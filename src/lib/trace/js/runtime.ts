/**
 * The `__t` runtime that instrumented JavaScript talks to (Module 07 §3.3). Pure: no DOM, no worker APIs,
 * so it is unit-tested in Node and reused by the worker. Produces a `Trace` (types.ts) with per-step deltas.
 */
import { TRACE_LIMITS, type Frame, type HeapObj, type Step, type Trace, type Truncation, type Value } from "@/lib/trace/types";

export type Getter = [name: string, get: () => unknown];
export type GetterGroup = Getter[];

export class TraceLimit extends Error {
  constructor(public readonly reason: Exclude<Truncation, false>) {
    super(`trace limit: ${reason}`);
    this.name = "TraceLimit";
  }
}

export interface RuntimeOptions {
  maxSteps?: number;
  maxHeap?: number;
  wallMs?: number;
  now?: () => number;
}

interface LiveFrame extends Frame {
  groups: GetterGroup[];
  locals: Record<string, Value>;
  localsJson: string;
}

const MAX_ITEMS = TRACE_LIMITS.maxItems;
const MAX_STRING = TRACE_LIMITS.maxString;
/** Frames (from the top) whose locals are re-read on every step; deeper frames keep their last snapshot. */
const LIVE_FRAMES = 40;

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function clipStr(s: string): string {
  return s.length > MAX_STRING ? s.slice(0, MAX_STRING) + "…" : s;
}

export function createRuntime(opts: RuntimeOptions = {}) {
  const maxSteps = opts.maxSteps ?? TRACE_LIMITS.maxSteps;
  const maxHeap = opts.maxHeap ?? TRACE_LIMITS.maxHeap;
  const wallMs = opts.wallMs ?? TRACE_LIMITS.wallMs;
  const now = opts.now ?? (() => Date.now());
  const started = now();

  const steps: Step[] = [];
  const stack: LiveFrame[] = [];
  let frameSeq = 0;
  let stdout = "";
  let outMark = 0;
  let prevHeapJson: Record<string, string> = {};
  let stackDirty = true;
  let truncated: Truncation = false;
  let limitHit: TraceLimit | null = null;
  let entry: Trace["entry"] = null;
  let exception: Trace["exception"] = null;
  let lastThrown: unknown = undefined;

  // heap identity (strong refs keep ids stable for the whole run)
  const ids = new Map<object, string>();
  let heapFull = false;
  const idOf = (o: object): string | null => {
    let id = ids.get(o);
    if (!id) {
      if (ids.size >= maxHeap) { heapFull = true; return null; }
      id = `@${ids.size + 1}`;
      ids.set(o, id);
    }
    return id;
  };

  function serialize(v: unknown, heap: Record<string, HeapObj>, pending: object[]): Value {
    if (v === null) return null;
    switch (typeof v) {
      case "number": return Number.isNaN(v) ? { sp: "nan" } : v === Infinity ? { sp: "inf" } : v === -Infinity ? { sp: "-inf" } : v;
      case "string": return clipStr(v);
      case "boolean": return v;
      case "undefined": return { sp: "undefined" };
      case "bigint": return { sp: "bigint", v: v.toString() };
      case "symbol": return { sp: "undefined" };
      case "function": case "object": {
        const o = v as object;
        const id = idOf(o);
        if (!id) return { sp: "undefined" };
        if (!(id in heap)) { heap[id] = { t: "other", cls: "?", repr: "" }; pending.push(o); }
        return { ref: id };
      }
      default: return null;
    }
  }

  function describe(o: object, heap: Record<string, HeapObj>, pending: object[]): HeapObj {
    const s = (x: unknown) => serialize(x, heap, pending);
    if (typeof o === "function") return { t: "func", name: (o as { name?: string }).name || "anonymous" };
    if (Array.isArray(o)) return { t: "list", items: o.slice(0, MAX_ITEMS).map(s), n: o.length };
    if (ArrayBuffer.isView(o) && !(o instanceof DataView)) { const a = Array.from(o as unknown as ArrayLike<number>); return { t: "list", items: a.slice(0, MAX_ITEMS).map(s), n: a.length }; }
    if (o instanceof Map) { const e = [...o.entries()]; return { t: "dict", entries: e.slice(0, MAX_ITEMS).map(([k, v]) => [s(k), s(v)] as [Value, Value]), n: e.length }; }
    if (o instanceof Set) { const e = [...o.values()]; return { t: "set", items: e.slice(0, MAX_ITEMS).map(s), n: e.length }; }
    if (o instanceof Date) return { t: "other", cls: "Date", repr: o.toISOString() };
    if (o instanceof RegExp) return { t: "other", cls: "RegExp", repr: o.toString() };
    if (o instanceof Error) return { t: "other", cls: o.name, repr: clipStr(o.message) };
    if (isPlainObject(o)) {
      const keys = Object.keys(o);
      return { t: "dict", entries: keys.slice(0, MAX_ITEMS).map((k) => [k, s((o as Record<string, unknown>)[k])] as [Value, Value]), n: keys.length };
    }
    const cls = (o.constructor as { name?: string } | undefined)?.name || "Object";
    const fields: Record<string, Value> = {};
    let n = 0;
    for (const k of Object.keys(o)) { if (n++ >= MAX_ITEMS) break; fields[k] = s((o as Record<string, unknown>)[k]); }
    return { t: "node", cls, fields };
  }

  /** Reads every getter of a frame (skipping TDZ / undeclared names) into `heap`. */
  function readLocals(groups: GetterGroup[], heap: Record<string, HeapObj>, pending: object[]): Record<string, Value> {
    const locals: Record<string, Value> = {};
    for (const g of groups) {
      for (const [name, get] of g) {
        let v: unknown;
        try { v = get(); } catch { continue; }
        if (name === "this" && (v === undefined || v === globalThis)) continue;
        locals[name] = serialize(v, heap, pending);
      }
    }
    return locals;
  }

  function completeHeap(heap: Record<string, HeapObj>, pending: object[]): void {
    while (pending.length) {
      const o = pending.pop()!;
      heap[ids.get(o)!] = describe(o, heap, pending);
    }
  }

  function checkLimits(): void {
    if (limitHit) throw limitHit;
    if (steps.length >= maxSteps) { truncated = "steps"; limitHit = new TraceLimit("steps"); throw limitHit; }
    if (now() - started > wallMs) { truncated = "time"; limitHit = new TraceLimit("time"); throw limitHit; }
  }

  /** Re-reads live frames, diffs locals and heap against the previous step, appends the step. */
  function pushStep(ev: Step["ev"], line: number, extra: Partial<Step> = {}): void {
    checkLimits();
    const changed: string[] = [];
    const step: Step = { i: steps.length, line, ev, changed, ...extra };
    const heap: Record<string, HeapObj> = {};
    const pending: object[] = [];
    const localsDelta: Record<string, Record<string, Value>> = {};
    const first = Math.max(0, stack.length - LIVE_FRAMES);
    for (let k = 0; k < stack.length; k++) {
      const f = stack[k];
      if (k >= first) {
        f.locals = readLocals(f.groups, heap, pending);
        const json = JSON.stringify(f.locals);
        if (json !== f.localsJson || steps.length === 0) {
          f.localsJson = json;
          localsDelta[String(f.id)] = f.locals;
          for (const name of Object.keys(f.locals)) changed.push(`${f.id}:${name}`);
        }
      } else {
        // deep frame: keep its objects reachable without re-reading getters
        for (const v of Object.values(f.locals)) if (typeof v === "object" && v && "ref" in v && !(v.ref in heap)) {
          const o = objectOf(v.ref);
          if (o) { heap[v.ref] = { t: "other", cls: "?", repr: "" }; pending.push(o); }
        }
      }
    }
    if (extra.ret !== undefined) {
      // keep the returned object described even when no frame references it
      const r = extra.ret;
      if (typeof r === "object" && r && "ref" in r && !(r.ref in heap)) { const o = objectOf(r.ref); if (o) { heap[r.ref] = { t: "other", cls: "?", repr: "" }; pending.push(o); } }
    }
    completeHeap(heap, pending);

    const heapJson: Record<string, string> = {};
    const delta: Record<string, HeapObj | null> = {};
    for (const [id, obj] of Object.entries(heap)) {
      const j = JSON.stringify(obj);
      heapJson[id] = j;
      if (prevHeapJson[id] !== j) { delta[id] = obj; changed.push(id); }
    }
    for (const id of Object.keys(prevHeapJson)) if (!(id in heap)) delta[id] = null;
    prevHeapJson = heapJson;
    if (Object.keys(localsDelta).length) step.locals = localsDelta;
    if (Object.keys(delta).length) step.heap = delta;
    if (stackDirty || steps.length === 0) {
      step.stack = stack.map((f) => ({ id: f.id, fn: f.fn, line: f.line }));
      stackDirty = false;
    }
    if (stdout.length > outMark) { step.out = stdout.slice(outMark); outMark = stdout.length; }
    steps.push(step);
  }

  const objectsById = new Map<string, object>();
  function objectOf(id: string): object | undefined {
    if (objectsById.size !== ids.size) for (const [o, i] of ids) objectsById.set(i, o);
    return objectsById.get(id);
  }

  const api = {
    enter(fn: string, line: number, args: GetterGroup): void {
      if (limitHit) throw limitHit;
      const frame: LiveFrame = { id: ++frameSeq, fn, line, groups: [args], locals: {}, localsJson: "" };
      stack.push(frame);
      stackDirty = true;
      if (!entry) {
        const heap: Record<string, HeapObj> = {}; const pending: object[] = [];
        const locals = readLocals([args], heap, pending);
        completeHeap(heap, pending);
        entry = { fn, args: locals };
      }
      pushStep("call", line);
    },
    line(line: number, groups: GetterGroup[]): void {
      const top = stack[stack.length - 1];
      if (top) { top.line = line; top.groups = groups; }
      pushStep("line", line);
    },
    ret<T>(value: T): T {
      const top = stack[stack.length - 1];
      const heap: Record<string, HeapObj> = {}; const pending: object[] = [];
      const v = serialize(value, heap, pending);
      pushStep("return", top?.line ?? 0, { ret: v });
      return value;
    },
    throw(e: unknown): void {
      if (e instanceof TraceLimit || limitHit) return;
      if (e === lastThrown) return; // already recorded while unwinding through outer frames
      lastThrown = e;
      const top = stack[stack.length - 1];
      const err = e as { name?: string; message?: string } | null;
      const type = (err && typeof err === "object" && err.name) || "Error";
      const message = err && typeof err === "object" && typeof err.message === "string" ? err.message : String(e);
      try {
        pushStep("exception", top?.line ?? 0, { exc: { type, message: clipStr(message) } });
        if (!exception) exception = { step: steps.length - 1, type, message: clipStr(message) };
      } catch { /* limit reached while recording */ }
    },
    exit(): void {
      stack.pop();
      stackDirty = true;
    },
    /** console.log / process.stdout.write shim. */
    write(text: string): void {
      if (stdout.length < TRACE_LIMITS.maxStdout) stdout += text;
    },
  };

  function finish(lang: Trace["lang"], fatal?: unknown): Trace {
    if (heapFull && !truncated) truncated = "heap";
    if (fatal && !(fatal instanceof TraceLimit) && !exception) {
      const err = fatal as { name?: string; message?: string } | null;
      exception = { step: Math.max(0, steps.length - 1), type: (err && typeof err === "object" && err.name) || "Error", message: clipStr(err && typeof err === "object" && typeof err.message === "string" ? err.message : String(fatal)) };
    }
    if (stdout.length > outMark && steps.length) { const last = steps[steps.length - 1]; last.out = (last.out ?? "") + stdout.slice(outMark); outMark = stdout.length; }
    return { lang, entry, steps, stdout, exception, truncated, ms: now() - started };
  }

  return { api, finish, get stdout() { return stdout; } };
}

export type Runtime = ReturnType<typeof createRuntime>;

/** Formats console.log arguments the way Node prints them (good enough for driver output). */
export function formatLogArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === "string" ? a : typeof a === "bigint" ? a.toString() : safeStringify(a))).join(" ");
}

function safeStringify(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "function") return `[Function: ${(v as { name?: string }).name || "anonymous"}]`;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export interface RunOptions extends RuntimeOptions { stdin: string }

/**
 * Executes instrumented user code + the (uninstrumented) driver with Node-like shims. Returns the trace.
 * Meant for the worker (and tests); the caller enforces the wall-clock limit from outside as well.
 */
export function runInstrumented(instrumentedUser: string, driver: string, o: RunOptions): Trace {
  const rt = createRuntime(o);
  const fsShim = { readFileSync: (fd: unknown) => { if (fd === 0 || fd === "/dev/stdin") return o.stdin; throw new Error("readFileSync: only stdin (fd 0) is available"); } };
  const require = (name: string) => {
    if (name === "fs") return fsShim;
    throw new Error(`Cannot find module '${name}' in the visualizer`);
  };
  const processShim = { stdout: { write: (s: unknown) => { rt.api.write(String(s)); return true; } }, stdin: { fd: 0 }, argv: [], env: {}, exit: () => { throw new TraceLimit("steps"); } };
  const consoleShim = {
    log: (...a: unknown[]) => rt.api.write(formatLogArgs(a) + "\n"),
    info: (...a: unknown[]) => rt.api.write(formatLogArgs(a) + "\n"),
    error: () => undefined, warn: () => undefined, debug: () => undefined,
  };
  let fatal: unknown;
  try {
    const fn = new Function("__t", "require", "process", "console", `${instrumentedUser}\n\n// ---- driver ----\n${driver}\n`);
    fn(rt.api, require, processShim, consoleShim);
  } catch (e) {
    fatal = e;
  }
  return rt.finish("javascript", fatal);
}
