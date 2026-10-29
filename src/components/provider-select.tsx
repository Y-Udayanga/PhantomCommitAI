"use client";
import type { AIProvider } from "@/lib/ai-provider";
export function ProviderSelect({
  provider,
  onChange,
  disabled,
}: {
  provider: AIProvider;
  onChange: (p: AIProvider) => void;
  disabled?: boolean;
}) {
  return (
    <label className="provider-select">
      AI provider
      <select
        aria-label="AI provider"
        value={provider}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AIProvider)}
      >
        <option value="gemma">Google Gemma</option>
        <option value="ultramarine">Ultramarine</option>
      </select>
    </label>
  );
}
