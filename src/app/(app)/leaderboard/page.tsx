"use client";
/** Leaderboard (Module 05 U-17): Global · Weekly · Template cohorts; podium, my rank, table, pagination. Visible to all plans (D-04 default). */
import Link from "next/link";
import { useMemo, useState } from "react";
import { Crown, Flame, Info, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/lib/app/query";
import { getLeaderboard, type GlobalEntry, type LeaderboardResponse, type TemplateEntry, type WeekEntry } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/avatar";
import { COMPANY_LABEL } from "@/components/dashboard/ProjectCard";
import { fmtDate, fmtNumber, ordinal } from "@/lib/app/format";
import { cn } from "@/lib/utils";

type Scope = "global" | "week" | "template";
type Row = GlobalEntry | TemplateEntry | WeekEntry;
const COMPANIES = Object.keys(COMPANY_LABEL);

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("global");
  const [company, setCompany] = useState("google");
  const [pages, setPages] = useState<GlobalEntry[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const key = user ? `/api/leaderboard?scope=${scope}${scope === "template" ? `&company=${company}` : ""}` : null;
  const q = useQuery<LeaderboardResponse>(key, () => getLeaderboard({ scope, company: scope === "template" ? company : undefined, limit: 50 }), { staleMs: 60_000 });
  const [loadingMore, setLoadingMore] = useState(false);

  const rows = useMemo<Row[]>(() => (q.data ? [...q.data.entries, ...pages.flat()] : []), [q.data, pages]);
  const nextCursor = cursor ?? (q.data?.scope === "global" ? q.data.nextCursor : null);

  const loadMore = async () => {
    if (!nextCursor || q.data?.scope !== "global") return;
    setLoadingMore(true);
    try {
      const r = await getLeaderboard({ scope: "global", cursor: nextCursor, limit: 50 });
      if (r.scope === "global") { setPages((p) => [...p, r.entries]); setCursor(r.nextCursor); }
    } finally { setLoadingMore(false); }
  };
  const changeScope = (s: Scope) => { setScope(s); setPages([]); setCursor(null); };

  const top3 = rows.slice(0, 3);
  const meUid = user?.uid;

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description={q.data?.scope === "week" ? <>Accepted submissions this ISO week ({fmtDate(q.data.range.from)} – {fmtDate(q.data.range.to)}).</> : q.data?.scope === "template" ? <>People working through the {q.data.label} list, ranked by progress.</> : <>Score = solved (weighted by difficulty) · streaks · mastery · rating. Snapshots refresh hourly.</>}
        actions={
          <div className="flex items-center gap-2">
            <Segmented label="Leaderboard scope" value={scope} onChange={changeScope} options={[{ value: "global", label: "Global" }, { value: "week", label: "Weekly" }, { value: "template", label: "Cohorts" }]} />
            {scope === "template" && (
              <Select value={company} onValueChange={(v) => { setCompany(v); setPages([]); setCursor(null); }}>
                <SelectTrigger className="w-[140px]" aria-label="Company cohort"><SelectValue /></SelectTrigger>
                <SelectContent>{COMPANIES.map((c) => <SelectItem key={c} value={c}>{COMPANY_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {q.loading ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-96" /></div>
      ) : q.error ? (
        <EmptyState icon={<Trophy />} title="Couldn't load the leaderboard" description={q.error.message} action={<Button variant="outline" onClick={() => void q.refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No rankings yet" description={scope === "week" ? "Nobody has an accepted submission this week yet — be first." : scope === "template" ? "Nobody is working through this template yet." : "Solve problems to appear on the leaderboard after the next snapshot."} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card className="p-5">
              <h2 className="sr-only">Top three</h2>
              <ol className="grid grid-cols-3 items-end gap-3">
                {[top3[1], top3[0], top3[2]].map((e, i) => e ? (
                  <li key={e.uid} className={cn("flex flex-col items-center rounded-card border border-line bg-surface-1 p-4 text-center", i === 1 && "bg-brand-soft/60 border-brand/30 pb-6")}>
                    <div className="relative">
                      <UserAvatar src={e.photoURL} name={e.displayName} size={i === 1 ? 64 : 48} />
                      <span className={cn("absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full px-2 py-0.5 text-2xs font-bold text-[#0f0f10]", e.rank === 1 ? "bg-[#f5b301]" : e.rank === 2 ? "bg-[#c3ccd6]" : "bg-[#e0955a]")}>{e.rank === 1 && <Crown className="size-3" />}{ordinal(e.rank)}</span>
                    </div>
                    <Link href={`/${e.username}`} className="mt-4 max-w-full truncate text-sm font-semibold text-text-1 hover:underline">{e.displayName || e.username}</Link>
                    <span className="truncate text-xs text-text-2">@{e.username}</span>
                    <span className="mt-2 text-lg font-semibold tabular text-text-1">{primaryValue(e)}</span>
                    <span className="text-2xs uppercase tracking-wider text-text-2">{primaryLabel(scope)}</span>
                  </li>
                ) : <li key={i} />)}
              </ol>
            </Card>
            <MyRank data={q.data!} rows={rows} meUid={meUid} />
          </div>

          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-1 text-left text-xs uppercase tracking-wider text-text-3">
                  <tr><th className="px-4 py-2.5 font-medium">Rank</th><th className="px-4 py-2.5 font-medium">User</th>{columns(scope).map((c) => <th key={c} className="px-4 py-2.5 text-right font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.uid} className={cn("border-t border-line/70 transition-colors hover:bg-surface-2", e.uid === meUid && "bg-brand-soft/50")}>
                      <td className="px-4 py-2.5 tabular font-semibold text-text-1">{e.rank <= 3 ? <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-bold text-[#0f0f10]", e.rank === 1 ? "bg-[#f5b301]" : e.rank === 2 ? "bg-[#c3ccd6]" : "bg-[#e0955a]")}>{e.rank}</span> : e.rank}</td>
                      <td className="px-4 py-2.5"><Link href={`/${e.username}`} className="flex items-center gap-2.5"><UserAvatar src={e.photoURL} name={e.displayName} size={28} /><span className="min-w-0"><span className="block truncate font-medium text-text-1">{e.displayName || e.username}{e.uid === meUid && <Badge variant="solid" size="sm" className="ml-2">You</Badge>}</span><span className="block truncate text-xs text-text-3">@{e.username}</span></span></Link></td>
                      {cells(scope, e).map((c, i) => <td key={i} className="px-4 py-2.5 text-right tabular text-text-2">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {q.data?.scope === "global" && nextCursor && (
              <div className="flex justify-center border-t border-line p-3"><Button variant="outline" loading={loadingMore} onClick={() => void loadMore()}>Load more</Button></div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function primaryLabel(scope: Scope) { return scope === "global" ? "score" : scope === "week" ? "accepted" : "progress"; }
function primaryValue(e: Row): string {
  if ("score" in e) return fmtNumber(e.score);
  if ("accepted" in e) return String(e.accepted);
  return `${Math.round(e.progressPct)}%`;
}
function columns(scope: Scope): string[] {
  return scope === "global" ? ["Score", "Solved", "Streak", "Rating", "Level"] : scope === "week" ? ["Accepted", "Submissions", "XP", "Active days"] : ["Solved", "Progress"];
}
function cells(scope: Scope, e: Row): React.ReactNode[] {
  if (scope === "global" && "score" in e) return [<span key="s" className="font-semibold text-text-1">{fmtNumber(e.score)}</span>, e.totalSolved, <span key="f" className="inline-flex items-center gap-1"><Flame className="size-3.5 text-[#ff9f0a]" />{e.currentStreak}</span>, Math.round(e.rating), e.level];
  if (scope === "week" && "accepted" in e) return [<span key="a" className="font-semibold text-text-1">{e.accepted}</span>, e.submissions, Math.round(e.xpEarned), e.activeDays];
  if ("progressPct" in e) return [`${e.solved}/${e.items}`, <span key="p" className="font-semibold text-text-1">{Math.round(e.progressPct)}%</span>];
  return [];
}

function MyRank({ data, rows, meUid }: { data: LeaderboardResponse; rows: Row[]; meUid?: string }) {
  const mine = rows.find((r) => r.uid === meUid);
  if (data.scope === "global") {
    const me = data.me;
    return (
      <Card className="p-5">
        <p className="flex items-center gap-2 text-sm text-text-2">Your rank
          <Tooltip><TooltipTrigger asChild><Info className="size-3.5 text-text-3" /></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs">Score = (easy + 2·medium + 3·hard)·2 + current streak·5 + average mastery·0.5 + longest streak·2 + rating/50.</TooltipContent></Tooltip>
        </p>
        <p className="mt-2 text-3xl font-semibold tabular text-text-1">{me.rank ? ordinal(me.rank) : "—"}<span className="ml-2 text-md font-normal text-text-3">of {me.total}</span></p>
        <p className="mt-1 text-sm text-text-2">{me.percentile !== null ? <>Top <span className="font-medium text-text-1">{Math.max(1, Math.round(100 - me.percentile))}%</span> · </> : null}score <span className="font-medium tabular text-text-1">{fmtNumber(me.score)}</span></p>
        {!me.rank && <p className="mt-3 text-xs text-text-3">You appear after your first accepted solve and the next hourly snapshot.</p>}
      </Card>
    );
  }
  const me = data.me ?? (mine as WeekEntry | TemplateEntry | undefined) ?? null;
  return (
    <Card className="p-5">
      <p className="text-sm text-text-2">Your rank</p>
      <p className="mt-2 text-3xl font-semibold tabular text-text-1">{me ? ordinal(me.rank) : "—"}<span className="ml-2 text-md font-normal text-text-3">of {rows.length}{data.scope === "week" ? " this week" : " in cohort"}</span></p>
      <p className="mt-1 text-sm text-text-2">{me && "accepted" in me ? <>{me.accepted} accepted · {me.activeDays} active days</> : me && "progressPct" in me ? <>{me.solved}/{me.items} solved · {Math.round(me.progressPct)}%</> : data.scope === "template" ? "Start this company's template to join the cohort." : "Get an accepted submission this week to appear."}</p>
      {data.updatedAt && <p className="mt-3 text-xs text-text-3">Snapshot {fmtDate(data.updatedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
    </Card>
  );
}
