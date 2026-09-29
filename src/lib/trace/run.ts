"use client";
/**
 * Main-thread orchestration for the visualizer (Module 07 §3.4): owns one worker per language, enforces
 * the wall-clock limit from outside (a runaway program is terminated together with its worker), and
 * turns worker messages into a `Trace`.
 */
import { divergeAt } from "@/lib/trace/replay";
import { PYTHON_WORKER_URL, type TraceRequestMessage, type TraceWorkerMessage } from "@/lib/trace/messages";
import { PYTHON_TRACER } from "@/lib/trace/python/tracer";
import { PYTHON_PRELUDE } from "@/lib/judge/assemble";
import { TRACE_LIMITS, type Trace, type TraceLanguage } from "@/lib/trace/types";

export type TraceProgress = { phase: "loading-python" | "running"; detail?: string };

export interface TraceRunRequest {
  lang: TraceLanguage;
  user: string;
  driver: string;
  stdin: string;
  expected?: string;
  onProgress?: (p: TraceProgress) => void;
}

export class TraceRunError extends Error {
  constructor(message: string, public readonly kind: "syntax" | "timeout" | "worker", public readonly line: number | null = null) {
    super(message);
    this.name = "TraceRunError";
  }
}

interface Pending { id: number; resolve: (t: Trace | null) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> | null; onProgress?: (p: TraceProgress) => void }

const workers: Partial<Record<TraceLanguage, Worker>> = {};
let seq = 0;
let pending: (Pending & { lang: TraceLanguage }) | null = null;

function spawn(lang: TraceLanguage): Worker {
  const w = lang === "python"
    ? new Worker(PYTHON_WORKER_URL, { type: "module" })
    : new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<TraceWorkerMessage>) => {
    const m = e.data;
    if (!pending || m.id !== pending.id) return;
    if (m.type === "progress") {
      pending.onProgress?.({ phase: m.phase, detail: m.detail });
      if (m.phase === "running") armTimeout();
      return;
    }
    const p = pending; pending = null;
    if (p.timer) clearTimeout(p.timer);
    if (m.type === "result") p.resolve(m.trace);
    else p.reject(new TraceRunError(m.message, m.line !== undefined ? "syntax" : "worker", m.line ?? null));
  };
  w.onerror = (ev) => {
    const p = pending; pending = null;
    if (p) { if (p.timer) clearTimeout(p.timer); p.reject(new TraceRunError(ev.message || "The visualizer worker crashed", "worker")); }
    killWorker(lang);
  };
  return w;
}

function armTimeout(): void {
  if (!pending) return;
  if (pending.timer) clearTimeout(pending.timer);
  // the runtime stops itself at TRACE_LIMITS.wallMs; this is the backstop for code that never reaches a probe
  const lang = pending.lang;
  pending.timer = setTimeout(() => {
    const p = pending; pending = null;
    killWorker(lang);
    p?.reject(new TraceRunError("Your code ran for more than 5 seconds — try a smaller input.", "timeout"));
  }, TRACE_LIMITS.wallMs + 2000);
}

function killWorker(lang: TraceLanguage): void {
  workers[lang]?.terminate();
  delete workers[lang];
}

function cancelPending(): void {
  if (!pending) return;
  const p = pending; pending = null;
  if (p.timer) clearTimeout(p.timer);
  p.reject(new TraceRunError("Cancelled", "worker"));
  killWorker(p.lang);
}

function post(lang: TraceLanguage, msg: TraceRequestMessage): void {
  if (!workers[lang]) workers[lang] = spawn(lang);
  workers[lang]!.postMessage(msg);
}

function request(lang: TraceLanguage, user: string, driver: string, stdin: string): TraceRequestMessage {
  return {
    type: "run", id: ++seq, lang, user, driver, stdin,
    maxSteps: TRACE_LIMITS.maxSteps, maxHeap: TRACE_LIMITS.maxHeap, wallMs: TRACE_LIMITS.wallMs,
    ...(lang === "python" ? { tracer: PYTHON_TRACER, prelude: PYTHON_PRELUDE } : {}),
  };
}

/** Runs one trace. Only one at a time; a new call while one is pending terminates the old worker. */
export function runTrace(req: TraceRunRequest): Promise<Trace> {
  cancelPending();
  const msg = request(req.lang, req.user, req.driver, req.stdin);
  return new Promise<Trace>((resolve, reject) => {
    pending = {
      id: msg.id, lang: req.lang, timer: null, onProgress: req.onProgress,
      resolve: (t) => (t ? resolve(finalize(t, req.expected)) : reject(new TraceRunError("Empty trace", "worker"))),
      reject,
    };
    // Python's first run includes the runtime download; the timeout is armed once the worker reports "running".
    if (req.lang === "javascript") armTimeout();
    post(req.lang, msg);
  });
}

function finalize(t: Trace, expected?: string): Trace {
  const out: Trace = { ...t, expected };
  if (expected !== undefined) out.divergeAt = divergeAt(out);
  return out;
}

/** Warms the Python runtime in the background (called when a Python problem is open and the page is idle). */
export function warmPython(): void {
  if (pending || workers.python) return;
  const msg = request("python", "", "", "");
  pending = { id: msg.id, lang: "python", timer: null, resolve: () => undefined, reject: () => undefined };
  post("python", msg);
}

export function cancelTrace(): void {
  cancelPending();
}
