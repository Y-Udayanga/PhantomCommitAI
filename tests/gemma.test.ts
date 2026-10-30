import { it, expect, vi, afterEach } from "vitest";
const { generate, keys } = vi.hoisted(() => ({
  generate: vi.fn(),
  keys: [] as string[],
}));
vi.mock("@google/genai", () => ({
  ThinkingLevel: { MINIMAL: "minimal" },
  GoogleGenAI: class {
    constructor({ apiKey }: { apiKey: string }) {
      keys.push(apiKey);
    }
    models = { generateContent: generate };
  },
}));
import { investigate } from "../src/lib/server/gemma";
import { demoCommits } from "./fixtures/history";
afterEach(() => {
  vi.unstubAllEnvs();
  generate.mockReset();
  keys.length = 0;
});
it("does not make calls without credentials", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(
    investigate("why removed?", "explain", demoCommits),
  ).rejects.toMatchObject({ status: 503 });
  expect(generate).not.toHaveBeenCalled();
});
it("parses fenced JSON and bounds context", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  generate.mockResolvedValue({
    text: '```json\n{"answer":"Intent is unknown.","findings":[]}\n```',
  });
  const r = await investigate("why removed?", "explain", demoCommits);
  expect(r.answer).toBe("Intent is unknown.");
  const input = generate.mock.calls[0][0];
  expect(input.contents.length).toBeLessThan(52000);
  expect(input.model).toBe("gemma-4-26b-a4b-it");
});
it("rejects invalid structured output", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  generate.mockResolvedValue({ text: '{"findings":"not valid"}' });
  await expect(
    investigate("why removed?", "explain", demoCommits),
  ).rejects.toMatchObject({ status: 502 });
});
it("tries each fallback once when all Google models are quota limited", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  generate.mockRejectedValue({ status: 429 });
  await expect(
    investigate("why removed?", "explain", demoCommits),
  ).rejects.toMatchObject({ status: 429 });
  expect(generate).toHaveBeenCalledTimes(10);
  expect(
    new Set(generate.mock.calls.map(([request]) => request.model)).size,
  ).toBe(10);
});
it("passes each configured key to the SDK only for its intended route", async () => {
  vi.stubEnv("GEMINI_API_KEY", "feature-unit-key");
  vi.stubEnv("GEMINI_DETECTIVE_API_KEY", "detective-unit-key");
  generate.mockResolvedValue({
    text: '{"answer":"Intent is unknown.","findings":[]}',
  });
  expect(
    (await investigate("Explain the changes.", "explain", demoCommits)).keySlot,
  ).toBe("features");
  expect(
    (await investigate("What evidence is missing?", "chat", demoCommits))
      .keySlot,
  ).toBe("detective");
  expect(keys).toEqual(["feature-unit-key", "detective-unit-key"]);
});
it("falls back on temporary failure using the same route-specific key", async () => {
  vi.stubEnv("GEMINI_API_KEY", "feature-unit-key");
  vi.stubEnv("GEMINI_DETECTIVE_API_KEY", "detective-unit-key");
  generate.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({
    text: '{"answer":"Intent is unknown.","findings":[]}',
  });
  await investigate("Explain the changes.", "explain", demoCommits);
  expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[1][0].model).toBe("gemma-4-31b-it");
  expect(keys).toEqual(["feature-unit-key"]);
});
