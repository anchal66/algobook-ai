"use client";
/** Collapsible "Why this problem?" strip (Module 03 W-06): practice state, recommendation reason, template progress. */
import { useState } from "react";
import { Brain, Building2, ChevronDown, Dumbbell, Flame, Info, Repeat, Sparkles, Sun, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import { useMe } from "@/store/me";
import type { PracticeState } from "@/types";

const STATE_CFG: Record<PracticeState, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string; hint: string }> = {
  "warm-up": { label: "Warm-up", icon: Sun, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", hint: "Easy wins to get you going." },
  learning: { label: "Learning", icon: Brain, cls: "text-sky-400 bg-sky-500/10 border-sky-500/20", hint: "Building new patterns — expect hints." },
  strengthening: { label: "Strengthening", icon: Dumbbell, cls: "text-violet-400 bg-violet-500/10 border-violet-500/20", hint: "Reinforcing topics you have almost mastered." },
  revision: { label: "Revision", icon: Repeat, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", hint: "Spaced repetition of what you learned earlier." },
  "interview-prep": { label: "Interview prep", icon: Target, cls: "text-rose-400 bg-rose-500/10 border-rose-500/20", hint: "Company-style mixes under time pressure." },
  maintenance: { label: "Maintenance", icon: Flame, cls: "text-orange-400 bg-orange-500/10 border-orange-500/20", hint: "Keeping your streak and skills fresh." },
};

export function WhyThisProblem() {
  const project = useWorkspace((s) => s.project);
  const items = useWorkspace((s) => s.items);
  const problem = useWorkspace((s) => s.problem);
  const state = useMe((s) => s.me?.user.practiceState ?? "learning");
  const [open, setOpen] = useState(true);
  if (!project || !problem) return null;
  const item = items.find((i) => i.problemId === problem.id);
  const cfg = STATE_CFG[state] ?? STATE_CFG.learning;
  const Icon = cfg.icon;
  const solved = project.progress.solved;
  const total = project.progress.items;

  return (
    <div className="mb-3 rounded-[8px] border border-line/60 bg-ws-bar/60">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-fg-2 hover:text-fg-1">
        <Sparkles className="size-3.5 text-brand-to" /> Why this problem?
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("flex cursor-help items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[11px] font-medium", cfg.cls)}><Icon className="size-3" />{cfg.label}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs"><p className="font-medium">{cfg.label} phase</p><p className="opacity-80">{cfg.hint}</p></TooltipContent>
          </Tooltip>
          {item?.reason && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1.5 rounded-[6px] border border-brand-from/20 bg-brand-from/10 px-2 py-1 text-[11px] font-medium text-brand-to"><Info className="size-3" />{item.reason.short}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">{item.reason.detail}</TooltipContent>
            </Tooltip>
          )}
          {project.templateId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1.5 rounded-[6px] border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-400">
                  <Building2 className="size-3" /><span className="capitalize">{project.templateId}</span>: {solved}/{total}
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-sky-500/20"><span className="block h-full rounded-full bg-sky-400" style={{ width: `${total ? Math.round((100 * solved) / total) : 0}%` }} /></span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">{solved} of {total} problems in this {project.templateId} list solved</TooltipContent>
            </Tooltip>
          )}
          {item?.source && <span className="rounded-[6px] bg-ws-chip px-2 py-1 text-[11px] text-fg-3">{item.source === "curated" ? "from the verified pool" : item.source === "template" ? "company list" : "AI generated · verified"}</span>}
        </div>
      )}
    </div>
  );
}
