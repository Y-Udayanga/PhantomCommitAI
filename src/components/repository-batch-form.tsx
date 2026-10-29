import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import {
  repositoryBatchURLs,
  type RepositoryCheckResult,
} from "@/lib/repository-batch";

export function RepositoryBatchForm({
  value,
  onChange,
  onSubmit,
  onOpen,
  busy,
  configured,
  error,
  results,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onOpen: () => void;
  busy: boolean;
  configured: boolean;
  error: string;
  results: RepositoryCheckResult[];
}) {
  let count = 0,
    validation = "";
  if (value.trim()) {
    try {
      count = repositoryBatchURLs(value).length;
    } catch (error) {
      validation = (error as Error).message;
    }
  }
  return (
    <form
      className="repository-batch-form"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Repository URL
        <input
          autoFocus
          type="url"
          required
          maxLength={300}
          disabled={busy}
          placeholder="https://github.com/owner/repository"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby="repo-batch-help"
        />
      </label>
      <p id="repo-batch-help">
        Paste one public GitHub repository link to start investigating.
      </p>
      {(error || validation) && (
        <p role="alert" className="red">
          {error || validation}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || !configured || !count || !!validation}
      >
        {busy ? "Connecting repository…" : "Investigate repository"}
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <ArrowRight size={16} />
        )}
      </Button>
      {results.length > 0 && (
        <section
          className="batch-results"
          aria-label="Repository check results"
        >
          <p role="status">
            {results.filter((r) => r.status === "checked").length} of{" "}
            {results.length} checked successfully. Completed results stay saved.
          </p>
          {results.map((result) => (
            <article
              className={`batch-result ${result.status}`}
              key={result.url}
            >
              <div>
                <strong>
                  {result.repository?.full_name ||
                    result.url.replace("https://github.com/", "")}
                </strong>
                <span>
                  {result.status === "checked"
                    ? `${result.commits} recent commits saved`
                    : result.status === "connected"
                      ? "Connected · history needs retry"
                      : "Check could not finish"}
                </span>
              </div>
              {result.status === "checked" && <Check size={17} />}
              {result.message && <p>{result.message}</p>}
              {result.retry_at && (
                <p>
                  Retry after{" "}
                  {new Date(result.retry_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  .
                </p>
              )}
            </article>
          ))}
          {results.some((r) => r.repository) && (
            <Button type="button" variant="outline" onClick={onOpen}>
              Open explorer <ArrowRight size={15} />
            </Button>
          )}
        </section>
      )}
      <p className="batch-limit-note">
        GitHub’s upstream quota still applies. If it pauses a batch, saved
        repositories remain available and unfinished checks can be retried.
      </p>
    </form>
  );
}
