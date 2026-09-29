"use client";
/** Results page (Module 06 §3.7): podium, standings, per-problem grid, my integrity report, similarity flags, rematch. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, Medal, RotateCcw, ShieldAlert, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, invalidate } from "@/lib/app/query";
import { rooms, type LeaderboardRowDTO } from "@/lib/app/api";
import { errorText } from "@/lib/app/errors";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { RoomAvatar } from "@/components/rooms/RoomAvatar";
import { rulesFor } from "@/lib/rooms/integrity";
import { fmtClock, fmtDate, ordinal } from "@/lib/app/format";
import { cn } from "@/lib/utils";

function Podium({ rows }: { rows: LeaderboardRowDTO[] }) {
  const top = rows.filter((r) => r.rank !== null).slice(0, 3);
  if (!top.length) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardRowDTO[];
  const tone = (rank: number | null) => rank === 1 ? "from-[#f5c542] to-[#c9930a]" : rank === 2 ? "from-[#d6d6d6] to-[#9a9a9a]" : "from-[#d59a63] to-[#9b5a2a]";
  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((r) => (
        <div key={r.uid} className={cn("flex w-32 flex-col items-center", r.rank === 1 ? "pb-4" : "")}>
          <UserAvatar src={r.photoURL} name={r.displayName || r.username} size={r.rank === 1 ? 56 : 44} />
          <p className="mt-2 max-w-full truncate text-sm font-medium text-text-1">{r.displayName || r.username}</p>
          <p className="text-xs text-text-3">{r.final} pts · {r.solved} solved</p>
          <div className={cn("mt-2 flex w-full items-center justify-center rounded-t-[10px] bg-gradient-to-b text-lg font-bold text-black/80", tone(r.rank), r.rank === 1 ? "h-20" : r.rank === 2 ? "h-14" : "h-10")}>{r.rank === 1 ? <Crown className="size-5" /> : <Medal className="size-5" />}</div>
        </div>
      ))}
    </div>
  );
}

export function Results({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const q = useQuery(user ? `/api/rooms/${roomId}/results` : null, () => rooms.results(roomId), { staleMs: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { if (q.data?.room.status === "finalising") { const t = setTimeout(() => invalidate(`/api/rooms/${roomId}/results`), 3000); return () => clearTimeout(t); } }, [q.data?.room.status, roomId]);
  if (q.error && !q.data) return <Card className="p-6 text-sm text-text-2">{errorText(q.error)}</Card>;
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  const { room, standings, perProblem, similarity, me, isHost } = q.data;
  const ranked = standings.filter((r) => r.rank !== null);
  const rules = rulesFor(room.settings.integrity.strictness);
  const myEvents = (me?.events ?? []).filter((e) => e.type !== "heartbeat");
  const rematch = async () => { setBusy("rematch"); try { const r = await rooms.rematch(roomId); invalidate("/api/rooms"); invalidate("/api/me"); router.push(`/rooms/${r.roomId}`); } catch (e) { toast.error(errorText(e)); setBusy(null); } };
  const waive = async (uid: string, problemId: string) => { setBusy(`w${uid}${problemId}`); try { await rooms.waive(roomId, uid, problemId); invalidate(`/api/rooms/${roomId}/results`); toast.success("Flag waived"); } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); } };

  return (
    <>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2"><Link href="/rooms" className="hover:underline">Rooms</Link> · results</span>}
        title={<span className="flex items-center gap-3"><RoomAvatar icon={room.avatar.icon} hue={room.avatar.hue} size={44} />{room.name}</span>}
        description={<>{room.status === "finalising" ? "Finalising — checking similarity and ranks…" : `Finished ${fmtDate(room.finishedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`} · {room.problemSet.length} problems · {room.settings.durationMin} min · {room.settings.rated ? (room.finalised.ratingsApplied ? "rated" : `unrated (${room.finalised.rankedCount} finisher${room.finalised.rankedCount === 1 ? "" : "s"})`) : "unrated"}{room.capacityHit ? " · judge capacity was reached during the contest" : ""}</>}
        actions={isHost ? <Button variant="brand" onClick={() => void rematch()} loading={busy === "rematch"}><RotateCcw className="size-4" /> Rematch</Button> : undefined}
      />
      {me && (
        <Card className="mb-4 flex flex-wrap items-center gap-6 p-5">
          <div><p className="text-xs uppercase tracking-wider text-text-3">Your place</p><p className="text-2xl font-semibold text-text-1">{me.rank ? ordinal(me.rank) : "—"} <span className="text-sm font-normal text-text-3">of {ranked.length}</span></p></div>
          <div><p className="text-xs uppercase tracking-wider text-text-3">Score</p><p className="text-2xl font-semibold text-text-1">{me.score.final}<span className="text-sm font-normal text-text-3"> / {me.score.raw} raw</span></p></div>
          <div><p className="text-xs uppercase tracking-wider text-text-3">Solved</p><p className="text-2xl font-semibold text-text-1">{me.score.solved}<span className="text-sm font-normal text-text-3"> / {room.problemSet.length}</span></p></div>
          {me.ratingDelta !== null && <div><p className="text-xs uppercase tracking-wider text-text-3">Contest rating</p><p className={cn("flex items-center gap-1 text-2xl font-semibold", me.ratingDelta >= 0 ? "text-ok" : "text-err")}>{me.ratingDelta >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}{me.ratingDelta >= 0 ? "+" : ""}{me.ratingDelta}<span className="text-sm font-normal text-text-3"> → {(me.ratingBefore ?? 1500) + me.ratingDelta}</span></p></div>}
          <div className="ml-auto"><p className="text-xs uppercase tracking-wider text-text-3">Integrity</p><p className={cn("flex items-center gap-1 text-sm font-medium", me.score.penaltyPct ? "text-err" : "text-ok")}>{me.score.penaltyPct ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}{me.score.penaltyPct ? `−${me.score.penaltyPct}% (${myEvents.length} events)` : "clean"}</p></div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5"><Podium rows={standings} /></Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-text-1">Standings</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-text-3"><th className="py-2 pr-2 font-medium">#</th><th className="py-2 font-medium">Participant</th>{room.problemSet.map((p) => <th key={p.index} className="py-2 text-center font-medium" title={p.title}>{p.index + 1}</th>)}<th className="py-2 text-right font-medium">Score</th><th className="py-2 text-right font-medium">Time</th><th className="py-2 text-right font-medium">Δ</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(showAll ? standings : standings.slice(0, 25)).map((r) => (
                    <tr key={r.uid} className={cn(r.uid === user?.uid && "bg-brand-soft/60")}>
                      <td className="py-2 pr-2 tabular-nums text-text-2">{r.rank ?? "—"}</td>
                      <td className="py-2"><div className="flex items-center gap-2"><UserAvatar src={r.photoURL} name={r.displayName || r.username} size={24} /><span className="truncate text-text-1">{r.displayName || r.username}</span>{r.leftEarly && <Badge variant="outline" size="sm">left</Badge>}{r.state === "kicked" && <Badge variant="err" size="sm">removed</Badge>}{r.violations > 0 && <span className="rounded-full bg-err/10 px-1.5 text-[10px] text-err" title={`${r.violations} integrity events · −${r.penaltyPct}%`}>{r.violations}</span>}</div></td>
                      {room.problemSet.map((p) => { const ps = r.perProblem[p.problemId]; return <td key={p.index} className="py-2 text-center"><span className={cn("inline-flex min-w-9 justify-center rounded-[4px] px-1 text-xs tabular-nums", ps?.status === "solved" ? "bg-ok/15 text-ok" : ps?.attempts ? "bg-warn/15 text-text-2" : "text-text-3")} title={ps?.acceptedAt ? `accepted ${fmtDate(ps.acceptedAt, { hour: "2-digit", minute: "2-digit" })}` : ""}>{ps?.status === "solved" ? ps.points : ps?.attempts ? `−${ps.attempts}` : "·"}</span></td>; })}
                      <td className="py-2 text-right font-semibold tabular-nums text-text-1">{r.final}</td>
                      <td className="py-2 text-right tabular-nums text-text-3">{fmtClock(r.totalTimeSec)}</td>
                      <td className={cn("py-2 text-right tabular-nums", (r.ratingDelta ?? 0) > 0 ? "text-ok" : (r.ratingDelta ?? 0) < 0 ? "text-err" : "text-text-3")}>{r.ratingDelta === null ? "—" : `${r.ratingDelta >= 0 ? "+" : ""}${r.ratingDelta}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {standings.length > 25 && <Button variant="link" size="sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show top 25" : `Show all ${standings.length}`}</Button>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-text-1">Problems</p>
            <ul className="mt-2 divide-y divide-line">
              {perProblem.map((p) => (
                <li key={p.index} className="py-2">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold text-text-2">#{p.index + 1}</span><Link href={`/problems/${p.slug || p.problemId}`} className="min-w-0 flex-1 truncate text-sm text-text-1 hover:underline">{p.title}</Link><DifficultyBadge difficulty={p.difficulty} size="sm" /><span className="text-xs text-text-3">{p.points} pts</span></div>
                  <p className="mt-0.5 text-xs text-text-3">{p.solved}/{ranked.length} solved · {p.attempted} attempted{p.firstSolver ? ` · first: ${p.firstSolver.username} at ${fmtDate(p.firstSolver.at, { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-3">Open a problem to practise it again with hints, editorial and the visualizer.</p>
          </Card>
          {me && (
            <Card className="p-5">
              <p className="text-sm font-semibold text-text-1">Your integrity report</p>
              {myEvents.length === 0 ? <p className="mt-1 flex items-center gap-1.5 text-sm text-ok"><ShieldCheck className="size-4" /> Nothing was detected.</p> : (
                <ul className="mt-2 divide-y divide-line text-sm">{myEvents.map((e, i) => <li key={i} className="flex items-center justify-between gap-2 py-1.5"><span className="text-text-1">{rules.find((r) => r.type === e.type)?.label ?? e.type}<span className="ml-2 text-xs text-text-3">{fmtDate(e.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></span><span className="font-mono text-err">−{e.penaltyPct}%</span></li>)}</ul>
              )}
            </Card>
          )}
          {similarity.length > 0 && (
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-text-1"><ShieldAlert className="size-4 text-err" /> Similar code {isHost ? "(host view)" : ""}</p>
              <ul className="mt-2 divide-y divide-line text-sm">
                {similarity.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-text-1">{f.username} · #{(room.problemSet.find((p) => p.problemId === f.problemId)?.index ?? 0) + 1} — {Math.round(f.score * 100)}% like {f.with === "reference" ? "the reference solution" : (standings.find((s) => s.uid === f.with)?.username ?? "another participant")}{f.waived && <Badge variant="outline" size="sm" className="ml-2">waived</Badge>}</span>
                    {isHost && !f.waived && <Button size="xs" variant="outline" onClick={() => void waive(f.uid, f.problemId)} loading={busy === `w${f.uid}${f.problemId}`}>Waive</Button>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
