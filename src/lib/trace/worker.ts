/// <reference lib="webworker" />
/**
 * Visualizer worker for JavaScript (Module 07 §3.4): instruments the user's code with acorn and runs it
 * with the `__t` runtime, off the main thread. Python runs in `public/trace/python-worker.js` (a real
 * module worker, which Pyodide requires); both speak the same messages (`messages.ts`).
 */
import { instrument, InstrumentError } from "@/lib/trace/js/instrument";
import { runInstrumented } from "@/lib/trace/js/runtime";
import type { TraceRequestMessage, TraceWorkerMessage } from "@/lib/trace/messages";

const ctx = self as unknown as { postMessage: (m: TraceWorkerMessage) => void; onmessage: ((e: MessageEvent<TraceRequestMessage>) => void) | null };

ctx.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type !== "run") return;
  const post = (m: TraceWorkerMessage) => ctx.postMessage(m);
  try {
    let code: string;
    try { code = instrument(msg.user).code; }
    catch (err) { post({ type: "error", id: msg.id, message: (err as Error).message, line: err instanceof InstrumentError ? err.line : null }); return; }
    post({ type: "progress", id: msg.id, phase: "running" });
    const trace = runInstrumented(code, msg.driver, { stdin: msg.stdin, maxSteps: msg.maxSteps, maxHeap: msg.maxHeap, wallMs: msg.wallMs });
    post({ type: "result", id: msg.id, trace });
  } catch (err) {
    post({ type: "error", id: msg.id, message: (err as Error)?.message ?? "The visualizer failed" });
  }
};
