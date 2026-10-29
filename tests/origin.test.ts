import { it, expect, vi, afterEach } from "vitest";
import { applicationOrigin } from "../src/lib/server/origin";
afterEach(() => vi.unstubAllEnvs());
it("uses the canonical public origin behind the Render proxy", () => {
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("RENDER_EXTERNAL_URL", "https://phantomcommit-ai.onrender.com");
  expect(applicationOrigin("http://localhost:10000/api/ai")).toBe(
    "https://phantomcommit-ai.onrender.com",
  );
});
it("supports explicit custom domains without trusting arbitrary forwarded headers", () => {
  vi.stubEnv("APP_ORIGIN", "https://example.com/");
  expect(applicationOrigin("http://localhost:10000/api/ai")).toBe(
    "https://example.com",
  );
});
