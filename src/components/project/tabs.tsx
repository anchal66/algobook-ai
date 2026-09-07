"use client";
/** Project overview tabs (Module 05 U-15): Plan · Problems · Activity · Settings. */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Lightbulb, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge, StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DifficultyBars } from "@/components/charts";
import { useQuery, invalidate } from "@/lib/app/query";
import { deleteProject, getActivity, getInsights, listSubmissions, patchProject, type ProjectDTO, type ProjectItemDTO, type ProjectInsights } from "@/lib/app/api";
import { CORE_TOPICS, TOPIC_META } from "@/lib/practice/topics";
import { fmtDate, fmtDuration, titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

// ── Plan ────────────────────────────────────────────────────────────────────
export function PlanTab({ project }: { project: ProjectDTO }) {
  const cached = project.insights as (ProjectInsights & { generatedAt?: string }) | null;
  const q = useQuery(`insights:${project.id}`, () => getInsights(project.id), { staleMs: 10 * 60_000, enabled: !cached });
  const insights = (q.data?.insights ?? cached) as ProjectInsights | null;
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await getInsights(project.id, true); invalidate("/api/projects"); } catch (e) { toast.error((e as Error).message); } finally { setRefreshing(false); } };
  const solved = project.progress.solved;

  if (!insights) {
    return q.error ? <EmptyState title="Plan unavailable" description={q.error.message} action={<Button variant="outline" onClick={() => void q.refetch()}>Retry</Button>} /> : (
      <Card className="flex items-center gap-4 p-6"><Loader2 className="size-5 animate-spin text-brand" /><div><p className="font-medium text-text-1">AlgoBook AI is building your plan…</p><p className="text-sm text-text-2">Milestones, weekly focus and key topics for “{project.title}”. Usually under 20 seconds.</p></div></Card>
    );
  }
  const total = insights.totalRecommended || project.progress.items || 1;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-md font-semibold text-text-1">Milestones</h3><p className="text-sm text-text-2">{solved} of {total} recommended problems solved.</p></div>
            <Button variant="ghost" size="sm" loading={refreshing} onClick={() => void refresh()}><RefreshCw className="size-4" /> Regenerate</Button>
          </div>
          <ol className="relative mt-5 space-y-5 border-l border-line pl-6">
            {insights.milestones.map((m, i) => {
              const done = solved >= m.questionsTarget;
              const current = !done && (i === 0 || solved >= insights.milestones[i - 1].questionsTarget);
              return (
                <li key={m.label} className="relative">
                  <span className={cn("absolute -left-[31px] flex size-5 items-center justify-center rounded-full border-2 bg-card", done ? "border-ok bg-ok text-white" : current ? "border-brand" : "border-line")}>{done && <CheckCircle2 className="size-3.5" />}{current && <span className="size-2 rounded-full bg-brand" />}</span>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-1">{m.label}<Badge size="sm" variant={done ? "ok" : current ? "brand" : "neutral"}>{m.questionsTarget} problems</Badge></p>
                  <p className="text-sm text-text-2">{m.description}</p>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="text-md font-semibold text-text-1">Weekly plan</h3>
          <ul className="mt-3 divide-y divide-line">
            {insights.weeklyPlan.map((w) => (
              <li key={w.week} className="flex flex-wrap items-center gap-2 py-2.5 text-sm"><span className="w-16 font-medium text-text-1">Week {w.week}</span><span className="flex flex-1 flex-wrap gap-1">{w.focus.map((f) => <Badge key={f} size="sm">{titleCase(f)}</Badge>)}</span><span className="tabular text-text-3">{w.target} problems</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="text-md font-semibold text-text-1">Difficulty mix</h3>
          <DifficultyBars className="mt-3" solved={{ Easy: project.progress.easy, Medium: project.progress.medium, Hard: project.progress.hard }} totals={{ Easy: insights.easyCount, Medium: insights.mediumCount, Hard: insights.hardCount }} />
          <p className="mt-3 text-xs text-text-3">≈ {insights.estimatedHoursPerWeek} h/week recommended</p>
        </Card>
        <Card className="p-5">
          <h3 className="text-md font-semibold text-text-1">Key topics</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">{insights.keyTopics.map((t) => <Badge key={t} variant="brand">{titleCase(t)}</Badge>)}</div>
        </Card>
        <Card className="border-brand/30 bg-brand-soft/40 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-1"><Lightbulb className="size-4 text-brand" /> Coach&rsquo;s tip</p>
          <p className="mt-1.5 text-sm text-text-2">{insights.tip}</p>
        </Card>
      </div>
    </div>
  );
}

// ── Problems ────────────────────────────────────────────────────────────────
export function ProblemsTab({ project, items }: { project: ProjectDTO; items: ProjectItemDTO[] }) {
  const subs = useQuery(`/api/submissions?projectId=${project.id}&limit=50`, () => listSubmissions({ projectId: project.id, limit: 50 }), { staleMs: 30_000 });
  const perProblem = useMemo(() => {
    const m = new Map<string, { attempts: number; best: number | null; hints: number; lastAt: string }>();
    for (const s of subs.data?.items ?? []) {
      const cur = m.get(s.problemId) ?? { attempts: 0, best: null, hints: 0, lastAt: s.createdAt };
      cur.attempts++;
      cur.hints = Math.max(cur.hints, s.hintsUsed);
      if (s.verdict === "AC") cur.best = cur.best === null ? s.timeSpentSec : Math.min(cur.best, s.timeSpentSec);
      m.set(s.problemId, cur);
    }
    return m;
  }, [subs.data]);
  if (items.length === 0) return <EmptyState title="No problems yet" description="Start solving — the first problem is generated or picked from the verified pool when you open the workspace." action={<Button asChild variant="brand"><Link href={`/project/${project.id}/solve/next`}>Get my first problem</Link></Button>} />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-1 text-left text-xs uppercase tracking-wider text-text-3"><tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Problem</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Difficulty</th><th className="px-4 py-2.5 text-right font-medium">Attempts</th><th className="px-4 py-2.5 text-right font-medium">Best time</th><th className="px-4 py-2.5 text-right font-medium">Hints</th><th className="px-4 py-2.5 font-medium">Why</th></tr></thead>
          <tbody>
            {items.map((it) => {
              const s = perProblem.get(it.problemId);
              return (
                <tr key={it.problemId} className="border-t border-line/70 hover:bg-surface-2">
                  <td className="px-4 py-2.5 tabular text-text-3">{it.order + 1}</td>
                  <td className="px-4 py-2.5"><Link href={`/project/${project.id}/solve/${it.problemId}`} className="font-medium text-text-1 hover:underline">{it.title}</Link><div className="mt-0.5 flex gap-1">{it.tags.slice(0, 3).map((t) => <Badge key={t} size="sm">{titleCase(t)}</Badge>)}</div></td>
                  <td className="px-4 py-2.5"><StatusBadge status={it.status} size="sm" /></td>
                  <td className="px-4 py-2.5"><DifficultyBadge difficulty={it.difficulty} plain /></td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2">{s?.attempts ?? 0}</td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2">{s?.best !== null && s?.best !== undefined ? fmtDuration(s.best) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular text-text-2">{s?.hints ?? 0}</td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-xs text-text-3" title={it.reason?.detail}>{it.reason?.short ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────
export function ActivityTab({ project }: { project: ProjectDTO }) {
  const year = new Date().getFullYear();
  const q = useQuery(`/api/activity?year=${year}`, () => getActivity(year), { staleMs: 60_000 });
  const days = (q.data?.days ?? []).filter((d) => d.projectIds.includes(project.id)).sort((a, b) => b.date.localeCompare(a.date));
  if (q.loading) return <Skeleton className="h-64" />;
  if (days.length === 0) return <EmptyState title="No activity yet" description="Days you run or submit in this project show up here as a timesheet." />;
  const totals = days.reduce((a, d) => ({ sub: a.sub + d.submissions, acc: a.acc + d.accepted, time: a.time + d.timeSpentSec, xp: a.xp + d.xpEarned }), { sub: 0, acc: 0, time: 0, xp: 0 });
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {[["Active days", days.length], ["Submissions", totals.sub], ["Accepted", totals.acc], ["Time", fmtDuration(totals.time)]].map(([k, v]) => <div key={String(k)} className="bg-card p-4"><p className="text-xs text-text-3">{k}</p><p className="text-lg font-semibold tabular text-text-1">{v}</p></div>)}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-surface-1 text-left text-xs uppercase tracking-wider text-text-3"><tr><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 text-right font-medium">Runs</th><th className="px-4 py-2.5 text-right font-medium">Submissions</th><th className="px-4 py-2.5 text-right font-medium">Accepted</th><th className="px-4 py-2.5 text-right font-medium">Time</th><th className="px-4 py-2.5 text-right font-medium">XP</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.date} className="border-t border-line/70"><td className="px-4 py-2.5 text-text-1">{fmtDate(d.date + "T00:00:00Z", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}{d.dailySolved && <Badge size="sm" variant="brand" className="ml-2">Daily</Badge>}</td><td className="px-4 py-2.5 text-right tabular text-text-2">{d.runs}</td><td className="px-4 py-2.5 text-right tabular text-text-2">{d.submissions}</td><td className="px-4 py-2.5 text-right tabular text-ok">{d.accepted}</td><td className="px-4 py-2.5 text-right tabular text-text-2">{fmtDuration(d.timeSpentSec)}</td><td className="px-4 py-2.5 text-right tabular text-text-2">+{Math.round(d.xpEarned)}</td></tr>)}</tbody>
      </table>
    </Card>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
export function SettingsTab({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [purpose, setPurpose] = useState(project.purpose);
  const [description, setDescription] = useState(project.description);
  const [topics, setTopics] = useState<string[]>(project.selectedTopics);
  const [duration, setDuration] = useState(project.durationDays);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = title !== project.title || purpose !== project.purpose || description !== project.description || duration !== project.durationDays || topics.join() !== project.selectedTopics.join();

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    setSaving(true);
    try { await patchProject(project.id, { title: title.trim(), purpose, description, selectedTopics: topics, durationDays: duration }); invalidate("/api/projects"); toast.success("Project updated"); } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };
  const remove = async () => {
    setDeleting(true);
    try { await deleteProject(project.id); invalidate("/api/projects"); toast.success("Project deleted"); router.push("/projects"); } catch (e) { toast.error((e as Error).message); setDeleting(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-4 p-5">
        <div className="grid gap-1.5"><Label htmlFor="p-title">Title</Label><Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
        <div className="grid gap-1.5"><Label htmlFor="p-purpose">Purpose</Label><Input id="p-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} /></div>
        <div className="grid gap-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} /></div>
        <div className="grid gap-1.5"><Label htmlFor="p-days">Duration (days)</Label><Input id="p-days" type="number" min={1} max={365} value={duration} onChange={(e) => setDuration(Math.min(365, Math.max(1, Number(e.target.value) || 1)))} className="w-32" /></div>
        <div>
          <Label>Focus topics</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">{CORE_TOPICS.map((t) => { const on = topics.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => setTopics(on ? topics.filter((x) => x !== t) : [...topics, t])} className={cn("h-8 rounded-full border px-3 text-sm transition-colors", on ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2 hover:border-line-strong")}>{TOPIC_META[t].name}</button>; })}</div>
        </div>
        <div className="flex justify-end"><Button variant="brand" loading={saving} disabled={!dirty} onClick={() => void save()}>Save changes</Button></div>
      </Card>
      <Card className="h-fit border-err/30 p-5">
        <h3 className="flex items-center gap-2 text-md font-semibold text-err"><Trash2 className="size-4" /> Danger zone</h3>
        <p className="mt-1 text-sm text-text-2">Deleting removes the problem list and this project&rsquo;s submissions. Global stats, rating and streak are kept.</p>
        <Button variant="destructive" className="mt-4" onClick={() => setConfirm(true)}>Delete project</Button>
      </Card>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="rounded-modal border-line bg-card sm:max-w-md">
          <DialogHeader><DialogTitle>Delete “{project.title}”?</DialogTitle><DialogDescription>Type the project title to confirm. This cannot be undone.</DialogDescription></DialogHeader>
          <ConfirmInput expected={project.title} onConfirm={() => void remove()} busy={deleting} onCancel={() => setConfirm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfirmInput({ expected, onConfirm, onCancel, busy }: { expected: string; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const [v, setV] = useState("");
  return (
    <>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={expected} aria-label="Project title confirmation" />
      <DialogFooter><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant="destructive" disabled={v.trim() !== expected} loading={busy} onClick={onConfirm}>Delete permanently</Button></DialogFooter>
    </>
  );
}
