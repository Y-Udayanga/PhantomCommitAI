import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  exchangeGitHubCode,
  githubCookieOptions,
  newGitHubAuthorization,
  openGitHubCookie,
  readGitHubSession,
  sealGitHubCookie,
  userGitHubCredential,
  validateGitHubState,
} from "../src/lib/server/github-app";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "test-only-secret");
  vi.stubEnv(
    "GITHUB_APP_COOKIE_SECRET",
    Buffer.alloc(32, 7).toString("base64url"),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("uses state, an exact callback and S256 PKCE for user authorization", () => {
  const auth = newGitHubAuthorization(owner, "https://example.com"),
    url = new URL(auth.url);
  const verifier = validateGitHubState(
    auth.cookie,
    url.searchParams.get("state")!,
    owner,
  );
  expect(url.searchParams.get("redirect_uri")).toBe(
    "https://example.com/api/github/callback",
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBe(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  expect(() =>
    validateGitHubState(auth.cookie, url.searchParams.get("state")!, other),
  ).toThrow();
  expect(() => validateGitHubState(auth.cookie, "bad-state", owner)).toThrow();
});
it("encrypts credentials and rejects tampering, swapped cookie purposes and another owner", () => {
  const token = "test-user-token-" + "x".repeat(30);
  const sealed = sealGitHubCookie(
    { owner, token, login: "test", expiresAt: Date.now() + 60000 },
    "session",
  );
  expect(sealed).not.toContain(token);
  expect(sealed).not.toContain(owner);
  expect(readGitHubSession(sealed, owner)?.token).toBe(token);
  expect(readGitHubSession(sealed, other)).toBeNull();
  expect(openGitHubCookie(sealed, "state")).toBeNull();
  expect(openGitHubCookie("A" + sealed.slice(1), "session")).toBeNull();
  expect(
    readGitHubSession(
      sealGitHubCookie(
        { owner, token, login: "test", expiresAt: Date.now() - 1 },
        "session",
      ),
      owner,
    ),
  ).toBeNull();
});
it("requires a user's own connection and never falls back to a shared token in App mode", async () => {
  vi.stubEnv("GITHUB_TOKEN", "shared-token-that-must-not-be-used");
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
  await expect(userGitHubCredential(owner)).rejects.toMatchObject({
    status: 403,
  });
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "");
  vi.stubEnv("GITHUB_AUTH_MODE", "app");
  await expect(userGitHubCredential(owner)).rejects.toMatchObject({
    status: 503,
  });
});
it("keeps OAuth secrets out of URLs and retains only expiring access tokens", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: "ghu_" + "x".repeat(40),
        expires_in: 28800,
        token_type: "bearer",
        refresh_token: "not-retained",
      }),
    ),
  );
  vi.stubGlobal("fetch", f);
  const result = await exchangeGitHubCode(
    "code",
    "verifier",
    "https://example.com",
  );
  expect(result).not.toHaveProperty("refresh_token");
  expect(f.mock.calls[0][0]).toBe(
    "https://github.com/login/oauth/access_token",
  );
  expect(f.mock.calls[0][1].body.get("code_verifier")).toBe("verifier");
  expect(githubCookieOptions("https://example.com", 600)).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
});
