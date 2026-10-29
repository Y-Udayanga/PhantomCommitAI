import { it, expect, vi, afterEach } from "vitest";
import { analysisModes, aiTasks, taskInstruction } from "../src/lib/ai-tasks";
import {
  gemmaCredential,
  gemmaConfiguration,
} from "../src/lib/server/ai-config";
afterEach(() => vi.unstubAllEnvs());
it("routes features and conversation to separate keys without silent fallback", () => {
  vi.stubEnv("GEMINI_API_KEY", "feature-test-key");
  vi.stubEnv("GEMINI_DETECTIVE_API_KEY", "detective-test-key");
  for (const mode of analysisModes)
    expect(gemmaCredential(mode)).toEqual({
      slot: mode === "chat" ? "detective" : "features",
      key: mode === "chat" ? "detective-test-key" : "feature-test-key",
    });
  vi.stubEnv("GEMINI_DETECTIVE_API_KEY", "");
  expect(gemmaCredential("chat").key).toBe("");
  expect(gemmaConfiguration()).toEqual({ features: true, detective: false });
});
it("each exposed task has a unique supported mode and specific server instructions", () => {
  expect(aiTasks).toHaveLength(18);
  expect(new Set(aiTasks.map((t) => t.mode)).size).toBe(18);
  for (const task of aiTasks) {
    expect(analysisModes).toContain(task.mode);
    expect(task.question.length).toBeGreaterThan(20);
    expect(taskInstruction(task.mode)).toBe(task.instruction);
  }
  expect(taskInstruction("chat")).toContain("unverified");
});
it("production source does not import test fixtures or synthetic seed data", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  function inspect(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) inspect(p);
      else if (/\.tsx?$/.test(p))
        expect(readFileSync(p, "utf8")).not.toMatch(
          /demoCommits|demoRepository|phantom-labs\/spectral-api|from\s+['"][^'"]*fixtures/,
        );
    }
  }
  inspect(
    new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  );
});
