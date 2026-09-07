"use client";
/** Mock interview (Module 05 U-18, D-11): start card, active session, history with AI debriefs. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Lock, Mic2, Play, Sparkles, Timer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useQuery, invalidate } from "@/lib/app/query";
import { finishInterview, listInterviews, startInterview, type InterviewDTO } from "@/lib/app/api";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtClock, fmtDate, fmtDuration } from "@/lib/app/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const VERDICT: Record<string, { label: string; variant: "ok" | "brand" | "warn" | "err" }> = {
  "strong-hire": { label: "Strong hire", variant: "ok" }, hire: { label: "Hire", variant: "brand" }, "lean-hire": { label: "Lean hire", variant: "warn" }, "no-hire": { label: "No hire", variant: "err" },
};

export default function InterviewPage() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const router = useRouter();
  const list = useQuery(user ? "/api/interview" : null, listInterviews, { staleMs: 30_000 });
  const [duration, setDuration] = useState<30 | 45 | 60>(45);
  const [difficulty, setDifficulty] = useState<"mixed" | "medium" | "hard">("mixed");
  const [busy, setBusy] = useState(false);
  const allowed = me ? me.quotas.limits.interview !== 0 : true;
  const left = me ? (me.quotas.limits.interview < 0 ? Infinity : Math.max(0, me.quotas.limits.interview - (me.quotas.used.interview ?? 0))) : 0;

  const interviews = useMemo(() => list.data?.interviews ?? [], [list.data]);
  const active = interviews.find((i) => i.status === "active" && new Date(i.endsAt).getTime() > Date.now());

  const start = async () => {
    setBusy(true);
    try {
      const r = await startInterview({ durationMin: duration, difficulty });
      invalidate("/api/interview");
      track("upgrade_click", { source: "interview_start" });
      router.push(`/project/${r.projectId}/solve/${r.interview.problems[0]?.problemId ?? "next"}`);
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  const finish = async (id: string) => {
    setBusy(true);
    try { await finishInterview(id); toast.success("Interview finished — your debrief is ready."); invalidate("/api/interview"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Mock interview" description="A timed session with two problems chosen around your rating. No hints, no editorial, no tutor — then an AI interviewer debriefs you." />
      {active && <ActiveBanner interview={active} onFinish={() => void finish(active.id)} busy={busy} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-1"><Mic2 className="size-5 text-brand" /> Start a session</h2>
          {!allowed ? (
            <div className="mt-4 rounded-card border border-brand/30 bg-brand-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-text-1"><Lock className="size-4 text-brand" /> Pro feature</p>
              <p className="mt-1 text-sm text-text-2">Mock interviews with an AI debrief are included in Pro (5 per day).</p>
              <Button asChild variant="brand" size="sm" className="mt-3"><Link href="/settings#plan"><Sparkles className="size-4" /> Upgrade to Pro</Link></Button>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <p className="text-sm font-medium text-text-2">Duration</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([30, 45, 60] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDuration(d)} aria-pressed={duration === d} className={cn("flex h-12 flex-col items-center justify-center rounded-[10px] border text-sm transition-colors", duration === d ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2 hover:border-line-strong")}>
                      <span className="text-md font-semibold">{d}</span><span className="text-2xs">minutes</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-text-2">Difficulty</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["mixed", "medium", "hard"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDifficulty(d)} aria-pressed={difficulty === d} className={cn("h-10 rounded-[10px] border text-sm capitalize transition-colors", difficulty === d ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2 hover:border-line-strong")}>{d}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-3">Mixed: a Medium near your rating, then a Medium/Hard about 300 points above.</p>
              </div>
              <Button variant="brand" size="lg" className="mt-6 w-full" loading={busy} disabled={!!active || left === 0} onClick={() => void start()}>
                <Play className="size-4" /> {active ? "Session in progress" : "Start interview"}
              </Button>
              <p className="mt-2 text-center text-xs text-text-3">{left === Infinity ? "Unlimited today" : `${left} session${left === 1 ? "" : "s"} left today`}</p>
            </>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold tracking-tight text-text-1">Past sessions</h2>
          {list.loading ? <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : interviews.filter((i) => i !== active).length === 0 ? (
            <EmptyState compact icon={<Timer />} title="No sessions yet" description="Your debriefs — score, verdict, strengths and gaps — collect here." />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {interviews.filter((i) => i !== active).map((i) => <HistoryRow key={i.id} i={i} onFinish={() => void finish(i.id)} busy={busy} />)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function ActiveBanner({ interview, onFinish, busy }: { interview: InterviewDTO; onFinish: () => void; busy: boolean }) {
  const [left, setLeft] = useState(() => Math.max(0, (new Date(interview.endsAt).getTime() - Date.now()) / 1000));
  useEffect(() => { const t = setInterval(() => setLeft(Math.max(0, (new Date(interview.endsAt).getTime() - Date.now()) / 1000)), 1000); return () => clearInterval(t); }, [interview.endsAt]);
  const first = interview.problems[0];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-brand/40 bg-brand-soft p-4">
      <span className="relative flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" /><span className="relative inline-flex size-3 rounded-full bg-brand" /></span>
      <p className="text-sm text-text-1"><span className="font-semibold">Interview in progress</span> · {interview.problems.length} problems · <span className="tabular font-semibold">{fmtClock(left)}</span> left</p>
      <div className="ml-auto flex gap-2">
        <Button asChild size="sm" variant="brand"><Link href={`/project/${interview.projectId}/solve/${first?.problemId ?? "next"}`}>Resume</Link></Button>
        <Button size="sm" variant="outline" loading={busy} onClick={onFinish}>Finish now</Button>
      </div>
    </div>
  );
}

function HistoryRow({ i, onFinish, busy }: { i: InterviewDTO; onFinish: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const fb = i.feedback;
  const v = fb ? VERDICT[fb.verdict] : null;
  const expiredUnfinished = i.status === "active" && new Date(i.endsAt).getTime() <= Date.now();
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px] text-md font-semibold tabular", fb ? "bg-brand-soft text-brand" : "bg-surface-2 text-text-3")}>{fb ? fb.score.toFixed(1) : "—"}</div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-1">{fmtDate(i.startedAt)} · {i.durationMin} min · <span className="capitalize">{i.difficulty}</span>{v && <Badge variant={v.variant} size="sm">{v.label}</Badge>}{expiredUnfinished && <Badge variant="warn" size="sm">Time's up — finish for debrief</Badge>}</p>
          <p className="truncate text-xs text-text-3">{i.problems.map((p) => p.title).join(" · ")}</p>
        </div>
        <ChevronDown className={cn("size-4 text-text-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 rounded-card border border-line bg-surface-1 p-4 text-sm">
          {fb ? (
            <>
              <p className="text-text-1">{fb.summary}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-ok">Strengths</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-text-2">{fb.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-err">To work on</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-text-2">{fb.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
              </div>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {fb.perProblem.map((p) => <li key={p.problemId} className="flex flex-wrap items-center gap-2 py-2"><Link href={`/problems/${p.problemId}`} className="font-medium text-text-1 hover:underline">{p.title}</Link>{i.problems.find((x) => x.problemId === p.problemId) && <DifficultyBadge difficulty={i.problems.find((x) => x.problemId === p.problemId)!.difficulty} size="sm" />}<Badge variant={p.solved ? "ok" : "neutral"} size="sm">{p.solved ? "Solved" : "Unsolved"}</Badge><span className="text-xs text-text-3">{p.attempts} attempt{p.attempts === 1 ? "" : "s"} · {fmtDuration(p.timeSpentSec)}</span><span className="basis-full text-xs text-text-2">{p.note}</span></li>)}
              </ul>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3"><p className="text-text-2">No debrief yet.</p><Button size="sm" variant="brand" loading={busy} onClick={onFinish}>Generate debrief</Button></div>
          )}
        </div>
      )}
    </li>
  );
}
