import "server-only";
import type { AnalysisMode } from "../ai-tasks";
export const googleFallbackModels = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];
export function googleModelChain() {
  return [
    ...new Set([
      process.env.GEMMA_MODEL?.trim() || "gemma-4-26b-a4b-it",
      ...googleFallbackModels,
    ]),
  ];
}
export function gemmaCredential(mode: AnalysisMode) {
  const slot = mode === "chat" ? "detective" : "features";
  return {
    slot,
    key:
      (slot === "detective"
        ? process.env.GEMINI_DETECTIVE_API_KEY
        : process.env.GEMINI_API_KEY
      )?.trim() || "",
  };
}
export function gemmaConfiguration() {
  return {
    features: !!gemmaCredential("explain").key,
    detective: !!gemmaCredential("chat").key,
  };
}
