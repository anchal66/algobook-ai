"use client";
/** Streak flame + count, session-health dot with break suggestion (Module 03 §1.1, W-24). */
import { useEffect } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMe } from "@/store/me";
import { useSession } from "@/store/session";

export function StreakPill({ className }: { className?: string }) {
  const streak = useMe((s) => s.me?.user.stats.currentStreak ?? 0);
  const session = useSession((s) => s.session);
  const lastSuggestionAt = useSession((s) => s.lastSuggestionAt);
  const markSuggested = useSession((s) => s.markSuggested);
  const health = useSession.getState().health();

  useEffect(() => {
    if (!health.suggestion) return;
    if (lastSuggestionAt && Date.now() - lastSuggestionAt < 20 * 60_000) return;
    markSuggested();
    toast("Time for a short break?", { description: health.suggestion, duration: 10_000 });
    // Re-evaluate whenever a new attempt is recorded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.attempts.length]);

  const dot = health.score >= 60 ? "bg-accepted" : health.score >= 30 ? "bg-medium" : "bg-hard";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex h-8 cursor-default items-center gap-1 rounded-[8px] px-2 text-sm text-fg-2", className)}>
          <Flame className={cn("size-4", streak > 0 ? "text-[#ff9f0a]" : "text-fg-3")} />
          <span className={cn("tabular-nums", streak > 0 ? "text-fg-1" : "text-fg-3")}>{streak}</span>
          {health.problemsAttempted > 0 && <span aria-hidden className={cn("ml-1 size-1.5 rounded-full", dot)} />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium">{streak > 0 ? `${streak}-day streak` : "No streak yet — solve a problem today"}</p>
        {health.problemsAttempted > 0 && (
          <p className="mt-1 opacity-80">
            Session health {health.score}/100 · {health.problemsSolved}/{health.problemsAttempted} solved in {health.sessionMinutes} min · {health.trend}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
