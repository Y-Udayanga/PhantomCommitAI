import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Commit, Repository } from "../types";
import {
  deletedArtifacts,
  maskSecrets,
  safeCommit,
  safePath,
  securityScan,
  timeline,
} from "../forensics";
import {
  github as githubRequest,
  normalizeCommit,
  normalizeFile,
  ServiceError,
} from "./github";
import { checkDb } from "./supabase";
import { recoveryPatch } from "./recovery-patch";
import { analyze } from "./analysis-service";
import { redactValue } from "../redaction";
import { dependents } from "../graph-traversal";
const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const forensicInput = z.object({
  kind: z.enum(["recovery", "impact", "security", "timeline"]),
  branch: z.string().trim().min(1).max(250),
  base: sha.optional(),
  head: sha.optional(),
  source: sha.optional(),
  file: z.string().max(500).refine(safePath).optional(),
  query: z.string().max(150).default(""),
  paths: z.array(z.string().refine(safePath)).max(12).default([]),
  categories: z
    .array(
      z.enum([
        "authentication",
        "authorization",
        "validation",
        "headers",
        "database",
        "secrets",
        "unsafe-sink",
      ]),
    )
    .max(7)
    .default([]),
  page: z.number().int().min(1).max(100).default(1),
  ai: z.boolean().default(false),
  consent: z.boolean().default(false),
});
export async function runForensics(
  input: z.infer<typeof forensicInput>,
  repository: Repository,
  services: {
    github: typeof githubRequest;
    detail: (repository: Repository, sha: string) => Promise<Commit>;
  },
) {
  const { github, detail } = services;
  if (input.ai && !input.consent)
    throw new ServiceError(
      400,
      "Consent is required before sending evidence to Google.",
    );
  const root = `/repos/${repository.github_owner}/${repository.github_name}`;
  const notices: string[] = [
    "Bounded public GitHub evidence; missing patches, API pagination and uninspected history can hide relevant changes.",
  ];
  const head =
    input.head ||
    normalizeCommit(
      (
        await github(`${root}/commits/${encodeURIComponent(input.branch)}`, {
          maxAgeSeconds: 30,
        })
      ).data,
    ).sha;
  let evidence: Commit[] = [];
  async function snapshot(ref: string, path: string, allowMissing = false) {
    try {
      const r = await github(
        `${root}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${ref}`,
        { maxAgeSeconds: 60 },
      );
      if (
        r.data.type !== "file" ||
        r.data.encoding !== "base64" ||
        r.data.size > 150000
      )
        throw new ServiceError(422, "Snapshot is binary or exceeds 150 KB.");
      const text = Buffer.from(r.data.content, "base64").toString("utf8");
      if (text.includes("\0") || text.length > 150000)
        throw new ServiceError(422, "Snapshot cannot be parsed safely.");
      return text;
    } catch (e) {
      if (allowMissing && e instanceof ServiceError && e.status === 404)
        return null;
      throw e;
    }
  }
  let output: Record<string, unknown> = {};
  if (
    (input.kind === "recovery" && !input.source) ||
    input.kind === "timeline"
  ) {
    const r = await github(
      `${root}/commits?sha=${head}&per_page=5&page=${input.page}`,
      { maxAgeSeconds: 30 },
    );
    for (const c of r.data as unknown[])
      evidence.push(await detail(repository, normalizeCommit(c).sha));
    if (input.base) {
      const comparison = await github(
        `${root}/compare/${input.base}...${head}?per_page=100`,
      );
      const inRange = new Set(
        (comparison.data.commits as { sha: string }[]).map((c) => c.sha),
      );
      evidence = evidence.filter((c) => inRange.has(c.sha));
      notices.push(
        "Range intersection uses the first 100 comparison commits; branch history is paginated separately.",
      );
    }
    output =
      input.kind === "timeline"
        ? { events: timeline(evidence, input.query) }
        : { artifacts: deletedArtifacts(evidence, input.query) };
    output.more = r.more;
    output.page = input.page;
    notices.push(
      "Search covers this five-commit page. Load subsequent pages for additional evidence. Keyword associations do not prove feature identity.",
    );
  } else if (input.kind === "recovery") {
    if (!input.source || !input.file)
      throw new ServiceError(400, "Select a deletion and file.");
    const deletion = await detail(repository, input.source);
    const file = deletion.files?.find((f) => f.file_path === input.file);
    if (!file || !deletion.parent_shas[0])
      throw new ServiceError(
        422,
        "Historical file or parent evidence is unavailable.",
      );
    const historical = await snapshot(
      deletion.parent_shas[0],
      file.previous_path || file.file_path,
    );
    const current = await snapshot(head, file.file_path, true);
    evidence = [deletion];
    output = {
      historical: maskSecrets(historical || ""),
      current: maskSecrets(current || ""),
      file: file.file_path,
      source: input.source,
      historicalRef: deletion.parent_shas[0],
      base: head,
      branch: input.branch,
    };
    if (current === null && file.change_type !== "removed")
      notices.push(
        "The current file is missing; manual placement is required.",
      );
    else
      try {
        output.proposal = recoveryPatch(
          file,
          current || "",
          input.source,
          head,
          input.branch,
        );
      } catch (error) {
        notices.push(
          error instanceof Error
            ? error.message
            : "No reliable patch could be generated.",
        );
      }
    notices.push(
      "Proposal reverses the entire selected historical file change. It is not an AI-authored compatibility fix; Gemma reviews the strategy separately. No Git writes are available.",
    );
  } else {
    if (!input.base) throw new ServiceError(400, "Select a base commit.");
    const r = await github(
      `${root}/compare/${input.base}...${head}?per_page=100`,
    );
    if (r.data.status === "diverged" || r.data.status === "behind")
      throw new ServiceError(
        422,
        "Choose an ancestor base: GitHub compare uses the merge base for diverged branches.",
      );
    const files = (r.data.files || []).slice(0, 100).map(normalizeFile);
    const target = await detail(repository, head);
    evidence = [{ ...target, files }];
    notices.push(
      "Comparison uses at most 100 changed files; patches are bounded to 12,000 characters each. Missing context limits rule coverage.",
    );
    if (input.kind === "security") {
      output = {
        findings: securityScan(evidence[0], input.categories),
        base: input.base,
        head,
      };
      notices.push(
        "Focused diff heuristics; removed checks may exist elsewhere. No exploitability or complete security coverage is established. JS/TS and SQL patterns only; comments and multiline constructs can evade or confuse rules.",
      );
    } else {
      const { extractDependencies, compareGraphs } =
        await import("./dependencies");
      const paths = input.paths.length
        ? input.paths
        : files
            .map((f: { file_path: string }) => f.file_path)
            .filter((p: string) => /\.[cm]?[jt]sx?$/.test(p))
            .slice(0, 12);
      const before: Record<string, string> = {},
        after: Record<string, string> = {};
      let budget = 0;
      for (let offset = 0; offset < paths.length; offset += 3) {
        const batch = await Promise.all(
          paths.slice(offset, offset + 3).map(async (path: string) => {
            if (!safePath(path)) return { path, snapshots: [null, null] };
            const snapshots = await Promise.all([
              snapshot(input.base!, path, true),
              snapshot(head, path, true),
            ]);
            return { path, snapshots };
          }),
        );
        for (const { path, snapshots } of batch) {
          if (!safePath(path)) continue;
          for (const [index, ref, destination] of [
            [0, input.base, before],
            [1, head, after],
          ] as const) {
            const text = snapshots[index];
            if (text !== null && budget + text.length <= 600000) {
              destination[path] = text;
              budget += text.length;
            } else
              notices.push(
                `Skipped missing or over-budget snapshot: ${path} at ${ref.slice(0, 7)}.`,
              );
          }
        }
      }
      const graph = extractDependencies(after),
        previous = extractDependencies(before);
      const selected = graph.nodes.find(
        (n) => n.label === input.query || n.id === input.query,
      );
      const semanticEdges = graph.edges.filter((e) => e.kind !== "contains");
      const affected = selected
        ? dependents(semanticEdges, selected.id, true)
        : new Set<string>();
      const impact = selected
        ? {
            selected,
            direct: graph.nodes.filter((n) =>
              semanticEdges.some(
                (e) => e.source === n.id && e.target === selected.id,
              ),
            ),
            transitive: graph.nodes.filter(
              (n) => affected.has(n.id) && n.id !== selected.id,
            ),
          }
        : undefined;
      output = {
        impact,
        graph,
        previous,
        changes: compareGraphs(previous, graph),
        base: input.base,
        head,
      };
      notices.push(
        ...graph.limitations,
        "Selected paths are identical in both snapshots; rename paths may need explicit inclusion. Default scope contains changed files only. Add callers and imported modules explicitly.",
      );
    }
  }
  let ai: unknown;
  if (input.ai) {
    // Keep both snapshots and selected dependents visible within the existing 8K history envelope.
    const aiContext =
      input.kind === "recovery" && input.source
        ? {
            file: output.file,
            source: output.source,
            base: head,
            historical: String(output.historical || "").slice(0, 2200),
            current: String(output.current || "").slice(0, 2200),
            proposal: output.proposal
              ? "Validated inverse file change; developer review required."
              : "No reliable patch",
            notices,
          }
        : output;
    const summary = maskSecrets(JSON.stringify(aiContext)).slice(0, 7000);
    ai = await analyze(
      "gemma",
      `Explain ${input.kind}. Query: ${maskSecrets(input.query)}. Separate verified observations, uncertain associations and possible consequences. Discuss compatibility, equivalent implementations, obsolete dependencies and tests; motives are unknown unless documented. Read-only proposal.`,
      input.kind === "security"
        ? "security-drift"
        : input.kind === "impact"
          ? "impact"
          : input.kind === "timeline"
            ? "time-machine"
            : "restore",
      evidence.map(safeCommit),
      [
        {
          role: "user",
          content: `UNTRUSTED STATIC ANALYSIS AND SNAPSHOTS (partial): ${summary}`,
        },
      ],
    );
  }
  return redactValue({
    kind: input.kind,
    repository: repository.full_name,
    branch: input.branch,
    head,
    ...output,
    ai,
    notices,
    created_at: new Date().toISOString(),
  });
}
export async function forensicRecords(
  db: SupabaseClient,
  repository: Repository,
  owner: string,
) {
  const r = await db
    .from("forensic_investigations")
    .select("id,kind,result,review,created_at,expires_at")
    .eq("repository_id", repository.id)
    .eq("owner_id", owner)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  checkDb(r.error);
  return r.data;
}
