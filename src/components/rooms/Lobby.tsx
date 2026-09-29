"use client";
/** Room lobby (Module 06 §3.7): code + share, settings summary, roster with approvals, slot preparation, chat, start. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Crown, Loader2, LogOut, Play, RefreshCw, Send, Share2, UserCheck, UserX, Wand2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { rooms, type RoomChatDTO, type RoomDetail, type RoomSlotDTO } from "@/lib/app/api";
import { sseFetch } from "@/lib/workspace/api";
import { invalidate } from "@/lib/app/query";
import { errorText } from "@/lib/app/errors";
import { useRoom, serverNow } from "@/store/room";
import { useNow } from "@/lib/app/useNow";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoomAvatar } from "@/components/rooms/RoomAvatar";
import { BudgetNote } from "@/components/rooms/wizard";
import { formatCode } from "@/lib/rooms/codes";
import { fmtDate } from "@/lib/app/format";
import { cn } from "@/lib/utils";

function CodeCard({ detail }: { detail: RoomDetail }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const code = detail.room.code;
  const link = typeof window !== "undefined" && code ? `${window.location.origin}/rooms?code=${code}` : "";
  const copy = async (what: "code" | "link") => {
    try { await navigator.clipboard.writeText(what === "code" ? code ?? "" : link); setCopied(what); setTimeout(() => setCopied(null), 1500); } catch { toast.error("Could not copy"); }
  };
  if (!code) return null;
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Join code</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-4xl font-semibold tracking-[0.25em] text-text-1">{formatCode(code)}</span>
        <Button variant="outline" size="icon-sm" aria-label="Copy code" onClick={() => void copy("code")}>{copied === "code" ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}</Button>
        <Button variant="outline" size="icon-sm" aria-label="Copy invite link" onClick={() => void copy("link")}>{copied === "link" ? <Check className="size-4 text-ok" /> : <Share2 className="size-4" />}</Button>
      </div>
      <p className="mt-2 text-xs text-text-3">Anyone signed in can enter this code on the Rooms page. It stops working the moment the contest starts.</p>
    </Card>
  );
}

function SlotRow({ slot, isHost, roomId, generateAllowed, onDone }: { slot: RoomSlotDTO; isHost: boolean; roomId: string; generateAllowed: boolean; onDone: () => void }) {
  const [stage, setStage] = useState<string | null>(null);
  const prepare = async () => {
    setStage("starting");
    try {
      await sseFetch(`/api/rooms/${roomId}/prepare`, { index: slot.index }, (event, data) => {
        const d = data as { stage?: string; status?: string; error?: string };
        if (event === "stage" && d.stage) setStage(d.stage);
        if (event === "done") { setStage(null); if (d.status === "failed") toast.error(d.error ?? "Generation failed"); else toast.success(`Problem ${slot.index + 1} is ready`); onDone(); }
        if (event === "error") { setStage(null); toast.error(d.error ?? "Generation failed"); onDone(); }
      });
    } catch (e) { setStage(null); toast.error(errorText(e)); onDone(); }
  };
  const busy = stage !== null || slot.status === "generating";
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-8 text-sm font-semibold text-text-2">#{slot.index + 1}</span>
      {slot.difficulty ? <DifficultyBadge difficulty={slot.difficulty} size="sm" /> : <Badge variant="outline" size="sm">any</Badge>}
      <span className="min-w-0 flex-1 truncate text-xs text-text-3">{slot.topics.length ? slot.topics.join(", ") : "any topic"}</span>
      {slot.status === "filled" ? <Badge variant="ok" size="sm">ready</Badge>
        : busy ? <span className="flex items-center gap-1 text-xs text-text-2"><Loader2 className="size-3.5 animate-spin" /> {stage ?? "generating"}…</span>
        : slot.status === "failed" ? <span className="text-xs text-err" title={slot.error ?? ""}>failed</span>
        : <Badge variant="warn" size="sm">missing</Badge>}
      {isHost && slot.status !== "filled" && !busy && generateAllowed && <Button size="xs" variant="outline" onClick={() => void prepare()}><Wand2 className="size-3.5" /> {slot.status === "failed" ? "Retry" : "Prepare"}</Button>}
    </li>
  );
}

function Chat({ roomId, enabled }: { roomId: string; enabled: boolean }) {
  const [messages, setMessages] = useState<RoomChatDTO[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const tick = async () => { try { const r = await rooms.chat(roomId, last.current); if (stop) return; if (r.messages.length) { setMessages((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]); last.current = Math.max(last.current, ...r.messages.map((x) => Date.parse(x.at))); } } catch { /* ignore */ } };
    void tick();
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [roomId, enabled]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages]);
  if (!enabled) return null;
  const send = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true);
    try { const r = await rooms.postChat(roomId, t); setMessages((m) => [...m, r.message]); last.current = Date.parse(r.message.at); setText(""); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Card className="flex h-72 flex-col p-4">
      <p className="text-sm font-semibold text-text-1">Lobby chat</p>
      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto text-sm">
        {messages.length === 0 && <p className="text-xs text-text-3">Say hi — chat closes when the contest starts.</p>}
        {messages.map((m) => <p key={m.id}><span className="font-medium text-text-1">{m.displayName || m.username}</span> <span className="text-text-2">{m.text}</span></p>)}
        <div ref={bottom} />
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Message" aria-label="Chat message" className="h-9 flex-1 rounded-[8px] border border-line bg-surface-1 px-3 text-sm text-text-1 outline-none focus:border-brand" />
        <Button type="submit" size="icon-sm" variant="brand" aria-label="Send" loading={busy}><Send className="size-4" /></Button>
      </form>
    </Card>
  );
}

export function Lobby() {
  const { user } = useAuth();
  const router = useRouter();
  const detail = useRoom((s) => s.detail)!;
  const load = useRoom((s) => s.load);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useNow();
  const room = detail.room;
  const me = detail.me;
  const isHost = room.hostUid === user?.uid;
  const accepted = detail.members.filter((m) => m.state === "accepted");
  const pending = detail.members.filter((m) => m.state === "pending");
  const filled = room.slots.filter((s) => s.status === "filled").length;
  const scheduledMs = room.scheduledAt ? Date.parse(room.scheduledAt) : null;
  const scheduleLocked = scheduledMs !== null && scheduledMs > serverNow();
  const refresh = () => void load(room.id, true);
  const act = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    try { await fn(); refresh(); after?.(); } catch (e) { toast.error(errorText(e)); } finally { setBusy(null); }
  };
  const start = (force = false) => act("start", () => rooms.start(room.id, force), () => { invalidate("/api/me"); toast.success("Starting…"); });
  const startBlockers: string[] = [];
  if (filled === 0) startBlockers.push("no problem is ready");
  if (accepted.length < 2 && room.settings.rated) startBlockers.push("a rated contest needs at least 2 participants");
  if (detail.budget && detail.budget.level === "over") startBlockers.push("today's judge budget cannot cover this room");

  return (
    <>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2"><Link href="/rooms" className="hover:underline">Rooms</Link> · lobby</span>}
        title={<span className="flex items-center gap-3"><RoomAvatar icon={room.avatar.icon} hue={room.avatar.hue} size={44} />{room.name}</span>}
        description={room.description || undefined}
        actions={isHost
          ? <><Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={!!busy}><X className="size-4" /> Cancel room</Button><Button variant="brand" size="lg" onClick={() => start(false)} loading={busy === "start"} disabled={startBlockers.length > 0 || scheduleLocked} title={startBlockers.join("; ")}><Play className="size-4" /> Start contest</Button></>
          : me && (me.state === "accepted" || me.state === "pending") ? <Button variant="outline" onClick={() => act("leave", () => rooms.leave(room.id), () => { invalidate("/api/me"); router.push("/rooms"); })} loading={busy === "leave"}><LogOut className="size-4" /> Leave</Button>
          : <Button variant="brand" onClick={() => act("join", () => rooms.join(room.id), () => invalidate("/api/me"))} loading={busy === "join"}>{room.joinApproval === "auto" ? "Join" : "Ask to join"}</Button>}
      />
      {isHost && (startBlockers.length > 0 || scheduleLocked) && (
        <p className="mb-4 rounded-[8px] bg-surface-2 px-3 py-2 text-sm text-text-2">
          {scheduleLocked ? <>Scheduled for {fmtDate(room.scheduledAt!, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. <button type="button" className="font-medium text-brand hover:underline" onClick={() => start(true)}>Start now anyway</button>.</> : `Cannot start yet: ${startBlockers.join("; ")}.`}
          {!scheduleLocked && startBlockers.length === 1 && startBlockers[0].includes("rated") && <> <button type="button" className="font-medium text-brand hover:underline" onClick={() => act("unrate", () => rooms.patch(room.id, { rated: false }))}>Make it unrated</button> to practise alone.</>}
        </p>
      )}
      {me?.state === "pending" && <p className="mb-4 rounded-[8px] border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-text-1">Waiting for the host to accept you — this page updates by itself.</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          {(isHost || me?.state === "accepted") && <CodeCard detail={detail} />}
          <Card className="p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-text-1">Format</p>{isHost && <Button asChild variant="link" size="xs"><Link href={`/rooms/${room.id}/edit`}>Edit</Link></Button>}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-2">{room.summary.map((l, i) => <li key={i}>{l}</li>)}</ul>
            {detail.budget && <div className="mt-3"><BudgetNote s={room.settings} budget={{ remaining: detail.budget.remaining, cap: detail.budget.cap }} members={Math.max(1, accepted.length)} /></div>}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-text-1">Problems · {filled}/{room.slots.length} ready</p><Button variant="ghost" size="icon-xs" aria-label="Refresh" onClick={refresh}><RefreshCw className="size-3.5" /></Button></div>
            <ul className="mt-1 divide-y divide-line">{room.slots.map((s) => <SlotRow key={s.index} slot={s} isHost={isHost} roomId={room.id} generateAllowed={room.settings.generateIfMissing} onDone={refresh} />)}</ul>
            {!isHost && <p className="mt-2 text-xs text-text-3">Titles are revealed when the contest starts.</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-text-1">Participants · {accepted.length}/{room.maxMembers}</p>
            <ul className="mt-2 divide-y divide-line">
              {accepted.map((m) => (
                <li key={m.uid} className="flex items-center gap-3 py-2">
                  <UserAvatar src={m.photoURL} name={m.displayName || m.username} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-1">{m.displayName || m.username} <span className="text-xs text-text-3">@{m.username}</span></span>
                  {m.role === "host" && <Crown className="size-4 text-warn" aria-label="host" />}
                  <span className={cn("size-2 rounded-full", m.online ? "bg-ok" : "bg-text-3/40")} title={m.online ? "online" : "away"} />
                  {m.ready && <Badge variant="ok" size="sm">ready</Badge>}
                  {isHost && m.role !== "host" && <Button size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => act(`kick${m.uid}`, () => rooms.member(room.id, m.uid, "kick"))}><UserX className="size-3.5" /></Button>}
                </li>
              ))}
            </ul>
            {me?.state === "accepted" && !isHost && <label className="mt-3 flex items-center justify-between text-sm text-text-1"><span>I&apos;m ready</span><Switch checked={me.ready} onCheckedChange={(v) => act("ready", () => rooms.ready(room.id, v))} /></label>}
            {isHost && pending.length > 0 && (
              <>
                <p className="mt-4 text-sm font-semibold text-text-1">Waiting for approval · {pending.length}</p>
                <ul className="mt-1 divide-y divide-line">
                  {pending.map((m) => (
                    <li key={m.uid} className="flex items-center gap-3 py-2">
                      <UserAvatar src={m.photoURL} name={m.displayName || m.username} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm text-text-1">{m.displayName || m.username} <span className="text-xs text-text-3">@{m.username}</span></span>
                      <Button size="xs" variant="success" onClick={() => act(`acc${m.uid}`, () => rooms.member(room.id, m.uid, "accept"))} loading={busy === `acc${m.uid}`}><UserCheck className="size-3.5" /> Accept</Button>
                      <Button size="xs" variant="outline" onClick={() => act(`rej${m.uid}`, () => rooms.member(room.id, m.uid, "reject"))} loading={busy === `rej${m.uid}`}>Reject</Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          {(isHost || me?.state === "accepted") && <Chat roomId={room.id} enabled={room.settings.chat !== "off"} />}
        </div>
      </div>
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="rounded-modal border-line bg-card sm:max-w-md">
          <DialogHeader><DialogTitle>Cancel this room?</DialogTitle><DialogDescription>Everyone in the lobby is sent back to the Rooms page. This cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep it</Button><Button variant="destructive" onClick={() => { setConfirmCancel(false); void act("cancel", () => rooms.cancel(room.id), () => { invalidate("/api/me"); invalidate("/api/rooms"); router.push("/rooms"); }); }}>Cancel room</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
