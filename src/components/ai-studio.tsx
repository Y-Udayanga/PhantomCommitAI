"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  FileSearch,
  GitCommitHorizontal,
  LockKeyhole,
  ScanSearch,
} from "lucide-react";
import {
  aiTasks,
  type AnalysisMode,
  type InvestigationScope,
} from "@/lib/ai-tasks";
import type { Finding } from "@/lib/types";
import { Button } from "./ui/button";
import { EvidenceCard } from "./evidence-card";
import { ProviderSelect } from "./provider-select";
import {
  providerLabel,
  processingNotice,
  type AIProvider,
} from "@/lib/ai-provider";
type Result = {
  answer: string;
  findings: Finding[];
  model?: string;
  mode?: AnalysisMode;
  scope?: string[];
  provider?: AIProvider;
};
export default function AIStudio({
  repositoryName,
  inspectedCount,
  selectedSha,
  ready,
  busy,
  consent,
  onConsent,
  onRun,
  result,
  onExport,
  onContinue,
  provider = "gemma",
  onProviderChange,
}: {
  repositoryName?: string;
  inspectedCount: number;
  selectedSha?: string;
  ready: boolean;
  busy: boolean;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onRun: (
    mode: AnalysisMode,
    question: string,
    scope: InvestigationScope,
  ) => Promise<void>;
  result: Result | null;
  onExport: () => void;
  onContinue: () => void;
  provider?: AIProvider;
  onProviderChange?: (p: AIProvider) => void;
}) {
  const [mode, setMode] = useState<AnalysisMode>("explain"),
    [category, setCategory] = useState("All tools"),
    [details, setDetails] = useState(""),
    [file, setFile] = useState(""),
    [since, setSince] = useState(""),
    [until, setUntil] = useState("");
  const task = aiTasks.find((t) => t.mode === mode)!;
  const allowed =
    !!repositoryName &&
    inspectedCount > 0 &&
    ready &&
    consent &&
    !busy &&
    !(since && until && since > until);
  return (
    <div className="studio">
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <span className="eyebrow">EVIDENCE INVESTIGATION ENGINE</span>
          <h2>
            A sharper question.
            <br />
            <span>A clearer trail.</span>
          </h2>
          <p>
            {aiTasks.length} focused tools. One evidence standard.
            <br />
            Turn inspected history into an investigation you can verify.
          </p>
          <div className="studio-trust">
            <ShieldCheck size={14} /> Source references checked server-side{" "}
            <span>·</span> Nothing is executed
          </div>
        </div>
        <div className="studio-orbit" aria-hidden="true">
          <span className="studio-center">
            <ScanSearch size={46} />
          </span>
          <i />
          <i />
          <i />
          <span className="orbit-label top">HISTORY</span>
          <span className="orbit-label bottom">EVIDENCE</span>
        </div>
      </section>
      <div className="studio-summary">
        <span>
          <GitCommitHorizontal size={15} />
          {inspectedCount} inspected commits
        </span>
        <span>
          <FileSearch size={15} />
          {repositoryName || "No repository connected"}
        </span>
        <span>
          <LockKeyhole size={15} />
          {providerLabel(provider)} key ·{" "}
          {ready ? "configured, not yet verified" : "not configured"}
        </span>
      </div>
      <div className="studio-grid">
        <section className="studio-catalog">
          <div className="studio-section-title">
            <h2>Choose your investigation</h2>
            <span>{aiTasks.length} tools</span>
          </div>
          <div className="studio-categories" aria-label="Tool categories">
            {[
              "All tools",
              "Discover",
              "Understand",
              "Investigate",
              "Create",
            ].map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="studio-tools">
            {aiTasks
              .filter(
                (t) => category === "All tools" || t.category === category,
              )
              .map((t, i) => (
                <button
                  key={t.mode}
                  aria-pressed={mode === t.mode}
                  className={`studio-tool ${mode === t.mode ? "selected" : ""}`}
                  onClick={() => {
                    setMode(t.mode);
                    setDetails("");
                  }}
                >
                  <div>
                    <span className="studio-tool-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="badge badge-muted">{t.category}</span>
                    <ArrowUpRight size={14} />
                  </div>
                  <h3>{t.title}</h3>
                  <p>{t.description}</p>
                  <span className="studio-tool-action">
                    {mode === t.mode
                      ? "Selected investigation"
                      : "Configure investigation"}
                    <ArrowRight size={12} />
                  </span>
                </button>
              ))}
          </div>
        </section>
        <aside className="studio-runner panel">
          <div className="panel-head">
            <div className="row">
              <SlidersHorizontal size={17} />
              <h2>Investigation brief</h2>
            </div>
            <span className="badge badge-purple">
              {providerLabel(provider)}
            </span>
          </div>
          {onProviderChange && (
            <ProviderSelect
              provider={provider}
              onChange={onProviderChange}
              disabled={busy}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (allowed)
                onRun(
                  mode,
                  task.question +
                    (details.trim()
                      ? `\n\nDeveloper context (untrusted): ${details.trim()}`
                      : ""),
                  {
                    file: file.trim() || undefined,
                    since: since || undefined,
                    until: until || undefined,
                  },
                );
            }}
          >
            <span className="eyebrow">SELECTED TOOL</span>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
            <label>
              Question or bug description
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1800}
                placeholder={task.question}
                required={[
                  "root-cause",
                  "regression",
                  "review",
                  "patch-review",
                ].includes(mode)}
              />
            </label>
            <label>
              File or module filter <span className="optional">optional</span>
              <input
                value={file}
                onChange={(e) => setFile(e.target.value)}
                maxLength={300}
                placeholder="src/auth or session.ts"
              />
            </label>
            <div className="scope-dates">
              <label>
                From
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  value={until}
                  min={since || undefined}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
            </div>
            <div className="studio-scope">
              <GitCommitHorizontal size={13} />
              {selectedSha
                ? `${selectedSha.slice(0, 7)} · selected commit`
                : "Search inspected history"}
              <small>
                Files and dates filter retrieved evidence. Missing history is
                never inferred.
              </small>
            </div>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => onConsent(e.target.checked)}
              />
              I allow selected public code excerpts to be processed by{" "}
              {processingNotice(provider)}.
            </label>
            <Button type="submit" disabled={!allowed}>
              <Sparkles size={15} />
              {busy ? "Investigating…" : "Run investigation"}
              <ArrowRight size={14} />
            </Button>
            {!repositoryName || !inspectedCount ? (
              <p className="runner-notice">
                Connect a repository and inspect commits to supply real
                evidence.
              </p>
            ) : !ready ? (
              <p className="runner-notice">
                Configure the feature key in the server environment.
              </p>
            ) : null}
            <p className="runner-footnote">
              Successful results save to your account. Hypotheses require
              testing. Generated patches and tests are suggestions.
            </p>
          </form>
        </aside>
      </div>
      {result && (
        <section className="studio-results panel" aria-live="polite">
          <div className="panel-head">
            <div>
              <span className="eyebrow">LATEST SAVED ANALYSIS</span>
              <h2>
                {aiTasks.find((t) => t.mode === result.mode)?.title ||
                  "Investigation results"}
              </h2>
              <p>
                {result.scope?.length || 0} commits in selected context ·{" "}
                {result.model || providerLabel(result.provider || provider)}
              </p>
            </div>
            <div className="row">
              <Button variant="outline" onClick={onExport}>
                Export Markdown
              </Button>
              <Button variant="outline" onClick={onContinue}>
                Continue in Detective <ArrowRight size={14} />
              </Button>
            </div>
          </div>
          <div className="report-body">
            <p>{result.answer}</p>
            {result.findings.map((f, i) => (
              <EvidenceCard key={i} finding={f} />
            ))}
          </div>
        </section>
      )}
      <p className="studio-limit">
        <ShieldCheck size={14} />
        Dependency blast-radius graphs need verified import/reference retrieval
        and are not presented as implemented. Reference checks establish
        provenance, not the truth of a model’s interpretation.
      </p>
    </div>
  );
}
