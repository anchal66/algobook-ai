"use client";
/** 48 px top bar (Module 03 §1.1): logo · Problem List · ‹ › ⤮ | Debug · Run · Submit · Notes · AI | Layout · Settings · Timer · Streak · avatar · Premium. */
import Link from "next/link";
import { ChevronLeft, ChevronRight, Code2, ListOrdered, NotebookPen, Settings, Shuffle, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import UserMenu from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { comboLabel, shortcutById } from "@/lib/editor/shortcuts";
import { RunSubmitCluster } from "@/components/workspace/TopBar/RunSubmitCluster";
import { TimerPill } from "@/components/workspace/TopBar/TimerPill";
import { StreakPill } from "@/components/workspace/TopBar/StreakPill";
import { LayoutMenu, iconBtn } from "@/components/workspace/TopBar/LayoutMenu";
import type { NextProblemApi } from "@/components/workspace/hooks/useNextProblem";
import { useWorkspace } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { isPro, useMe } from "@/store/me";

export interface TopBarProps {
  nav: NextProblemApi;
  onRun: () => void;
  onSubmit: () => void;
  onFullscreen: () => void;
}

export function TopBar({ nav, onRun, onSubmit, onFullscreen }: TopBarProps) {
  const setUi = useWorkspace((s) => s.setUi);
  const sidePanel = useWorkspace((s) => s.sidePanel);
  const placement = useSettings((s) => s.layout.runSubmitPlacement);
  const me = useMe((s) => s.me);
  const pro = isPro(me);

  const toggleSide = (p: "notes" | "tutor") => setUi({ sidePanel: sidePanel === p ? null : p });
  const pillBtn = (active: boolean) => cn("flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-ws-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60", active ? "text-brand-to" : "text-fg-1");

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3" role="banner">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-1">
        <Link href="/dashboard" aria-label="AlgoBook home" className="mr-1 flex size-8 items-center justify-center rounded-[8px] hover:bg-ws-hover">
          <span className="bg-brand flex size-6 items-center justify-center rounded-[6px]"><Code2 className="size-3.5 text-white" /></span>
        </Link>
        <span className="h-4 w-px bg-line/70" />
        <button type="button" onClick={() => setUi({ drawerOpen: true })} className="ml-1 flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-sm font-medium text-fg-1 hover:bg-ws-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-from/60">
          <ListOrdered className="size-4" />
          <span className="hidden sm:inline">Problem List</span>
        </button>
        {nav.hasProject && (
          <div className="hidden items-center md:flex">
            <Tooltip><TooltipTrigger asChild>
              <button type="button" onClick={nav.goPrev} disabled={!nav.canPrev} aria-label="Previous problem" className={cn(iconBtn, "disabled:opacity-40")}><ChevronLeft className="size-4" /></button>
            </TooltipTrigger><TooltipContent side="bottom">Previous {comboLabel(shortcutById("prevProblem").combo)}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button type="button" onClick={nav.goNext} disabled={!nav.canNext} aria-label="Next problem" className={cn(iconBtn, "disabled:opacity-40")}><ChevronRight className="size-4" /></button>
            </TooltipTrigger><TooltipContent side="bottom">Next {comboLabel(shortcutById("nextProblem").combo)}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button type="button" onClick={nav.shuffle} disabled={nav.total < 2} aria-label="Pick a random problem" className={cn(iconBtn, "disabled:opacity-40")}><Shuffle className="size-4" /></button>
            </TooltipTrigger><TooltipContent side="bottom">Random unsolved</TooltipContent></Tooltip>
          </div>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-1">
        {placement === "toolbar" && <RunSubmitCluster onRun={onRun} onSubmit={onSubmit} className="hidden lg:flex" />}
        <div className="flex items-center rounded-[8px] bg-ws-panel p-0.5">
          <Tooltip><TooltipTrigger asChild>
            <button type="button" onClick={() => toggleSide("notes")} aria-pressed={sidePanel === "notes"} className={pillBtn(sidePanel === "notes")}><NotebookPen className="size-4" /><span className="hidden xl:inline">Notes</span></button>
          </TooltipTrigger><TooltipContent side="bottom">Notes</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button type="button" onClick={() => toggleSide("tutor")} aria-pressed={sidePanel === "tutor"} className={pillBtn(sidePanel === "tutor")}><Sparkles className="size-4" /><span className="hidden xl:inline">AI</span></button>
          </TooltipTrigger><TooltipContent side="bottom">AI tutor</TooltipContent></Tooltip>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <LayoutMenu onFullscreen={onFullscreen} />
        <Tooltip><TooltipTrigger asChild>
          <button type="button" onClick={() => setUi({ settingsOpen: true })} aria-label="Settings" className={iconBtn}><Settings className="size-4" /></button>
        </TooltipTrigger><TooltipContent side="bottom">Settings</TooltipContent></Tooltip>
        <TimerPill />
        <StreakPill className="hidden sm:flex" />
        <div className="ml-1 flex items-center [&_img]:size-7 [&_button]:ring-1 [&_button]:ring-line"><UserMenu /></div>
        {pro ? (
          <span className="ml-1 hidden rounded-[6px] bg-[#ffa116]/15 px-2 py-1 text-xs font-semibold text-[#ffa116] sm:inline">Pro</span>
        ) : (
          <Link href="/settings" className="ml-1 hidden rounded-[6px] bg-[#ffa116]/15 px-2 py-1 text-xs font-semibold text-[#ffa116] transition-colors hover:bg-[#ffa116]/25 sm:inline">Upgrade</Link>
        )}
      </div>
    </header>
  );
}
