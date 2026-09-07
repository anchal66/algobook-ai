"use client";
/** Profile layout shared by /profile (owner) and /[username] (public) — LeetCode density (Module 05 U-16). */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityHeatmap, RatingLine, SkillRadar, StatRing } from "@/components/charts";
import { IdentityCard, BadgesGrid, SkillsList, RecentAccepted, type ProfileIdentity } from "@/components/profile/parts";
import { useQuery } from "@/lib/app/query";
import { getAchievements, getActivity, getCatalog, getLeaderboard, getSkills, listSubmissions } from "@/lib/app/api";
import type { UserStats } from "@/types";
import { Reveal } from "@/components/design/motion";
import { fmtNumber, titleCase } from "@/lib/app/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/app/errors";

export interface ProfileData extends ProfileIdentity {
  stats: UserStats;
  ratingHistory: { d: string; r: number }[];
  mastery: Record<string, { mastery: number; solved: number }>;
}

export function ProfileView({ p, isOwner }: { p: ProfileData; isOwner: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const u = isOwner ? undefined : p.username;
  const skills = useQuery(`/api/me/skills${u ? `?username=${u}` : ""}`, () => getSkills(u), { staleMs: 60_000 });
  const badges = useQuery(`/api/me/achievements${u ? `?username=${u}` : ""}`, () => getAchievements(u), { staleMs: 60_000 });
  const activity = useQuery(`/api/activity?year=${year}${u ? `&username=${u}` : ""}`, () => getActivity(year, u), { staleMs: 60_000 });
  const lb = useQuery(isOwner ? "/api/leaderboard?scope=global&limit=1" : null, () => getLeaderboard({ scope: "global", limit: 1 }), { staleMs: 5 * 60_000 });
  const subs = useQuery(isOwner ? "/api/submissions?limit=50" : null, () => listSubmissions({ limit: 50 }), { staleMs: 60_000 });
  const catalog = useQuery(isOwner ? "/api/problems/catalog" : null, getCatalog, { staleMs: 60_000 });

  const rank = lb.data?.scope === "global" ? { rank: lb.data.me.rank, total: lb.data.me.total } : null;
  const beats = lb.data?.scope === "global" && lb.data.me.percentile !== null ? lb.data.me.percentile : null;
  const radar = useMemo(() => (skills.data?.topics ?? Object.entries(p.mastery).map(([topic, m]) => ({ name: titleCase(topic), mastery: m.mastery, solved: m.solved }))).map((t) => ({ name: "name" in t ? t.name : titleCase(String(t)), mastery: t.mastery, solved: t.solved })), [skills.data, p.mastery]);
  const recent = useMemo(() => {
    if (!subs.data) return undefined;
    const titles = new Map((catalog.data?.items ?? []).map((c) => [c.id, c]));
    const seen = new Set<string>();
    return subs.data.items.filter((s) => s.verdict === "AC" && !seen.has(s.problemId) && seen.add(s.problemId)).slice(0, 8).map((s) => ({ id: s.id, title: titles.get(s.problemId)?.title ?? s.problemId, slug: titles.get(s.problemId)?.slug ?? s.problemId, language: s.language, at: s.createdAt }));
  }, [subs.data, catalog.data]);
  const s = p.stats;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Reveal><IdentityCard p={p} isOwner={isOwner} rank={isOwner ? rank : undefined} /></Reveal>
        <Reveal delay={0.05}>
          <Card className="p-5">
            <h2 className="text-md font-semibold text-text-1">Community stats</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[["Rating", Math.round(s.rating)], ["Level", `${s.level} · ${fmtNumber(s.xp)} XP`], ["Score", fmtNumber(s.score)], ["Current streak", `${s.currentStreak} d`], ["Longest streak", `${s.longestStreak} d`], ["Languages", s.languagesAccepted.length ? s.languagesAccepted.map(titleCase).join(", ") : "—"]].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between"><dt className="text-text-2">{k}</dt><dd className="tabular font-medium text-text-1">{v}</dd></div>
              ))}
              {p.practiceState && <div className="flex items-center justify-between"><dt className="text-text-2">Practice state</dt><dd><Badge variant="brand" size="sm">{titleCase(p.practiceState)}</Badge></dd></div>}
            </dl>
          </Card>
        </Reveal>
        <Reveal delay={0.1}><SkillsList topics={skills.data?.topics} /></Reveal>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal>
            <Card className="flex h-full items-center p-5">
              <StatRing solved={{ Easy: s.easy, Medium: s.medium, Hard: s.hard }} size={140} stroke={10} beats={beats} centerLabel="Solved" />
            </Card>
          </Reveal>
          <Reveal delay={0.05}>
            <Card className="h-full p-5">
              <div className="flex items-baseline justify-between"><h2 className="text-md font-semibold text-text-1">Rating</h2><span className="text-lg font-semibold tabular text-text-1">{Math.round(s.rating)}</span></div>
              <RatingLine points={p.ratingHistory.map((h) => ({ date: h.d, rating: h.r }))} height={150} mini />
            </Card>
          </Reveal>
        </div>
        <Reveal>{badges.error && !badges.data ? <Card className="p-5"><p className="text-sm text-text-2">Couldn&rsquo;t load badges: {errorText(badges.error)}</p><Button size="sm" variant="outline" className="mt-2" onClick={() => void badges.refetch()}>Retry</Button></Card> : <BadgesGrid data={badges.data} />}</Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal>
            <Card className="p-5">
              <h2 className="text-md font-semibold text-text-1">Skill radar</h2>
              {skills.loading ? <Skeleton className="mt-3 h-56" /> : <SkillRadar topics={radar} height={240} />}
            </Card>
          </Reveal>
          <Reveal delay={0.05}>
            <Card className="p-5">
              <h2 className="text-md font-semibold text-text-1">Rating history</h2>
              <RatingLine points={p.ratingHistory.map((h) => ({ date: h.d, rating: h.r }))} height={240} />
            </Card>
          </Reveal>
        </div>
        <Reveal>
          <Card className="p-5">
            {activity.loading ? <Skeleton className="h-40" /> : activity.data ? (
              <ActivityHeatmap data={activity.data.heatmap} year={year} onYearChange={setYear} totalSubmissions={activity.data.totalSubmissions} activeDays={activity.data.activeDays} maxStreak={activity.data.maxStreak} />
            ) : <p className="text-sm text-text-3">Activity unavailable.</p>}
          </Card>
        </Reveal>
        {isOwner && <Reveal><RecentAccepted rows={recent} /></Reveal>}
      </div>
    </div>
  );
}

/** Builds ProfileData from `/api/me`'s user object (owner view). */
export function profileFromMe(u: { username: string; displayName: string; photoURL: string; bio: string; company: string; college: string; location: string; githubUrl: string; linkedinUrl: string; skills: string[]; createdAt: string; practiceState: string; stats: UserStats; topicSkills: Record<string, { mastery: number; solved: number }>; ratingHistory?: { d: string; r: number }[] }): ProfileData {
  return {
    username: u.username, displayName: u.displayName, photoURL: u.photoURL, bio: u.bio, company: u.company, college: u.college, location: u.location,
    githubUrl: u.githubUrl, linkedinUrl: u.linkedinUrl, skills: u.skills, createdAt: u.createdAt, practiceState: u.practiceState, stats: u.stats,
    ratingHistory: u.ratingHistory ?? [], mastery: Object.fromEntries(Object.entries(u.topicSkills).map(([t, s]) => [t, { mastery: s.mastery, solved: s.solved }])),
  };
}
