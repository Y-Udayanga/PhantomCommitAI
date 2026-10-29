import { it, expect, vi, afterEach, describe } from "vitest";
import {
  github,
  normalizeCommit,
  normalizeFile,
  commitDetails,
  clearGitHubCache,
} from "../src/lib/server/github";
afterEach(() => {
  clearGitHubCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const raw = {
  sha: "a".repeat(40),
  html_url: "https://github.com/test/repo/commit/" + "a".repeat(40),
  commit: {
    message: "remove validator",
    author: { name: "Alex", date: "2026-10-24T00:00:00Z" },
    committer: { date: "2026-10-24T00:00:00Z" },
  },
  parents: [{ sha: "b".repeat(40) }],
};
describe("GitHub boundary", () => {
  it("normalizes metadata without inventing intent", () =>
    expect(normalizeCommit(raw)).toMatchObject({
      sha: raw.sha,
      message: "remove validator",
      parent_shas: ["b".repeat(40)],
    }));
  it("bounds patch storage and marks truncation", () =>
    expect(
      normalizeFile({
        filename: "a.ts",
        status: "modified",
        additions: 1,
        deletions: 5,
        patch: "x".repeat(15000),
      }),
    ).toMatchObject({
      patch_excerpt: "x".repeat(12000),
      diff_truncated: true,
    }));
  it("handles missing patches and renames", () =>
    expect(
      normalizeFile({
        filename: "new.ts",
        previous_filename: "old.ts",
        status: "renamed",
        additions: 0,
        deletions: 0,
      }),
    ).toMatchObject({
      previous_path: "old.ts",
      patch_excerpt: null,
      diff_truncated: true,
    }));
  it("surfaces rate limits without retry storms", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 403,
        headers: {
          "x-ratelimit-reset": "1800000000",
          "x-ratelimit-remaining": "0",
        },
      }),
    );
    vi.stubGlobal("fetch", mock);
    await expect(github("/repos/a/b")).rejects.toMatchObject({ status: 429 });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("handles empty repositories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 409 })),
    );
    expect((await github("/repos/a/b/commits")).data).toEqual([]);
  });
  it("retries temporary failures at most once", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", f);
    await expect(github("/repos/a/b")).rejects.toMatchObject({ status: 502 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("preserves incomplete file pagination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...raw, files: [] }), {
          headers: { link: '<https://api.github.com/page2>; rel="next"' },
        }),
      ),
    );
    expect(
      (await commitDetails("test", "repo", raw.sha)).files_incomplete,
    ).toBe(true);
  });
});
it.skipIf(!process.env.RUN_LIVE_GITHUB)(
  "reads actual public GitHub metadata",
  async () => {
    const r = await github("/repos/octocat/Hello-World");
    expect(r.data.full_name).toBe("octocat/Hello-World");
  },
);

it("coalesces parallel identical calls and revalidates cached metadata with ETags", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ full_name: "a/b", private: false }), {
        headers: {
          etag: '"v1"',
          link: '<https://api.github.com/page2>; rel="next"',
        },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", f);
  const [a, b] = await Promise.all([
    github("/repos/a/b"),
    github("/repos/a/b"),
  ]);
  expect(f).toHaveBeenCalledTimes(1);
  expect(a).toEqual(b);
  expect(await github("/repos/a/b")).toEqual(a);
  expect(f.mock.calls[1][1].headers["If-None-Match"]).toBe('"v1"');
});
it("uses a bounded fresh cache only when explicitly requested", async () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  const f = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response("[]")));
  vi.stubGlobal("fetch", f);
  await github("/repos/a/b/branches", { maxAgeSeconds: 30 });
  await github("/repos/a/b/branches", { maxAgeSeconds: 30 });
  expect(f).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(now + 31000);
  await github("/repos/a/b/branches", { maxAgeSeconds: 30 });
  expect(f).toHaveBeenCalledTimes(2);
});
it("honors secondary cooldowns across paths without issuing repeated upstream calls", async () => {
  const now = Date.now();
  const f = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ message: "secondary rate limit" }), {
      status: 403,
      headers: { "retry-after": "120" },
    }),
  );
  vi.stubGlobal("fetch", f);
  await expect(github("/repos/a/b")).rejects.toMatchObject({
    status: 429,
    retryAt: expect.any(Number),
  });
  await expect(github("/repos/c/d")).rejects.toMatchObject({ status: 429 });
  expect(f).toHaveBeenCalledTimes(1);
  try {
    await github("/repos/a/b");
  } catch (e) {
    expect((e as { retryAt: number }).retryAt).toBeGreaterThanOrEqual(
      now + 120000,
    );
  }
});
it("distinguishes forbidden and invalid-token errors from exhausted quota", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Resource not accessible" }), {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "100",
          "x-ratelimit-reset": "1800000000",
        },
      }),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", f);
  await expect(github("/repos/a/b")).rejects.toMatchObject({ status: 403 });
  await expect(github("/repos/c/d")).rejects.toMatchObject({ status: 503 });
  expect(f).toHaveBeenCalledTimes(2);
});
it("partitions cached public responses by configured credential", async () => {
  const f = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response("[]")));
  vi.stubGlobal("fetch", f);
  await github("/repos/a/b/branches", { maxAgeSeconds: 60 });
  vi.stubEnv("GITHUB_TOKEN", "test-only-public-token");
  await github("/repos/a/b/branches", { maxAgeSeconds: 60 });
  expect(f).toHaveBeenCalledTimes(2);
  expect(f.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer test-only-public-token",
  );
});

it("uses a short secondary cooldown even when a primary reset header is present", async () => {
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "secondary rate limit" }), {
          status: 403,
          headers: {
            "x-ratelimit-reset": String(Math.ceil(now / 1000) + 3600),
            "x-ratelimit-remaining": "100",
          },
        }),
      ),
  );
  await expect(github("/repos/a/b")).rejects.toMatchObject({
    status: 429,
    retryAt: now + 60000,
  });
});
it("resumes upstream requests after cooldown and never serves stale metadata on 404", async () => {
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ private: false }), {
        headers: { etag: '"v1"' },
      }),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", f);
  await expect(github("/repos/a/b")).rejects.toMatchObject({ status: 429 });
  clock.mockReturnValue(now + 1001);
  expect((await github("/repos/a/b")).data.private).toBe(false);
  await expect(github("/repos/a/b")).rejects.toMatchObject({ status: 404 });
  expect(f).toHaveBeenCalledTimes(3);
});
