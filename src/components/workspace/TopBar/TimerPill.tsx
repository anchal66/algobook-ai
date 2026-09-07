"use client";
/** Stopwatch / countdown pill (Module 03 §1.1, W-23). Click to start, then pause / reset controls. */
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTimer } from "@/components/workspace/hooks/useTimer";
import { useSettings } from "@/store/settings";

export function TimerPill({ className }: { className?: string }) {
  const visible = useSettings((s) => s.timer.visible);
  const t = useTimer();
  if (!visible) return null;
  const started = t.running || t.elapsedMs > 0;
  const icon = "flex size-7 items-center justify-center rounded-[6px] text-fg-2 hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60";

  if (!started) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={t.start} aria-label="Start timer" className={cn("flex h-8 items-center gap-1 rounded-[8px] bg-ws-panel px-2 text-fg-2 hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", className)}>
            <Timer className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t.mode === "countdown" ? "Start countdown" : "Start stopwatch"}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className={cn("flex h-8 items-center gap-0.5 rounded-[8px] bg-ws-panel pl-2 pr-0.5", className)}>
      <span className={cn("font-mono text-sm tabular-nums", t.running ? "text-fg-1" : "text-fg-3")} aria-live="off">{t.label}</span>
      <button type="button" onClick={t.toggle} aria-label={t.running ? "Pause timer" : "Resume timer"} className={icon}>
        {t.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
      <button type="button" onClick={t.reset} aria-label="Reset timer" className={icon}>
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
