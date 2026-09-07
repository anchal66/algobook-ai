"use client";
/** Daily challenge (Module 05 U-18): today's problem + past 30 days calendar. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, Flame, Trophy, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/lib/app/query";
import { getDaily } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedNumber, Reveal } from "@/components/design/motion";
import { fmtClock, fmtDate, secondsToUtcMidnight, titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export default function DailyPage() {
  const { user } = useAuth();
  const daily = useQuery(user ? "/api/daily?days=30" : null, () => getDaily(30), { staleMs: 60_000 });
  const [left, setLeft] = useState(secondsToUtcMidnight());
  useEffect(() => { const t = setInterval(() => setLeft(secondsToUtcMidnight()), 1000); return () => clearInterval(t); }, []);

  const history = useMemo(() => daily.data?.history ?? [], [daily.data]);
  const dailyStreak = useMemo(() => {
    // Consecutive solved days ending today (or yesterday if today is still open).
    const byDate = new Map(history.map((h) => [h.date, h.solved]));
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const solved = byDate.get(d);
      if (solved) n++; else if (i === 0) continue; else break;
    }
    return n;
  }, [history]);

  const c = daily.data?.challenge;
  const href = c && daily.data?.projectId ? `/project/${daily.data.projectId}/solve/${c.problemId}` : c ? `/problems/${c.slug}` : "#";

  return (
    <>
      <PageHeader title="Daily challenge" description="One verified problem every day for everyone. Solve it for +20 XP; it counts towards your streak and the daily_10 badge." />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <Card className="relative overflow-hidden p-6">
            <div className="aurora opacity-50" aria-hidden><i /><i /><i /></div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand"><CalendarCheck className="size-3.5" /> {fmtDate(daily.data?.date ? daily.data.date + "T00:00:00Z" : undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</span>
                <span className="tabular text-xs text-text-3" title="Resets at 00:00 UTC">Resets in {fmtClock(left)}</span>
              </div>
              {daily.loading ? <Skeleton className="mt-4 h-24" /> : c ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-1">{c.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DifficultyBadge difficulty={c.difficulty} />
                    {c.tags.slice(0, 4).map((t) => <Badge key={t}>{titleCase(t)}</Badge>)}
                    <span className="text-sm text-text-2">· {c.solvers} solved today</span>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button asChild variant={daily.data?.solved ? "secondary" : "brand"} size="lg"><Link href={href}>{daily.data?.solved ? <><Check className="size-4" /> Solved · open</> : "Solve today's challenge"}</Link></Button>
                    <span className="text-sm text-text-2">+{daily.data?.xpBonus ?? 20} XP bonus{daily.data?.solved ? " earned" : ""}</span>
                  </div>
                </>
              ) : (
                <EmptyState compact title="Preparing today's challenge" description="It is generated from the verified pool once a day. Refresh in a moment." action={<Button variant="outline" onClick={() => void daily.refetch()}>Refresh</Button>} />
              )}
            </div>
          </Card>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Reveal delay={0.05}>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm text-text-2"><Flame className="size-4 text-[#ff9f0a]" /> Daily streak</p>
              <p className="mt-2 text-3xl font-semibold text-text-1"><AnimatedNumber value={dailyStreak} /><span className="ml-1 text-md font-normal text-text-3">days</span></p>
              <p className="mt-1 text-xs text-text-3">Consecutive daily challenges solved</p>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm text-text-2"><Trophy className="size-4 text-brand" /> Total solved</p>
              <p className="mt-2 text-3xl font-semibold text-text-1"><AnimatedNumber value={daily.data?.dailySolvedTotal ?? 0} /></p>
              <p className="mt-1 text-xs text-text-3">{Math.max(0, 10 - (daily.data?.dailySolvedTotal ?? 0))} more for the “Daily Devotee” badge</p>
            </Card>
          </Reveal>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold tracking-tight text-text-1">Last 30 days</h2>
        {daily.loading ? <Skeleton className="mt-4 h-40" /> : history.length === 0 ? (
          <p className="mt-2 text-sm text-text-3">No past challenges recorded yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-10">
            {[...history].reverse().map((h) => {
              const isToday = h.date === daily.data?.date;
              return (
                <li key={h.date}>
                  <Link href={`/problems/${h.slug}`} title={`${fmtDate(h.date + "T00:00:00Z", { month: "short", day: "numeric", timeZone: "UTC" })} · ${h.title}`} className={cn("flex aspect-square flex-col items-center justify-center rounded-[10px] border text-xs transition-colors hover:border-line-strong", h.solved ? "border-ok/40 bg-ok/12 text-ok" : isToday ? "border-brand bg-brand-soft text-brand" : "border-line text-text-3")}>
                    <span className="text-2xs">{h.date.slice(5)}</span>
                    {h.solved ? <Check className="mt-1 size-4" /> : isToday ? <span className="mt-1 text-2xs font-semibold">today</span> : <X className="mt-1 size-3.5 opacity-50" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
