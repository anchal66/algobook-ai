/**
 * Strict linter for the canonical stdin encoding (Module 01 §3.9 / reference/IO-FORMAT.md).
 * `parseInput` in stdin.ts is lenient (it renders whatever it can); generation must be strict
 * so a spec whose tests do not match its own `params` is rejected before the judge runs.
 */
import type { ProblemParam } from "@/lib/data/schema";

export interface LintResult { ok: boolean; errors: string[] }

const INT_RE = /^-?\d+$/;
const NUM_RE = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const LIST_RE = /^\[.*\]$/;

function base(type: string): { base: string; dims: number } {
  const m = type.match(/^(\w+)((?:\[\])*)$/);
  if (!m) return { base: type, dims: 0 };
  return { base: m[1], dims: (m[2].match(/\[\]/g) ?? []).length };
}

function checkToken(b: string, tok: string, where: string, errors: string[]): void {
  if (b === "int" || b === "long") { if (!INT_RE.test(tok)) errors.push(`${where}: expected an integer token, got "${tok.slice(0, 20)}"`); return; }
  if (b === "double") { if (!NUM_RE.test(tok)) errors.push(`${where}: expected a number token, got "${tok.slice(0, 20)}"`); return; }
  if (b === "bool") { if (tok !== "true" && tok !== "false") errors.push(`${where}: expected true/false, got "${tok.slice(0, 20)}"`); return; }
  if (b === "char") { if ([...tok].length !== 1) errors.push(`${where}: expected exactly one character, got "${tok.slice(0, 20)}"`); return; }
}

/**
 * Validates that `input` is exactly the canonical encoding for `params` and that nothing
 * but a trailing newline follows. Errors are human-readable so they can be fed back to the model.
 */
export function lintInput(params: ProblemParam[], input: string): LintResult {
  const errors: string[] = [];
  const text = input.replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  // A trailing newline produces one empty last element; drop it (but keep intentionally empty lines before it).
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  let i = 0;
  const next = (what: string): string | null => {
    if (i >= lines.length) { errors.push(`${what}: input ended early (line ${i + 1} missing)`); return null; }
    return lines[i++];
  };

  for (const p of params) {
    const { base: b, dims } = base(p.type);
    const where = `param "${p.name}" (${p.type})`;
    if (b === "ListNode" || b === "TreeNode") {
      const line = next(where); if (line === null) break;
      if (!LIST_RE.test(line.trim())) errors.push(`${where}: expected a bracket list like [1,2,null,3], got "${line.slice(0, 30)}"`);
      else { try { JSON.parse(line.trim()); } catch { errors.push(`${where}: bracket list is not valid JSON: "${line.slice(0, 30)}"`); } }
      continue;
    }
    if (dims === 0) {
      const line = next(where); if (line === null) break;
      if (b === "string") continue; // raw line, anything goes
      const tok = line.trim();
      if (tok.includes(" ") && b !== "char") errors.push(`${where}: expected one token on the line, got "${line.slice(0, 30)}"`);
      else checkToken(b, tok, where, errors);
      continue;
    }
    if (dims === 1) {
      const nLine = next(`${where} length`); if (nLine === null) break;
      if (!INT_RE.test(nLine.trim()) || Number(nLine) < 0) { errors.push(`${where}: first line must be the element count N, got "${nLine.slice(0, 30)}"`); break; }
      const n = Number(nLine.trim());
      if (b === "string") {
        for (let k = 0; k < n; k++) { const l = next(`${where}[${k}]`); if (l === null) { k = n; break; } }
        continue;
      }
      const line = next(`${where} elements`); if (line === null) break;
      const toks = line.trim() ? line.trim().split(/\s+/) : [];
      if (toks.length !== n) { errors.push(`${where}: declared N=${n} but found ${toks.length} tokens on the next line`); continue; }
      toks.forEach((t, k) => checkToken(b, t, `${where}[${k}]`, errors));
      continue;
    }
    // dims === 2
    const rcLine = next(`${where} dimensions`); if (rcLine === null) break;
    const rc = rcLine.trim().split(/\s+/);
    if (rc.length !== 2 || !INT_RE.test(rc[0]) || !INT_RE.test(rc[1])) { errors.push(`${where}: first line must be "R C", got "${rcLine.slice(0, 30)}"`); break; }
    const [r, c] = rc.map(Number);
    if (b === "string") {
      for (let k = 0; k < r * c; k++) { const l = next(`${where} cell ${k}`); if (l === null) { k = r * c; break; } }
      continue;
    }
    for (let row = 0; row < r; row++) {
      const line = next(`${where} row ${row}`); if (line === null) { row = r; break; }
      const toks = line.trim() ? line.trim().split(/\s+/) : [];
      if (toks.length !== c) { errors.push(`${where}: row ${row} has ${toks.length} tokens, expected C=${c}`); continue; }
      toks.forEach((t, k) => checkToken(b, t, `${where}[${row}][${k}]`, errors));
    }
  }
  if (!errors.length && i < lines.length) {
    const extra = lines.slice(i).filter((l) => l.trim().length);
    if (extra.length) errors.push(`${extra.length} unexpected extra line(s) after the last parameter: "${extra[0].slice(0, 30)}"`);
  }
  return { ok: errors.length === 0, errors };
}
