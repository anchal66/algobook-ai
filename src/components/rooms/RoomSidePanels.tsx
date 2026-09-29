"use client";
/** Arena side panels (Module 06 §3.7): live leaderboard and the participant's own integrity log. */
import { useEffect, useState } from "react";
import { Crown, ShieldAlert, ShieldCheck, Snowflake, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { rooms, type RoomEventDTO } from "@/lib/app/api";
import { useRoom } from "@/store/room";
import { UserAvatar } from "@/components/ui/avatar";
import { rulesFor } from "@/lib/rooms/integrity";
import { fmtClock } from "@/lib/app/format";
import { useAuth } from "@/context/AuthContext";

export function LeaderboardPanel() {
  const detail = useRoom((s) => s.detail);
  const { user } = useAuth();
  const board = detail?.leaderboard;
  const problems = detail?.room.problemSet ?? [];
  if (!detail || !board) return <p className="p-3 text-sm text-fg-3">Standings appear once the contest starts.</p>;
  return (
    <div className="ws-scroll h-full overflow-y-auto p-2">
      {board.hidden && <p className="mb-2 flex items-center gap-1.5 rounded-[6px] bg-ws-bar px-2 py-1.5 text-[11px] text-fg-2"><EyeOff className="size-3.5" /> The host hid the leaderboard until the end. You see only yourself.</p>}
      {board.frozen && <p className="mb-2 flex items-center gap-1.5 rounded-[6px] bg-ws-bar px-2 py-1.5 text-[11px] text-fg-2"><Snowflake className="size-3.5 text-brand-to" /> Frozen for the final minutes — ranks update at the end.</p>}
      <table className="w-full text-[12px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-wide text-fg-3"><th className="py-1 pr-1 font-medium">#</th><th className="py-1 font-medium">Player</th>{problems.map((p) => <th key={p.index} className="py-1 text-center font-medium">{p.index + 1}</th>)}<th className="py-1 text-right font-medium">Score</th></tr></thead>
        <tbody>
          {board.rows.map((r) => (
            <tr key={r.uid} className={cn("border-t border-line/60", r.uid === user?.uid && "bg-brand-from/10")}>
              <td className="py-1.5 pr-1 tabular-nums text-fg-2">{r.rank === 1 ? <Crown className="size-3.5 text-medium" /> : r.rank ?? "—"}</td>
              <td className="py-1.5"><div className="flex items-center gap-1.5"><UserAvatar src={r.photoURL} name={r.displayName || r.username} size={18} /><span className="truncate text-fg-1">{r.displayName || r.username}</span>{!r.online && <span className="size-1.5 rounded-full bg-fg-3/40" title="offline" />}{r.violations > 0 && <span className="rounded-full bg-wrong/15 px-1 text-[10px] text-wrong" title={`${r.violations} integrity events`}>{r.violations}</span>}</div></td>
              {problems.map((p) => { const ps = r.perProblem[p.problemId]; return <td key={p.index} className="py-1.5 text-center"><span className={cn("inline-block size-2.5 rounded-full", ps?.status === "solved" ? "bg-accepted" : ps?.status === "attempting" ? "bg-medium" : "bg-fg-3/30")} title={ps ? `${ps.points} pts · ${ps.attempts} attempts` : "not attempted"} /></td>; })}
              <td className="py-1.5 text-right font-semibold tabular-nums text-fg-1">{r.final}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {board.rows.length === 0 && <p className="p-2 text-xs text-fg-3">No participants yet.</p>}
    </div>
  );
}

export function IntegrityPanel() {
  const detail = useRoom((s) => s.detail);
  const [events, setEvents] = useState<RoomEventDTO[] | null>(null);
  const roomId = detail?.room.id;
  const count = detail?.me?.violations.count ?? 0;
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    void rooms.events(roomId).then((r) => { if (!cancelled) setEvents(r.events); }).catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [roomId, count]);
  if (!detail) return null;
  const rules = rulesFor(detail.room.settings.integrity.strictness);
  const me = detail.me;
  return (
    <div className="ws-scroll h-full overflow-y-auto p-3 text-sm">
      <div className={cn("flex items-center gap-2 rounded-[8px] p-3", count ? "bg-wrong/10" : "bg-accepted/10")}>
        {count ? <ShieldAlert className="size-5 text-wrong" /> : <ShieldCheck className="size-5 text-accepted" />}
        <div><p className="font-medium text-fg-1">{count ? `${count} event${count === 1 ? "" : "s"} · −${me?.violations.penaltyPct ?? 0}% of your points` : "Clean so far"}</p><p className="text-[11px] text-fg-3">Everything detected on your side shows here immediately.</p></div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {(events ?? []).filter((e) => e.type !== "heartbeat").map((e, i) => {
          const rule = rules.find((r) => r.type === e.type);
          return <li key={i} className="flex items-start justify-between gap-2 rounded-[6px] bg-ws-bar px-2 py-1.5 text-[12px]"><div><p className="font-medium text-fg-1">{rule?.label ?? e.type}</p><p className="text-fg-3">{new Date(e.at).toLocaleTimeString()}{typeof e.meta.durationMs === "number" ? ` · ${fmtClock(Math.round(e.meta.durationMs / 1000))}` : ""}{typeof e.meta.chars === "number" ? ` · ${e.meta.chars} chars` : ""}</p></div><span className="whitespace-nowrap font-mono text-wrong">−{e.penaltyPct}%</span></li>;
        })}
        {events && events.filter((e) => e.type !== "heartbeat").length === 0 && <li className="text-[12px] text-fg-3">No events recorded.</li>}
      </ul>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-fg-3">Rules in this room</p>
      <ul className="mt-1 space-y-1 text-[12px] text-fg-2">{rules.filter((r) => !r.logOnly).map((r) => <li key={r.type}><span className="text-fg-1">{r.label}</span> — {r.base}%{r.perRepeat ? ` +${r.perRepeat}%/repeat` : ""}{r.perThirtySec ? ` +${r.perThirtySec}%/30 s` : ""}</li>)}</ul>
    </div>
  );
}
