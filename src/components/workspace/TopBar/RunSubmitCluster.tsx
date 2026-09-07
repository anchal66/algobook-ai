"use client";
/** Debug · Run · Submit pill group (Module 03 §1.1). Rendered in the toolbar or in the Code panel header per settings. */
import { Bug, CloudUpload, Loader2, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { comboLabel, shortcutById } from "@/lib/editor/shortcuts";
import { useWorkspace } from "@/store/workspace";

export interface RunSubmitClusterProps {
  onRun: () => void;
  onSubmit: () => void;
  compact?: boolean;
  className?: string;
}

export function RunSubmitCluster({ onRun, onSubmit, compact, className }: RunSubmitClusterProps) {
  const runState = useWorkspace((s) => s.runState);
  const submitState = useWorkspace((s) => s.submitState);
  const hasProblem = useWorkspace((s) => !!s.problem);
  const busy = runState === "running" || submitState === "running";
  const btn = "flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60";

  return (
    <div className={cn("flex items-center rounded-[8px] bg-ws-panel p-0.5", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <button type="button" disabled aria-label="Debug" className={cn(btn, "text-fg-3")}>
              <Bug className="size-4" />
              {!compact && <span className="hidden lg:inline">Debug</span>}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Debugger is coming soon</TooltipContent>
      </Tooltip>
      <span className="h-4 w-px bg-line/70" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onRun} disabled={busy || !hasProblem} aria-label="Run" className={cn(btn, "text-fg-1 hover:bg-ws-hover")}>
            {runState === "running" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {!compact && <span>Run</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Run {comboLabel(shortcutById("run").combo)}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onSubmit} disabled={busy || !hasProblem} aria-label="Submit" className={cn(btn, "text-accepted hover:bg-ws-hover")}>
            {submitState === "running" ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
            {!compact && <span>Submit</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Submit {comboLabel(shortcutById("submit").combo)}</TooltipContent>
      </Tooltip>
    </div>
  );
}
