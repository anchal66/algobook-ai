/**
 * Formatting fallback (Module 03 W-07). Monaco ships formatters only for JS/TS/JSON/CSS/HTML, so
 * Java, C++ and JavaScript-without-a-worker get a deterministic brace re-indenter; Python keeps
 * the author's indentation (it is semantic) and only trims trailing whitespace.
 */
import type { Language } from "@/types";

function stripTrailing(line: string): string { return line.replace(/[ \t]+$/g, ""); }

/** Re-indents C-like code by brace depth. Keeps blank lines, comments and string contents intact. */
export function reindentBraces(code: string, tabSize: number): string {
  const indent = " ".repeat(tabSize);
  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  let depth = 0;
  let inBlockComment = false;
  /** Depth of the enclosing `switch` body while inside a case section (case bodies indent one level deeper). */
  let caseDepth: number | null = null;
  const out: string[] = [];
  for (const raw of lines) {
    const line = stripTrailing(raw).trimStart();
    if (!line) { out.push(""); continue; }
    if (inBlockComment) {
      out.push(indent.repeat(depth) + (line.startsWith("*") ? " " + line : line));
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    // Count braces outside strings/chars/line comments.
    let opens = 0, closes = 0, leadingCloses = 0;
    let inStr: string | null = null;
    let seenCode = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; seenCode = true; continue; }
      if (c === "/" && line[i + 1] === "/") break;
      if (c === "/" && line[i + 1] === "*") { if (!line.includes("*/", i + 2)) inBlockComment = true; else i = line.indexOf("*/", i + 2) + 1; continue; }
      if (c === "}") { closes++; if (!seenCode) leadingCloses++; continue; }
      if (c === "{") { opens++; seenCode = true; continue; }
      if (!/\s/.test(c)) seenCode = true;
    }
    const lineDepth = Math.max(0, depth - leadingCloses);
    const isCaseLabel = /^(case\b.*|default\s*):\s*(\/\/.*)?$/.test(line);
    if (caseDepth !== null && lineDepth < caseDepth) caseDepth = null; // left the switch body
    if (isCaseLabel) caseDepth = lineDepth;
    const extra = caseDepth !== null && !isCaseLabel && lineDepth >= caseDepth ? 1 : 0;
    out.push(indent.repeat(lineDepth + extra) + line);
    depth = Math.max(0, depth + opens - closes);
  }
  return out.join("\n");
}

export function formatCode(language: Language, code: string, tabSize: number): string {
  if (language === "python") return code.replace(/\r\n?/g, "\n").split("\n").map(stripTrailing).join("\n");
  return reindentBraces(code, tabSize);
}
