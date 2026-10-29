import { parseRepository } from "./analysis";
import type { Repository } from "./types";

export const repositoryBatchLimit = 4;
export function repositoryBatchURLs(input: string | string[]) {
  const values =
    typeof input === "string" ? input.trim().split(/[\s,]+/) : input;
  const unique = new Map<string, string>();
  for (const value of values.filter(Boolean)) {
    const parsed = parseRepository(value);
    unique.set(parsed.url.toLowerCase(), parsed.url);
  }
  if (!unique.size)
    throw new Error("Enter at least one public GitHub repository URL.");
  if (unique.size > repositoryBatchLimit)
    throw new Error(
      "Check up to 4 repositories per batch. Start another batch for additional repositories.",
    );
  return [...unique.values()];
}
export type RepositoryCheckResult = {
  url: string;
  status: "checked" | "connected" | "error";
  repository?: Repository;
  commits: number;
  message?: string;
  retry_at?: string;
};
