import { it, expect } from "vitest";
import { selectContext, filterEvidence } from "../src/lib/context";
import { demoCommits } from "./fixtures/history";
it("file and date filters restrict evidence without inventing missing history", () => {
  expect(
    filterEvidence(demoCommits, { since: "2026-10-23", until: "2026-10-23" }),
  ).toHaveLength(1);
  const filtered = filterEvidence(demoCommits, { file: "AUTH" });
  expect(filtered).toHaveLength(1);
  expect(filtered[0].files?.every((f) => f.file_path.includes("auth"))).toBe(
    true,
  );
  expect(
    filterEvidence(demoCommits, { file: "not-a-real-module" }),
  ).toHaveLength(0);
  expect(filterEvidence(demoCommits, { since: "2027-01-01" })).toHaveLength(0);
});
it("bounds valid JSON and excludes unselected database columns and joins", () => {
  const input = Array.from({ length: 10 }, (_, i) => ({
    ...demoCommits[0],
    sha: i.toString(16).padStart(40, "a"),
    private_debug: "do not send",
    file_changes: [{ patch_excerpt: "unbounded join" }],
    files: Array.from({ length: 10 }, () => ({
      ...demoCommits[0].files![0],
      patch_excerpt: "x".repeat(12000),
    })),
  }));
  const context = selectContext(input, "session");
  const json = JSON.stringify(context);
  expect(json.length).toBeLessThanOrEqual(40000);
  expect(context.length).toBeLessThanOrEqual(5);
  expect(json).not.toContain("private_debug");
  expect(json).not.toContain("file_changes");
  expect(context[0].files?.[0].patch_excerpt?.length).toBe(4500);
  expect(context[0].files?.[0].diff_truncated).toBe(true);
  expect(context[0].files_incomplete).toBe(true);
});
