"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui/button";
import { EvidenceCard } from "./evidence-card";
import type { Commit, FileChange, Finding, Repository } from "@/lib/types";
import type { SecurityFinding, TimelineEvent } from "@/lib/forensics";
import type { CodeGraph, CodeEdge } from "@/lib/server/dependencies";
const ImpactGraph = dynamic(() => import("./impact-graph"), { ssr: false });
const CodePortal = dynamic(() => import("./code-portal"), { ssr: false });
type Kind = "recovery" | "impact" | "security" | "timeline";
type Review = Record<
  string,
  { status: string; reason: string; updated_at: string }
>;
type Result = {
  kind: Kind;
  repository: string;
  branch: string;
  head: string;
  base?: string;
  source?: string;
  file?: string;
  historicalRef?: string;
  historical?: string;
  current?: string;
  notices: string[];
  more?: boolean;
  page?: number;
  artifacts?: { commit: Commit; file: FileChange }[];
  events?: TimelineEvent[];
  findings?: SecurityFinding[];
  graph?: CodeGraph;
  previous?: CodeGraph;
  changes?: { added: CodeEdge[]; removed: CodeEdge[] };
  proposal?: {
    patch: string;
    proposed?: string;
    source: string;
    base: string;
    branch: string;
    validation: string;
  };
  ai?: { answer: string; findings: Finding[]; model: string };
};
type RecordRow = {
  id: string;
  result: Result;
  kind?: Kind;
  review: Review;
  created_at: string;
  expires_at: string;
};
const titles: Record<Kind, string> = {
  recovery: "Smart code recovery",
  impact: "Code impact graph",
  security: "Security regressions",
  timeline: "Feature evolution timeline",
};
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
    signal: options.signal || AbortSignal.timeout(90000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || "Investigation failed.");
  return json.data;
}
function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ForensicWorkbench({
  initialKind,
  repos,
  repository,
  branches,
  branch,
  selected,
  selectedFile,
  commits,
  onRepository,
}: {
  initialKind: Kind;
  repos: Repository[];
  repository: Repository | null;
  branches: string[];
  branch: string;
  selected: Commit | null;
  selectedFile?: FileChange | null;
  commits: Commit[];
  onRepository: (r: Repository) => void;
}) {
  const [kind, setKind] = useState(initialKind),
    [targetBranch, setTargetBranch] = useState(
      branch || repository?.default_branch || "main",
    );
  const [base, setBase] = useState(selected?.parent_shas[0] || ""),
    [head, setHead] = useState(
      initialKind === "recovery" ? "" : selected?.sha || "",
    ),
    [query, setQuery] = useState(""),
    [paths, setPaths] = useState("");
  const [ai, setAI] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [record, setRecord] = useState<RecordRow | null>(null),
    [history, setHistory] = useState<RecordRow[]>([]),
    [page, setPage] = useState(1),
    [category, setCategory] = useState("all"),
    [severity, setSeverity] = useState("all"),
    [status, setStatus] = useState("all"),
    [reason, setReason] = useState("");
  const [revision, setRevision] = useState("target");
  const [timelineScale, setTimelineScale] = useState(1);
  const controller = useRef<AbortController | null>(null);
  const root = repository ? `repositories/${repository.id}/forensics` : "";
  useEffect(() => {
    if (!root) return;
    const abort = new AbortController();
    api<RecordRow[]>(root, { signal: abort.signal })
      .then(setHistory)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [root]);
  const result = record?.result;
  async function run(source?: string, file?: string, nextPage = 1) {
    if (!root || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setMessage("Retrieving Git evidence and analyzing bounded source…");
    try {
      const value = await api<RecordRow>(root, {
        method: "POST",
        signal: abort.signal,
        body: JSON.stringify({
          kind,
          branch: targetBranch,
          base: base || undefined,
          head: head || undefined,
          source,
          file,
          query,
          paths: paths
            .split(/\r?\n/)
            .map((p) => p.trim())
            .filter(Boolean),
          page: nextPage,
          ai,
          consent,
          categories:
            kind === "security" && category !== "all" ? [category] : [],
        }),
      });
      if (abort.signal.aborted) return;
      setRecord(value);
      setPage(nextPage);
      setHistory((h) => [value, ...h].slice(0, 20));
      setMessage(
        "Investigation saved. Source snapshots are kept only in this view.",
      );
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Investigation failed.");
    } finally {
      if (controller.current === abort) {
        setBusy(false);
        setMessage(
          abort.signal.aborted
            ? "Cancelled. The server may finish saving work already started."
            : "",
        );
      }
    }
  }
  async function review(finding: string, next: string) {
    if (!record || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const saved = await api<RecordRow>(`${root}/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ finding, status: next, reason }),
      });
      setRecord((r) => (r ? { ...r, review: saved.review } : r));
      setHistory((h) =>
        h.map((r) => (r.id === record.id ? { ...r, review: saved.review } : r)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id?: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api(`${root}${id ? `/${id}` : ""}`, { method: "DELETE" });
      setHistory((h) => (id ? h.filter((r) => r.id !== id) : []));
      if (!id || record?.id === id) setRecord(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed.");
    } finally {
      setBusy(false);
    }
  }
  function exportReport() {
    if (!result || !record) return;
    download(
      `phantom-${result.kind}.md`,
      `# ${titles[result.kind]}\n\nRepository: ${result.repository}\nBranch: ${result.branch}\nTarget: ${result.head}\nBase: ${result.base || "history page"}\nSaved: ${record.created_at}\n\nThese are investigation leads and proposals, not verified failures.\n\n## Limitations\n${result.notices.map((n) => `- ${n}`).join("\n")}\n\n## Evidence and review decisions\n\n\x60\x60\x60json\n${JSON.stringify({ ...result, historical: undefined, current: undefined, proposal: result.proposal ? { ...result.proposal, proposed: undefined } : undefined, review: record.review }, null, 2)}\n\x60\x60\x60\n`,
    );
  }
  function switchKind(next: Kind) {
    setKind(next);
    setRecord(null);
    setError("");
    setPage(1);
    setCategory("all");
  }
  const filtered = (result?.findings || []).filter(
    (f) =>
      (category === "all" || category === f.category) &&
      (severity === "all" || severity === f.severity) &&
      (status === "all" ||
        (record?.review[f.id]?.status || "open") === status) &&
      (!query ||
        `${f.title} ${f.file}`.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <section className="forensic-workbench">
      <header className="forensic-header">
        <span className="eyebrow">EVIDENCE WORKBENCH</span>
        <h2>{titles[kind]}</h2>
        <p>
          Inspect real Git history. Review static evidence and optional Gemma
          interpretations. Repository access stays read-only.
        </p>
      </header>
      <nav className="forensic-tabs" aria-label="Investigation tools">
        {(Object.keys(titles) as Kind[]).map((k) => (
          <button
            key={k}
            disabled={busy}
            aria-pressed={kind === k}
            onClick={() => switchKind(k)}
          >
            {titles[k]}
          </button>
        ))}
      </nav>
      <div className="forensic-controls">
        <label>
          Repository
          <select
            value={repository?.id || ""}
            disabled={busy}
            onChange={(e) => {
              const repo = repos.find((r) => r.id === e.target.value);
              if (repo) onRepository(repo);
            }}
          >
            <option value="">Select a connected repository</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target branch
          <input
            list="forensic-branches"
            value={targetBranch}
            disabled={busy}
            onChange={(e) => {
              setTargetBranch(e.target.value);
              setHead("");
            }}
          />
          <datalist id="forensic-branches">
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </datalist>
        </label>
        <label>
          Base commit SHA
          <input
            value={base}
            placeholder="Full 40-character SHA"
            disabled={busy}
            onChange={(e) => setBase(e.target.value)}
          />
        </label>
        <label>
          Target commit SHA (optional)
          <input
            value={head}
            placeholder="Defaults to branch tip"
            disabled={busy}
            onChange={(e) => setHead(e.target.value)}
            list="forensic-commits"
          />
          <datalist id="forensic-commits">
            {commits.map((c) => (
              <option key={c.sha} value={c.sha}>
                {c.message.slice(0, 60)}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          Search file, symbol, keyword or SHA
          <input
            value={query}
            maxLength={150}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {kind === "impact" && (
        <label className="forensic-paths">
          Source paths (one per line, up to 12; empty uses changed JS/TS files)
          <textarea
            value={paths}
            disabled={busy}
            onChange={(e) => setPaths(e.target.value)}
            placeholder="src/auth.ts&#10;src/routes.ts"
          />
        </label>
      )}
      {kind === "security" && (
        <div className="forensic-controls">
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "all",
                "authentication",
                "authorization",
                "validation",
                "secrets",
                "database",
                "headers",
                "unsafe-sink",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {["all", "high", "medium"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Review status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["all", "open", "reviewed", "resolved", "dismissed"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="forensic-ai">
        <label className="forensic-check">
          <input
            type="checkbox"
            checked={ai}
            disabled={busy}
            onChange={(e) => setAI(e.target.checked)}
          />
          Ask Gemma to explain this investigation
        </label>
        {ai && (
          <label className="forensic-check">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to sending bounded, masked public code and analysis to
            Google.
          </label>
        )}
      </div>
      <div className="forensic-toolbar">
        <Button
          disabled={
            !repository ||
            busy ||
            (ai && !consent) ||
            (kind === "timeline" && !query.trim())
          }
          onClick={() => run()}
        >
          {kind === "recovery" || kind === "timeline"
            ? "Search history"
            : "Analyze comparison"}
        </Button>
        {kind === "recovery" &&
          selected &&
          selectedFile &&
          selectedFile.deletions > 0 && (
            <Button
              variant="outline"
              disabled={busy || !repository || (ai && !consent)}
              onClick={() => run(selected.sha, selectedFile.file_path)}
            >
              Preview selected deletion
            </Button>
          )}
        {busy && message && (
          <Button
            variant="outline"
            onClick={() => {
              controller.current?.abort();
            }}
          >
            Cancel
          </Button>
        )}
        {result && (
          <Button variant="outline" onClick={exportReport}>
            Export investigation
          </Button>
        )}
      </div>
      {busy && <p role="status">{message || "Saving review…"}</p>}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {!repository && (
        <div className="forensic-empty">
          <h3>Connect a repository to begin.</h3>
          <p>
            Use Investigate repository to import a public GitHub repository,
            then select it here.
          </p>
        </div>
      )}
      {repository && !result && !busy && (
        <div className="forensic-empty">
          <h3>Choose a focused investigation.</h3>
          <p>
            Recovery and timeline inspect five commits per page. Security and
            impact require a full base SHA. Add caller paths to broaden graph
            coverage.
          </p>
        </div>
      )}
      {result && (
        <>
          <details className="forensic-evidence">
            <summary>Scope and limitations</summary>
            <ul>
              {result.notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
          {result.artifacts && (
            <section>
              <h3>Deleted code evidence ({result.artifacts.length})</h3>
              {!result.artifacts.length && (
                <p>
                  No matching removals in this page. Try another page or search.
                </p>
              )}
              {result.artifacts.map(({ commit: c, file: f }) => (
                <article
                  className="forensic-card"
                  key={`${c.sha}:${f.file_path}`}
                >
                  <h4>{f.file_path}</h4>
                  <p>
                    {c.sha.slice(0, 7)} · {c.author_name} ·{" "}
                    {new Date(c.committed_at).toLocaleString()} · {f.deletions}{" "}
                    removed lines ·{" "}
                    {f.file_path.split(".").pop() || "unknown language"}
                  </p>
                  <p>{c.message}</p>
                  {f.previous_path && <p>Previous path: {f.previous_path}</p>}
                  <a href={c.html_url} target="_blank" rel="noreferrer">
                    Commit evidence ↗
                  </a>
                  <pre className="forensic-code">
                    {f.patch_excerpt || "Patch unavailable"}
                  </pre>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setKind("recovery");
                      run(c.sha, f.file_path);
                    }}
                  >
                    Preview recovery
                  </Button>
                </article>
              ))}
            </section>
          )}
          {result.historical !== undefined && (
            <section className="forensic-card">
              <h3>Historical implementation → selected current base</h3>
              <p>
                {result.file} · source {result.source?.slice(0, 7)} · base{" "}
                {result.base?.slice(0, 7)}
              </p>
              <CodePortal
                before={result.historical}
                after={result.current || ""}
                language={/\.tsx?$/.test(result.file || "") ? "typescript" : /\.[cm]?jsx?$/.test(result.file || "") ? "javascript" : result.file?.endsWith(".sql") ? "sql" : result.file?.endsWith(".py") ? "python" : "plaintext"}
              />
            </section>
          )}
          {result.kind === "recovery" && result.source && result.file && result.historical === undefined && (
            <Button variant="outline" disabled={busy || (ai && !consent)} onClick={() => run(result.source, result.file)}>Reload historical and current snapshots</Button>
          )}
          {result.proposal && (
            <section className="forensic-card">
              <h3>Proposed restoration patch — review required</h3>
              <p>
                Source {result.proposal.source} · Target{" "}
                {result.proposal.branch} at {result.proposal.base}
              </p>
              <p>{result.proposal.validation}</p>
              <pre className="forensic-code">{result.proposal.patch}</pre>
              <div className="forensic-toolbar">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        result.proposal!.patch,
                      );
                      setMessage("Patch copied.");
                    } catch {
                      setError(
                        "Clipboard unavailable. Download the patch instead.",
                      );
                    }
                  }}
                >
                  Copy patch
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      "phantom-recovery.patch",
                      result.proposal!.patch,
                      "text/x-diff",
                    )
                  }
                >
                  Download patch
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBase(result.base || "");
                    setHead(result.head);
                    setPaths(result.file || "");
                    switchKind("impact");
                  }}
                >
                  Inspect code impact
                </Button>
              </div>
              {message && !busy && <p role="status">{message}</p>}
            </section>
          )}
          {result.graph && (
            <>
              <label>
                Graph revision
                <select
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                >
                  <option value="target">Target snapshot</option>
                  <option value="base">Base snapshot</option>
                </select>
              </label>
              <p className="forensic-muted">
                Select a node to fill the investigation query. Enable Gemma and
                analyze again for an explanation of its verified dependents.
              </p>
              <ImpactGraph
                graph={
                  revision === "base" && result.previous
                    ? result.previous
                    : result.graph
                }
                repositoryUrl={repository!.github_url}
                sha={
                  revision === "base" ? result.base || result.head : result.head
                }
                onSelection={setQuery}
              />
              <details className="forensic-card">
                <summary>
                  Dependency changes: +{result.changes?.added.length || 0} / −
                  {result.changes?.removed.length || 0}
                </summary>
                <p>
                  Changed relationships appear as removed and added edges. Line
                  movement is ignored.
                </p>
                {[
                  ...(result.changes?.added.map((e) => ({
                    ...e,
                    change: "added",
                  })) || []),
                  ...(result.changes?.removed.map((e) => ({
                    ...e,
                    change: "removed",
                  })) || []),
                ].map((e) => (
                  <p key={`${e.change}:${e.id}`}>
                    {e.change}: {e.source} → {e.target} ({e.kind})
                  </p>
                ))}
              </details>
            </>
          )}
          {result.findings && (
            <section>
              <div className="forensic-stats">
                <span>{result.findings.length} findings</span>
                <span>
                  {result.findings.filter((f) => f.severity === "high").length}{" "}
                  high
                </span>
                <span>
                  {
                    result.findings.filter(
                      (f) =>
                        !record?.review[f.id] ||
                        record.review[f.id].status === "open",
                    ).length
                  }{" "}
                  awaiting review
                </span>
                <span>
                  {
                    Object.values(record?.review || {}).filter(
                      (r) => r.status === "resolved",
                    ).length
                  }{" "}
                  resolved
                </span>
                <span>
                  {
                    Object.values(record?.review || {}).filter(
                      (r) => r.status === "dismissed",
                    ).length
                  }{" "}
                  dismissed
                </span>
              </div>
              <label>
                Decision reason (required for dismissal)
                <input
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {!filtered.length && (
                <p>
                  No matching findings. A clean scan does not establish
                  security.
                </p>
              )}
              {filtered.map((f) => (
                <article key={f.id} className="forensic-card">
                  <h3>{f.title}</h3>
                  <p>
                    {f.severity} severity · {f.confidence} · {f.category} ·{" "}
                    {f.method}
                  </p>
                  <a
                    href={`${repository?.github_url}/commit/${f.sha}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.sha.slice(0, 7)} · {f.file}:{f.line}
                  </a>
                  <pre className="forensic-code">{f.evidence}</pre>
                  <p>{f.remediation}</p>
                  <label>
                    Finding status
                    <select
                      value={record?.review[f.id]?.status || "open"}
                      disabled={busy}
                      onChange={(e) => review(f.id, e.target.value)}
                    >
                      {["open", "reviewed", "resolved", "dismissed"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {record?.review[f.id]?.reason && (
                    <p>Review note: {record.review[f.id].reason}</p>
                  )}
                </article>
              ))}
            </section>
          )}
          {result.events && (
            <section className="forensic-timeline">
              <h3>Feature history leads</h3>
              <label>
                Timeline scale
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.25"
                  value={timelineScale}
                  onChange={(e) => setTimelineScale(Number(e.target.value))}
                />
              </label>
              <label>
                Event category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "all",
                    "introduced in scope",
                    "modified",
                    "renamed",
                    "removed",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              {!result.events.length && (
                <p>No evidenced matches in this history page.</p>
              )}
              {result.events
                .filter((e) => category === "all" || e.category === category)
                .map((e) => (
                  <article
                    className="forensic-card"
                    style={{
                      padding: `${22 * timelineScale}px`,
                      marginTop: `${14 * timelineScale}px`,
                    }}
                    key={`${e.sha}:${e.file}`}
                  >
                    <span className="eyebrow">{e.category}</span>
                    <h4>{e.message.split("\n")[0]}</h4>
                    <p>
                      {new Date(e.date).toLocaleString()} · {e.author} ·{" "}
                      {e.file}
                    </p>
                    <p>{e.certainty}</p>
                    {e.previous && (
                      <p>
                        Git rename: {e.previous} → {e.file}
                      </p>
                    )}
                    <a href={e.url} target="_blank" rel="noreferrer">
                      {e.sha.slice(0, 7)} · inspect commit ↗
                    </a>
                    <details>
                      <summary>View changed code</summary>
                      <pre className="forensic-code">{e.evidence}</pre>
                    </details>
                    <div className="forensic-toolbar">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setHead(e.sha);
                          setBase(e.parent || "");
                          switchKind("security");
                        }}
                      >
                        Review security change
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setHead("");
                          setQuery(e.file);
                          switchKind("recovery");
                        }}
                      >
                        Find deleted code
                      </Button>
                    </div>
                  </article>
                ))}
            </section>
          )}
          {(result.artifacts || result.events) && (
            <div className="forensic-toolbar">
              <Button
                variant="outline"
                disabled={busy || page <= 1}
                onClick={() => run(undefined, undefined, page - 1)}
              >
                Previous history page
              </Button>
              <span>Page {result.page || page}</span>
              <Button
                variant="outline"
                disabled={busy || !result.more}
                onClick={() => run(undefined, undefined, page + 1)}
              >
                Next history page
              </Button>
            </div>
          )}
          {result.ai && (
            <section className="forensic-card">
              <h3>Gemma interpretation</h3>
              <p className="forensic-muted">
                Generated hypotheses and recommendations · model{" "}
                {result.ai.model}. References verify provenance, not semantic
                correctness.
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{result.ai.answer}</p>
              {result.ai.findings.map((f, i) => (
                <EvidenceCard key={i} finding={f} />
              ))}
            </section>
          )}
        </>
      )}
      <section className="forensic-history">
        <h3>Investigation history</h3>
        <p className="forensic-muted">
          Latest 20 saved investigations; 30-day retention. Full snapshots are
          not stored. Expired rows are purged on the next investigation by their
          owner.
        </p>
        {history.map((r) => (
          <div className="forensic-history-row" key={r.id}>
            <button
              disabled={busy}
              onClick={() => {
                setRecord(r);
                setKind(r.result.kind);
                setPage(r.result.page || 1);
                setBase(r.result.base || "");
                setHead(r.result.head);
                setTargetBranch(r.result.branch);
              }}
            >
              {titles[r.result.kind]} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </button>
            <button
              disabled={busy}
              aria-label="Delete saved investigation"
              onClick={() => remove(r.id)}
            >
              Delete
            </button>
          </div>
        ))}
        {!history.length && <p>No saved investigations yet.</p>}
        {history.length > 0 && (
          <Button variant="outline" disabled={busy} onClick={() => remove()}>
            Delete saved forensic investigations
          </Button>
        )}
      </section>
    </section>
  );
}
