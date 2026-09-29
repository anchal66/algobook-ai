"use client";
/** Arena top bar (Module 06 §3.7): room name · problem strip · countdown | Visualize · Run · Submit | Leaderboard · Integrity · settings. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Lock, Settings, ShieldAlert, Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import UserMenu from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { RunSubmitCluster } from "@/components/workspace/TopBar/RunSubmitCluster";
import { LayoutMenu, iconBtn } from "@/components/workspace/TopBar/LayoutMenu";
import { useWorkspace, formatClock } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { useRoom, serverNow } from "@/store/room";
import { useNow } from "@/lib/app/useNow";

export interface RoomTopBarProps { roomId: string; index: number; onRun: () => void; onSubmit: () => void; onVisualize: () => void; onFullscreen: () => void }

export function RoomTopBar({ roomId, index, onRun, onSubmit, onVisualize, onFullscreen }: RoomTopBarProps) {
  const detail = useRoom((s) => s.detail);
  const setUi = useWorkspace((s) => s.setUi);
  const sidePanel = useWorkspace((s) => s.sidePanel);
  const placement = useSettings((s) => s.layout.runSubmitPlacement);
  const router = useRouter();
  useNow();
  const now = serverNow();
  const endsAt = detail?.room.endsAt ? Date.parse(detail.room.endsAt) : null;
  const startedAt = detail?.room.startedAt ? Date.parse(detail.room.startedAt) : null;
  const remaining = endsAt ? Math.max(0, endsAt - now) : null;
  const preStart = startedAt !== null && startedAt > now;
  const problems = detail?.room.problemSet ?? [];
  const me = detail?.me;
  const sequential = detail?.room.settings.problemMode === "sequential";
  const toggleSide = (p: "leaderboard" | "integrity") => setUi({ sidePanel: sidePanel === p ? null : p });
  const pillBtn = (active: boolean) => cn("flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-ws-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", active ? "text-brand-to" : "text-fg-1");
  const violations = me?.violations.count ?? 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3" role="banner">
      <div className="flex min-w-0 items-center gap-1">
        <Link href={`/rooms/${roomId}`} aria-label="Back to the room" className="mr-1 flex size-8 items-center justify-center rounded-[8px] hover:bg-ws-hover">
          <span className="bg-brand flex size-6 items-center justify-center rounded-[6px]"><Code2 className="size-3.5 text-white" /></span>
        </Link>
        <span className="hidden max-w-[160px] truncate text-sm font-medium text-fg-1 md:inline">{detail?.room.name ?? "Contest"}</span>
        <span className="h-4 w-px bg-line/70" />
        <div className="ml-1 flex items-center gap-0.5" role="tablist" aria-label="Contest problems">
          {problems.map((p) => {
            const mine = me?.perProblem[p.problemId];
            const locked = sequential && !!me && p.index > me.unlockedIndex;
            const status = mine?.status ?? "todo";
            return (
              <Tooltip key={p.index}>
                <TooltipTrigger asChild>
                  <button type="button" role="tab" aria-selected={p.index === index} disabled={locked} onClick={() => router.push(`/rooms/${roomId}/play/${p.index}`)}
                    className={cn("flex h-8 min-w-8 items-center justify-center gap-1 rounded-[6px] px-2 text-sm font-semibold tabular-nums transition-colors", p.index === index ? "bg-ws-chip text-fg-1" : "text-fg-2 hover:bg-ws-hover hover:text-fg-1", locked && "opacity-40")}>
                    {locked ? <Lock className="size-3" /> : <span aria-hidden className={cn("size-1.5 rounded-full", status === "solved" ? "bg-accepted" : status === "attempting" ? "bg-medium" : "bg-fg-3/50")} />}
                    {p.index + 1}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{p.title} · {p.difficulty} · {p.points} pts{locked ? " · locked" : status === "solved" ? " · solved" : ""}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {placement === "toolbar" && <RunSubmitCluster onRun={onRun} onSubmit={onSubmit} onVisualize={onVisualize} className="hidden lg:flex" />}
        <div className="flex items-center rounded-[8px] bg-ws-panel p-0.5">
          <Tooltip><TooltipTrigger asChild>
            <button type="button" aria-label="Leaderboard" onClick={() => toggleSide("leaderboard")} aria-pressed={sidePanel === "leaderboard"} className={pillBtn(sidePanel === "leaderboard")}><Trophy className="size-4" /><span className="hidden xl:inline">Leaderboard</span></button>
          </TooltipTrigger><TooltipContent side="bottom">Live standings</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button type="button" aria-label="Integrity" onClick={() => toggleSide("integrity")} aria-pressed={sidePanel === "integrity"} className={pillBtn(sidePanel === "integrity")}>
              <ShieldAlert className={cn("size-4", violations > 0 && "text-wrong")} /><span className="hidden xl:inline">Integrity</span>{violations > 0 && <span className="rounded-full bg-wrong/20 px-1.5 text-[10px] font-semibold text-wrong">{violations}</span>}
            </button>
          </TooltipTrigger><TooltipContent side="bottom">What was detected and what it cost</TooltipContent></Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className={cn("flex h-8 items-center gap-1.5 rounded-[8px] bg-ws-panel px-2.5 font-mono text-sm tabular-nums", remaining !== null && remaining < 5 * 60_000 ? "text-wrong" : "text-fg-1")} aria-live="off" aria-label="Time remaining">
          {preStart ? `starts in ${Math.ceil((startedAt! - now) / 1000)}s` : remaining === null ? "—" : formatClock(remaining)}
        </div>
        <LayoutMenu onFullscreen={onFullscreen} />
        <Tooltip><TooltipTrigger asChild>
          <button type="button" onClick={() => setUi({ settingsOpen: true })} aria-label="Settings" className={iconBtn}><Settings className="size-4" /></button>
        </TooltipTrigger><TooltipContent side="bottom">Settings</TooltipContent></Tooltip>
        <div className="ml-1 flex items-center [&_img]:size-7 [&_button]:ring-1 [&_button]:ring-line"><UserMenu /></div>
      </div>
    </header>
  );
}
