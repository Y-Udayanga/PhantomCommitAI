import "server-only";
import { investigate as gemma, PROMPT_VERSION } from "./gemma";
import {
  investigateUltramarine,
  ultramarineKey,
  ultramarineModel,
} from "./ultramarine";
import { gemmaCredential, googleModelChain } from "./ai-config";
import type { AIProvider } from "../ai-provider";
import type { AnalysisMode } from "../ai-tasks";
import type { Commit } from "../types";
export const ANALYSIS_VERSION = `${PROMPT_VERSION}-providers-v2-structured`;
export function providerConfiguration() {
  return {
    gemma: {
      features: !!gemmaCredential("explain").key,
      detective: !!gemmaCredential("chat").key,
    },
    ultramarine: !!ultramarineKey(),
  };
}
export function providerIdentity(provider: AIProvider, mode: AnalysisMode) {
  return provider === "ultramarine"
    ? { key: ultramarineKey(), model: ultramarineModel() }
    : {
        key: gemmaCredential(mode).key,
        model: googleModelChain().join(">"),
      };
}
export async function analyze(
  provider: AIProvider,
  question: string,
  mode: AnalysisMode,
  commits: Commit[],
  history: { role: string; content: string }[] = [],
) {
  if (provider === "ultramarine")
    return investigateUltramarine(question, mode, commits, history);
  return {
    ...(await gemma(question, mode, commits, history)),
    provider: "gemma" as const,
  };
}
