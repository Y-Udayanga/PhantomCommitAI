import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Commit, FileChange } from "../types";
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAt?: number,
  ) {
    super(message);
  }
}
type GitHubResult = {
  data: Awaited<ReturnType<Response["json"]>>;
  more: boolean;
};
type CachedResponse = GitHubResult & {
  etag: string | null;
  fetchedAt: number;
  bytes: number;
};
const responses = new Map<string, CachedResponse>();
const pending = new Map<string, Promise<GitHubResult>>();
const cooldowns = new Map<string, number>();
let cachedBytes = 0;
const cacheLimit = 8 * 1024 * 1024;

export function clearGitHubCache() {
  responses.clear();
  pending.clear();
  cooldowns.clear();
  cachedBytes = 0;
}
function remember(key: string, result: CachedResponse) {
  const previous = responses.get(key);
  if (previous) {
    cachedBytes -= previous.bytes;
    responses.delete(key);
  }
  if (result.bytes > cacheLimit) return;
  while (responses.size >= 100 || cachedBytes + result.bytes > cacheLimit) {
    const oldest = responses.keys().next().value;
    if (!oldest) break;
    cachedBytes -= responses.get(oldest)!.bytes;
    responses.delete(oldest);
  }
  responses.set(key, result);
  cachedBytes += result.bytes;
}
function retryTime(response: Response) {
  const now = Date.now();
  const retry = response.headers.get("retry-after");
  const seconds = retry === null ? NaN : Number(retry);
  const reset =
    response.headers.get("x-ratelimit-remaining") === "0"
      ? Number(response.headers.get("x-ratelimit-reset")) * 1000
      : NaN;
  const candidate = retry
    ? Number.isFinite(seconds)
      ? now + seconds * 1000
      : Date.parse(retry)
    : reset;
  return Number.isFinite(candidate) && candidate > now
    ? Math.min(candidate, now + 86400000)
    : now + 60000;
}
export async function github(
  path: string,
  options: { maxAgeSeconds?: number; token?: string } = {},
): Promise<GitHubResult> {
  const token = options.token || process.env.GITHUB_TOKEN?.trim();
  const credential = createHash("sha256")
    .update(token || "anonymous")
    .digest("hex");
  const key = credential + path;
  const cached = responses.get(key);
  if (
    cached &&
    options.maxAgeSeconds &&
    Date.now() - cached.fetchedAt < options.maxAgeSeconds * 1000
  )
    return { data: cached.data, more: cached.more };
  const blockedUntil = cooldowns.get(credential);
  if (blockedUntil && blockedUntil > Date.now())
    throw new ServiceError(
      429,
      "GitHub is temporarily rate limited. Saved evidence remains available.",
      blockedUntil,
    );
  if (pending.has(key)) return pending.get(key)!;
  const work = fetchGitHub(path, token, credential, key, cached);
  pending.set(key, work);
  try {
    return await work;
  } finally {
    pending.delete(key);
  }
}
async function fetchGitHub(
  path: string,
  token: string | undefined,
  credential: string,
  key: string,
  cached?: CachedResponse,
): Promise<GitHubResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
        },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
    } catch {
      if (!attempt) continue;
      throw new ServiceError(504, "GitHub timed out. Try again.");
    }
    if (response.status === 304 && cached) {
      cached.fetchedAt = Date.now();
      return { data: cached.data, more: cached.more };
    }
    if (response.status === 404) {
      if (cached) {
        responses.delete(key);
        cachedBytes -= cached.bytes;
      }
      throw new ServiceError(
        404,
        "Public repository or revision not found. Private repositories are not supported.",
      );
    }
    if (response.status === 409) return { data: [], more: false };
    if (response.status === 401)
      throw new ServiceError(
        token?.startsWith("ghu_") ? 401 : 503,
        token?.startsWith("ghu_")
          ? "Your GitHub connection expired or was revoked. Reconnect GitHub in Settings."
          : "GitHub authentication failed. An administrator must check the server GitHub token.",
      );
    if (response.status === 403 || response.status === 429) {
      const body = await response.json().catch(() => ({}));
      const limited =
        response.status === 429 ||
        response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after") ||
        /rate limit|abuse detection/i.test(body.message || "");
      if (!limited)
        throw new ServiceError(
          403,
          "GitHub denied access. Check repository visibility and the configured token permissions.",
        );
      const until = retryTime(response);
      if (cooldowns.size >= 4) cooldowns.delete(cooldowns.keys().next().value!);
      cooldowns.set(credential, until);
      throw new ServiceError(
        429,
        "GitHub is temporarily rate limited. Saved evidence remains available.",
        until,
      );
    }
    if (response.status >= 500 && !attempt) continue;
    if (!response.ok)
      throw new ServiceError(502, "GitHub could not complete this request.");
    const result = {
      data: await response.json(),
      more: response.headers.get("link")?.includes('rel="next"') || false,
    };
    remember(key, {
      ...result,
      etag: response.headers.get("etag"),
      fetchedAt: Date.now(),
      bytes: Buffer.byteLength(JSON.stringify(result)),
    });
    return result;
  }
  throw new ServiceError(502, "GitHub unavailable.");
}
const commitSchema = z.object({
  sha: z.string(),
  html_url: z.string().url(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string(), date: z.string() }).nullable(),
    committer: z.object({ date: z.string() }).nullable(),
  }),
  parents: z.array(z.object({ sha: z.string() })),
});
export function normalizeCommit(input: unknown): Commit {
  const c = commitSchema.parse(input);
  return {
    sha: c.sha,
    message: c.commit.message,
    author_name: c.commit.author?.name || "Unknown",
    committed_at:
      c.commit.committer?.date ||
      c.commit.author?.date ||
      new Date(0).toISOString(),
    html_url: c.html_url,
    parent_shas: c.parents.map((p) => p.sha),
  };
}
const fileSchema = z.object({
  filename: z.string(),
  previous_filename: z.string().optional(),
  status: z.string(),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string().optional(),
});
export function normalizeFile(input: unknown): FileChange {
  const f = fileSchema.parse(input);
  const cap = 12000;
  return {
    file_path: f.filename,
    previous_path: f.previous_filename,
    change_type: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch_excerpt: f.patch?.slice(0, cap) || null,
    diff_truncated: !f.patch || f.patch.length > cap,
  };
}
export async function commitDetails(
  owner: string,
  name: string,
  sha: string,
  token?: string,
): Promise<Commit> {
  const result = await github(
    `/repos/${owner}/${name}/commits/${sha}?per_page=100`,
    { token },
  );
  const data = result.data;
  return {
    ...normalizeCommit(data),
    files: z
      .array(z.unknown())
      .parse(data.files || [])
      .map(normalizeFile),
    files_incomplete: result.more,
  };
}
