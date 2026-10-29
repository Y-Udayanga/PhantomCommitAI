"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="empty" style={{ minHeight: "100vh" }}>
      <h1>The trail was interrupted.</h1>
      <p>We couldn’t load this page. Retry, or return to the workspace.</p>
      <Button onClick={reset}>Try again</Button>
      <Link href="/dashboard">Return to dashboard</Link>
    </main>
  );
}
