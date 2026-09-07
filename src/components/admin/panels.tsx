"use client";
/** Admin console panels (Module 05 U-20, D-12): AI usage, pool coverage, flagged queue, triggers. */
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/lib/app/errors";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Play, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART, ChartTooltip, Legend } from "@/components/charts";
import { useQuery, invalidate } from "@/lib/app/query";
import { getAiUsage, getFlagged, leaderboardSnapshot, pregen, reverifyProblem, setProblemStatus, type AiUsageResponse, type UsageBucket } from "@/lib/app/api";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { fmtDate, fmtNumber, titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/app/useNow";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export function UsagePanel() {
  const [days, setDays] = useState(7);
  const now = useNow();
  const from = new Date(now - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const q = useQuery(`/api/admin/ai-usage?from=${from}`, () => getAiUsage(from), { staleMs: 60_000 });
  const d = q.data;
  const byDay = useMemo(() => Object.entries(d?.byDay ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([day, b]) => ({ day, cost: Number(b.costUsd.toFixed(3)), calls: b.calls })), [d]);
  const top = (m: Record<string, UsageBucket> | undefined) => Object.entries(m ?? {}).sort(([, a], [, b]) => b.costUsd - a.costUsd).slice(0, 8);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-md font-semibold text-text-1">AI usage</h2>
        <div className="flex gap-1">{[1, 7, 30].map((n) => <button key={n} type="button" onClick={() => setDays(n)} className={cn("h-7 rounded-[6px] px-2 text-xs font-medium", days === n ? "bg-surface-3 text-text-1" : "text-text-3 hover:bg-surface-2")}>{n === 1 ? "Today" : `${n}d`}</button>)}</div>
      </div>
      {q.loading ? <Skeleton className="mt-4 h-48" /> : d ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Spend", usd(d.total.costUsd)], ["Calls", fmtNumber(d.total.calls)], ["Failed", fmtNumber(d.total.failed)], ["Avg latency", `${fmtNumber(d.total.avgLatencyMs)} ms`]].map(([k, v]) => <div key={String(k)} className="rounded-card bg-surface-1 p-3"><p className="text-xs text-text-3">{k}</p><p className="text-lg font-semibold tabular text-text-1">{v}</p></div>)}
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap={2}>
                <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: CHART.grid }} tick={{ fill: CHART.text3, fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.text3, fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => (active && payload?.length ? <ChartTooltip title={fmtDate(String(payload[0].payload.day))} rows={[{ label: "Spend", value: usd(Number(payload[0].payload.cost)), color: CHART.brand }, { label: "Calls", value: payload[0].payload.calls }]} /> : null)} />
                <Bar dataKey="cost" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend className="mt-1" items={[{ label: "Spend per day (USD)", color: CHART.brand }]} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <UsageTable title="By purpose" rows={top(d.byPurpose)} total={d.total.costUsd} />
            <UsageTable title="By model" rows={top(d.byModel)} total={d.total.costUsd} />
          </div>
        </>
      ) : <p className="mt-3 text-sm text-err">{q.error?.message}</p>}
    </Card>
  );
}
function UsageTable({ title, rows, total }: { title: string; rows: [string, UsageBucket][]; total: number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-3">{title}</p>
      <table className="mt-2 w-full text-sm"><tbody>{rows.map(([k, b]) => <tr key={k} className="border-t border-line/70"><td className="py-1.5 text-text-1">{k}</td><td className="py-1.5 text-right tabular text-text-2">{b.calls}</td><td className="py-1.5 text-right tabular text-text-1">{usd(b.costUsd)}</td><td className="w-24 py-1.5 pl-3"><div className="h-1.5 rounded-full bg-surface-3"><div className="h-full rounded-full bg-brand" style={{ width: `${total ? (b.costUsd / total) * 100 : 0}%` }} /></div></td></tr>)}</tbody></table>
    </div>
  );
}

export function CoveragePanel() {
  const q = useQuery("/api/admin/pregen:deficits", () => pregen({ action: "deficits" }), { staleMs: 60_000 });
  const jobs = useQuery("/api/admin/pregen:status", () => pregen({ action: "status" }), { staleMs: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const cells = q.data?.cells ?? [];
  const topics = [...new Set(cells.map((c) => c.topic))];
  const cell = (t: string, d: string) => cells.find((c) => c.topic === t && c.difficulty === d);
  const poolMin = q.data?.poolMin ?? 6;
  const run = async (action: "submit" | "collect") => {
    setBusy(action);
    try { const r = await pregen({ action, maxRequests: 60 }); toast.success(r.message ?? (action === "collect" ? `Collected ${r.collected?.length ?? 0} job(s)` : "Batch submitted")); invalidate("/api/admin/pregen"); } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-md font-semibold text-text-1">Pool coverage</h2><p className="text-sm text-text-2">Verified problems per topic × difficulty; target ≥ {poolMin} each{q.data?.totalNeed ? ` · ${q.data.totalNeed} still needed` : ""}.</p></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" loading={busy === "collect"} onClick={() => void run("collect")}><RefreshCw className="size-4" /> Collect results</Button><Button size="sm" variant="brand" loading={busy === "submit"} onClick={() => void run("submit")}><Play className="size-4" /> Pre-generate deficits</Button></div>
      </div>
      {q.loading ? <Skeleton className="mt-4 h-64" /> : (
        <div className="scroll-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead><tr className="text-left text-text-3"><th className="py-1.5 pr-3 font-medium">Topic</th>{["Easy", "Medium", "Hard"].map((d) => <th key={d} className="py-1.5 pr-3 text-center font-medium">{d}</th>)}</tr></thead>
            <tbody>{topics.map((t) => <tr key={t} className="border-t border-line/70"><td className="py-1 pr-3 text-text-1">{titleCase(t)}</td>{["Easy", "Medium", "Hard"].map((d) => { const c = cell(t, d); const have = c?.have ?? 0; const ratio = Math.min(1, have / poolMin); return <td key={d} className="py-1 pr-3 text-center"><span className="inline-flex h-7 min-w-12 items-center justify-center rounded-[6px] tabular font-medium" style={{ background: `color-mix(in srgb, var(--chart-brand) ${Math.round(ratio * 70)}%, var(--surface-2))`, color: ratio > 0.6 ? "#fff" : "var(--text-1)" }}>{have}{c && c.need > 0 && <span className="ml-1 text-2xs">−{c.need}</span>}</span></td>; })}</tr>)}</tbody>
          </table>
        </div>
      )}
      {jobs.data?.jobs?.length ? (
        <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-3">Pre-generation jobs</p><ul className="mt-2 space-y-1 text-sm">{jobs.data.jobs.slice(0, 5).map((j) => <li key={j.id} className="flex items-center justify-between rounded-[6px] bg-surface-1 px-2 py-1"><span className="font-mono text-xs text-text-2">{j.id.slice(0, 10)}…</span><span className="text-text-2">{String(j.status)}{typeof j.processed === "number" ? ` · ${j.processed}/${j.requested ?? "?"}` : ""}</span><span className="text-xs text-text-3">{j.updatedAt ? fmtDate(String(j.updatedAt), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span></li>)}</ul></div>
      ) : null}
    </Card>
  );
}

export function FlaggedPanel() {
  const q = useQuery("/api/admin/problems/flagged", getFlagged, { staleMs: 30_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const reverify = async (id: string) => {
    setBusy(id);
    try {
      const r = await reverifyProblem(id);
      const summary = r.results.map((x) => `${x.language} ${x.verdict} ${x.passed}/${x.total}`).join(" · ");
      if (r.action === "kept") toast.success(`Re-verified “${r.title}”: all languages pass — ${summary}`);
      else if (r.action === "languages_disabled") toast.warning(`“${r.title}”: disabled ${r.disabled.join(", ")} — ${summary}`);
      else toast.error(`“${r.title}” retired: the Java reference no longer passes — ${summary}`);
      invalidate("/api/admin/problems"); invalidate("/api/problems/catalog");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  };
  const setStatus = async (id: string, status: "verified" | "retired") => {
    setBusy(id);
    try { await setProblemStatus(id, status); toast.success(status === "retired" ? "Problem retired" : "Problem restored"); invalidate("/api/admin/problems"); invalidate("/api/problems/catalog"); } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  };
  return (
    <Card className="p-5">
      <h2 className="text-md font-semibold text-text-1">Flagged problems</h2>
      <p className="text-sm text-text-2">Reported by users; two distinct flags retire a problem automatically.</p>
      {q.loading ? <Skeleton className="mt-4 h-32" /> : q.data?.items.length ? (
        <ul className="mt-4 divide-y divide-line">
          {q.data.items.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/problems/${p.slug}`} className="font-medium text-text-1 hover:underline">{p.title}</Link>
                <DifficultyBadge difficulty={p.difficulty} size="sm" />
                <Badge variant={p.status === "retired" ? "err" : p.status === "verified" ? "ok" : "neutral"} size="sm">{titleCase(p.status)}</Badge>
                <Badge variant="warn" size="sm">{p.flagCount} flag{p.flagCount === 1 ? "" : "s"}</Badge>
                <span className="ml-auto flex gap-2">
                  <Button size="xs" variant="outline" loading={busy === p.id} onClick={() => void reverify(p.id)}><ShieldCheck className="size-3" /> Re-verify</Button>
                  {p.status !== "retired" ? <Button size="xs" variant="destructive" loading={busy === p.id} onClick={() => void setStatus(p.id, "retired")}><Trash2 className="size-3" /> Retire</Button> : <Button size="xs" variant="outline" loading={busy === p.id} onClick={() => void setStatus(p.id, "verified")}><RotateCcw className="size-3" /> Restore</Button>}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-text-2">{p.reports.map((r) => <li key={r.id}><span className="font-medium text-text-1">{titleCase(r.reason)}</span>{r.details ? ` — ${r.details}` : ""}<span className="text-text-3"> · {r.createdAt ? fmtDate(r.createdAt) : ""}</span></li>)}{p.reports.length === 0 && p.flagReasons.map((r, i) => <li key={i}>{titleCase(r)}</li>)}</ul>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-text-3">Queue is empty.</p>}
      <ReverifyAny onRun={reverify} busy={busy} />
    </Card>
  );
}

function ReverifyAny({ onRun, busy }: { onRun: (id: string) => Promise<void>; busy: string | null }) {
  const [id, setId] = useState("");
  return (
    <form className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); if (id.trim()) void onRun(id.trim()); }}>
      <p className="basis-full text-xs text-text-3">Re-verify any problem by id or slug: every stored reference solution is executed again against all tests. A failing language is disabled; a failing Java reference retires the problem.</p>
      <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="problem id or slug" className="h-8 w-64" aria-label="Problem id or slug" />
      <Button type="submit" size="sm" variant="outline" loading={!!busy && busy === id.trim()} disabled={!id.trim()}><ShieldCheck className="size-4" /> Re-verify</Button>
    </form>
  );
}

export function TriggersPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: "snapshot" | "daily") => {
    setBusy(action);
    try { const r = await leaderboardSnapshot(action); toast.success(action === "snapshot" ? `Snapshot done · ${r.global?.total ?? 0} ranked · ${r.ms ?? 0} ms` : r.created ? "Daily challenge created" : "Daily challenge already exists"); invalidate("/api/leaderboard"); invalidate("/api/daily"); } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  };
  return (
    <Card className="p-5">
      <h2 className="text-md font-semibold text-text-1">Triggers</h2>
      <p className="text-sm text-text-2">Run the cron jobs now.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" loading={busy === "snapshot"} onClick={() => void run("snapshot")}><RefreshCw className="size-4" /> Leaderboard snapshot</Button>
        <Button variant="outline" loading={busy === "daily"} onClick={() => void run("daily")}><Play className="size-4" /> Create today&rsquo;s daily</Button>
        <Button asChild variant="ghost"><Link href="/dev/api-smoke">API smoke page</Link></Button>
        <Button asChild variant="ghost"><Link href="/dev/tokens">Design tokens</Link></Button>
      </div>
    </Card>
  );
}
export type { AiUsageResponse };
