"use client";
/** Sticky footer (Module 03 §1.3): 👍 👎 · ⭐ bookmark · ↗ share · ❓ report. */
import { useEffect, useState } from "react";
import { Flag, Share2, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getReaction, isBookmarked, setReaction, toggleBookmark, type Reaction } from "@/lib/workspace/bookmarks";
import { useAuth } from "@/context/AuthContext";
import { ReportIssueDialog } from "@/components/workspace/Description/ReportIssueDialog";
import type { ProblemDTO } from "@/lib/workspace/types";

const btn = "flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs text-fg-2 transition-colors hover:bg-ws-hover hover:text-fg-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60";

export function DescriptionFooter({ problem }: { problem: ProblemDTO }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";
  const [reaction, setReactionState] = useState<Reaction>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setReactionState(getReaction(uid, problem.id));
    setBookmarked(isBookmarked(uid, problem.id));
  }, [uid, problem.id]);

  const react = (r: Reaction) => {
    const next = reaction === r ? null : r;
    setReaction(uid, problem.id, next);
    setReactionState(next);
  };
  const share = async () => {
    const url = `${window.location.origin}/problems/${problem.slug}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { toast(url); }
  };

  return (
    <footer className="flex h-10 shrink-0 items-center gap-1 border-t border-line/60 bg-ws-panel px-2">
      <div className="flex items-center rounded-[6px] bg-ws-chip">
        <Tooltip><TooltipTrigger asChild>
          <button type="button" onClick={() => react("up")} aria-pressed={reaction === "up"} aria-label="Like" className={cn(btn, reaction === "up" && "text-accepted")}><ThumbsUp className="size-3.5" /><span className="tabular-nums">{Math.max(0, problem.stats.accepted) + (reaction === "up" ? 1 : 0)}</span></button>
        </TooltipTrigger><TooltipContent side="top">Good problem</TooltipContent></Tooltip>
        <span className="h-3.5 w-px bg-line/70" />
        <Tooltip><TooltipTrigger asChild>
          <button type="button" onClick={() => react("down")} aria-pressed={reaction === "down"} aria-label="Dislike" className={cn(btn, reaction === "down" && "text-wrong")}><ThumbsDown className="size-3.5" /></button>
        </TooltipTrigger><TooltipContent side="top">Not a good problem</TooltipContent></Tooltip>
      </div>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={() => { setBookmarked(toggleBookmark(uid, problem.id)); }} aria-pressed={bookmarked} aria-label="Bookmark" className={cn(btn, bookmarked && "text-medium")}><Star className={cn("size-3.5", bookmarked && "fill-current")} /></button>
      </TooltipTrigger><TooltipContent side="top">{bookmarked ? "Remove bookmark" : "Bookmark"}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={() => void share()} aria-label="Share" className={btn}><Share2 className="size-3.5" /></button>
      </TooltipTrigger><TooltipContent side="top">Copy link</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild>
        <button type="button" onClick={() => setReportOpen(true)} aria-label="Report an issue" className={cn(btn, "ml-auto")}><Flag className="size-3.5" /><span className="hidden sm:inline">Report issue</span></button>
      </TooltipTrigger><TooltipContent side="top">Something wrong with this problem?</TooltipContent></Tooltip>
      <span className="ml-1 hidden items-center gap-1 text-[11px] text-fg-3 md:flex">
        <span className="size-1.5 rounded-full bg-accepted" /> {problem.stats.acceptanceRate}% accepted · {problem.stats.attempts} attempts
      </span>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} problemId={problem.id} title={problem.title} />
    </footer>
  );
}
