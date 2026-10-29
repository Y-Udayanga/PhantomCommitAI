import type { Commit } from "./types";
import { rankCommits } from "./analysis";
import type { InvestigationScope } from "./ai-tasks";

export function filterEvidence(
  commits: Commit[],
  scope: InvestigationScope,
): Commit[] {
  return commits
    .filter(
      (c) =>
        (!scope.since || c.committed_at.slice(0, 10) >= scope.since) &&
        (!scope.until || c.committed_at.slice(0, 10) <= scope.until),
    )
    .map((c) => ({
      ...c,
      files: c.files?.filter(
        (f) =>
          !scope.file ||
          f.file_path.toLowerCase().includes(scope.file.toLowerCase()),
      ),
    }))
    .filter((c) => !scope.file || !!c.files?.length);
}

/** Select only explicit evidence fields; never serialize arbitrary database joins. */
export function selectContext(
  commits: Commit[],
  question: string,
  budget = 40000,
): Commit[] {
  const selected: Commit[] = [];
  for (const { commit } of rankCommits(commits, question).slice(0, 5)) {
    const candidate: Commit = {
      sha: commit.sha,
      message: commit.message.slice(0, 2000),
      author_name: commit.author_name.slice(0, 100),
      committed_at: commit.committed_at,
      html_url: commit.html_url,
      parent_shas: commit.parent_shas.slice(0, 2),
      files_incomplete:
        commit.files_incomplete || (commit.files?.length || 0) > 8,
      files: commit.files?.slice(0, 8).map((f) => ({
        file_path: f.file_path,
        previous_path: f.previous_path,
        change_type: f.change_type,
        additions: f.additions,
        deletions: f.deletions,
        patch_excerpt: f.patch_excerpt?.slice(0, 4500) || null,
        diff_truncated:
          f.diff_truncated || (f.patch_excerpt?.length || 0) > 4500,
      })),
    };
    while (
      JSON.stringify([...selected, candidate]).length > budget &&
      candidate.files?.length
    ) {
      candidate.files.pop();
      candidate.files_incomplete = true;
    }
    if (JSON.stringify([...selected, candidate]).length <= budget)
      selected.push(candidate);
  }
  return selected;
}
