"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { Brand, Ghost } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { browserDatabase } from "@/lib/supabase-browser";
import { ThemeToggle } from "@/components/theme-toggle";
function AuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "update">(
      params.get("action") === "update" ? "update" : "signin",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const db = browserDatabase();
      if (!db)
        throw new Error(
          "Supabase is not configured. Set the two public Supabase environment variables and apply the migration, then restart.",
        );
      const action = mode;
      if (action === "signin") {
        const r = await db.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        router.replace("/dashboard");
        router.refresh();
      }
      if (action === "signup") {
        const r = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (r.error) throw r.error;
        if (r.data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else
          setMessage("Check your email to verify your account, then sign in.");
      }
      if (action === "reset") {
        const r = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth%3Faction%3Dupdate`,
        });
        if (r.error) throw r.error;
        setMessage(
          "If this account exists, a password reset link will arrive by email.",
        );
      }
      if (action === "update") {
        const r = await db.auth.updateUser({ password });
        if (r.error) throw r.error;
        setMessage("Password updated. You can open your workspace.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page" id="main">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <section className="auth-story">
        <Link href="/">
          <Brand />
        </Link>
        <div>
          <div className="auth-ghost">
            <Ghost size={110} />
          </div>
          <h1>
            Code never
            <br />
            truly dies.
            <br />
            <span>Follow its story.</span>
          </h1>
          <p>
            Investigate the past. Understand the present. Build a better future
            for your codebase.
          </p>
        </div>
        <small>PHANTOMCOMMIT AI · EVIDENCE OVER ASSUMPTIONS</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <div className="eyebrow">YOUR NEXT DISCOVERY AWAITS</div>
          <h2>
            {mode === "signup"
              ? "Create your workspace."
              : mode === "reset"
                ? "Reset your password."
                : mode === "update"
                  ? "Choose a new password."
                  : "Welcome back, detective."}
          </h2>
          <p>
            {mode === "signup"
              ? "Start uncovering the stories hidden in Git history."
              : "Your evidence, investigations, and discoveries are waiting."}
          </p>
          {message && (
            <div role="status" className="auth-message">
              {message} <Link href="/dashboard">Open workspace →</Link>
            </div>
          )}
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            {mode !== "update" && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <>
                  {mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : mode === "update"
                        ? "Update password"
                        : "Sign in to workspace"}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
          <div className="auth-links">
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
                setMessage("");
              }}
            >
              {mode === "signup"
                ? "Already have an account?"
                : "Create an account"}
            </button>
            <button
              onClick={() => {
                setMode("reset");
                setError("");
                setMessage("");
              }}
            >
              Forgot password?
            </button>
          </div>
          <button className="auth-demo" onClick={() => setMode("update")}>
            Following a password reset link? Set your new password.
          </button>
          <p className="auth-assurance">
            <ShieldCheck size={15} /> Your repositories and investigations stay
            scoped to your account.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function Auth() {
  return (
    <Suspense
      fallback={
        <main className="empty" id="main">
          Loading sign in…
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
