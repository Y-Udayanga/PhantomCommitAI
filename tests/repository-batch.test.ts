import { expect, it, vi } from "vitest";
import {
  repositoryBatchURLs,
  type RepositoryCheckResult,
} from "../src/lib/repository-batch";
import { checkRepositoryBatch } from "../src/lib/server/repository-batch";
import { ServiceError } from "../src/lib/server/github";

const urls = ["a/one", "b/two", "c/three", "d/four"].map(
  (repo) => `https://github.com/${repo}`,
);
it("normalizes .git URLs and counts duplicate repositories once", () => {
  expect(
    repositoryBatchURLs(
      "https://github.com/Y-Udayanga/Debugliya.git\nhttps://github.com/y-udayanga/debugliya",
    ),
  ).toHaveLength(1);
});
it("checks all four repositories with at most two concurrent workers", async () => {
  let active = 0,
    max = 0;
  const check = vi.fn(async (url: string): Promise<RepositoryCheckResult> => {
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) =>
      setTimeout(resolve, url.includes("one") ? 20 : 5),
    );
    active--;
    return { url, status: "checked", commits: 20 };
  });
  const results = await checkRepositoryBatch(urls, check);
  expect(check).toHaveBeenCalledTimes(4);
  expect(max).toBe(2);
  expect(results.map((r) => r.url)).toEqual(urls);
  expect(results.every((r) => r.status === "checked")).toBe(true);
});
it("preserves successful checks when another repository is limited", async () => {
  const check = vi.fn(async (url: string): Promise<RepositoryCheckResult> => {
    if (url.includes("two"))
      throw new ServiceError(429, "GitHub cooldown", 1800000000000);
    return { url, status: "checked", commits: 5 };
  });
  const results = await checkRepositoryBatch(urls, check);
  expect(results.filter((r) => r.status === "checked")).toHaveLength(3);
  expect(results[1]).toMatchObject({
    status: "error",
    message: "GitHub cooldown",
    retry_at: new Date(1800000000000).toISOString(),
  });
});
it("rejects a fifth unique repository and unsafe URLs before any upstream work", async () => {
  const check = vi.fn();
  await expect(
    checkRepositoryBatch([...urls, "https://github.com/e/five"], check),
  ).rejects.toThrow("4 repositories");
  await expect(
    checkRepositoryBatch(["https://github.com@evil.example/a/b"], check),
  ).rejects.toThrow();
  expect(check).not.toHaveBeenCalled();
});
it("does not return private exception details", async () => {
  const results = await checkRepositoryBatch([urls[0]], async () => {
    throw new Error("private row data");
  });
  expect(results[0].message).not.toContain("private row data");
});
