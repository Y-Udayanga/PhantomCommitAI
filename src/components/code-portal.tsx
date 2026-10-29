"use client";
import { DiffEditor, loader } from "@monaco-editor/react";
import { useTheme } from "./theme-toggle";
loader.config({ paths: { vs: "/monaco/vs" } });
export default function CodePortal({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const theme = useTheme();
  return (
    <DiffEditor
      height="400px"
      theme={theme === "light" ? "light" : "vs-dark"}
      original={before}
      modified={after}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        automaticLayout: true,
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        renderSideBySideInlineBreakpoint: 700,
      }}
      loading={<div className="skeleton">Loading code portal…</div>}
    />
  );
}
