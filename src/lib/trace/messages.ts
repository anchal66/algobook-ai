/** Messages between the main thread and the tracer workers (Module 07 §3.4). Mirrored by `public/trace/python-worker.js`. */
import type { Trace, TraceLanguage } from "@/lib/trace/types";

export interface TraceRequestMessage {
  type: "run";
  id: number;
  lang: TraceLanguage;
  user: string;
  driver: string;
  stdin: string;
  maxSteps: number;
  maxHeap: number;
  wallMs: number;
  /** Python only: tracer source + prelude (the static worker cannot import them). */
  tracer?: string;
  prelude?: string;
}

export type TraceWorkerMessage =
  | { type: "progress"; id: number; phase: "loading-python" | "running"; detail?: string }
  | { type: "result"; id: number; trace: Trace | null }
  | { type: "error"; id: number; message: string; line?: number | null };

export const PYTHON_WORKER_URL = "/trace/python-worker.js";
