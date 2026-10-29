"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  FolderGit2,
  Ghost as GhostIcon,
  History,
  Bug,
  ScanSearch,
  FlaskConical,
  FileText,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  GitCommitHorizontal,
  GitBranch,
  Search,
  ChevronRight,
  ChevronDown,
  Command,
  Sparkles,
  ShieldCheck,
  Clock3,
  ExternalLink,
  Download,
  LoaderCircle,
  X,
  Menu,
  Trash2,
  LogOut,
  Check,
  CircleHelp,
  Send,
  RefreshCw,
} from "lucide-react";
import { Brand, Ghost } from "./brand";
import { EvidenceCard } from "./evidence-card";
import {
  GitHubConnection,
  type GitHubConnectionState,
} from "./github-connection";
import { RepositoryBatchForm } from "./repository-batch-form";
import {
  repositoryBatchURLs,
  type RepositoryCheckResult,
} from "@/lib/repository-batch";
import { ReportCard, ReportIntro } from "./report-card";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import AIStudio from "./ai-studio";
const ForensicWorkbench = dynamic(() => import("./forensic-workbench"));
import { ProviderSelect } from "./provider-select";
import {
  providerLabel,
  processingNotice,
  type AIProvider,
} from "@/lib/ai-provider";
import type { AnalysisMode, InvestigationScope } from "@/lib/ai-tasks";
import { classify } from "@/lib/analysis";
import { browserDatabase } from "@/lib/supabase-browser";
import type { Commit, Repository, Finding, FileChange } from "@/lib/types";
const ActivityChart = dynamic(() => import("./activity-chart"), {
  ssr: false,
  loading: () => <div className="skeleton chart-skeleton" />,
});
const CommitGraph = dynamic(() => import("./commit-graph"), {
  ssr: false,
  loading: () => <div className="skeleton chart-skeleton" />,
});
const CodePortal = dynamic(() => import("./code-portal"), {
  ssr: false,
  loading: () => <div className="skeleton chart-skeleton" />,
});
const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "repositories", label: "Repository explorer", icon: FolderGit2 },
  { id: "graveyard", label: "Code graveyard", icon: GhostIcon },
  { id: "replay", label: "Ghost replay", icon: History },
  { id: "haunted-bugs", label: "Haunted bugs", icon: Bug },
  { id: "intelligence", label: "AI Studio", icon: Sparkles },
  { id: "detective", label: "AI detective", icon: ScanSearch },
  { id: "resurrection", label: "Resurrection lab", icon: FlaskConical },
  { id: "recovery", label: "Smart code recovery", icon: FlaskConical },
  { id: "impact", label: "Code impact graph", icon: GitBranch },
  { id: "security", label: "Security regressions", icon: ShieldCheck },
  { id: "timeline", label: "Feature evolution", icon: History },
  { id: "reports", label: "Investigation reports", icon: FileText },
];
type Thread = {
  id: string;
  title: string;
  repository_id: string;
  created_at: string;
  repositories?: {
    full_name: string;
  };
};
type Message = {
  role: string;
  content: string;
  evidence_json?: Finding[];
  provider?: AIProvider;
  model?: string;
};
type Analysis = {
  answer: string;
  findings: Finding[];
  thread_id?: string;
  scope?: string[];
  model?: string;
  provider?: AIProvider;
};
type Report = {
  id: string;
  title: string;
  report_content: string;
  created_at: string;
};
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(95000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const j = await r.json();
  if (!r.ok) {
    const retryAt = Date.parse(j.error?.retry_at || "");
    if (r.status === 429 && Number.isFinite(retryAt)) {
      throw new Error(
        `GitHub is temporarily rate limited. Try again at ${new Date(retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Saved investigations and reports remain available.`,
      );
    }
    throw new Error(j.error?.message || "Request failed.");
  }
  return j.data;
}
function exportMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function reportMarkdown(repo: string, a: Analysis) {
  return `# PhantomCommit AI — ${repo}\n\n## Investigation scope\nBounded retrieved Git history. AI hypotheses require testing. Reference validation checks provenance, not factual entailment.\n\n## Executive summary\n${a.answer}\n\n${a.findings.map((f) => `## ${f.title}\n\n${f.summary}\n\nStatus: ${f.evidence_status}; risk: ${f.severity}\n\n${f.explanation}\n\nRecommended action: ${f.recommended_action}\n\n${f.evidence.map((e) => `- ${e.sha} — ${e.file_path}${e.line ? `:${e.line}` : ""} — ${e.verified ? "Reference verified" : "Insufficient evidence"} ${e.html_url}`).join("\n")}`).join("\n\n")}\n\n## Unresolved questions\nDeveloper intent and causal effects require additional evidence and reproduction.\n`;
}
export default function Workspace({
  section,
  configured,
}: {
  section: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [gitHubConnection, setGitHubConnection] =
    useState<GitHubConnectionState>({ configured: false, connected: false });
  const [importResults, setImportResults] = useState<RepositoryCheckResult[]>(
    [],
  );
  const [provider, setProvider] = useState<AIProvider>("gemma");
  const [ultramarineReady, setUltramarineReady] = useState(false);
  const [active, setActive] = useState(section),
    [repos, setRepos] = useState<Repository[]>([]),
    [repository, setRepository] = useState<Repository | null>(null),
    [commits, setCommits] = useState<Commit[]>([]),
    [selected, setSelected] = useState<Commit | null>(null),
    [file, setFile] = useState<FileChange | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [threadId, setThreadId] = useState<string>(),
    [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(""),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [importOpen, setImportOpen] = useState(false),
    [repoUrl, setRepoUrl] = useState(""),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    [branches, setBranches] = useState<string[]>([]),
    [branch, setBranch] = useState(""),
    [mobile, setMobile] = useState(false),
    [aiReady, setAiReady] = useState(false),
    [detectiveReady, setDetectiveReady] = useState(false),
    [dataLoaded, setDataLoaded] = useState(false),
    [displayName, setDisplayName] = useState(""),
    [profileEmail, setProfileEmail] = useState(""),
    [portal, setPortal] = useState<{
      before: string;
      after: string;
    } | null>(null),
    [baseSha, setBaseSha] = useState("");
  const analysisReady = provider === "ultramarine" ? ultramarineReady : aiReady;
  const chatReady =
    provider === "ultramarine" ? ultramarineReady : detectiveReady;
  function changeProvider(next: AIProvider) {
    setProvider(next);
    setConsent(false);
    setResult(null);
  }
  const operation = useRef(false);
  const chatMessages = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active !== "detective" || !messages.length) return;
    chatMessages.current?.lastElementChild?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [active, messages]);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!importOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImportOpen(false);
      if (event.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [importOpen]);
  const loadSaved = useCallback(async (r: Repository) => {
    const c = await request<Commit[]>(`repositories/${r.id}/saved-commits`);
    setCommits(c);
    setSelected(null);
    setFile(null);
    setBranch(r.default_branch);
    setPage(1);
    setMore(false);
    setMessages([]);
    setThreadId(undefined);
    setResult(null);
    setPortal(null);
  }, []);
  useEffect(() => {
    if (!configured) return;
    let stopped = false;
    (async () => {
      try {
        const [r, t, p, s, connection] = await Promise.all([
          request<Repository[]>("repositories"),
          request<Thread[]>("investigations"),
          request<Report[]>("reports"),
          request<{
            providers: { ultramarine: boolean };
            ai: boolean;
            aiRoutes: { features: boolean; detective: boolean };
          }>("status"),
          request<GitHubConnectionState>("github/connection"),
        ]);
        if (stopped) return;
        setGitHubConnection(connection);
        const pendingRepo = sessionStorage.getItem(
          "phantom-pending-repository",
        );
        if (
          pendingRepo &&
          new URLSearchParams(window.location.search).has("github")
        ) {
          setRepoUrl(pendingRepo);
          setImportOpen(true);
          sessionStorage.removeItem("phantom-pending-repository");
        }
        if (
          new URLSearchParams(window.location.search).get("github") === "error"
        )
          setError(
            new URLSearchParams(window.location.search).get("github_error") ===
              "configuration"
              ? "GitHub rejected the App credentials. The administrator must update the GitHub App client secret and callback configuration."
              : new URLSearchParams(window.location.search).get(
                    "github_error",
                  ) === "session"
                ? "Your workspace session expired. Sign in again, then connect GitHub."
                : "GitHub authorization expired or was cancelled. Click Connect GitHub to start a fresh connection.",
          );
        setRepos(r);
        setDataLoaded(true);
        setThreads(t);
        setReports(p);
        setAiReady(s.aiRoutes.features);
        setUltramarineReady(s.providers.ultramarine);
        setDetectiveReady(s.aiRoutes.detective);
        if (r.length) {
          const initial =
            r.find((x) => x.id === localStorage.getItem("phantom-repo")) ||
            r[0];
          setRepository(initial);
          await loadSaved(initial);
        }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [configured, loadSaved]);
  useEffect(() => {
    if (active !== "settings" || !configured) return;
    request<{
      display_name?: string;
      email?: string;
    }>("profile")
      .then((p) => {
        setDisplayName(p.display_name || "");
        setProfileEmail(p.email || "");
      })
      .catch((e) => setError(e.message));
  }, [active, configured]);
  async function perform(label: string, action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      operation.current = false;
    }
  }
  function navigate(id: string) {
    setActive(id);
    window.history.pushState(null, "", `/${id}`);
    setMobile(false);
    setSearch("");
    setPortal(null);
  }
  async function chooseRepo(r: Repository) {
    await perform("Opening repository", async () => {
      setRepository(r);
      localStorage.setItem("phantom-repo", r.id);
      await loadSaved(r);
    });
  }
  async function disconnectGitHub() {
    await perform("Disconnecting GitHub", async () => {
      await request("github/connection", { method: "DELETE" });
      setGitHubConnection((previous) => ({
        configured: previous.configured,
        connected: false,
      }));
      notify("GitHub connection removed from this browser.");
    });
  }
  async function importRepo() {
    await perform("Connecting to GitHub", async () => {
      if (!configured) {
        throw new Error(
          "Configure Supabase and apply the database migration to connect a repository.",
        );
      }
      const urls = repositoryBatchURLs(repoUrl);
      const connection =
        await request<GitHubConnectionState>("github/connection");
      setGitHubConnection(connection);
      if (connection.configured && !connection.connected) {
        sessionStorage.setItem("phantom-pending-repository", repoUrl);
        window.location.assign(
          new URL("/api/github/connect", window.location.origin).href,
        );
        return;
      }
      setImportResults([]);
      const batch = await request<{ results: RepositoryCheckResult[] }>(
        "repositories/batch",
        { method: "POST", body: JSON.stringify({ urls }) },
      );
      setImportResults(batch.results);
      const connected = batch.results.flatMap((result) =>
        result.repository ? [result.repository] : [],
      );
      if (connected.length) {
        setRepos((prev) => [
          ...connected,
          ...prev.filter((repo) => !connected.some((r) => r.id === repo.id)),
        ]);
        const first = connected[0];
        setRepository(first);
        localStorage.setItem("phantom-repo", first.id);
        setActive("repositories");
        await loadSaved(first);
        if (urls.length === 1 && batch.results[0]?.status === "checked")
          setImportOpen(false);
      }
      notify(
        `${batch.results.filter((r) => r.status === "checked").length} of ${urls.length} repository checks completed.`,
      );
    });
  }
  async function loadHistory(next = 1, newBranch = branch) {
    if (!repository) return;
    await perform("Retrieving commit history", async () => {
      const r = await request<{
        commits: Commit[];
        more: boolean;
      }>(
        `repositories/${repository.id}/commits?page=${next}&branch=${encodeURIComponent(newBranch || repository.default_branch)}`,
      );
      setCommits((prev) =>
        next === 1
          ? r.commits
          : [
              ...prev,
              ...r.commits.filter((c) => !prev.some((p) => p.sha === c.sha)),
            ],
      );
      setMore(r.more);
      setPage(next);
      setSelected(null);
      setFile(null);
      notify(`${r.commits.length} commits retrieved from GitHub.`);
    });
  }
  async function inspect(c: Commit) {
    setPortal(null);
    if (!repository) return;
    await perform("Inspecting commit evidence", async () => {
      const d = await request<Commit>(
        `repositories/${repository.id}/commits/${c.sha}`,
      );
      setSelected(d);
      setFile(d.files?.[0] || null);
      setCommits((prev) => prev.map((p) => (p.sha === d.sha ? d : p)));
    });
  }
  async function analyzeBatch() {
    if (!repository) return;
    await perform("Analyzing up to 3 commits", async () => {
      const pending = commits.filter((c) => !c.files).slice(0, 3);
      if (!pending.length) {
        notify(
          "All loaded commit details are cached. Load more history to continue.",
        );
        return;
      }
      const r = await request<{
        commits: Commit[];
      }>(`repositories/${repository.id}/analyze`, {
        method: "POST",
        body: JSON.stringify({ shas: pending.map((c) => c.sha) }),
      });
      setCommits((prev) =>
        prev.map((c) => r.commits.find((d) => d.sha === c.sha) || c),
      );
      notify(
        `Analyzed ${r.commits.length} commits. Continue to process the next batch.`,
      );
    });
  }
  async function ask(
    mode: AnalysisMode = "chat",
    question = query,
    scope: InvestigationScope = {},
  ) {
    if (!repository) {
      setError(
        "Select a repository and inspect a commit before asking the detective.",
      );
      return;
    }
    await perform(
      `${providerLabel(provider)} is following the evidence`,
      async () => {
        if (!consent)
          throw new Error(
            `Confirm that selected code excerpts may be processed by ${providerLabel(provider)}.`,
          );
        setResult(null);
        const a = await request<Analysis>("ai", {
          method: "POST",
          body: JSON.stringify({
            repository_id: repository.id,
            provider,
            sha: selected?.sha,
            mode,
            question,
            thread_id: mode === "chat" ? threadId : undefined,
            ...scope,
            consent: true,
          }),
        });
        setResult(a);
        setThreadId(a.thread_id);
        setMessages((prev) => [
          ...(mode === "chat" ? prev : []),
          { role: "user", content: question },
          {
            role: "assistant",
            content: a.answer,
            evidence_json: a.findings,
            provider: a.provider,
            model: a.model,
          },
        ]);
        setQuery("");
        const [t, p] = await Promise.allSettled([
          request<Thread[]>("investigations"),
          request<Report[]>("reports"),
        ]);
        if (t.status === "fulfilled") setThreads(t.value);
        if (p.status === "fulfilled") setReports(p.value);
        notify("Analysis saved to your investigation history.");
      },
    );
  }
  async function openThread(t: Thread) {
    await perform("Opening saved investigation", async () => {
      const r = repos.find((r) => r.id === t.repository_id);
      if (r) {
        setRepository(r);
        await loadSaved(r);
      }
      const data = await request<{
        messages: Message[];
      }>("investigations/" + t.id);
      setMessages(data.messages);
      setThreadId(t.id);
      const last = [...data.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      setResult(
        last
          ? {
              answer: last.content,
              findings: last.evidence_json || [],
              provider: last.provider,
              model: last.model,
            }
          : null,
      );
      setSelected(null);
      setFile(null);
      setActive("detective");
    });
  }
  async function historicalPreview() {
    if (!repository || !selected || !file) return;
    await perform("Loading historical snapshots", async () => {
      const fetchSnapshot = async (ref: string, path: string) =>
        request<{
          content: string;
        }>(
          `repositories/${repository.id}/snapshot?ref=${ref}&file=${encodeURIComponent(path)}`,
        ).then((r) => r.content);
      const parent = baseSha || selected.parent_shas[0];
      const before =
        file.change_type === "added" && !baseSha
          ? ""
          : parent
            ? await fetchSnapshot(parent, file.previous_path || file.file_path)
            : "";
      const after =
        file.change_type === "removed"
          ? ""
          : await fetchSnapshot(selected.sha, file.file_path);
      setPortal({ before, after });
    });
  }
  const analyzed = commits.filter((c) => c.files),
    files = analyzed.flatMap((c) =>
      (c.files || []).map((f) => ({ ...f, commit: c })),
    ),
    removed = files.filter(
      (f) => f.deletions > 0 || f.change_type === "removed",
    ),
    risks = files.filter((f) =>
      classify(f).includes("Validation or error-handling review"),
    );
  const visible = commits.filter((c) =>
    `${c.message} ${c.sha} ${c.author_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const graveyard = removed.filter((f) =>
    `${f.file_path} ${f.commit.message}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const currentTitle =
    navigation.find((n) => n.id === active)?.label || "Settings";
  const statusBadge = (
    <span className="status-pill">
      <span className="live-dot" />
      {configured ? "Live workspace" : "Setup required"}
    </span>
  );
  const aiConsent = (
    <label className="consent">
      <input
        type="checkbox"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
      />{" "}
      I allow selected public code excerpts to be processed by{" "}
      {processingNotice(provider)}.
    </label>
  );
  const commitList = (
    <div className="commit-list">
      {visible.map((c) => (
        <button
          className={`commit-row ${selected?.sha === c.sha ? "selected" : ""}`}
          key={c.sha}
          onClick={() => inspect(c)}
        >
          <span className="timeline-dot" />
          <div className="commit-description">
            <strong>{c.message.split("\n")[0]}</strong>
            <span>
              {c.author_name} <i>·</i>{" "}
              {new Date(c.committed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
              {c.files && (
                <>
                  <i>·</i>
                  <span className="green">
                    {c.files.length} files inspected
                  </span>
                </>
              )}
            </span>
          </div>
          <code>{c.sha.slice(0, 7)}</code>
          <ChevronRight size={16} />
        </button>
      ))}
      {!visible.length && (
        <div className="empty compact">
          <Search />
          <h3>{search ? "No matching commits" : "No history loaded yet"}</h3>
          <p>
            {search
              ? "Try a commit message, SHA, or author."
              : "Load the first 20 commits from GitHub to begin."}
          </p>
        </div>
      )}
    </div>
  );
  const diffPanel = selected && (
    <section className="panel diff-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">EVIDENCE INSPECTOR</span>
          <h3>{selected.message.split("\n")[0]}</h3>
        </div>
        {selected.html_url && (
          <a
            className="text-link"
            href={selected.html_url}
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ExternalLink size={13} />
          </a>
        )}
      </div>
      <div className="diff-toolbar">
        <select
          aria-label="Changed file"
          value={file?.file_path || ""}
          onChange={(e) => {
            setFile(
              selected.files?.find((f) => f.file_path === e.target.value) ||
                null,
            );
            setPortal(null);
          }}
        >
          {selected.files?.map((f) => (
            <option key={f.file_path} value={f.file_path}>
              {f.file_path}
            </option>
          ))}
        </select>
        {file && (
          <>
            <span className="green">+{file.additions}</span>
            <span className="red">−{file.deletions}</span>
          </>
        )}
      </div>
      {selected.files_incomplete && (
        <p className="notice">
          GitHub returned only the first 100 changed files. This commit has
          incomplete file evidence.
        </p>
      )}
      {file?.previous_path && (
        <p className="notice">
          Renamed from {file.previous_path}. A rename does not establish
          function deletion.
        </p>
      )}
      {portal ? (
        <CodePortal before={portal.before} after={portal.after} />
      ) : file?.patch_excerpt ? (
        <pre className="diff-code">
          {file.patch_excerpt.split("\n").map((l, i) => (
            <div
              key={i}
              className={
                l.startsWith("-")
                  ? "line-removed"
                  : l.startsWith("+")
                    ? "line-added"
                    : l.startsWith("@@")
                      ? "line-hunk"
                      : ""
              }
            >
              <span className="line-counter">{i + 1}</span>
              {l || " "}
            </div>
          ))}
        </pre>
      ) : (
        <div className="empty compact">
          <CircleHelp />
          <h3>Patch unavailable</h3>
          <p>
            GitHub may omit binary, large, or truncated diffs. No line-level
            conclusion is possible.
          </p>
        </div>
      )}
      {file?.diff_truncated && (
        <p className="notice">
          Incomplete diff evidence. This excerpt cannot establish the full scope
          of the change.
        </p>
      )}
      <div className="diff-footer">
        <span>
          <ShieldCheck size={14} /> {"GitHub source evidence"} ·{" "}
          {selected.sha.slice(0, 7)}
        </span>
        <Button
          variant="outline"
          onClick={historicalPreview}
          disabled={!!busy || !file}
        >
          Compare snapshots <History size={14} />
        </Button>
        <Button
          onClick={() => {
            setActive("detective");
            setQuery(
              "Explain this change, its previous behavior, possible effects, and important unknowns.",
            );
          }}
        >
          Ask AI <Sparkles size={14} />
        </Button>
      </div>
    </section>
  );
  return (
    <div className="workspace">
      <aside
        id="workspace-sidebar"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <Link className="sidebar-brand" href="/">
          <Brand />
        </Link>
        <button
          className="workspace-switch"
          onClick={() => setImportOpen(true)}
        >
          <span className="workspace-avatar">P</span>
          <span>
            Personal workspace<small>History is never lost</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${active === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "detective" && <span className="nav-ai">AI</span>}
              {n.id === "graveyard" && removed.length > 0 && (
                <span className="nav-count">{removed.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="gemma-card">
            <Sparkles size={19} />
            <strong>
              A little intelligence.
              <br />A lot of evidence.
            </strong>
            <span>Gemma + Ultramarine</span>
            <button onClick={() => navigate("detective")}>
              Meet your detective <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className={`nav-item ${active === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <a
            className="nav-item"
            href="https://github.com/Y-Udayanga/PhantomCommitAI"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={18} />
            Documentation <ArrowUpRight size={13} />
          </a>
          <div className="profile-row">
            <span className="profile-avatar">P</span>
            <span>
              {displayName || "Your workspace"}
              <small>{"Personal account"}</small>
            </span>
            {configured && (
              <button
                aria-label="Sign out"
                onClick={() =>
                  perform("Signing out", async () => {
                    await request("github/connection", {
                      method: "DELETE",
                    }).catch(() => undefined);
                    await browserDatabase()?.auth.signOut();
                    router.replace("/auth");
                    router.refresh();
                  })
                }
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={mobile}
            aria-controls="workspace-sidebar"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            {statusBadge}
            <a
              href="https://github.com/Y-Udayanga/PhantomCommitAI"
              target="_blank"
              rel="noreferrer"
              aria-label="Project source"
            >
              <Command size={17} />
            </a>
          </div>
        </header>
        <main id="main" className="main-content">
          {!configured && (
            <div className="notice setup">
              <Settings size={18} />
              <span>
                Live mode needs Supabase configuration. Add the values from
                .env.example and apply the SQL migration.
              </span>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {active === "dashboard"
                  ? "YOUR CODEBASE. UNCOVERED."
                  : "PHANTOMCOMMIT INVESTIGATION WORKSPACE"}
              </div>
              <h1>
                {active === "dashboard"
                  ? "The investigation starts here"
                  : currentTitle}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {active === "dashboard"
                  ? "Every commit leaves a trace. Find the stories hiding in your history."
                  : active === "graveyard"
                    ? "Removed code is still part of the story. Follow it back to the evidence."
                    : active === "intelligence"
                      ? "Focused Gemma investigations, grounded in the history you inspect."
                      : active === "detective"
                        ? "Ask the right questions. Let Gemma help you follow the evidence."
                        : "Explore the past. Understand the change. Keep the evidence close."}
              </p>
            </div>
            <Button onClick={() => setImportOpen(true)}>
              <Plus size={16} /> Investigate repository
            </Button>
          </div>
          {![
            "intelligence",
            "detective",
            "recovery",
            "impact",
            "security",
            "timeline",
          ].includes(active) && (
            <ProviderSelect
              provider={provider}
              onChange={changeProvider}
              disabled={!!busy}
            />
          )}
          {error && (
            <div role="alert" className="error-banner">
              <CircleHelp size={17} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {busy && (
            <div className="progress-banner" role="status">
              <LoaderCircle className="spin" size={16} />
              {busy}…
            </div>
          )}
          {active === "intelligence" && (
            <div className="repository-toolbar">
              <div className="row">
                <FolderGit2 size={18} />
                <select
                  aria-label="AI Studio repository"
                  value={repository?.id || ""}
                  onChange={(e) => {
                    const r = repos.find((r) => r.id === e.target.value);
                    if (r) chooseRepo(r);
                  }}
                >
                  <option value="" disabled>
                    Select a repository
                  </option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                disabled={!!busy || !commits.length}
                onClick={analyzeBatch}
              >
                <ScanSearch size={14} />
                Analyze next batch
              </Button>
            </div>
          )}{" "}
          {active === "intelligence" && (
            <AIStudio
              repositoryName={repository?.full_name}
              inspectedCount={analyzed.length}
              selectedSha={selected?.sha}
              ready={analysisReady}
              provider={provider}
              onProviderChange={changeProvider}
              busy={!!busy}
              consent={consent}
              onConsent={setConsent}
              onRun={ask}
              result={result}
              onExport={() => {
                if (result && repository)
                  exportMarkdown(
                    repository?.full_name,
                    reportMarkdown(repository.full_name, result),
                  );
              }}
              onContinue={() => navigate("detective")}
            />
          )}
          {(
            ["recovery", "impact", "security", "timeline"] as string[]
          ).includes(active) && (
            <ForensicWorkbench
              key={`${repository?.id || "empty"}:${active}`}
              initialKind={
                active as "recovery" | "impact" | "security" | "timeline"
              }
              repos={repos}
              repository={repository}
              branches={branches}
              branch={branch}
              selected={selected}
              selectedFile={file}
              commits={commits}
              onRepository={chooseRepo}
            />
          )}
          {active === "dashboard" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="stats-grid">
                {[
                  {
                    label: "Repositories connected",
                    value: repos.length,
                    icon: FolderGit2,
                    detail: "Your investigation workspace",
                    color: "purple",
                  },
                  {
                    label: "Commits inspected",
                    value: analyzed.length,
                    icon: GitCommitHorizontal,
                    detail: `${commits.length} commits in loaded history`,
                    color: "blue",
                  },
                  {
                    label: "Removal artifacts",
                    value: removed.length,
                    icon: GhostIcon,
                    detail: "File and line removals · not functions",
                    color: "purple",
                  },
                  {
                    label: "Changes to review",
                    value: risks.length,
                    icon: ShieldCheck,
                    detail: "Heuristic leads · not confirmed bugs",
                    color: "amber",
                  },
                ].map((s) => (
                  <article className="stat-card" key={s.label}>
                    <div>
                      <span>{s.label}</span>
                      <s.icon size={18} className={s.color} />
                    </div>
                    <strong>
                      {dataLoaded ? s.value.toString().padStart(2, "0") : "—"}
                    </strong>
                    <p>
                      <span className={`tiny-dot ${s.color}`} />
                      {s.detail}
                    </p>
                  </article>
                ))}
              </div>
              <section className="investigation-hero">
                <div className="hero-card-icon">
                  <Ghost size={70} />
                </div>
                <div>
                  <span className="eyebrow">
                    THERE’S MORE TO YOUR CODE THAN HEAD
                  </span>
                  <h2>Some of your best code might be a ghost.</h2>
                  <p>
                    Uncover deleted logic, replay changes, and understand what
                    your codebase left behind.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      repository
                        ? navigate("repositories")
                        : setImportOpen(true)
                    }
                  >
                    Follow the history <ArrowRight size={15} />
                  </Button>
                </div>
                <div className="mini-graph" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </section>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Repository activity</h2>
                      <p>Lines changed across inspected commits</p>
                    </div>
                    <span className="badge badge-muted">Loaded history</span>
                  </div>
                  {analyzed.length ? (
                    <>
                      <ActivityChart commits={analyzed} />
                      <div className="chart-legend">
                        <span className="legend-green" /> Additions{" "}
                        <span className="legend-purple" /> Deletions
                      </div>
                    </>
                  ) : (
                    <div className="empty chart-empty">
                      <GitCommitHorizontal />
                      <h3>A story waiting to unfold</h3>
                      <p>
                        Connect a repository and inspect commits to see real
                        activity.
                      </p>
                    </div>
                  )}
                </section>
                <section className="panel quick-tools">
                  <div className="panel-head">
                    <div>
                      <h2>Your investigation toolkit</h2>
                      <p>Pick a thread. See where it leads.</p>
                    </div>
                    <ScanSearch size={19} />
                  </div>
                  {[
                    {
                      icon: GhostIcon,
                      title: "Explore the graveyard",
                      text: "Discover what disappeared",
                      target: "graveyard",
                      color: "purple",
                    },
                    {
                      icon: History,
                      title: "Replay a moment",
                      text: "Compare the before and after",
                      target: "replay",
                      color: "blue",
                    },
                    {
                      icon: Sparkles,
                      title: "Consult the detective",
                      text: "Ask Gemma about the evidence",
                      target: "detective",
                      color: "amber",
                    },
                  ].map((t) => (
                    <button key={t.title} onClick={() => navigate(t.target)}>
                      <span className={`tool-icon ${t.color}`}>
                        <t.icon size={20} />
                      </span>
                      <span>
                        <strong>{t.title}</strong>
                        <small>{t.text}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </section>
              </div>
              <section className="panel repo-panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Connected repositories{" "}
                      <span className="count-badge">{repos.length}</span>
                    </h2>
                    <p>Your next discovery is one commit away.</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate("repositories")}
                  >
                    View explorer <ArrowRight size={14} />
                  </button>
                </div>
                {repos.length ? (
                  repos.map((r) => (
                    <button
                      key={r.id}
                      className="repository-row"
                      onClick={() => {
                        if (r.id !== repository?.id) chooseRepo(r);
                        navigate("repositories");
                      }}
                    >
                      <span className="repo-symbol">
                        <FolderGit2 size={23} />
                      </span>
                      <span>
                        <strong>{r.full_name}</strong>
                        <small>
                          {r.description || "Public GitHub repository"}
                        </small>
                      </span>
                      <span className="branch-label">
                        <GitBranch size={13} />
                        {r.default_branch}
                      </span>
                      <span className="badge badge-green">{"Connected"}</span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))
                ) : (
                  <div className="empty compact">
                    <FolderGit2 />
                    <h3>No repositories connected</h3>
                    <p>
                      Start with a small public repository. Import metadata,
                      then load history on demand.
                    </p>
                    <Button onClick={() => setImportOpen(true)}>
                      <Plus size={14} />
                      Connect repository
                    </Button>
                  </div>
                )}
              </section>
              <div className="section-title">
                <h2>Recent investigations</h2>
                <span className="muted small">
                  Saved conversations & evidence
                </span>
              </div>
              {threads.length ? (
                <div className="investigation-grid">
                  {threads.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      className="investigation-card"
                      onClick={() => openThread(t)}
                    >
                      <span className="badge badge-purple">
                        Saved investigation
                      </span>
                      <h3>{t.title}</h3>
                      <p>{t.repositories?.full_name}</p>
                      <span>
                        <Clock3 size={13} />
                        {new Date(t.created_at).toLocaleDateString()}
                        <ArrowUpRight size={15} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="quiet-empty">
                  <ScanSearch size={20} />
                  <span>
                    Your first saved investigation will appear here. Ask Gemma a
                    question to start one.
                  </span>
                  <button
                    className="text-link"
                    onClick={() => navigate("detective")}
                  >
                    Open detective <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
          {[
            "repositories",
            "graveyard",
            "replay",
            "haunted-bugs",
            "resurrection",
            "detective",
          ].includes(active) && (
            <>
              <div className="repository-toolbar">
                <div className="row">
                  <FolderGit2 size={18} />
                  <select
                    aria-label="Active repository"
                    value={repository?.id || ""}
                    onChange={(e) => {
                      const r = repos.find((r) => r.id === e.target.value);
                      if (r) chooseRepo(r);
                    }}
                  >
                    <option value="" disabled>
                      Select a repository
                    </option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                  <span className="branch-label">
                    <GitBranch size={13} />
                    {branch || repository?.default_branch || "—"}
                  </span>
                </div>
                <div className="row">
                  <span className="muted small">
                    {analyzed.length}/{commits.length} commits inspected
                  </span>
                  {repository && (
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => loadHistory()}
                    >
                      <RefreshCw size={14} />
                      Load history
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={!!busy || !commits.length}
                    onClick={analyzeBatch}
                  >
                    <ScanSearch size={14} />
                    Analyze next batch
                  </Button>
                </div>
              </div>
              {!repository ? (
                <div className="empty panel">
                  <Ghost size={60} />
                  <h2>Every investigation needs a repository.</h2>
                  <p>
                    Connect a public GitHub repository to uncover its history.
                  </p>
                  <Button onClick={() => setImportOpen(true)}>
                    Connect repository <Plus size={15} />
                  </Button>
                </div>
              ) : (
                <>
                  {active === "repositories" && (
                    <>
                      <div className="explorer-controls">
                        <label className="search-field">
                          <Search size={16} />
                          <input
                            placeholder="Search commits, authors, or SHA…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <kbd>⌕</kbd>
                        </label>
                        <Button
                          variant="outline"
                          disabled={!!busy}
                          onClick={() =>
                            perform("Loading branches", async () => {
                              const r = await request<{
                                branches: {
                                  name: string;
                                }[];
                                more: boolean;
                              }>(`repositories/${repository.id}/branches`);
                              setBranches(r.branches.map((b) => b.name));
                              if (r.more)
                                notify("Showing the first 100 branches.");
                            })
                          }
                        >
                          <GitBranch size={14} />
                          Branches
                        </Button>
                        {branches.length > 0 && (
                          <select
                            aria-label="Branch"
                            value={branch}
                            onChange={(e) => {
                              setBranch(e.target.value);
                              loadHistory(1, e.target.value);
                            }}
                          >
                            {branches.map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>Commit history</h2>
                            <p>
                              Real metadata first. Inspect a commit to retrieve
                              its file evidence.
                            </p>
                          </div>
                          <span className="badge badge-muted">
                            {commits.length} loaded
                          </span>
                        </div>
                        {commitList}
                        {more && (
                          <div className="load-more">
                            <Button
                              variant="outline"
                              disabled={!!busy}
                              onClick={() => loadHistory(page + 1)}
                            >
                              Load next 20 commits <ChevronDown size={15} />
                            </Button>
                          </div>
                        )}
                      </section>
                      {diffPanel}
                    </>
                  )}
                  {active === "graveyard" && (
                    <>
                      <div className="explorer-controls">
                        <label className="search-field">
                          <Search size={16} />
                          <input
                            placeholder="Search removed files…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <span className="muted small">
                          Removed lines and files · historical evidence
                        </span>
                      </div>
                      <div className="artifact-grid">
                        {graveyard.map((f, i) => (
                          <button
                            className="artifact-card"
                            key={f.commit.sha + f.file_path}
                            onClick={() => {
                              setSelected(f.commit);
                              setFile(f);
                              setPortal(null);
                            }}
                          >
                            <div className="row">
                              <span className="artifact-icon">
                                <Ghost size={31} />
                              </span>
                              <span
                                className={`badge ${f.change_type === "removed" ? "badge-purple" : "badge-muted"}`}
                              >
                                {f.change_type === "removed"
                                  ? "Deleted file"
                                  : f.change_type === "renamed"
                                    ? "Renamed file"
                                    : "Removed lines"}
                              </span>
                            </div>
                            <span className="artifact-number">
                              ARTIFACT {String(i + 1).padStart(3, "0")}
                            </span>
                            <h3>{f.file_path.split("/").pop()}</h3>
                            <p>{f.file_path}</p>
                            <div className="artifact-meta">
                              <span>−{f.deletions} lines</span>
                              <code>{f.commit.sha.slice(0, 7)}</code>
                              <ArrowUpRight size={15} />
                            </div>
                            <small>
                              {new Date(
                                f.commit.committed_at,
                              ).toLocaleDateString()}{" "}
                              · {f.commit.author_name}
                            </small>
                          </button>
                        ))}
                      </div>
                      {!graveyard.length && (
                        <div className="empty panel">
                          <Ghost size={44} />
                          <h3>No removal evidence in this scope</h3>
                          <p>
                            Inspect more commits or analyze the next batch.
                            Missing evidence does not mean no code was removed.
                          </p>
                        </div>
                      )}
                      {diffPanel}
                    </>
                  )}
                  {active === "replay" && (
                    <>
                      <div className="replay-grid">
                        <section className="panel">
                          <div className="panel-head">
                            <div>
                              <h2>Haunted commit map</h2>
                              <p>Parent links from Git metadata</p>
                            </div>
                            <GitBranch size={18} />
                          </div>
                          {commits.length ? (
                            <CommitGraph commits={commits} onSelect={inspect} />
                          ) : (
                            <div className="empty compact">
                              Load history to build the map.
                            </div>
                          )}
                        </section>
                        <section className="panel">
                          <div className="panel-head">
                            <div>
                              <h2>Choose a moment</h2>
                              <p>Select a commit, then compare snapshots.</p>
                            </div>
                            <History size={19} />
                          </div>
                          <div className="short-commit-list">{commitList}</div>
                        </section>
                      </div>
                      {selected && (
                        <div className="compare-control">
                          <label>
                            Compare against{" "}
                            <select
                              aria-label="Comparison base commit"
                              value={baseSha}
                              onChange={(e) => {
                                setBaseSha(e.target.value);
                                setPortal(null);
                              }}
                            >
                              <option value="">First parent (default)</option>
                              {commits
                                .filter((c) => c.sha !== selected.sha)
                                .map((c) => (
                                  <option key={c.sha} value={c.sha}>
                                    {c.sha.slice(0, 7)} ·{" "}
                                    {c.message.slice(0, 45)}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <Button
                            variant="outline"
                            onClick={historicalPreview}
                            disabled={!!busy || !file}
                          >
                            Open code portal <ArrowRight size={14} />
                          </Button>
                        </div>
                      )}
                      {diffPanel}
                    </>
                  )}
                  {active === "haunted-bugs" && (
                    <>
                      <div className="notice">
                        <ShieldCheck size={18} />
                        <span>
                          These are deterministic review leads, not verified
                          vulnerabilities. Gemma can investigate possible
                          effects after you inspect the evidence.
                        </span>
                      </div>
                      <div className="risk-list">
                        {risks.map((f) => (
                          <article
                            className="panel risk-card"
                            key={f.commit.sha + f.file_path}
                          >
                            <span className="tool-icon amber">
                              <Bug size={22} />
                            </span>
                            <div>
                              <span className="badge badge-amber">
                                Review lead · hypothesis
                              </span>
                              <h3>
                                Validation or error-handling lines changed
                              </h3>
                              <p>
                                {f.file_path} ·{" "}
                                {f.commit.message.split("\n")[0]}
                              </p>
                              <code>{f.commit.sha.slice(0, 7)}</code>
                              <p className="small muted">
                                Keyword matching in removed lines. Check for
                                replacement logic before drawing conclusions.
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelected(f.commit);
                                setFile(f);
                                setActive("detective");
                                setQuery(
                                  "Investigate whether the removed validation or error handling was replaced. Explain possible risks and what must be tested.",
                                );
                              }}
                            >
                              Investigate <ArrowUpRight size={14} />
                            </Button>
                          </article>
                        ))}
                      </div>
                      {!risks.length && (
                        <div className="empty panel">
                          <ShieldCheck size={40} />
                          <h3>No heuristic leads in inspected changes</h3>
                          <p>
                            This is not a security audit. Analyze more history
                            to expand the scope.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {active === "resurrection" && (
                    <>
                      <div className="notice">
                        <FlaskConical size={18} />
                        <span>
                          Restoration proposals are generated for developer
                          review. Nothing is applied or committed automatically.
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigate("recovery")}
                      >
                        Open smart code recovery and validated patch preview
                      </Button>
                      <div className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>Choose an artifact to restore</h2>
                            <p>
                              Select removed functionality, then request a
                              compatibility and testing plan.
                            </p>
                          </div>
                        </div>
                        {removed.map((f) => (
                          <button
                            className="commit-row"
                            key={f.commit.sha + f.file_path}
                            onClick={() => {
                              setSelected(f.commit);
                              setFile(f);
                              setPortal(null);
                            }}
                          >
                            <GhostIcon size={18} />
                            <strong>{f.file_path}</strong>
                            <code>{f.commit.sha.slice(0, 7)}</code>
                            {selected?.sha === f.commit.sha &&
                            file?.file_path === f.file_path ? (
                              <Check size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>
                        ))}
                        {!removed.length && (
                          <div className="empty compact">
                            Analyze commits to discover historical artifacts.
                          </div>
                        )}
                      </div>
                      {diffPanel}
                      {selected && (
                        <section className="panel ai-action-panel">
                          <h3>Plan a careful resurrection.</h3>
                          <p>
                            The selected AI will suggest a patch, dependencies,
                            compatibility concerns, and tests using this
                            commit’s evidence.
                          </p>
                          {aiConsent}
                          <Button
                            disabled={!!busy || !consent || !analysisReady}
                            onClick={() =>
                              ask(
                                "restore",
                                `Propose a reviewed restoration patch for ${file?.file_path}. Include compatibility concerns, dependencies, unknowns, and suggested tests. Do not apply it.`,
                              )
                            }
                          >
                            <Sparkles size={15} />
                            Generate restoration proposal
                          </Button>
                          {result?.findings.map((f, i) => (
                            <EvidenceCard key={i} finding={f} />
                          ))}
                        </section>
                      )}
                    </>
                  )}
                  {active === "detective" && (
                    <div className="detective-grid">
                      <section className="panel detective-chat">
                        <div className="panel-head">
                          <div className="row">
                            <span className="tool-icon purple">
                              <ScanSearch size={22} />
                            </span>
                            <div>
                              <h2>Meet your AI detective</h2>
                              <p>
                                {providerLabel(provider)} · evidence-aware
                                investigation
                              </p>
                            </div>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => {
                              setThreadId(undefined);
                              setMessages([]);
                              setResult(null);
                              setSelected(null);
                            }}
                          >
                            New investigation <Plus size={14} />
                          </button>
                        </div>
                        <div
                          className="chat-messages"
                          ref={chatMessages}
                          aria-live="polite"
                          aria-busy={!!busy}
                        >
                          {!messages.length ? (
                            <div className="detective-welcome">
                              <div className="detective-orb">
                                <Ghost size={55} />
                              </div>
                              <h2>What’s haunting your codebase?</h2>
                              <p>
                                Investigate a change, trace missing
                                functionality,
                                <br />
                                or find the next commit worth reviewing.
                              </p>
                              <div className="prompt-grid">
                                {[
                                  "Explain the changes in the inspected commits.",
                                  "Which removed checks deserve a closer look?",
                                  "Help investigate a regression in authentication.",
                                  "What functionality could be safely restored?",
                                ].map((q) => (
                                  <button key={q} onClick={() => setQuery(q)}>
                                    {q}
                                    <ArrowUpRight size={14} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            messages.map((m, i) => (
                              <article
                                className={`chat-message ${m.role}`}
                                key={i}
                              >
                                <span className="message-label">
                                  {m.role === "user"
                                    ? "YOU"
                                    : (m.provider === "ultramarine"
                                        ? "ULTRAMARINE"
                                        : m.model?.startsWith("gemini-")
                                          ? "GEMINI"
                                          : "GEMMA") + " · GENERATED ANALYSIS"}
                                </span>
                                {m.role !== "user" && m.model && (
                                  <small className="muted">
                                    Model: {m.model}
                                  </small>
                                )}
                                <p>{m.content}</p>
                                {m.evidence_json?.map((f, j) => (
                                  <EvidenceCard key={j} finding={f} />
                                ))}
                              </article>
                            ))
                          )}
                        </div>
                        <form
                          className="chat-composer"
                          onSubmit={(e) => {
                            e.preventDefault();
                            ask("chat");
                          }}
                        >
                          <ProviderSelect
                            provider={provider}
                            onChange={changeProvider}
                            disabled={!!busy}
                          />
                          <div className="chat-scope">
                            <GitCommitHorizontal size={13} />
                            {selected
                              ? `${selected.sha.slice(0, 7)} · selected commit`
                              : `${analyzed.length} inspected commits · bounded history`}{" "}
                            {selected && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(null);
                                  setFile(null);
                                }}
                              >
                                Use all inspected commits
                              </button>
                            )}
                          </div>
                          <textarea
                            aria-label="Investigation question"
                            placeholder="Ask about a change, a missing feature, or a suspected regression…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            maxLength={2500}
                          />
                          {aiConsent}
                          {error && (
                            <p role="alert" className="red">
                              {error}
                            </p>
                          )}
                          {busy && (
                            <p role="status">
                              <LoaderCircle className="spin" size={16} /> {busy}
                              …
                            </p>
                          )}
                          <div className="composer-footer">
                            <span>
                              <ShieldCheck size={12} />
                              {chatReady
                                ? "References checked against Git evidence"
                                : "Selected provider is not configured"}
                            </span>
                            <Button
                              type="submit"
                              disabled={
                                !!busy ||
                                query.trim().length < 3 ||
                                !consent ||
                                !chatReady
                              }
                            >
                              {busy ? (
                                <LoaderCircle size={15} className="spin" />
                              ) : (
                                <Send size={15} />
                              )}
                              {busy ? "Investigating…" : "Investigate"}
                            </Button>
                          </div>
                        </form>
                      </section>
                      <aside className="detective-context">
                        <section className="panel">
                          <div className="panel-head">
                            <h3>Evidence scope</h3>
                            <ShieldCheck size={17} />
                          </div>
                          <div className="context-body">
                            <span className="badge badge-purple">
                              {repository.full_name}
                            </span>
                            <p>
                              {analyzed.length} commits inspected. Up to 5
                              relevant commits and 40,000 context characters per
                              AI request.
                            </p>
                            <p>
                              Ranking: message keyword match +3, file path +2,
                              patch +1. Ties retain commit order.
                            </p>
                            <p>
                              “Reference verified” checks SHA, path, and
                              supplied line excerpts. It does not prove the AI’s
                              interpretation.
                            </p>
                            <button
                              className="text-link"
                              onClick={() => navigate("repositories")}
                            >
                              Inspect more evidence <ArrowRight size={13} />
                            </button>
                          </div>
                        </section>
                        <section className="panel">
                          <div className="panel-head">
                            <h3>Saved investigations</h3>
                            <History size={16} />
                          </div>
                          <div className="context-body">
                            {threads.length ? (
                              threads.map((t) => (
                                <button
                                  key={t.id}
                                  className="saved-thread"
                                  onClick={() => openThread(t)}
                                >
                                  <ScanSearch size={14} />
                                  {t.title}
                                  <ChevronRight size={13} />
                                </button>
                              ))
                            ) : (
                              <p>
                                Conversations save automatically after
                                successful AI analysis.
                              </p>
                            )}
                          </div>
                        </section>
                        {result && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              exportMarkdown(
                                repository.full_name,
                                reportMarkdown(repository.full_name, result),
                              )
                            }
                          >
                            <Download size={15} /> Export investigation
                          </Button>
                        )}
                      </aside>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {active === "reports" && (
            <>
              <ReportIntro
                consent={aiConsent}
                disabled={!!busy || !repository || !consent || !analysisReady}
                onGenerate={() =>
                  ask(
                    "report",
                    "Generate an investigation report: executive summary, scope, confirmed observations, possible risks, unresolved questions, next steps, and evidence references.",
                  )
                }
              />

              {reports.map((r) => {
                let a: Analysis;
                try {
                  a = JSON.parse(r.report_content);
                } catch {
                  return null;
                }
                return (
                  <ReportCard
                    key={r.id}
                    title={r.title}
                    createdAt={r.created_at}
                    answer={a.answer}
                    findings={a.findings}
                    onExport={() =>
                      exportMarkdown(r.title, reportMarkdown(r.title, a))
                    }
                    onPrint={() => window.print()}
                  />
                );
              })}
              {!reports.length && (
                <div className="empty">
                  <FileText size={42} />
                  <h3>No reports yet</h3>
                  <p>
                    Inspect commit evidence, then generate your first saved
                    report.
                  </p>
                </div>
              )}
            </>
          )}
          {active === "settings" && (
            <div className="settings-grid">
              <GitHubConnection
                connection={gitHubConnection}
                busy={!!busy}
                onDisconnect={disconnectGitHub}
              />
              <section className="panel settings-card">
                <h2>Profile & appearance</h2>
                <div className="settings-status">
                  <span>Color theme</span>
                  <ThemeToggle />
                </div>
                <p>{profileEmail || "Sign in to manage your profile."}</p>
                <label>
                  Display name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                    placeholder="Display name"
                  />
                </label>
                <Button
                  disabled={!configured || !!busy || !displayName.trim()}
                  onClick={() =>
                    perform("Saving profile", async () => {
                      await request("profile", {
                        method: "PATCH",
                        body: JSON.stringify({ display_name: displayName }),
                      });
                      notify("Profile saved.");
                    })
                  }
                >
                  Save profile <Check size={14} />
                </Button>
              </section>
              <section className="panel settings-card">
                <h2>AI connections & scope</h2>
                <p>
                  Analysis uses batches of 3 commits. Each history page
                  retrieves up to 20 commits. No repository code is executed.
                </p>
                <div className="settings-status">
                  <Sparkles size={18} />
                  <span>Gemma · analysis tools</span>
                  <span
                    className={`badge ${aiReady ? "badge-green" : "badge-muted"}`}
                  >
                    {aiReady ? "Configured" : "Not configured"}
                  </span>
                </div>
                <p>
                  Ultramarine:{" "}
                  {ultramarineReady ? "Configured" : "Not configured"}. AI
                  Detective key:{" "}
                  {detectiveReady
                    ? "Configured · provider access unverified"
                    : "Not configured"}
                  . Gemma keys are routed separately; Google quota is
                  project-scoped.
                </p>{" "}
                <p>
                  Selected excerpts are sent to the selected provider only after
                  consent. Keys remain on the server. Model availability
                  requires a successful provider request.
                </p>
              </section>
              <section className="panel settings-card">
                <h2>Connected repositories</h2>
                {repos.map((r) => (
                  <div className="settings-status" key={r.id}>
                    <span>{r.full_name}</span>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      aria-label={`Delete ${r.full_name}`}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete all stored investigation data for ${r.full_name}? This cannot be undone.`,
                          )
                        )
                          return;
                        perform("Deleting repository data", async () => {
                          await request(`repositories/${r.id}`, {
                            method: "DELETE",
                          });
                          setRepos((prev) => prev.filter((p) => p.id !== r.id));
                          if (repository?.id === r.id) {
                            setRepository(null);
                            setCommits([]);
                            setSelected(null);
                            setFile(null);
                          }
                          setThreads((prev) =>
                            prev.filter((t) => t.repository_id !== r.id),
                          );
                          setReports([]);
                          notify(
                            "Stored repository and related investigation data deleted.",
                          );
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </section>
              <section className="panel settings-card danger-zone">
                <h2>Delete investigation data</h2>
                <p>
                  Permanently remove all imported repositories, commits,
                  conversations, AI cache, findings, and reports in your
                  account. Your authentication account remains.
                </p>
                <Button
                  variant="outline"
                  disabled={!configured || !!busy || !repos.length}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Permanently delete ALL investigation data? This cannot be undone.",
                      )
                    )
                      return;
                    perform("Deleting all investigation data", async () => {
                      await request("profile", { method: "DELETE" });
                      setRepos([]);
                      setCommits([]);
                      setThreads([]);
                      setReports([]);
                      setRepository(null);
                      setSelected(null);
                      setFile(null);
                      setMessages([]);
                      setResult(null);
                      notify("All investigation data deleted.");
                    });
                  }}
                >
                  <Trash2 size={15} />
                  Delete all investigation data
                </Button>
              </section>
            </div>
          )}
          <div className="workspace-footer">
            <span>
              <Ghost size={16} /> Code never truly dies.
            </span>
            <span>
              PhantomCommit AI <i>·</i> {"Evidence over assumptions"}
            </span>
          </div>
        </main>
      </div>
      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close import"
              onClick={() => setImportOpen(false)}
            >
              <X size={20} />
            </button>
            <span className="tool-icon purple">
              <FolderGit2 size={27} />
            </span>
            <h2 id="import-title">A new investigation awaits.</h2>
            <p>
              Enter a public GitHub repository link. We retrieve real history
              and never execute repository code.
            </p>
            {gitHubConnection.configured && !gitHubConnection.connected && (
              <GitHubConnection
                connection={gitHubConnection}
                busy={!!busy}
                onDisconnect={disconnectGitHub}
              />
            )}
            <RepositoryBatchForm
              value={repoUrl}
              onChange={(value) => {
                setRepoUrl(value);
                setImportResults([]);
                setError("");
              }}
              onSubmit={importRepo}
              onOpen={() => setImportOpen(false)}
              busy={!!busy}
              configured={configured}
              error={error}
              results={importResults}
            />
            <small>
              <ShieldCheck size={13} /> Public repositories only. Private
              repository support is planned.
            </small>
          </section>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
