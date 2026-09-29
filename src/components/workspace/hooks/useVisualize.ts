"use client";
/** Visualize flow (Module 07 V-07/V-08): build stdin for the chosen case, fetch the driver, trace in the worker, open the Trace tab. */
import { useCallback } from "react";
import { toast } from "sonner";
import { ApiError, getDriver } from "@/lib/workspace/api";
import { fromHuman } from "@/lib/judge/human";
import { runTrace, TraceRunError } from "@/lib/trace/run";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/store/workspace";
import { useTrace } from "@/store/trace";
import type { Language } from "@/types";

export const VISUALIZABLE: ReadonlySet<Language> = new Set<Language>(["python", "javascript"]);

const driverCache = new Map<string, string>();

export function canVisualize(language: Language): language is "python" | "javascript" {
  return VISUALIZABLE.has(language);
}

export function traceSourceKey(language: string, code: string, caseIndex: number, values: string[]): string {
  return `${language}\u0000${caseIndex}\u0000${values.join("\u0001")}\u0000${code}`;
}

export function useVisualize(): { visualize: (caseIndex?: number) => Promise<void> } {
  const visualize = useCallback(async (caseIndexArg?: number) => {
    const ws = useWorkspace.getState();
    const tr = useTrace.getState();
    const { problem, language, cases } = ws;
    if (!problem) return;
    if (!canVisualize(language)) { toast("Visualize is available for Python and JavaScript"); return; }
    const caseIndex = Math.max(0, Math.min(cases.length - 1, caseIndexArg ?? (ws.consoleTab === "result" ? ws.activeResultCase : ws.activeCase)));
    const c = cases[caseIndex];
    if (!c) return;
    const enc = fromHuman(problem.params, c.values);
    if (!enc.ok) {
      ws.setUi({ consoleTab: "testcase" });
      ws.setActiveCase(caseIndex);
      toast.error("Fix the highlighted test case input first");
      return;
    }
    const code = ws.code[language] ?? "";
    ws.setUi({ consoleTab: "trace", maximized: "console" });
    tr.setStatus({ status: "preparing", progress: null, error: null });
    try {
      const key = `${problem.id}:${language}`;
      let driver = driverCache.get(key);
      if (!driver) { driver = (await getDriver(problem.id, language)).driver; driverCache.set(key, driver); }
      tr.setStatus({ status: "loading" });
      const started = Date.now();
      const trace = await runTrace({
        lang: language, user: code, driver, stdin: enc.stdin, expected: c.expected,
        onProgress: (p) => useTrace.getState().setStatus({ status: p.phase === "loading-python" ? "loading" : "running", progress: p }),
      });
      useTrace.getState().setTrace(trace, caseIndex, traceSourceKey(language, code, caseIndex, c.values), code);
      if (trace.divergeAt !== undefined) useTrace.getState().setCursor(trace.divergeAt);
      else if (trace.exception) useTrace.getState().setCursor(trace.exception.step);
      track("visualize", { language, steps: trace.steps.length, truncated: String(trace.truncated), ms: Date.now() - started });
    } catch (e) {
      const msg = e instanceof TraceRunError ? e.message : e instanceof ApiError ? (e.code === "LANGUAGE_NOT_READY" ? "This language is still being prepared for the problem." : e.message) : (e as Error)?.message ?? "The visualizer failed";
      const line = e instanceof TraceRunError ? e.line : null;
      if (e instanceof TraceRunError && e.message === "Cancelled") return;
      useTrace.getState().setStatus({ status: "error", error: { message: msg, line }, progress: null });
    }
  }, []);
  return { visualize };
}
