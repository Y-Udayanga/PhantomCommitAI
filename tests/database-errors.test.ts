import { expect, it, vi } from "vitest";
import { checkDb } from "../src/lib/server/supabase";
import { ServiceError } from "../src/lib/server/github";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

it.each(["PGRST202", "PGRST205", "42P01", "42883"])(
  "identifies missing database schema for %s without exposing raw errors",
  (code) => {
    try {
      checkDb({ code, message: "private database details" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).status).toBe(503);
      expect((error as Error).message).toContain(
        "Database setup is incomplete",
      );
      expect((error as Error).message).not.toContain(
        "private database details",
      );
    }
  },
);
it("does not expose other database failures or reject successful results", () => {
  expect(() => checkDb(null)).not.toThrow();
  expect(() =>
    checkDb({ code: "42501", message: "private row content" }),
  ).toThrow("DATABASE_ERROR");
});
