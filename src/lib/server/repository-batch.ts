import "server-only";
import {
  repositoryBatchURLs,
  type RepositoryCheckResult,
} from "../repository-batch";
import { ServiceError } from "./github";

// Two workers keep four-repository batches bounded without a burst of API calls.
export async function checkRepositoryBatch(
  urls: string[],
  check: (url: string) => Promise<RepositoryCheckResult>,
) {
  const normalized = repositoryBatchURLs(urls);
  const results: RepositoryCheckResult[] = new Array(normalized.length);
  let cursor = 0;
  async function worker() {
    while (cursor < normalized.length) {
      const index = cursor++;
      try {
        results[index] = await check(normalized[index]);
      } catch (error) {
        results[index] = {
          url: normalized[index],
          status: "error",
          commits: 0,
          message:
            error instanceof ServiceError
              ? error.message
              : "This repository could not be checked. Please retry.",
          ...(error instanceof ServiceError && error.retryAt
            ? { retry_at: new Date(error.retryAt).toISOString() }
            : {}),
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(2, normalized.length) }, worker),
  );
  return results;
}
