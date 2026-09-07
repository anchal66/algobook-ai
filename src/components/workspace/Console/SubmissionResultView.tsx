"use client";
/**
 * After Submit (Module 03 W-12): `Accepted 🎉` with confetti, Runtime / Memory Beats % cards,
 * solve meta, Next problem · Review my code · View editorial; or the failing-case view.
 */
import { useState } from "react";
import { ArrowRight, BookOpen, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, useWorkspace } from "@/store/workspace";
import { useMe } from "@/store/me";
import { ApiError, reviewSubmission } from "@/lib/workspace/api";
import type { ReviewDTO } from "@/lib/workspace/types";
import { AcceptedConfetti } from "@/components/workspace/Overlays/AcceptedConfetti";
import { CaseResultView, OutputBlock } from "@/components/workspace/Console/CaseResultView";
import { ExplainErrorButton } from "@/components/workspace/Console/ExplainErrorButton";
import { VERDICT_CLASS, VERDICT_LABEL, formatMemory } from "@/components/workspace/Console/verdict";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

export function BeatsBar({ label, value, beats }: { label: string; value: string; beats: number | null }) {
  const pct = Math.max(0, Math.min(100, beats ?? 0));
  return (
    <div className="rounded-[8px] bg-fg-1/[0.05] p-3">
      <p className="text-xs text-fg-3">{label}</p>
      <p className="mt-1 text-lg font-semibold text-fg-1">{value}</p>
      <p className="text-xs text-fg-2">Beats <span className="font-semibold text-fg-1">{beats === null ? "—" : `${beats.toFixed(1)}%`}</span></p>
      <div className="mt-2 flex h-6 items-end gap-px" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 20 + 80 * Math.exp(-Math.pow((i - 8) / 5, 2));
          const filled = i / 24 <= pct / 100;
          return <span key={i} className={cn("flex-1 rounded-t-[2px] transition-colors", filled ? "bg-brand-to" : "bg-fg-1/10")} style={{ height: `${h}%` }} />;
        })}
      </div>
    </div>
  );
}

export interface SubmissionResultViewProps {
  onNext: () => void;
  onViewEditorial: () => void;
  onAskTutor: () => void;
}

export function SubmissionResultView({ onNext, onViewEditorial, onAskTutor }: SubmissionResultViewProps) {
  const result = useWorkspace((s) => s.submitResult);
  const problem = useWorkspace((s) => s.problem);
  const projectId = useWorkspace((s) => s.projectId);
  const bumpQuota = useMe((s) => s.bumpQuota);
  const [review, setReview] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: ReviewDTO; error?: string }>({ status: "idle" });
  if (!result || !problem) return null;
  const s = result.submission;
  const accepted = s.verdict === "AC";

  const doReview = async () => {
    setReview({ status: "loading" });
    try {
      const r = await reviewSubmission(problem.id, s.id);
      if (!r.cached) bumpQuota("review");
      setReview({ status: "done", data: r.review });
    } catch (e) {
      setReview({ status: "error", error: e instanceof ApiError ? (e.code === "PAYMENT_REQUIRED" ? "AI code review is part of the Pro plan." : e.message) : "Review failed" });
    }
  };

  return (
    <div className="ws-scroll h-full overflow-y-auto p-4">
      {accepted && <AcceptedConfetti />}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={cn("text-lg font-semibold", VERDICT_CLASS[s.verdict])}>{VERDICT_LABEL[s.verdict]}{accepted && " 🎉"}</h2>
        <span className="text-xs text-fg-3">{accepted ? `${s.passed}/${s.total} testcases passed` : `${s.passed}/${s.total} testcases passed`}</span>
      </div>

      {accepted ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BeatsBar label="Runtime" value={`${s.runtimeMs} ms`} beats={s.beatsRuntimePct} />
            <BeatsBar label="Memory" value={formatMemory(s.memoryKb)} beats={s.beatsMemoryPct} />
          </div>
          <p className="mt-3 text-xs text-fg-3">
            Solved in {formatClock(s.timeSpentSec * 1000)} · {s.runCount} {s.runCount === 1 ? "run" : "runs"} · {s.hintsUsed} {s.hintsUsed === 1 ? "hint" : "hints"}{s.editorialViewed ? " · editorial viewed" : ""}{s.isFirstTry ? " · first try" : ` · attempt ${s.attemptNumber}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {projectId && (
              <button type="button" onClick={onNext} className="bg-brand flex h-9 items-center gap-1.5 rounded-[8px] px-4 text-sm font-medium text-white hover:opacity-90">
                Next problem <ArrowRight className="size-4" />
              </button>
            )}
            <button type="button" onClick={() => void doReview()} disabled={review.status === "loading" || review.status === "done"} className="flex h-9 items-center gap-1.5 rounded-[8px] bg-ws-chip px-4 text-sm font-medium text-fg-1 hover:bg-ws-hover disabled:opacity-60">
              {review.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-brand-to" />} Review my code
            </button>
            <button type="button" onClick={onViewEditorial} className="flex h-9 items-center gap-1.5 rounded-[8px] bg-ws-chip px-4 text-sm font-medium text-fg-1 hover:bg-ws-hover">
              <BookOpen className="size-4" /> View editorial
            </button>
          </div>
          {review.status === "error" && <p className="mt-2 text-xs text-wrong" role="alert">{review.error}</p>}
          {review.status === "done" && review.data && <ReviewCard review={review.data} />}
        </>
      ) : (
        <div className="mt-3 space-y-3">
          {s.verdict === "CE" && s.compileOutput && (
            <div>
              <OutputBlock label="Compile output" value={s.compileOutput} tone="error" />
              <ExplainErrorButton output={s.compileOutput} />
            </div>
          )}
          {s.verdict !== "CE" && s.failedCase && (
            <CaseResultView
              params={problem.params}
              hidden={s.failedCase.hidden}
              result={{ index: s.failedCase.index, status: s.failedCase.status ?? s.verdict, passed: false, input: s.failedCase.input, expected: s.failedCase.expected, actual: s.failedCase.actual, stderr: s.failedCase.stderr, compileOutput: null, timeMs: 0, memoryKb: 0 }}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onAskTutor} className="flex h-9 items-center gap-1.5 rounded-[8px] bg-brand-from/15 px-4 text-sm font-medium text-brand-to hover:bg-brand-from/25">
              <MessageSquare className="size-4" /> Ask AI tutor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewDTO }) {
  return (
    <div className="mt-4 rounded-[8px] border border-brand-from/30 bg-brand-from/[0.07] p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand-to"><Sparkles className="size-3.5" /> AI code review</p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", review.isOptimal ? "bg-accepted/15 text-accepted" : "bg-medium/15 text-medium")}>{review.score}/10{review.isOptimal ? " · optimal" : ""}</span>
      </div>
      <StatementMarkdown markdown={review.analysis} />
      <p className="mt-2 text-xs text-fg-2">Time {review.timeComplexity} · Space {review.spaceComplexity}</p>
      {review.improvements.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-1/90">{review.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
      )}
      {!review.isOptimal && <p className="mt-2 text-fg-2"><strong className="text-fg-1">Optimal approach:</strong> {review.optimalApproach}</p>}
    </div>
  );
}
