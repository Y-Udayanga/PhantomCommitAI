import "server-only";
import type { AnalysisMode } from "../ai-tasks";
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
