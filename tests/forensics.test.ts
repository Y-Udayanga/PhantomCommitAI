import { describe, expect, it } from "vitest";
import {
  deletedArtifacts,
  maskSecrets,
  securityScan,
  timeline,
  safePath,
} from "../src/lib/forensics";
import { redactValue } from "../src/lib/redaction";
import {
  recoveryPatch,
  validateRecoveryPatch,
} from "../src/lib/server/recovery-patch";
import {
  extractDependencies,
  compareGraphs,
} from "../src/lib/server/dependencies";
import { dependents } from "../src/lib/graph-traversal";
import type { Commit, FileChange } from "../src/lib/types";
const file: FileChange = {
  file_path: "src/auth.ts",
  change_type: "modified",
  additions: 0,
  deletions: 1,
  diff_truncated: false,
  patch_excerpt: "@@ -1,3 +1,2 @@\n function route() {\n-  requireAuth();\n }",
};
const commit: Commit = {
  sha: "a".repeat(40),
  parent_shas: ["b".repeat(40)],
  message: "Adjust route",
  author_name: "Fixture",
  committed_at: "2026-01-01T00:00:00Z",
  html_url: "https://github.com/fixture/repo/commit/" + "a".repeat(40),
  files: [file],
};
describe("Git discovery and recovery", () => {
  it("finds deleted implementation by symbol, path and SHA with Git metadata", () => {
    for (const query of ["requireAuth", "auth.ts", commit.sha])
      expect(deletedArtifacts([commit], query)).toHaveLength(1);
    expect(deletedArtifacts([commit], "unrelated")).toEqual([]);
  });
  it("produces a unified patch checked against the exact selected snapshot", () => {
    const current = "function route() {\n}\n";
    const proposal = recoveryPatch(
      file,
      current,
      commit.sha,
      "b".repeat(40),
      "main",
    );
    expect(proposal.patch).toContain("+  requireAuth();");
    expect(proposal.proposed).toBe("function route() {\n  requireAuth();\n}\n");
    expect(validateRecoveryPatch(proposal.patch, file.file_path, current)).toBe(
      true,
    );
  });
  it("rejects stale contexts, truncated evidence, renamed paths and secrets", () => {
    expect(() =>
      recoveryPatch(file, "unrelated\n", commit.sha, commit.sha, "main"),
    ).toThrow();
    for (const f of [
      { ...file, diff_truncated: true },
      { ...file, previous_path: "old.ts" },
      {
        ...file,
        patch_excerpt: file.patch_excerpt + '\n-password = "realcredential"',
      },
    ])
      expect(() =>
        recoveryPatch(
          f,
          "function route() {\n}\n",
          commit.sha,
          commit.sha,
          "main",
        ),
      ).toThrow();
  });
  it("rejects unsafe paths, multiple targets and invalid unified diffs", () => {
    for (const p of ["../x", "/x", "a/../../x", "a\\x", "a\nx"])
      expect(safePath(p)).toBe(false);
    expect(() =>
      validateRecoveryPatch(
        "--- a/x\n+++ b/y\n@@ -1 +1 @@\n-a\n+b\n",
        "x",
        "a\n",
      ),
    ).toThrow();
    expect(() => validateRecoveryPatch("not a diff", "x", "")).toThrow();
  });
});
describe("security review rules", () => {
  it("detects auth, ownership, validation and database control removal", () => {
    for (const [text, category] of [
      ["requireAuth();", "authentication"],
      ["assertOwner(user);", "authorization"],
      ["schema.safeParse(input);", "validation"],
      ["alter table t enable row level security;", "database"],
    ]) {
      const c = {
        ...commit,
        files: [{ ...file, patch_excerpt: `@@ -1 +0,0 @@\n-${text}` }],
      };
      expect(securityScan(c).some((f) => f.category === category)).toBe(true);
    }
  });
  it("does not alert for comment-only removal or equivalent changed guard", () => {
    expect(
      securityScan({
        ...commit,
        files: [
          {
            ...file,
            patch_excerpt: "@@ -1 +1 @@\n-// requireAuth();\n+// moved note",
          },
        ],
      }),
    ).toEqual([]);
    expect(
      securityScan({
        ...commit,
        files: [
          {
            ...file,
            patch_excerpt:
              "@@ -1 +1 @@\n-requireAuth(req);\n+requireAuth(request);",
          },
        ],
      }),
    ).toEqual([]);
    expect(securityScan(commit, ["secrets"])).toEqual([]);
  });
  it("masks secrets before displaying finding evidence or nested reports", () => {
    const secret = 'api_key = "highlySensitiveCredential"';
    const findings = securityScan({
      ...commit,
      files: [{ ...file, patch_excerpt: `@@ -0,0 +1 @@\n+${secret}` }],
    });
    expect(findings[0].category).toBe("secrets");
    expect(JSON.stringify(findings)).not.toContain("highlySensitiveCredential");
    expect(
      redactValue({ nested: [{ text: secret }] }).nested[0].text,
    ).toContain("REDACTED");
    expect(maskSecrets("ghp_" + "a".repeat(30))).toBe("[REDACTED]");
  });
});
describe("dependency evidence", () => {
  it("resolves imports, exported calls, class construction and component usage", () => {
    const g = extractDependencies({
      "a.tsx": "export function Guard(){return null}; export class Gate {}",
      "b.tsx":
        "import {Guard, Gate} from './a'; export function Route(){ new Gate(); Guard(); return <Guard/> }",
    });
    expect(g.edges.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["imports", "constructs", "calls", "renders"]),
    );
    const call = g.edges.find((e) => e.kind === "calls")!;
    expect(call.source).toContain("Route");
    expect(call.target).toContain("Guard");
    expect(call.file).toBe("b.tsx");
  });
  it("does not invent edges for shadowed parameters, comments, dynamic calls or unsupported languages", () => {
    const g = extractDependencies({
      "a.ts":
        "function guard(){}; function test(guard:()=>void){guard()}; // fake()\nconst target = unknownLookup();",
      "x.py": "def fake(): pass",
    });
    expect(g.edges.filter((e) => e.kind === "calls")).toHaveLength(0);
    expect(g.nodes.some((n) => n.file === "x.py")).toBe(false);
    expect(g.limitations.join(" ")).toContain("dynamic");
  });
  it("compares relationships across snapshots without treating line shifts as additions", () => {
    const a = extractDependencies({
      "a.ts": "function a(){}; function b(){a()}",
    });
    const b = extractDependencies({
      "a.ts": "\nfunction a(){}; function b(){a()}",
    });
    expect(compareGraphs(a, b)).toEqual({ added: [], removed: [] });
    expect(
      compareGraphs(
        a,
        extractDependencies({ "a.ts": "function a(){}; function b(){}" }),
      ).removed.some((e) => e.kind === "calls"),
    ).toBe(true);
  });
  it("traverses direct and transitive dependents with cycle protection", () => {
    const edges = [
      { source: "b", target: "a" },
      { source: "c", target: "b" },
      { source: "a", target: "c" },
    ];
    expect([...dependents(edges, "a", false)]).toEqual(["a", "b"]);
    expect(dependents(edges, "a", true).size).toBe(3);
  });
});
describe("timeline provenance", () => {
  it("keeps recorded rename evidence and never infers feature origins from commit keywords alone", () => {
    const renamed = {
      ...commit,
      files: [{ ...file, change_type: "renamed", previous_path: "src/old.ts" }],
    };
    expect(timeline([renamed], "old.ts")[0]).toMatchObject({
      category: "renamed",
      previous: "src/old.ts",
    });
    expect(
      timeline([{ ...commit, message: "feature magic" }], "magic"),
    ).toEqual([]);
    expect(timeline([commit], "")).toEqual([]);
  });
});
