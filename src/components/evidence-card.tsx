import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import type { Finding } from "@/lib/types";
export function EvidenceCard({ finding: f }: { finding: Finding }) {
  return (
    <article className="finding">
      <div className="row">
        <span
          className={`badge ${f.severity === "high" ? "badge-red" : "badge-purple"}`}
        >
          {f.severity} risk
        </span>
        <span className="muted small">
          {f.evidence_status === "direct"
            ? "Direct observation"
            : f.evidence_status === "insufficient"
              ? "Insufficient evidence"
              : f.evidence_status}
        </span>
      </div>
      <h3>{f.title}</h3>
      <p>{f.summary}</p>
      <pre className="finding-explanation">{f.explanation}</pre>
      {f.evidence.map((e, i) => (
        <div className="evidence-row" key={i}>
          <ShieldCheck size={14} />
          <code>
            {e.sha.slice(0, 7)} · {e.file_path}
            {e.line ? `:${e.line}` : ""}
          </code>
          <span>
            {e.verified ? "Reference verified" : "Insufficient evidence"}
          </span>
          {e.verified && /^https:\/\/github\.com\//.test(e.html_url) && (
            <a
              href={e.html_url}
              target="_blank"
              rel="noreferrer"
              aria-label="View GitHub evidence"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      ))}
      <div className="next-action">
        <ArrowRight size={14} />
        {f.recommended_action}
      </div>
    </article>
  );
}
