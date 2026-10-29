/** Conservative masking, not an exhaustive credential detector. */
export function maskSecrets(text: string): string {
  return text
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]+|AIza[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:password|passwd|secret|api[_-]?key|access[_-]?token|service[_-]?role[_-]?key)["']?\s*[=:]\s*["'`])[^"'`\r\n]{4,}(["'`])/gi,
      "$1[REDACTED]$2",
    )
    .replace(
      /((?:PASSWORD|SECRET|API_KEY|ACCESS_TOKEN|SERVICE_ROLE_KEY)\s*=\s*)(?!["'`\s])[^\r\n\s]{4,}/g,
      "$1[REDACTED]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED JWT]",
    );
}
export function redactValue<T>(value: T): T {
  if (typeof value === "string") return maskSecrets(value) as T;
  if (Array.isArray(value)) return value.map(redactValue) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactValue(v)]),
    ) as T;
  return value;
}
