/**
 * Execution-trace format shared by every tracer (Module 07 §3.1). A trace is a list of steps; step 0 is
 * complete, later steps carry deltas (changed frames / heap objects). `replay.ts` rebuilds full states.
 * Both the Python tracer (`python/tracer.ts`) and the JavaScript runtime (`js/runtime.ts`) emit exactly this.
 */

export type TraceLanguage = "python" | "javascript";

/** Special scalars that JSON cannot carry natively. */
export type SpecialValue = { sp: "undefined" | "inf" | "-inf" | "nan" | "bigint" | "del"; v?: string };
export type Value = number | string | boolean | null | { ref: string } | SpecialValue;

export type HeapObj =
  | { t: "list"; items: Value[]; n: number }
  | { t: "tuple"; items: Value[]; n: number }
  | { t: "set"; items: Value[]; n: number }
  | { t: "dict"; entries: [Value, Value][]; n: number }
  | { t: "node"; cls: string; fields: Record<string, Value> }
  | { t: "func"; name: string }
  | { t: "other"; cls: string; repr: string };

export type StepEvent = "line" | "call" | "return" | "exception";

export interface Frame {
  /** Stable per activation; locals are keyed by it. */
  id: number;
  fn: string;
  /** Line the frame is currently at (call site for frames below the top). */
  line: number;
}

export interface Step {
  i: number;
  /** 1-based line in the user's code (the editor's numbering). */
  line: number;
  ev: StepEvent;
  /** Present when the stack shape changed (push/pop) and on step 0. */
  stack?: Frame[];
  /** Full locals of every frame whose locals changed (keyed by frame id). */
  locals?: Record<string, Record<string, Value>>;
  /** Changed / new heap objects; `null` = no longer reachable. */
  heap?: Record<string, HeapObj | null>;
  /** Return value on `return` steps. */
  ret?: Value;
  /** stdout appended during this step. */
  out?: string;
  /** Exception summary on `exception` steps. */
  exc?: { type: string; message: string };
  /** `frameId:name` for changed locals, `@id` for changed heap objects. */
  changed: string[];
}

export type Truncation = false | "steps" | "heap" | "time";

export interface Trace {
  lang: TraceLanguage;
  /** The harness call into the user's code. */
  entry: { fn: string; args: Record<string, Value> } | null;
  steps: Step[];
  stdout: string;
  expected?: string;
  /** First step whose cumulative stdout stops being a prefix of `expected` (only when expected is known). */
  divergeAt?: number;
  exception: { step: number; type: string; message: string } | null;
  truncated: Truncation;
  /** Wall-clock ms spent tracing. */
  ms: number;
}

export const TRACE_LIMITS = {
  maxSteps: 3000,
  maxHeap: 500,
  maxItems: 50,
  maxString: 200,
  maxStdout: 20_000,
  wallMs: 5000,
} as const;

/** Rebuilt state at one step (see replay.ts). */
export interface TraceState {
  stack: Frame[];
  locals: Record<string, Record<string, Value>>;
  heap: Record<string, HeapObj>;
  stdout: string;
}

export function isRef(v: Value): v is { ref: string } {
  return typeof v === "object" && v !== null && "ref" in v;
}
export function isSpecial(v: Value): v is SpecialValue {
  return typeof v === "object" && v !== null && "sp" in v;
}
