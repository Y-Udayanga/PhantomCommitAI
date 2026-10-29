import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { ServiceError } from "./github";

export const githubSessionCookie = "phantom-github-session";
export const githubStateCookie = "phantom-github-state";
export class GitHubAuthorizationError extends ServiceError {
  constructor(public reason: "configuration" | "expired_code" | "provider") {
    super(502, "GitHub authorization could not be completed.");
  }
}
const sessionSchema = z.object({
  owner: z.string().uuid(),
  token: z.string().min(20).max(512),
  login: z.string().max(100),
  expiresAt: z.number(),
});
const stateSchema = z.object({
  owner: z.string().uuid(),
  state: z.string(),
  verifier: z.string(),
  expiresAt: z.number(),
});

export function githubAppConfigured() {
  return !!(
    process.env.GITHUB_APP_CLIENT_ID &&
    process.env.GITHUB_APP_CLIENT_SECRET &&
    process.env.GITHUB_APP_COOKIE_SECRET &&
    Buffer.from(process.env.GITHUB_APP_COOKIE_SECRET, "base64url").length === 32
  );
}
function encryptionKey() {
  const key = Buffer.from(
    process.env.GITHUB_APP_COOKIE_SECRET || "",
    "base64url",
  );
  if (key.length !== 32)
    throw new ServiceError(503, "GitHub App connection is not configured.");
  return key;
}
export function sealGitHubCookie(data: unknown, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openGitHubCookie(
  value: string | undefined,
  purpose: string,
): unknown {
  if (!value || value.length > 4096) return null;
  try {
    const bytes = Buffer.from(value, "base64url"),
      decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey(),
        bytes.subarray(0, 12),
      );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    return null;
  }
}
export function newGitHubAuthorization(owner: string, origin: string) {
  if (!githubAppConfigured())
    throw new ServiceError(503, "GitHub App connection is not configured.");
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.GITHUB_APP_CLIENT_ID!,
    redirect_uri: origin + "/api/github/callback",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: "offline_access",
  }).toString();
  return {
    url: url.toString(),
    cookie: sealGitHubCookie(
      { owner, state, verifier, expiresAt: Date.now() + 600000 },
      "state",
    ),
  };
}
export function validateGitHubState(
  cookie: string | undefined,
  state: string,
  owner: string,
) {
  const result = stateSchema.safeParse(openGitHubCookie(cookie, "state"));
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !result.success ||
    result.data.owner !== owner ||
    result.data.expiresAt <= Date.now() ||
    state.length !== result.data.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(result.data.state))
  )
    throw new ServiceError(
      400,
      "GitHub authorization expired or could not be verified. Connect again.",
    );
  return result.data.verifier;
}
export async function exchangeGitHubCode(
  code: string,
  verifier: string,
  origin: string,
) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_APP_CLIENT_ID!.trim(),
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET!.trim(),
      code,
      code_verifier: verifier,
      redirect_uri: origin + "/api/github/callback",
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const payload = await response.json();
  if (
    payload?.error === "incorrect_client_credentials" ||
    payload?.error === "redirect_uri_mismatch"
  )
    throw new GitHubAuthorizationError("configuration");
  if (payload?.error === "bad_verification_code")
    throw new GitHubAuthorizationError("expired_code");
  if (!response.ok || payload?.error)
    throw new GitHubAuthorizationError("provider");
  // Keep only the short-lived access token. Refresh tokens are intentionally not retained.
  const parsed = z
    .object({
      access_token: z.string().min(20).max(512),
      expires_in: z.number().int().min(60).max(86400),
      token_type: z.literal("bearer"),
    })
    .safeParse(payload);
  if (!parsed.success)
    throw new ServiceError(
      502,
      "GitHub authorization failed. Check the App configuration and try again.",
    );
  return {
    token: parsed.data.access_token,
    expiresAt: Date.now() + parsed.data.expires_in * 1000 - 30000,
  };
}
export function readGitHubSession(value: string | undefined, owner: string) {
  const parsed = sessionSchema.safeParse(openGitHubCookie(value, "session"));
  return parsed.success &&
    parsed.data.owner === owner &&
    parsed.data.expiresAt > Date.now()
    ? parsed.data
    : null;
}
export async function userGitHubCredential(owner: string) {
  if (!githubAppConfigured()) {
    if (process.env.GITHUB_AUTH_MODE === "app")
      throw new ServiceError(503, "The GitHub App is not configured yet.");
    return undefined;
  }
  const session = readGitHubSession(
    (await cookies()).get(githubSessionCookie)?.value,
    owner,
  );
  if (!session)
    throw new ServiceError(
      403,
      "Connect your GitHub account in Settings to check repositories. Saved investigations remain available.",
    );
  return session.token;
}
export function githubCookieOptions(origin: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(origin).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
