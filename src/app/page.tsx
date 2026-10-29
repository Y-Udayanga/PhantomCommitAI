import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  ShieldCheck,
  Sparkles,
  History,
  GitFork,
  Fingerprint,
  Code2,
} from "lucide-react";
import { Brand, Ghost } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" aria-label="PhantomCommit home">
          <Brand />
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">The toolkit</a>
          <a
            href="https://github.com/Y-Udayanga/PhantomCommitAI"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={17} /> GitHub
          </a>
        </nav>
        <Button asChild variant="outline">
          <Link href="/auth">
            Open workspace <ArrowUpRight size={15} />
          </Link>
        </Button>
      </header>
      <main id="main">
        <section className="hero">
          <div className="eyebrow">
            <span className="live-dot" /> GIT HISTORY, WITH A SIXTH SENSE{" "}
            <span className="new-tag">GEMMA POWERED</span>
          </div>
          <h1>
            Every codebase
            <br />
            has a <span>ghost story.</span>
          </h1>
          <p className="hero-copy">
            Find the code that disappeared. Understand what changed.
            <br />
            Turn forgotten Git history into your next breakthrough.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/repositories">
                Investigate repository <ArrowRight size={17} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/intelligence">
                Open AI Studio <Sparkles size={17} />
              </Link>
            </Button>
          </div>
          <p className="hero-note">
            <ShieldCheck size={14} /> Public repositories. Verifiable evidence.
            Nothing executed.
          </p>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit-ring" />
            <div className="orbit-ring second" />
            <span className="orbit-ghost">
              <Ghost size={115} />
            </span>
            <span className="orbit-code code-one">HISTORICAL CHANGES</span>
            <span className="orbit-code code-two">VERIFIED REFERENCES</span>
            <span className="orbit-commit">
              <GitBranch size={18} /> Repository history <i /> history preserved
            </span>
            <div className="orbit-node n1" />
            <div className="orbit-node n2" />
            <div className="orbit-node n3" />
          </div>
        </section>
        <section className="trust-strip">
          <span>CODE NEVER TRULY DIES. IT JUST WAITS TO BE UNDERSTOOD.</span>
          <span>
            <GitBranch size={17} /> GitHub REST API
          </span>
          <span>
            <Sparkles size={17} /> Google Gemma
          </span>
          <span>
            <ShieldCheck size={17} /> Evidence first
          </span>
        </section>
        <section id="features" className="landing-section">
          <div className="eyebrow">THE INVESTIGATION TOOLKIT</div>
          <h2>Go beyond the latest commit.</h2>
          <div className="feature-grid">
            {[
              {
                icon: History,
                title: "Replay the past",
                text: "Navigate real commit history and compare historical code, side by side.",
                href: "/replay",
              },
              {
                icon: Fingerprint,
                title: "Follow every clue",
                text: "Trace removals and suspicious changes back to their exact Git evidence.",
                href: "/graveyard",
              },
              {
                icon: Sparkles,
                title: "Ask a better detective",
                text: "Let Gemma explain a change, investigate a regression, or suggest a safe restoration.",
                href: "/intelligence",
              },
            ].map((f) => (
              <Link className="feature-card" href={f.href} key={f.title}>
                <f.icon size={25} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </div>
        </section>
        <section id="how" className="landing-section how">
          <div>
            <div className="eyebrow">FROM REPOSITORY TO REVELATION</div>
            <h2>
              History is the evidence.
              <br />
              Gemma connects the dots.
            </h2>
            <p>
              Open-weight reasoning, hosted through Google’s Gemini API.
              Selected code excerpts are processed by Google only when you
              request AI analysis.
            </p>
          </div>
          <ol>
            {[
              "Connect a public GitHub repository",
              "Inspect commits, changes, and deleted code",
              "Ask Gemma. Verify the evidence. Save the story.",
            ].map((t, i) => (
              <li key={t}>
                <span>0{i + 1}</span>
                {t}
                <Code2 size={19} />
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Built for the ghosts in the machine.</span>
        <a href="https://github.com/Y-Udayanga/PhantomCommitAI">
          Open source <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
