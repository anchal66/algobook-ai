"use client";
/** Dashboard (Module 05 U-12). All data from the API; nothing aggregated client-side from Firestore. */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Compass, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useQuery } from "@/lib/app/query";
import { getActivity, getContinue, getDaily, getRecommended, listProjects } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityHeatmap } from "@/components/charts";
import { Reveal } from "@/components/design/motion";
import { ContinueCard, DailyCard, RatingCard, StreakCard } from "@/components/dashboard/cards";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { NewProjectTile, ProjectCard, isSystemProject } from "@/components/dashboard/ProjectCard";
import { titleCase } from "@/lib/app/format";
import { errorText } from "@/lib/app/errors";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const uid = user?.uid ?? null;
  const [year, setYear] = useState(new Date().getFullYear());

  const projects = useQuery(uid ? "/api/projects" : null, listProjects);
  const daily = useQuery(uid ? "/api/daily" : null, () => getDaily());
  const cont = useQuery(uid ? "/api/me/continue" : null, getContinue);
  const activity = useQuery(uid ? `/api/activity?year=${year}` : null, () => getActivity(year), { staleMs: 60_000 });
  const recommended = useQuery(uid ? "/api/problems/recommended" : null, getRecommended, { staleMs: 5 * 60_000 });

  const visible = (projects.data?.projects ?? []).filter((p) => !isSystemProject(p) && p.id !== me?.user.dailyProjectId);
  const stats = me?.user.stats;
  const firstName = (me?.user.displayName || user?.displayName || "there").split(" ")[0];
  const isNew = !!me && !!projects.data && visible.length === 0 && (stats?.totalSolved ?? 0) === 0;
  const onboarding = { hasProject: visible.length > 0, hasSolve: (stats?.totalSolved ?? 0) > 0, hasProfile: !!me?.user.bio };
  const firstProjectId = visible[0]?.id ?? null;
  const showOnboarding = !!me && !!projects.data && (!onboarding.hasProject || !onboarding.hasSolve || !onboarding.hasProfile) && (stats?.totalSolved ?? 0) < 3;

  return (
    <>
      <PageHeader
        title={<>{greeting()}, {firstName}</>}
        description={me ? <>{stats?.totalSolved ?? 0} solved · practice state <Badge variant="brand" size="sm" className="align-middle">{titleCase(me.user.practiceState)}</Badge></> : <Skeleton className="h-4 w-48" />}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/explore"><Compass className="size-4" /> Explore</Link></Button>
            <Button asChild variant="brand"><Link href="/projects/new"><Plus className="size-4" /> New project</Link></Button>
          </>
        }
      />

      {showOnboarding && <Reveal className="mb-6"><Onboarding state={onboarding} firstName={firstName} firstProjectId={firstProjectId} /></Reveal>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={0}><ContinueCard item={cont.data?.item} loading={cont.loading} error={cont.error} onRetry={() => void cont.refetch()} /></Reveal>
        <Reveal delay={0.05}><DailyCard daily={daily.data} loading={daily.loading} error={daily.error} onRetry={() => void daily.refetch()} /></Reveal>
        <Reveal delay={0.1}><StreakCard me={me} /></Reveal>
        <Reveal delay={0.15}><RatingCard me={me} /></Reveal>
      </div>

      <section className="mt-8" aria-labelledby="projects-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="projects-h" className="text-lg font-semibold tracking-tight text-text-1">Projects</h2>
          {visible.length > 3 && <Link href="/projects" className="flex items-center gap-1 text-sm text-text-2 hover:text-text-1">All projects <ArrowRight className="size-4" /></Link>}
        </div>
        {projects.loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : projects.error ? (
          <EmptyState title="Couldn't load projects" description={errorText(projects.error)} action={<Button variant="outline" onClick={() => void projects.refetch()}>Retry</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.slice(0, isNew ? 0 : 5).map((p, i) => <Reveal key={p.id} delay={i * 0.04}><ProjectCard project={p} /></Reveal>)}
            <Reveal delay={0.2}><NewProjectTile /></Reveal>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-text-1">Activity</h2>
          {activity.loading ? <Skeleton className="h-36" /> : activity.data ? (
            <ActivityHeatmap
              data={activity.data.heatmap} year={year} onYearChange={setYear}
              totalSubmissions={activity.data.totalSubmissions} activeDays={activity.data.activeDays} maxStreak={activity.data.maxStreak}
              streakDates={activity.data.streak.active ? new Set(activity.data.days.slice(-Math.max(1, activity.data.currentStreak)).map((d) => d.date)) : undefined}
            />
          ) : <EmptyState compact title="No activity yet" description="Your submissions light up this calendar." />}
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-1"><Sparkles className="size-4 text-brand" /> Recommended next</h2>
            <button type="button" onClick={() => void recommended.refetch()} className="text-xs text-text-3 hover:text-text-1">Refresh</button>
          </div>
          {recommended.loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : recommended.data?.items.length ? (
            <ul className="space-y-2">
              {recommended.data.items.map((p) => (
                <li key={p.id}>
                  <Link href={p.projectId ? `/problems/${p.slug}` : `/problems/${p.slug}`} className="group block rounded-[10px] border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-text-1">{p.title}</span>
                      <DifficultyBadge difficulty={p.difficulty} size="sm" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-text-2">{p.reason.short}{p.reason.detail ? ` — ${p.reason.detail}` : ""}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">{p.tags.slice(0, 3).map((t) => <Badge key={t} size="sm">{titleCase(t)}</Badge>)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title={recommended.error ? "Couldn't load recommendations" : "No recommendations yet"} description={recommended.error ? errorText(recommended.error) : "The pool fills as problems are verified."} action={recommended.error ? <Button size="sm" variant="outline" onClick={() => void recommended.refetch()}>Retry</Button> : undefined} />
          )}
        </Card>
      </div>
    </>
  );
}
