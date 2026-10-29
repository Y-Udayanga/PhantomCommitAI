import { changedLines } from "./analysis";
import type { Commit, FileChange } from "./types";
import { maskSecrets } from "./redaction";
export { maskSecrets } from "./redaction";

/** Redaction is deliberately conservative; it is not a full secret scanner. */
export function safeCommit(commit: Commit): Commit {
  return {
    ...commit,
    message: maskSecrets(commit.message),
    files: commit.files?.map((f) => ({
      ...f,
      patch_excerpt:
        f.patch_excerpt === null ? null : maskSecrets(f.patch_excerpt),
    })),
  };
}
export function safePath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 500 &&
    !/[\x00-\x1f\\:"<>|]/.test(path) &&
    !path.startsWith("/") &&
    !path.split("/").some((p) => !p || p === "." || p === "..")
  );
}
export type SecurityFinding = {
  id: string;
  title: string;
  category: string;
  severity: "high" | "medium";
  confidence: "review required";
  sha: string;
  file: string;
  line: number;
  evidence: string;
  method: "diff rule";
  remediation: string;
};
const rules = [
  {
    category: "authentication",
    pattern:
      /\b(?:requireAuth|authenticate|verifyToken|verifySession|getUser)\s*\(/,
    remediation:
      "Verify unauthenticated requests are rejected by the target route and its middleware.",
  },
  {
    category: "authorization",
    pattern:
      /\b(?:authorize|checkPermission|requireRole|assertOwner)\s*\(|\b(?:owner_id|user_id)\s*!==?\s*/,
    remediation:
      "Test cross-user, cross-tenant and non-admin access at the changed boundary.",
  },
  {
    category: "validation",
    pattern:
      /\.(?:safeParse|parse)\s*\(|\b(?:sanitize|validateInput|escapeHtml)\s*\(/,
    remediation:
      "Send malformed and adversarial inputs and verify equivalent validation remains.",
  },
  {
    category: "headers",
    pattern:
      /(?:Content-Security-Policy|X-Frame-Options|csrfProtection|helmet\s*\()/i,
    remediation:
      "Verify browser security headers and CSRF protection at the deployed boundary.",
  },
  {
    category: "database",
    pattern: /enable\s+row\s+level\s+security|create\s+policy/i,
    remediation:
      "Inspect resulting grants and policies with two tenant identities; test denied reads and writes.",
  },
] as const;
export function securityScan(commit: Commit, categories: string[] = []) {
  const findings: SecurityFinding[] = [];
  for (const f of commit.files || []) {
    const lines = changedLines(f).filter(
      (l) => !/^\s*(?:\/\/|\*|--)/.test(l.text),
    );
    const added = lines.filter((l) => l.side === "new");
    for (const rule of rules) {
      if (!/\.(?:[cm]?[jt]sx?|sql)$/.test(f.file_path)) continue;
      if (categories.length && !categories.includes(rule.category)) continue;
      const removed = lines.find(
        (l) => l.side === "old" && rule.pattern.test(l.text),
      );
      if (removed && !added.some((l) => rule.pattern.test(l.text)))
        findings.push({
          id: `${f.file_path}:${rule.category}:${removed.line}`,
          title: `Potential ${rule.category} protection removal`,
          category: rule.category,
          severity:
            rule.category === "authorization" || rule.category === "database"
              ? "high"
              : "medium",
          confidence: "review required",
          sha: commit.sha,
          file: f.file_path,
          line: removed.line,
          evidence: maskSecrets(removed.text),
          method: "diff rule",
          remediation: rule.remediation,
        });
    }
    for (const line of added) {
      const category =
        maskSecrets(line.text) !== line.text
          ? "secrets"
          : /disable\s+row\s+level\s+security|drop\s+policy/i.test(line.text)
            ? "database"
            : /\beval\s*\(|\bexec\s*\(\s*`|dangerouslySetInnerHTML/.test(
                  line.text,
                )
              ? "unsafe-sink"
              : "";
      if (!category || (categories.length && !categories.includes(category)))
        continue;
      findings.push({
        id: `${f.file_path}:${category}:${line.line}`,
        title: `Potential ${category} risk introduced`,
        category,
        severity: "high",
        confidence: "review required",
        sha: commit.sha,
        file: f.file_path,
        line: line.line,
        evidence: maskSecrets(line.text),
        method: "diff rule",
        remediation:
          "Review data flow and reachability, reproduce safely, and add a negative security test. Rotate credentials if a real secret was committed.",
      });
    }
  }
  return findings.slice(0, 100);
}
export type TimelineEvent = {
  sha: string;
  parent?: string;
  date: string;
  author: string;
  message: string;
  file: string;
  previous?: string;
  category: string;
  evidence: string;
  url: string;
  certainty: string;
};
export function timeline(commits: Commit[], query: string): TimelineEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [...commits]
    .sort((a, b) => a.committed_at.localeCompare(b.committed_at))
    .flatMap((c) =>
      (c.files || [])
        .filter(
          (f) =>
            [f.file_path, f.previous_path || ""].some((p) =>
              p.toLowerCase().includes(q),
            ) ||
            changedLines(f).some((l) => l.text.toLowerCase().includes(q)) ||
            c.sha === q,
        )
        .map((f) => ({
          sha: c.sha,
          parent: c.parent_shas[0],
          date: c.committed_at,
          author: c.author_name,
          message: maskSecrets(c.message),
          file: f.file_path,
          previous: f.previous_path,
          category:
            f.change_type === "renamed"
              ? "renamed"
              : f.change_type === "added"
                ? "introduced in scope"
                : f.change_type === "removed"
                  ? "removed"
                  : "modified",
          certainty:
            "Verified file change; feature association is a search lead, not semantic identity.",
          evidence: maskSecrets(f.patch_excerpt || "Patch unavailable"),
          url: c.html_url,
        })),
    )
    .slice(0, 100);
}
export function deletedArtifacts(commits: Commit[], query: string) {
  const q = query.toLowerCase();
  return commits
    .flatMap((c) =>
      (c.files || [])
        .filter((f) => f.deletions > 0 || f.change_type === "removed")
        .filter(
          (f) =>
            !q ||
            [
              f.file_path,
              f.previous_path || "",
              c.sha,
              ...changedLines(f)
                .filter((l) => l.side === "old")
                .map((l) => l.text),
            ].some((v) => v.toLowerCase().includes(q)),
        )
        .map((f) => ({
          commit: safeCommit({ ...c, files: undefined }),
          file: {
            ...f,
            patch_excerpt: maskSecrets(f.patch_excerpt || ""),
          } as FileChange,
        })),
    )
    .slice(0, 100);
}
