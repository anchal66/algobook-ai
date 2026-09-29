/**
 * Rebuilds the full program state at any step from the delta-encoded trace (Module 07 §3.1), finds where
 * the output diverged from the expected one, and derives "chapters" for the timeline. Pure and unit-tested.
 */
import type { Frame, HeapObj, Step, Trace, TraceState, Value } from "@/lib/trace/types";

const CHECKPOINT_EVERY = 64;

function cloneState(s: TraceState): TraceState {
  return {
    stack: s.stack.map((f) => ({ ...f })),
    locals: Object.fromEntries(Object.entries(s.locals).map(([k, v]) => [k, { ...v }])),
    heap: { ...s.heap },
    stdout: s.stdout,
  };
}

function apply(state: TraceState, step: Step): void {
  if (step.stack) {
    state.stack = step.stack.map((f) => ({ ...f }));
    const live = new Set(state.stack.map((f) => String(f.id)));
    for (const id of Object.keys(state.locals)) if (!live.has(id)) delete state.locals[id];
  }
  const top = state.stack[state.stack.length - 1];
  if (top) top.line = step.line;
  if (step.locals) for (const [fid, locals] of Object.entries(step.locals)) state.locals[fid] = locals;
  if (step.heap) for (const [id, obj] of Object.entries(step.heap)) { if (obj === null) delete state.heap[id]; else state.heap[id] = obj; }
  if (step.out) state.stdout += step.out;
}

/** Incremental replayer: forward scrubbing is O(1) per step, random access O(64). */
export class Replayer {
  private checkpoints = new Map<number, TraceState>();
  private cursor = -1;
  private state: TraceState = { stack: [], locals: {}, heap: {}, stdout: "" };

  constructor(private readonly trace: Trace) {}

  at(i: number): TraceState {
    const n = this.trace.steps.length;
    if (n === 0) return { stack: [], locals: {}, heap: {}, stdout: "" };
    i = Math.max(0, Math.min(n - 1, i));
    if (i < this.cursor || this.cursor < 0) {
      const cp = Math.floor(i / CHECKPOINT_EVERY) * CHECKPOINT_EVERY;
      let from = cp;
      while (from > 0 && !this.checkpoints.has(from)) from -= CHECKPOINT_EVERY;
      this.state = from > 0 ? cloneState(this.checkpoints.get(from)!) : { stack: [], locals: {}, heap: {}, stdout: "" };
      this.cursor = from > 0 ? from : -1;
    }
    while (this.cursor < i) {
      this.cursor++;
      apply(this.state, this.trace.steps[this.cursor]);
      if (this.cursor % CHECKPOINT_EVERY === 0 && this.cursor > 0 && !this.checkpoints.has(this.cursor)) this.checkpoints.set(this.cursor, cloneState(this.state));
    }
    return this.state;
  }
}

/** Convenience for tests and one-off lookups. */
export function replay(trace: Trace, i: number): TraceState {
  return new Replayer(trace).at(i);
}

/** First step at which the cumulative stdout stops being a prefix of `expected` (trailing whitespace ignored). */
export function divergeAt(trace: Trace): number | undefined {
  if (trace.expected === undefined) return undefined;
  const expected = trace.expected.replace(/\s+$/, "");
  let out = "";
  for (const s of trace.steps) {
    if (!s.out) continue;
    out += s.out;
    const trimmed = out.replace(/\s+$/, "");
    if (!expected.startsWith(trimmed)) return s.i;
  }
  const finalOut = trace.stdout.replace(/\s+$/, "");
  if (finalOut !== expected) return trace.steps.length ? trace.steps[trace.steps.length - 1].i : undefined;
  return undefined;
}

export interface Chapter {
  kind: "call" | "loop" | "exception" | "return";
  label: string;
  from: number;
  to: number;
  depth: number;
}

/**
 * Chapters: one per function activation and one per detected loop iteration (a `line` step that jumps
 * backwards inside the same frame starts a new iteration). Used by the timeline strip.
 */
export function chapters(trace: Trace): Chapter[] {
  const out: Chapter[] = [];
  const open = new Map<number, { label: string; from: number; depth: number }>();
  let stack: Frame[] = [];
  const iterations = new Map<number, { count: number; from: number; line: number }>();
  const closeIteration = (fid: number, to: number) => {
    const it = iterations.get(fid);
    if (it && it.count > 0) { out.push({ kind: "loop", label: `iteration ${it.count}`, from: it.from, to, depth: stack.length }); }
    iterations.delete(fid);
  };
  let prevLine = new Map<number, number>();
  for (const s of trace.steps) {
    if (s.stack) {
      const nextStack = s.stack;
      const prevIds = new Set(stack.map((f) => f.id));
      const nextIds = new Set(nextStack.map((f) => f.id));
      for (const f of stack) if (!nextIds.has(f.id)) {
        closeIteration(f.id, s.i - 1);
        const o = open.get(f.id);
        if (o) { out.push({ kind: "call", label: o.label, from: o.from, to: s.i - 1, depth: o.depth }); open.delete(f.id); }
        prevLine.delete(f.id);
      }
      for (const f of nextStack) if (!prevIds.has(f.id)) open.set(f.id, { label: `${f.fn}()`, from: s.i, depth: nextStack.indexOf(f) });
      stack = nextStack;
    }
    const top = stack[stack.length - 1];
    if (top && s.ev === "line") {
      const pl = prevLine.get(top.id);
      if (pl !== undefined && s.line <= pl) {
        const it = iterations.get(top.id);
        if (it && it.line === s.line) { out.push({ kind: "loop", label: `iteration ${it.count}`, from: it.from, to: s.i - 1, depth: stack.length }); iterations.set(top.id, { count: it.count + 1, from: s.i, line: s.line }); }
        else if (!it) iterations.set(top.id, { count: 1, from: s.i, line: s.line });
      }
      prevLine.set(top.id, s.line);
    }
    if (s.ev === "exception") out.push({ kind: "exception", label: s.exc ? `${s.exc.type}` : "exception", from: s.i, to: s.i, depth: stack.length });
  }
  const last = trace.steps.length - 1;
  for (const f of stack) { closeIteration(f.id, last); const o = open.get(f.id); if (o) out.push({ kind: "call", label: o.label, from: o.from, to: last, depth: o.depth }); }
  prevLine = new Map();
  return out.sort((a, b) => a.from - b.from || a.depth - b.depth);
}

/** Next step index (after `from`) matching a predicate, or null. */
export function findStep(trace: Trace, from: number, dir: 1 | -1, pred: (s: Step) => boolean): number | null {
  for (let i = from + dir; i >= 0 && i < trace.steps.length; i += dir) if (pred(trace.steps[i])) return i;
  return null;
}

/** Short inline rendering of a value (for frames and labels). */
export function formatValue(v: Value, heap?: Record<string, HeapObj>, depth = 0): string {
  if (v === null) return "None";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return JSON.stringify(v);
  if ("sp" in v) return v.sp === "bigint" ? `${v.v}n` : v.sp === "undefined" ? "undefined" : v.sp === "del" ? "—" : v.sp;
  const o = heap?.[v.ref];
  if (!o || depth > 1) return v.ref;
  switch (o.t) {
    case "list": case "tuple": return `[${o.items.slice(0, 8).map((x) => formatValue(x, heap, depth + 1)).join(", ")}${o.n > 8 ? ", …" : ""}]`;
    case "set": return `{${o.items.slice(0, 8).map((x) => formatValue(x, heap, depth + 1)).join(", ")}${o.n > 8 ? ", …" : ""}}`;
    case "dict": return `{${o.entries.slice(0, 6).map(([k, x]) => `${formatValue(k, heap, depth + 1)}: ${formatValue(x, heap, depth + 1)}`).join(", ")}${o.n > 6 ? ", …" : ""}}`;
    case "node": return `${o.cls}(${Object.entries(o.fields).slice(0, 3).map(([k, x]) => `${k}=${formatValue(x, heap, depth + 1)}`).join(", ")})`;
    case "func": return `${o.name}()`;
    case "other": return o.repr || o.cls;
  }
}
