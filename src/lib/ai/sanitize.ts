/** Prompt-injection hygiene for free text that reaches a model (Module 02 §3.4, C8). */

/** Single line, quotes escaped, control characters removed, hard cap. */
export function sanitizeUserPrompt(raw: string | undefined | null, max = 300): string {
  if (!raw) return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/["\\]/g, (c) => (c === '"' ? '\\"' : "\\\\"))
    .trim()
    .slice(0, max);
}

/** Free text that is shown to the model verbatim but must stay bounded (descriptions, titles). */
export function clip(raw: string | undefined | null, max: number): string {
  if (!raw) return "";
  const s = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Code is passed inside fenced blocks; keep it bounded and strip NUL bytes. */
export function clipCode(code: string | undefined | null, maxBytes: number): string {
  if (!code) return "";
  const s = code.replace(/\u0000/g, "");
  return Buffer.byteLength(s, "utf8") > maxBytes ? Buffer.from(s, "utf8").subarray(0, maxBytes).toString("utf8") + "\n// …[truncated]" : s;
}
