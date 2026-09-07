"use client";
/** Generation experience (Module 03 §1.12 / W-18): animated orb + stage list driven by the SSE stream, retry on failure. */
import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { useNextProblem } from "@/components/workspace/hooks/useNextProblem";
import type { GenerationStage } from "@/lib/workspace/types";

const STAGE_ORDER: GenerationStage[] = ["searching", "generating", "validating", "verifying", "repairing", "persisting", "done"];
const STAGE_LABEL: Record<GenerationStage, string> = {
  searching: "Searching the verified pool…",
  generating: "Generating with AI…",
  validating: "Checking the spec…",
  verifying: "Verifying test cases on the judge…",
  repairing: "Repairing…",
  persisting: "Saving the problem…",
  done: "Done",
};

export function GenerationStages({ compact }: { compact?: boolean }) {
  const generation = useWorkspace((s) => s.generation);
  const nav = useNextProblem();
  const seen = new Set(generation.stages.map((s) => s.stage));
  const last = generation.stages[generation.stages.length - 1];
  const visible = STAGE_ORDER.filter((s) => s !== "repairing" || seen.has("repairing"));
  const reused = generation.stages.some((s) => s.stage === "done" && s.info?.source === "reused");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!generation.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [generation.active]);
  const elapsed = generation.startedAt && now ? Math.max(0, Math.round((now - generation.startedAt) / 1000)) : 0;

  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-5 p-6 text-center", compact && "gap-3 p-4")}>
      <div className="relative">
        <div className={cn("ws-orb bg-brand rounded-full opacity-90 blur-[1px]", compact ? "size-10" : "size-16")} />
        <div className={cn("absolute inset-0 flex items-center justify-center text-white", generation.error && "opacity-0")}>
          {generation.active ? <Loader2 className={cn("animate-spin", compact ? "size-4" : "size-6")} /> : <Sparkles className={compact ? "size-4" : "size-6"} />}
        </div>
      </div>
      {generation.error ? (
        <div className="max-w-sm space-y-3">
          <p className="text-sm font-medium text-fg-1">We couldn&apos;t prepare a problem</p>
          <p className="text-sm text-fg-3">{generation.error}</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => void nav.generate(generation.prompt ?? undefined)} className="bg-brand flex h-9 items-center gap-1.5 rounded-[8px] px-4 text-sm font-medium text-white hover:opacity-90"><RefreshCw className="size-4" /> Try again</button>
            <button type="button" onClick={() => useWorkspace.getState().setUi({ drawerOpen: true })} className="flex h-9 items-center rounded-[8px] bg-ws-chip px-4 text-sm font-medium text-fg-1 hover:bg-ws-hover">Open problem list</button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-fg-1">{generation.prompt ? `Finding a problem for “${generation.prompt}”` : "Preparing your next problem"}</p>
            <p className="mt-1 text-xs text-fg-3">{reused ? "Found a verified match." : `Usually 15–40 s for a pool match, up to 2 min for a fresh verified problem · ${elapsed}s`}</p>
          </div>
          <ol className="w-full max-w-xs space-y-1.5 text-left" aria-live="polite">
            {visible.map((stage) => {
              const done = seen.has(stage) && last?.stage !== stage;
              const current = last?.stage === stage && generation.active;
              const pending = !seen.has(stage);
              if (pending && reused) return null;
              return (
                <li key={stage} className={cn("flex items-center gap-2 text-sm", pending ? "text-fg-3/60" : "text-fg-1")}>
                  <span className={cn("flex size-4 items-center justify-center rounded-full", done || stage === "done" && seen.has("done") ? "bg-accepted text-white" : current ? "text-brand-to" : "border border-line")}>
                    {(done || (stage === "done" && seen.has("done"))) ? <Check className="size-3" /> : current ? <Loader2 className="size-3 animate-spin" /> : null}
                  </span>
                  {STAGE_LABEL[stage]}
                  {stage === "repairing" && last?.info?.round !== undefined && <span className="text-xs text-fg-3">round {String(last.info.round)}</span>}
                </li>
              );
            })}
          </ol>
          {generation.active && (
            <button type="button" onClick={nav.cancelGeneration} className="flex h-8 items-center gap-1 rounded-[6px] px-3 text-xs text-fg-3 hover:bg-ws-hover hover:text-fg-1"><X className="size-3.5" /> Cancel</button>
          )}
        </>
      )}
    </div>
  );
}
