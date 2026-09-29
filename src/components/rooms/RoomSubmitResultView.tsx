"use client";
/** Contest submit result (Module 06): verdict per the room's visibility setting, points, submits left, no AI actions. */
import { CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import type { RoomSubmitResponse } from "@/lib/workspace/api";
import { CaseResultView, OutputBlock } from "@/components/workspace/Console/CaseResultView";
import { VERDICT_CLASS, VERDICT_LABEL } from "@/components/workspace/Console/verdict";
import { AcceptedConfetti } from "@/components/workspace/Overlays/AcceptedConfetti";
import type { CaseStatus } from "@/types";

export function RoomSubmitResultView({ result }: { result: RoomSubmitResponse }) {
  const problem = useWorkspace((s) => s.problem);
  const { submission: sub, problem: ps, score } = result;
  const accepted = sub.verdict === "AC";
  const hidden = result.hiddenVerdict;
  const label = hidden ? "Received" : VERDICT_LABEL[sub.verdict as CaseStatus] ?? sub.verdict;
  return (
    <div className="ws-scroll h-full overflow-y-auto p-4">
      {accepted && <AcceptedConfetti />}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={cn("text-lg font-semibold", hidden ? "text-fg-1" : accepted ? "text-accepted" : VERDICT_CLASS[sub.verdict as CaseStatus] ?? "text-fg-1")}>{label}</h2>
        {sub.passed !== null && sub.total !== null && <span className="text-xs text-fg-3">{sub.passed} / {sub.total} tests · {sub.runtimeMs} ms</span>}
        <span className="ml-auto text-xs text-fg-3">{ps.submitsLeft} submit{ps.submitsLeft === 1 ? "" : "s"} left on this problem</span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-[8px] bg-fg-1/[0.05] p-3"><p className="text-xs text-fg-3">This problem</p><p className="mt-1 text-lg font-semibold text-fg-1">{ps.points} pts</p><p className="text-xs text-fg-2">{ps.status === "solved" ? "solved" : `${ps.attempts} attempt${ps.attempts === 1 ? "" : "s"}`}</p></div>
        <div className="rounded-[8px] bg-fg-1/[0.05] p-3"><p className="text-xs text-fg-3">Contest score</p><p className="mt-1 text-lg font-semibold text-fg-1">{score.final}</p><p className="text-xs text-fg-2">{score.solved} solved{score.penaltyPct ? ` · −${score.penaltyPct}% integrity` : ""}</p></div>
        <div className="flex items-center justify-center rounded-[8px] bg-fg-1/[0.05] p-3 text-brand-to">{accepted ? <CheckCircle2 className="size-6" /> : <Trophy className="size-6 opacity-40" />}</div>
      </div>
      {hidden && <p className="text-sm text-fg-2">This room hides verdicts until the contest ends. Your submission was recorded.</p>}
      {!hidden && sub.verdict === "CE" && sub.compileOutput && <OutputBlock label="Compile output" value={sub.compileOutput} tone="error" />}
      {!hidden && sub.failedCase && problem && sub.failedCase.input && (
        <CaseResultView params={problem.params} result={{ index: sub.failedCase.index, status: (sub.failedCase.status ?? sub.verdict) as CaseStatus, passed: false, input: sub.failedCase.input, expected: sub.failedCase.expected, actual: sub.failedCase.actual, stderr: sub.failedCase.stderr ?? "", compileOutput: null, timeMs: sub.runtimeMs, memoryKb: 0 }} hidden={sub.failedCase.hidden} />
      )}
      {!hidden && sub.failedCase && !sub.failedCase.input && <p className="text-sm text-fg-2">A hidden test failed. Details are not shown in this room.</p>}
    </div>
  );
}
