/**
 * Canonical stdin encoding shared by all languages (Module 01 §3.9).
 *   scalar (int|long|double|bool|string|char) → one token per line
 *   T[]   → N, then N space-separated tokens (strings: one per line after N)
 *   T[][] → R C, then R lines of C space-separated tokens
 *   ListNode/TreeNode → LeetCode array literal on one line, e.g. [1,2,null,3]
 * Module 02 prompts must produce this format; Module 03 renders/parses it.
 */
import type { ProblemParam } from "@/lib/data/schema";

export type ParamValue = string | number | boolean | null | ParamValue[];

function base(type: string): { base: string; dims: number } {
  const m = type.match(/^(\w+)((?:\[\])*)$/);
  if (!m) throw new Error(`Bad param type: ${type}`);
  return { base: m[1], dims: (m[2].match(/\[\]/g) ?? []).length };
}

function scalarToken(b: string, v: ParamValue): string {
  if (b === "bool") return v ? "true" : "false";
  if (b === "string" || b === "char") return String(v);
  return String(v);
}

/** Encodes one argument according to its declared type. */
export function encodeValue(type: string, value: ParamValue): string {
  const { base: b, dims } = base(type);
  if (b === "ListNode" || b === "TreeNode") return JSON.stringify(value) + "\n";
  if (dims === 0) return scalarToken(b, value) + "\n";
  const arr = (value ?? []) as ParamValue[];
  if (dims === 1) {
    if (b === "string") return `${arr.length}\n${arr.map((x) => String(x)).join("\n")}${arr.length ? "\n" : ""}`;
    return `${arr.length}\n${arr.map((x) => scalarToken(b, x)).join(" ")}\n`;
  }
  const rows = arr as ParamValue[][];
  const cols = rows.length ? (rows[0] as ParamValue[]).length : 0;
  const body = rows.map((r) => (r as ParamValue[]).map((x) => scalarToken(b, x)).join(b === "string" ? "\n" : " ")).join("\n");
  return `${rows.length} ${cols}\n${body}${rows.length ? "\n" : ""}`;
}

/** Builds the full stdin for a call with the given argument values (in `params` order). */
export function encodeInput(params: ProblemParam[], values: ParamValue[]): string {
  if (values.length !== params.length) throw new Error(`Expected ${params.length} values, got ${values.length}`);
  return params.map((p, i) => encodeValue(p.type, values[i])).join("");
}

/** Parses stdin produced by `encodeInput` back into values (for rendering named parameters in the UI). */
export function parseInput(params: ProblemParam[], stdin: string): ParamValue[] {
  const lines = stdin.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const next = () => (i < lines.length ? lines[i++] : "");
  const scalar = (b: string, tok: string): ParamValue => {
    if (b === "int" || b === "long" || b === "double") return Number(tok);
    if (b === "bool") return tok.trim() === "true";
    return tok;
  };
  const out: ParamValue[] = [];
  for (const p of params) {
    const { base: b, dims } = base(p.type);
    if (b === "ListNode" || b === "TreeNode") { out.push(JSON.parse(next() || "[]")); continue; }
    if (dims === 0) { out.push(scalar(b, next())); continue; }
    if (dims === 1) {
      const n = parseInt(next() || "0", 10);
      if (b === "string") { const a: ParamValue[] = []; for (let k = 0; k < n; k++) a.push(next()); out.push(a); }
      else { const toks = n ? (next().trim() ? lines[i - 1].trim().split(/\s+/) : []) : []; out.push(toks.map((t) => scalar(b, t))); }
      continue;
    }
    const [r, c] = (next() || "0 0").trim().split(/\s+/).map(Number);
    const rows: ParamValue[] = [];
    for (let k = 0; k < r; k++) {
      if (b === "string") { const row: ParamValue[] = []; for (let j = 0; j < c; j++) row.push(next()); rows.push(row); }
      else rows.push(next().trim().split(/\s+/).filter(Boolean).map((t) => scalar(b, t)));
    }
    out.push(rows);
  }
  return out;
}

/** Formats a value the way LeetCode shows it (`[2,7,11,15]`, `"abc"`, `true`). */
export function formatValue(type: string, v: ParamValue): string {
  const { base: b, dims } = base(type);
  if (dims === 0 && b === "string") return JSON.stringify(v);
  if (dims === 0 && b === "char") return `'${v}'`;
  return JSON.stringify(v);
}
