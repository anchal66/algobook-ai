"use client";
/** Visualizer state (Module 07 §3.4): the current trace, playback cursor and UI selection. */
import { create } from "zustand";
import type { TraceProgress } from "@/lib/trace/run";
import type { Trace } from "@/lib/trace/types";

export type TraceStatus = "idle" | "preparing" | "loading" | "running" | "done" | "error";
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

export interface TraceState {
  status: TraceStatus;
  progress: TraceProgress | null;
  error: { message: string; line: number | null } | null;
  trace: Trace | null;
  /** Which workspace case the trace was made from. */
  caseIndex: number;
  /** Hash of code + case used for the trace (stale detection). */
  sourceKey: string | null;
  /** The code that was traced (shown in the read-only code column). */
  code: string;
  cursor: number;
  playing: boolean;
  speed: PlaybackSpeed;
  breakpoints: number[];
  /** Selected heap object or `frameId:name`. */
  selected: string | null;
  showHarness: boolean;
  explain: { open: boolean; text: string; streaming: boolean; error: string | null; forStep: number | null; question: "step" | "chapter" | "failure" | null };
  setStatus: (s: Partial<Pick<TraceState, "status" | "progress" | "error">>) => void;
  setTrace: (t: Trace | null, caseIndex: number, sourceKey: string | null, code?: string) => void;
  setCursor: (i: number) => void;
  step: (dir: 1 | -1) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: PlaybackSpeed) => void;
  toggleBreakpoint: (line: number) => void;
  setSelected: (s: string | null) => void;
  setShowHarness: (v: boolean) => void;
  setExplain: (p: Partial<TraceState["explain"]>) => void;
  reset: () => void;
}

const initialExplain: TraceState["explain"] = { open: false, text: "", streaming: false, error: null, forStep: null, question: null };

export const useTrace = create<TraceState>()((set, get) => ({
  status: "idle", progress: null, error: null, trace: null, caseIndex: 0, sourceKey: null, code: "",
  cursor: 0, playing: false, speed: 1, breakpoints: [], selected: null, showHarness: false, explain: initialExplain,
  setStatus: (p) => set(p),
  setTrace: (trace, caseIndex, sourceKey, code = "") => set({ trace, caseIndex, sourceKey, code, cursor: 0, playing: false, selected: null, explain: initialExplain, status: trace ? "done" : "idle", error: null, progress: null }),
  setCursor: (i) => {
    const n = get().trace?.steps.length ?? 0;
    set({ cursor: Math.max(0, Math.min(Math.max(0, n - 1), i)) });
  },
  step: (dir) => { const s = get(); s.setCursor(s.cursor + dir); },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  toggleBreakpoint: (line) => set((s) => ({ breakpoints: s.breakpoints.includes(line) ? s.breakpoints.filter((l) => l !== line) : [...s.breakpoints, line].sort((a, b) => a - b) })),
  setSelected: (selected) => set({ selected }),
  setShowHarness: (showHarness) => set({ showHarness }),
  setExplain: (p) => set((s) => ({ explain: { ...s.explain, ...p } })),
  reset: () => set({ status: "idle", progress: null, error: null, trace: null, cursor: 0, playing: false, selected: null, breakpoints: [], explain: initialExplain, sourceKey: null }),
}));
