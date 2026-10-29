import { it, expect, vi, afterEach } from "vitest";
import { investigateUltramarine } from "../src/lib/server/ultramarine";
import { demoCommits } from "./fixtures/history";
import { messageEvidence } from "../src/lib/saved-messages";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const completion = {
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          answer: "Intent remains unknown.",
          findings: [],
        }),
        reasoning_content: "Private reasoning is not shown.",
      },
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
};
it("uses the documented endpoint and parameters, validating only final content", async () => {
  vi.stubEnv("ULTRAMARINE_API_KEY", "private-test-key");
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(completion)));
  vi.stubGlobal("fetch", fetcher);
  const result = await investigateUltramarine(
    "Explain the change.",
    "explain",
    demoCommits,
  );
  const [url, options] = fetcher.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(url).toBe("https://api.paperinstruments.com/v1/chat/completions");
  expect(body.model).toBe("ultramarine-1-flash");
  expect(body.reasoning_effort).toBe("low");
  expect(body.response_format).toEqual({ type: "json_object" });
  expect(body.tools).toBeUndefined();
  expect(result.provider).toBe("ultramarine");
  expect(result.answer).toBe("Intent remains unknown.");
  expect(JSON.stringify(result)).not.toContain("Private reasoning");
  expect(result.usage?.totalTokens).toBe(120);
});
it("does not retry quota exhaustion or change providers", async () => {
  vi.stubEnv("ULTRAMARINE_API_KEY", "private-test-key");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: { "x-should-retry": "false" },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    investigateUltramarine("Explain the change.", "explain", demoCommits),
  ).rejects.toMatchObject({ status: 429 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects token-truncated or reasoning-only completions", async () => {
  vi.stubEnv("ULTRAMARINE_API_KEY", "private-test-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "length", message: { content: null } }],
          }),
        ),
      ),
  );
  await expect(
    investigateUltramarine("Explain the change.", "explain", demoCommits),
  ).rejects.toMatchObject({ status: 502 });
});
it("downgrades invented evidence references", async () => {
  vi.stubEnv("ULTRAMARINE_API_KEY", "private-test-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    answer: "A hypothesis.",
                    findings: [
                      {
                        title: "Unverified",
                        finding_type: "risk",
                        summary: "Unverified",
                        severity: "low",
                        evidence_status: "direct",
                        explanation: "Unknown.",
                        recommended_action: "Inspect.",
                        evidence: [
                          { sha: "f".repeat(40), file_path: "invented.ts" },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        ),
      ),
  );
  const result = await investigateUltramarine(
    "Explain the change.",
    "risk",
    demoCommits,
  );
  expect(result.findings[0].evidence_status).toBe("insufficient");
});
it("keeps saved message provider provenance compatible with legacy records", () => {
  expect(messageEvidence([]).provider).toBe("gemma");
  expect(
    messageEvidence({
      findings: [],
      provider: "ultramarine",
      model: "ultramarine-1-flash",
    }),
  ).toEqual({
    evidence_json: [],
    provider: "ultramarine",
    model: "ultramarine-1-flash",
  });
});
