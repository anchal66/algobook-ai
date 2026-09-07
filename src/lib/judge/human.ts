/**
 * Human ↔ canonical stdin conversion for the Testcase panel (Module 03 W-10).
 *   toHuman(params, stdin)   → ["[2,7,11,15]", "9"]   (one LeetCode-style literal per param)
 *   fromHuman(params, texts) → { ok: true, stdin } | { ok: false, errors: { [paramIndex]: message } }
 * Runs in the browser and on the server (imports only the client-safe stdin helpers).
 */
import type { ProblemParam } from "@/lib/data/schema";
import { encodeInput, formatValue, parseInput, type ParamValue } from "@/lib/judge/stdin";

export type HumanResult = { ok: true; stdin: string; values: ParamValue[] } | { ok: false; errors: Record<number, string> };

function base(type: string): { base: string; dims: number } {
  const m = type.match(/^(\w+)((?:\[\])*)$/);
  if (!m) return { base: type, dims: 0 };
  return { base: m[1], dims: (m[2].match(/\[\]/g) ?? []).length };
}

/** Renders each parameter of a canonical stdin as the literal LeetCode shows (`nums = [2,7,11,15]`). */
export function toHuman(params: ProblemParam[], stdin: string): string[] {
  try {
    const values = parseInput(params, stdin);
    return params.map((p, i) => formatValue(p.type, values[i]));
  } catch {
    return params.map(() => "");
  }
}

const INT_RE = /^-?\d+$/;

function parseScalar(b: string, text: string): ParamValue | Error {
  const t = text.trim();
  if (b === "int" || b === "long") {
    if (!INT_RE.test(t)) return new Error("Expected an integer");
    return Number(t);
  }
  if (b === "double") {
    if (t === "" || Number.isNaN(Number(t))) return new Error("Expected a number");
    return Number(t);
  }
  if (b === "bool") {
    if (t !== "true" && t !== "false") return new Error("Expected true or false");
    return t === "true";
  }
  if (b === "char") {
    const m = t.match(/^['"](.)['"]$/);
    const ch = m ? m[1] : t;
    if ([...ch].length !== 1) return new Error("Expected exactly one character, e.g. 'a'");
    return ch;
  }
  // string: accept a JSON literal ("a b") or raw text
  if (/^"[\s\S]*"$/.test(t)) {
    try { return JSON.parse(t) as string; } catch { return new Error("Invalid string literal"); }
  }
  return text.replace(/\r?\n$/, "");
}

function checkArray(b: string, arr: unknown, dims: number, where: string): ParamValue | Error {
  if (!Array.isArray(arr)) return new Error(`${where}: expected a list like [1,2,3]`);
  if (dims === 2) {
    const rows: ParamValue[] = [];
    let cols: number | null = null;
    for (let r = 0; r < arr.length; r++) {
      const row = checkArray(b, arr[r], 1, `${where}[${r}]`);
      if (row instanceof Error) return row;
      const len = (row as ParamValue[]).length;
      if (cols !== null && len !== cols) return new Error(`${where}: rows must have the same length`);
      cols = len;
      rows.push(row);
    }
    return rows;
  }
  const out: ParamValue[] = [];
  for (let k = 0; k < arr.length; k++) {
    const v = arr[k];
    if (b === "int" || b === "long") { if (typeof v !== "number" || !Number.isInteger(v)) return new Error(`${where}[${k}]: expected an integer`); out.push(v); continue; }
    if (b === "double") { if (typeof v !== "number") return new Error(`${where}[${k}]: expected a number`); out.push(v); continue; }
    if (b === "bool") { if (typeof v !== "boolean") return new Error(`${where}[${k}]: expected true/false`); out.push(v); continue; }
    if (b === "char") { if (typeof v !== "string" || [...v].length !== 1) return new Error(`${where}[${k}]: expected a one-character string`); out.push(v); continue; }
    if (typeof v !== "string") return new Error(`${where}[${k}]: expected a quoted string`);
    if (v.includes("\n")) return new Error(`${where}[${k}]: strings cannot contain new lines`);
    out.push(v);
  }
  return out;
}

/** Parses one human literal according to the declared type. */
export function parseHuman(type: string, text: string): ParamValue | Error {
  const { base: b, dims } = base(type);
  if (b === "ListNode" || b === "TreeNode") {
    let v: unknown;
    try { v = JSON.parse(text.trim() || "[]"); } catch { return new Error("Expected a list like [1,2,null,3]"); }
    if (!Array.isArray(v) || !v.every((x) => x === null || typeof x === "number")) return new Error("Expected numbers and null only, e.g. [1,2,null,3]");
    return v as ParamValue;
  }
  if (dims === 0) return parseScalar(b, text);
  let v: unknown;
  try { v = JSON.parse(text.trim() || "[]"); } catch { return new Error(dims === 2 ? "Expected a matrix like [[1,2],[3,4]]" : "Expected a list like [1,2,3]"); }
  return checkArray(b, v, dims, "value");
}

/** Validates every parameter and encodes the canonical stdin. */
export function fromHuman(params: ProblemParam[], texts: string[]): HumanResult {
  const errors: Record<number, string> = {};
  const values: ParamValue[] = [];
  params.forEach((p, i) => {
    const r = parseHuman(p.type, texts[i] ?? "");
    if (r instanceof Error) errors[i] = r.message;
    else values.push(r);
  });
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, stdin: encodeInput(params, values), values };
}
