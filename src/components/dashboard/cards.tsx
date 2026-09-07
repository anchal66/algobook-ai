"use client";
/** Dashboard top-row cards (Module 05 U-12): Continue · Daily challenge · Streak & XP · Rating. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck, Flame, Play, Snowflake, TrendingUp, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts";
import { AnimatedNumber } from "@/components/design/motion";
import type { ContinueItem, DailyResponse } from "@/lib/app/api";
import type { MeResponse } from "@/lib/workspace/types";
import { fmtClock, levelProgress, secondsToUtcMidnight, timeAgo } from "@/lib/app/format";
import { cn } from "@/lib/utils";

function CardShell({ title, icon, children, className, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <Card variant="glow" className={cn("flex h-full flex-col p-5", className)}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-text-2">{icon}{title}</h3>
        {action}
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

export function ContinueCard({ item, loading }: { item: ContinueItem | null | undefined; loading: boolean }) {
  return (
    <CardShell title="Continue" icon={<Play className="size-4" />}>
      {loading ? <Skeleton className="h-20" /> : item ? (
        <>
          <Link href={item.href} className="line-clamp-2 text-md font-semibold text-text-1 hover:underline underline-offset-4">{item.number ? `${item.number}. ` : ""}{item.title}</Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-3">
            <DifficultyBadge difficulty={item.difficulty} size="sm" />
            <span>{item.solved ? "Solved" : item.draftChars > 0 ? `${item.draftChars} chars drafted` : "Not started"}</span>
            <span>· {timeAgo(item.at)}</span>
          </div>
          <Button asChild variant="brand" size="sm" className="mt-auto w-fit"><Link href={item.href}>{item.solved ? "Revisit" : "Resume"} <ArrowRight className="size-4" /></Link></Button>
        </>
      ) : (
        <>
          <p className="text-sm text-text-2">Nothing in progress. Pick a problem and your place is saved automatically.</p>
          <Button asChild variant="secondary" size="sm" className="mt-auto w-fit"><Link href="/explore">Explore problems</Link></Button>
        </>
      )}
    </CardShell>
  );
}

export function DailyCard({ daily, loading }: { daily: DailyResponse | undefined; loading: boolean }) {
  const [left, setLeft] = useState(secondsToUtcMidnight());
  useEffect(() => { const t = setInterval(() => setLeft(secondsToUtcMidnight()), 1000); return () => clearInterval(t); }, []);
  const c = daily?.challenge;
  const href = c && daily?.projectId ? `/project/${daily.projectId}/solve/${c.problemId}` : c ? `/problems/${c.slug}` : "/daily";
  return (
    <CardShell title="Daily challenge" icon={<CalendarCheck className="size-4" />} action={<span className="tabular text-xs text-text-3" title="Resets at 00:00 UTC">{fmtClock(left)}</span>}>
      {loading ? <Skeleton className="h-20" /> : c ? (
        <>
          <Link href={href} className="line-clamp-2 text-md font-semibold text-text-1 hover:underline underline-offset-4">{c.title}</Link>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-text-3">
            <DifficultyBadge difficulty={c.difficulty} size="sm" />
            <span>{c.solvers} solved today</span>
            <span>· +{daily?.xpBonus ?? 20} XP</span>
          </div>
          <Button asChild variant={daily?.solved ? "secondary" : "brand"} size="sm" className="mt-auto w-fit">
            <Link href={href}>{daily?.solved ? "Solved ✓ · view" : "Solve now"}</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-text-2">Today&rsquo;s challenge is being prepared. Check back in a moment.</p>
      )}
    </CardShell>
  );
}

export function StreakCard({ me }: { me: MeResponse | null }) {
  const s = me?.user.stats;
  const lp = levelProgress(s?.xp ?? 0);
  const streak = s?.currentStreak ?? 0;
  const r = 26, c = 2 * Math.PI * r;
  return (
    <CardShell title="Streak & XP" icon={<Flame className="size-4" />}>
      {!s ? <Skeleton className="h-20" /> : (
        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0">
            <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
              <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
              <circle cx="32" cy="32" r={r} fill="none" stroke="url(#lvl-g)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * lp.progress} ${c}`} className="transition-[stroke-dasharray] duration-600 ease-out-quart" />
              <defs><linearGradient id="lvl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-2xs uppercase text-text-3">Lv</span>
              <span className="text-md font-semibold tabular text-text-1">{lp.level}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber value={streak} className={cn("text-2xl font-semibold leading-none", streak > 0 ? "text-[#ff9f0a]" : "text-text-1")} />
              <span className="text-sm text-text-2">day streak</span>
            </div>
            <p className="mt-1 text-xs text-text-3"><span className="tabular text-text-2">{s.xp}</span> XP · {lp.toNext} to level {lp.level + 1}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-text-3"><Snowflake className="size-3.5 text-brand-2" />{s.streakFreezes} freeze{s.streakFreezes === 1 ? "" : "s"} · best {s.longestStreak}</p>
          </div>
        </div>
      )}
    </CardShell>
  );
}

export function RatingCard({ me }: { me: MeResponse | null }) {
  const s = me?.user.stats;
  const hist = (me?.user as unknown as { ratingHistory?: { d: string; r: number }[] } | undefined)?.ratingHistory ?? [];
  const values = hist.slice(-12).map((h) => h.r);
  const delta = values.length >= 2 ? Math.round(values[values.length - 1] - values[0]) : 0;
  return (
    <CardShell title="Rating" icon={<TrendingUp className="size-4" />} action={<Link href="/profile" className="text-xs text-text-3 hover:text-text-1">Details</Link>}>
      {!s ? <Skeleton className="h-20" /> : (
        <>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={Math.round(s.rating)} className="text-2xl font-semibold leading-none text-text-1" />
            {delta !== 0 && <span className={cn("text-xs font-medium tabular", delta > 0 ? "text-ok" : "text-err")}>{delta > 0 ? "+" : ""}{delta} recent</span>}
          </div>
          <p className="mt-1 text-xs text-text-3"><Zap className="mr-1 inline size-3 text-brand" />{s.ratedSolves} rated solve{s.ratedSolves === 1 ? "" : "s"} · band {s.rating < 1300 ? "Easy" : s.rating < 1600 ? "Medium" : "Hard"}</p>
          <div className="mt-auto pt-2">
            {values.length >= 2 ? <Sparkline values={values} height={40} /> : <p className="text-xs text-text-3">Solve rated problems to draw a trend.</p>}
          </div>
        </>
      )}
    </CardShell>
  );
}
