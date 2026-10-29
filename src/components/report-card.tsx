import { Download, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { EvidenceCard } from "./evidence-card";
import { Button } from "./ui/button";
import type { Finding } from "@/lib/types";

export function ReportIntro({
  consent,
  disabled,
  onGenerate,
}: {
  consent: ReactNode;
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="panel report-intro">
      <span className="tool-icon purple">
        <FileText size={26} />
      </span>
      <div>
        <h2>Turn evidence into a clear story.</h2>
        <p>
          Generate a professional report with observations, risks, unknowns, and
          evidence references.
        </p>
        {consent}
      </div>
      <Button disabled={disabled} onClick={onGenerate}>
        <Sparkles size={15} /> Generate report
      </Button>
    </section>
  );
}

export function ReportCard({
  title,
  createdAt,
  answer,
  findings,
  onExport,
  onPrint,
}: {
  title: string;
  createdAt: string;
  answer: string;
  findings: Finding[];
  onExport: () => void;
  onPrint: () => void;
}) {
  return (
    <article className="panel report-card">
      <div className="panel-head report-card-header">
        <div className="report-heading">
          <span className="eyebrow">SAVED INVESTIGATION REPORT</span>
          <h2>{title}</h2>
          <p>{new Date(createdAt).toLocaleString()}</p>
        </div>
        <div className="report-actions">
          <Button variant="outline" onClick={onExport}>
            <Download size={15} /> Markdown
          </Button>
          <Button variant="outline" onClick={onPrint}>
            Print
          </Button>
        </div>
      </div>
      <div className="report-body">
        <p>{answer}</p>
        {findings.map((finding, i) => (
          <EvidenceCard key={i} finding={finding} />
        ))}
      </div>
    </article>
  );
}
