"use client";
/** Test Result tab (Module 03 W-11/W-12): idle → running shimmer → per-case results, or the submission result view. */
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";
import { CaseChips, type Chip } from "@/components/workspace/Console/CaseChips";
import { CaseResultView } from "@/components/workspace/Console/CaseResultView";
import { SubmissionResultView, type SubmissionResultViewProps } from "@/components/workspace/Console/SubmissionResultView";
import { VERDICT_CLASS, VERDICT_LABEL } from "@/components/workspace/Console/verdict";

function RunningSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
      <p className="text-sm text-fg-2">{label}</p>
      <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="ws-shimmer h-7 w-16 rounded-[6px]" />)}</div>
      <div className="ws-shimmer h-3 w-20 rounded" />
      <div className="ws-shimmer h-9 rounded-[8px]" />
      <div className="ws-shimmer h-3 w-20 rounded" />
      <div className="ws-shimmer h-9 rounded-[8px]" />
    </div>
  );
}

export function TestResultTab(props: SubmissionResultViewProps) {
  const problem = useWorkspace((s) => s.problem);
  const runState = useWorkspace((s) => s.runState);
  const runResult = useWorkspace((s) => s.runResult);
  const runError = useWorkspace((s) => s.runError);
  const active = useWorkspace((s) => s.activeResultCase);
  const setRun = useWorkspace((s) => s.setRun);
  const submitState = useWorkspace((s) => s.submitState);
  const submitError = useWorkspace((s) => s.submitError);
  const submitResult = useWorkspace((s) => s.submitResult);
  const cases = useWorkspace((s) => s.cases);

  if (submitState === "running") return <RunningSkeleton label="Judging…" />;
  if (submitState === "error") return <ErrorState message={submitError ?? "Submit failed"} />;
  if (submitState === "done" && submitResult) return <SubmissionResultView {...props} />;
  if (runState === "running") return <RunningSkeleton label="Running…" />;
  if (runState === "error") return <ErrorState message={runError ?? "Run failed"} />;
  if (runState !== "done" || !runResult || !problem) {
    return <div className="flex h-full items-center justify-center p-4 text-sm text-fg-3">You must run your code first</div>;
  }

  const allPassed = runResult.every((c) => c.passed);
  const worst = runResult.find((c) => !c.passed) ?? runResult[0];
  const maxMs = Math.max(0, ...runResult.map((c) => c.timeMs));
  const chips: Chip[] = runResult.map((c, i) => ({ id: cases[i]?.id ?? String(i), label: `Case ${i + 1}`, status: c.passed ? "pass" : "fail" }));
  const current = runResult[Math.min(active, runResult.length - 1)];

  return (
    <div className="ws-scroll h-full overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={cn("text-lg font-semibold", allPassed ? "text-accepted" : VERDICT_CLASS[worst.status])}>{allPassed ? "Accepted" : VERDICT_LABEL[worst.status]}</h2>
        <span className="text-xs text-fg-3">Runtime: {maxMs} ms</span>
      </div>
      {worst.status !== "CE" && <CaseChips chips={chips} active={Math.min(active, runResult.length - 1)} onSelect={(i) => setRun({ activeResultCase: i })} />}
      <div className="mt-4">
        <CaseResultView params={problem.params} result={current} custom={cases[current.index]?.custom} />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center" role="alert">
      <p className="text-sm font-medium text-wrong">Something went wrong</p>
      <p className="max-w-sm text-xs text-fg-3">{message}</p>
    </div>
  );
}
