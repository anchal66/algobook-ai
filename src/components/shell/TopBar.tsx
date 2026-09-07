"use client";
/** App top bar (Module 05 §1): menu (mobile) · search/⌘K · streak flame · XP/level · plan · avatar. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Menu, Search, Sparkles, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import UserMenu from "@/components/UserMenu";
import { useCommandPalette } from "@/components/shell/CommandPalette";
import { useMe } from "@/store/me";
import { levelProgress } from "@/lib/app/format";
import { NAV_ITEMS, isActive } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { setOpen } = useCommandPalette();
  const me = useMe((s) => s.me);
  const path = usePathname();
  const current = NAV_ITEMS.find((n) => isActive(n, path));
  const stats = me?.user.stats;
  const streak = stats?.currentStreak ?? 0;
  const freezes = stats?.streakFreezes ?? 0;
  const lp = levelProgress(stats?.xp ?? 0);
  const pro = me?.plan.tier === "pro";
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-background/80 px-3 backdrop-blur-xl sm:px-4 lg:px-6" role="banner">
      <button type="button" onClick={onMenu} aria-label="Open navigation" className="flex size-9 items-center justify-center rounded-[8px] text-text-2 hover:bg-surface-2 lg:hidden">
        <Menu className="size-5" />
      </button>
      <h1 className="hidden text-md font-semibold tracking-tight text-text-1 md:block">{current?.label ?? "AlgoBook"}</h1>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex h-9 w-9 items-center justify-center gap-2 rounded-[8px] border border-line bg-surface-1 text-sm text-text-3 transition-colors hover:border-line-strong hover:text-text-2 sm:w-64 sm:justify-start sm:px-3 lg:ml-6"
        aria-label="Search (Command K)"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-2xs text-text-3 sm:inline">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {!me ? (
          <>
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/daily" className={cn("flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-semibold tabular transition-colors hover:bg-surface-2", streak > 0 ? "text-[#ff9f0a]" : "text-text-3")} aria-label={`Streak ${streak} days`}>
                  <Flame className={cn("size-4", streak > 0 && "fill-current")} />
                  {streak}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{streak > 0 ? `${streak}-day streak` : "No active streak"} · {freezes} freeze{freezes === 1 ? "" : "s"} banked</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/profile" className="relative hidden h-8 items-center gap-1.5 overflow-hidden rounded-full border border-line px-2.5 text-xs font-semibold text-text-1 transition-colors hover:bg-surface-2 sm:flex" aria-label={`Level ${lp.level}`}>
                  <span aria-hidden className="absolute inset-y-0 left-0 bg-brand-soft" style={{ width: `${Math.round(lp.progress * 100)}%` }} />
                  <Zap className="relative size-3.5 text-brand" />
                  <span className="relative">Lv {lp.level}</span>
                  <span className="relative tabular text-text-3">{stats?.xp ?? 0} XP</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{lp.toNext} XP to level {lp.level + 1}</TooltipContent>
            </Tooltip>
            {pro ? (
              <span className="hidden h-8 items-center gap-1 rounded-full bg-brand px-2.5 text-xs font-semibold text-white sm:flex"><Sparkles className="size-3.5" /> Pro</span>
            ) : (
              <Link href="/settings#plan" className="hidden h-8 items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20 sm:flex">
                <Sparkles className="size-3.5" /> Upgrade
              </Link>
            )}
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
