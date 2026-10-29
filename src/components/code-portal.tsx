"use client";
import { DiffEditor, loader } from "@monaco-editor/react";
loader.config({ paths: { vs: "/monaco/vs" } });
export default function CodePortal({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <DiffEditor
      height="400px"
      theme="vs-dark"
      original={before}
      modified={after}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        automaticLayout: true,
        renderSideBySide: true,
      }}
      loading={<div className="skeleton">Loading code portal…</div>}
    />
  );
}
