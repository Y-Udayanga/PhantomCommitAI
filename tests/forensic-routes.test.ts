import { expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  github: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/server/supabase", () => ({
  authenticated: mocks.auth,
  configured: () => true,
  checkDb: (e: unknown) => {
    if (e) throw new Error("DATABASE_ERROR");
  },
}));
vi.mock("../src/lib/server/github", async (original) => ({
  ...(await original<typeof import("../src/lib/server/github")>()),
  github: mocks.github,
}));
vi.mock("../src/lib/server/github-app", () => ({
  githubAppConfigured: () => false,
  userGitHubCredential: async () => undefined,
  githubSessionCookie: "test",
}));
import { GET, POST, PATCH } from "../src/app/api/[...path]/route";
const id = "10000000-0000-4000-8000-000000000001";
const ctx = (suffix: string[] = []) => ({
  params: Promise.resolve({
    path: ["repositories", id, "forensics", ...suffix],
  }),
});
beforeEach(() => {
  vi.clearAllMocks();
  const builder = { select: () => builder, eq: mocks.eq, single: mocks.single };
  mocks.eq.mockReturnValue(builder);
  mocks.single.mockResolvedValue({ data: null, error: { code: "missing" } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.auth.mockResolvedValue({
    db: { rpc: mocks.rpc, from: () => builder },
    user: { id: "owner-fixture" },
  });
});
it("rejects unauthenticated forensic history and reports before database or GitHub access", async () => {
  mocks.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  const response = await GET(
    new NextRequest(`http://localhost/api/repositories/${id}/forensics`),
    ctx(),
  );
  expect(response.status).toBe(401);
  expect(mocks.github).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires owned repository metadata before reading saved investigations", async () => {
  const r = await GET(
    new NextRequest(`http://localhost/api/repositories/${id}/forensics`),
    ctx(),
  );
  expect(r.status).toBe(404);
  expect(mocks.eq).toHaveBeenCalledWith("owner_id", "owner-fixture");
  expect(mocks.github).not.toHaveBeenCalled();
});
it("blocks cross-origin scans before provider and database work", async () => {
  const r = await POST(
    new NextRequest(`http://localhost/api/repositories/${id}/forensics`, {
      method: "POST",
      headers: { origin: "https://attacker.invalid" },
      body: "{}",
    }),
    ctx(),
  );
  expect(r.status).toBe(403);
  expect(mocks.auth).not.toHaveBeenCalled();
});
it("rechecks public visibility before analysis even for an owned saved repository", async () => {
  mocks.single.mockResolvedValue({
    data: {
      id,
      github_owner: "fixture",
      github_name: "repo",
      default_branch: "main",
    },
    error: null,
  });
  mocks.github.mockResolvedValue({ data: { private: true }, more: false });
  const r = await POST(
    new NextRequest(`http://localhost/api/repositories/${id}/forensics`, {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: JSON.stringify({
        kind: "security",
        branch: "main",
        base: "a".repeat(40),
        head: "b".repeat(40),
      }),
    }),
    ctx(),
  );
  expect(r.status).toBe(403);
  expect(mocks.github).toHaveBeenCalledTimes(1);
});
it("requires a reason for dismissal before any finding update", async () => {
  mocks.single.mockResolvedValue({
    data: { id, github_owner: "fixture", github_name: "repo" },
    error: null,
  });
  const r = await PATCH(
    new NextRequest(`http://localhost/api/repositories/${id}/forensics/${id}`, {
      method: "PATCH",
      headers: { origin: "http://localhost" },
      body: JSON.stringify({ finding: "test", status: "dismissed" }),
    }),
    ctx([id]),
  );
  expect(r.status).toBe(400);
  expect(mocks.github).not.toHaveBeenCalled();
});
