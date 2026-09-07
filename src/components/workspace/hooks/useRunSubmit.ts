"use client";
/** Run and Submit flows (Module 03 W-11/W-12). */
import { useCallback } from "react";
import { toast } from "sonner";
import { ApiError, runCode, submitCode } from "@/lib/workspace/api";
import { fromHuman } from "@/lib/judge/human";
import { track } from "@/lib/analytics";
import { timerElapsedMs, useWorkspace } from "@/store/workspace";
import { useMe } from "@/store/me";
import { invalidateProjectCache } from "@/components/workspace/hooks/useProblemLoader";
import { useSession } from "@/store/session";

export function describeApiError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "QUOTA_EXCEEDED") return "Daily quota reached for this feature. It resets at midnight UTC.";
    if (e.code === "PAYMENT_REQUIRED") return "This feature is part of the Pro plan.";
    if (e.code === "LANGUAGE_NOT_READY") return "This language is still being prepared for the problem. Try again in a moment.";
    if (e.code === "UNAUTHENTICATED") return "Your session expired. Please sign in again.";
    return e.message;
  }
  return (e as Error)?.message ?? "Something went wrong";
}

export function useRunSubmit(): { run: () => Promise<void>; submit: () => Promise<void> } {
  const bumpQuota = useMe((s) => s.bumpQuota);

  const run = useCallback(async () => {
    const ws = useWorkspace.getState();
    const { problem, language, cases } = ws;
    if (!problem || ws.runState === "running" || ws.submitState === "running") return;
    const code = ws.code[language] ?? "";
    const encoded: { input: string; expected?: string }[] = [];
    for (let i = 0; i < cases.length; i++) {
      const r = fromHuman(problem.params, cases[i].values);
      if (!r.ok) {
        ws.setUi({ consoleTab: "testcase" });
        ws.setActiveCase(i);
        toast.error(`Case ${i + 1} has an invalid input`);
        return;
      }
      encoded.push(cases[i].custom ? { input: r.stdin } : { input: r.stdin, expected: cases[i].expected });
    }
    ws.setRun({ runState: "running", runResult: null, runError: null, activeResultCase: 0 });
    ws.setSubmit({ submitState: "idle", submitResult: null, submitError: null });
    ws.setUi({ consoleTab: "result" });
    try {
      const res = await runCode(problem.id, language, code, encoded);
      const first = res.cases.findIndex((c) => !c.passed);
      useWorkspace.getState().setRun({ runState: "done", runResult: res.cases, activeResultCase: first >= 0 ? first : 0 });
      useWorkspace.getState().incrementRuns();
      bumpQuota("run");
      track("run", { language, cases: encoded.length });
    } catch (e) {
      useWorkspace.getState().setRun({ runState: "error", runError: describeApiError(e) });
    }
  }, [bumpQuota]);

  const submit = useCallback(async () => {
    const ws = useWorkspace.getState();
    const { problem, language } = ws;
    if (!problem || ws.submitState === "running" || ws.runState === "running") return;
    const code = ws.code[language] ?? "";
    if (!code.trim()) { toast.error("Write some code first"); return; }
    const timeSpentSec = Math.round((ws.timer.startedAt || ws.timer.accumulatedMs ? timerElapsedMs(ws.timer) : Date.now() - ws.openedAt) / 1000);
    ws.setSubmit({ submitState: "running", submitResult: null, submitError: null });
    ws.setUi({ consoleTab: "result" });
    try {
      const res = await submitCode(problem.id, language, code, {
        hintsUsed: ws.hintsRevealed, editorialViewed: ws.editorialViewed, timeSpentSec, runCount: ws.runCount,
      }, ws.projectId ?? undefined);
      const w = useWorkspace.getState();
      w.setSubmit({ submitState: "done", submitResult: res, submittedAt: Date.now() });
      bumpQuota("submit");
      track("submit", { language, verdict: res.submission.verdict, passed: res.submission.passed, total: res.submission.total });
      useSession.getState().record(res.submission.verdict === "AC", ws.hintsRevealed, timeSpentSec);
      if (res.submission.verdict === "AC") {
        w.markItemSolved(problem.id);
        invalidateProjectCache();
        if (w.timer.running) w.setTimer({ running: false, accumulatedMs: timerElapsedMs(w.timer), startedAt: null });
        useMe.getState().load(useMe.getState().loadedFor ?? "", true).catch(() => undefined);
      }
    } catch (e) {
      useWorkspace.getState().setSubmit({ submitState: "error", submitError: describeApiError(e) });
    }
  }, [bumpQuota]);

  return { run, submit };
}
