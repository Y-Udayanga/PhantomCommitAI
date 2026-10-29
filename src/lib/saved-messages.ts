import type { Finding } from "./types";
export function messageEvidence(value: unknown): {
  evidence_json: Finding[];
  provider: "gemma" | "ultramarine";
  model?: string;
} {
  if (Array.isArray(value)) return { evidence_json: value, provider: "gemma" };
  if (
    value &&
    typeof value === "object" &&
    "findings" in value &&
    Array.isArray(value.findings)
  )
    return {
      evidence_json: value.findings,
      provider:
        "provider" in value && value.provider === "ultramarine"
          ? "ultramarine"
          : "gemma",
      model:
        "model" in value && typeof value.model === "string"
          ? value.model
          : undefined,
    };
  return { evidence_json: [], provider: "gemma" };
}
