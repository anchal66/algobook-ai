"use client";
/** Rooms hub (Module 06 §3.7): create (Pro), join with a code, public lobbies with filters, my live and past rooms. */
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Globe, KeyRound, Lock, Plus, Sparkles, Swords, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMe } from "@/store/me";
import { useQuery, invalidate } from "@/lib/app/query";
import { rooms, type RoomCard } from "@/lib/app/api";
import { errorText } from "@/lib/app/errors";
import { PageHeader } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { RoomAvatar } from "@/components/rooms/RoomAvatar";
import { normalizeCode } from "@/lib/rooms/codes";
import { fmtDate, timeAgo } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/app/useNow";

type Filter = "all" | "starting" | "rated" | "open";

function RoomRow({ r, onJoin, busy }: { r: RoomCard; onJoin?: () => void; busy?: boolean }) {
  const full = r.acceptedCount >= r.maxMembers;
  return (
    <li className="flex items-center gap-3 py-3">
      <RoomAvatar icon={r.avatar.icon} hue={r.avatar.hue} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/rooms/${r.id}`} className="truncate font-medium text-text-1 hover:underline">{r.name}</Link>
          <Badge variant={r.status === "running" ? "warn" : r.status === "lobby" ? "brand" : "outline"} size="sm">{r.status === "lobby" ? "lobby" : r.status}</Badge>
          {r.rated && <Badge variant="outline" size="sm">rated</Badge>}
          {r.visibility === "private" && <Lock className="size-3.5 text-text-3" />}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-3">
          {r.count} problem{r.count === 1 ? "" : "s"} · {r.durationMin} min · {r.difficultyMode === "fixed" ? r.fixedDifficulty : r.difficultyMode} · {r.topicMode === "any" ? "any topic" : r.topicMode === "pool" ? r.topicPool.slice(0, 3).join(", ") + (r.topicPool.length > 3 ? "…" : "") : "topics per problem"} · host {r.host.displayName || r.host.username} · {r.scheduledAt ? `starts ${fmtDate(r.scheduledAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : timeAgo(r.createdAt)}
        </p>
      </div>
      <span className="flex items-center gap-1 text-xs text-text-2"><Users className="size-3.5" />{r.acceptedCount}/{r.maxMembers}</span>
      {r.mine ? (
        <Button asChild size="sm" variant={r.status === "running" ? "brand" : "outline"}><Link href={`/rooms/${r.id}`}>{r.status === "running" ? "Enter" : r.status === "lobby" ? "Open" : `#${r.mine.rank ?? "—"} · ${r.mine.final}`}</Link></Button>
      ) : onJoin ? (
        <Button size="sm" variant="brand" onClick={onJoin} disabled={full || busy} loading={busy}>{full ? "Full" : r.joinApproval === "auto" ? "Join" : "Ask to join"}</Button>
      ) : null}
    </li>
  );
}

function CodeEntry({ initial }: { initial: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const c = normalizeCode(code);
    if (!c) { toast.error("Enter the 6-digit code"); return; }
    setBusy(true);
    try { const r = await rooms.joinByCode(c); invalidate("/api/me"); router.push(`/rooms/${r.roomId}`); }
    catch (e) { toast.error(errorText(e)); setBusy(false); }
  };
  useEffect(() => { if (initial && normalizeCode(initial)) void submit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-1"><KeyRound className="size-5 text-brand" /> Join with a code</h2>
      <p className="mt-1 text-sm text-text-2">Ask the host for the 6-digit code. You can join any room on every plan.</p>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} placeholder="123 456" aria-label="Room code"
          className="h-12 flex-1 rounded-[10px] border border-line bg-surface-1 px-4 text-center font-mono text-2xl tracking-[0.35em] text-text-1 outline-none placeholder:text-text-3 focus:border-brand focus:ring-[3px] focus:ring-brand/30" />
        <Button type="submit" variant="brand" size="lg" loading={busy}>Join <ArrowRight className="size-4" /></Button>
      </form>
    </Card>
  );
}

function Hub() {
  const { user } = useAuth();
  const me = useMe((s) => s.me);
  const params = useSearchParams();
  const router = useRouter();
  const pro = me?.plan.tier === "pro";
  const pub = useQuery(user ? "/api/rooms?scope=public" : null, () => rooms.list("public"), { staleMs: 10_000 });
  const mine = useQuery(user ? "/api/rooms?scope=mine" : null, () => rooms.list("mine"), { staleMs: 10_000 });
  const history = useQuery(user ? "/api/rooms?scope=history" : null, () => rooms.list("history"), { staleMs: 60_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const [joining, setJoining] = useState<string | null>(null);
  const now = useNow();
  const list = useMemo(() => (pub.data?.rooms ?? []).filter((r) => filter === "all" || (filter === "rated" && r.rated) || (filter === "open" && r.joinApproval === "auto" && r.acceptedCount < r.maxMembers) || (filter === "starting" && r.scheduledAt && Date.parse(r.scheduledAt) - now < 30 * 60_000)), [pub.data, filter, now]);
  const join = async (r: RoomCard) => {
    setJoining(r.id);
    try { await rooms.join(r.id); invalidate("/api/rooms"); invalidate("/api/me"); router.push(`/rooms/${r.id}`); }
    catch (e) { toast.error(errorText(e)); setJoining(null); }
  };
  const live = mine.data?.rooms ?? [];
  const active = me?.activeRoom;

  return (
    <>
      <PageHeader title="Competition rooms" description="Race friends or classmates on the same problems, live. Hosts pick the format; everyone sees the same rules, the same clock and the same integrity checks." actions={pro ? <Button asChild variant="brand"><Link href="/rooms/new"><Plus className="size-4" /> Create a room</Link></Button> : undefined} />
      {active && (
        <Card className="mb-4 flex items-center gap-3 border-brand/40 bg-brand-soft p-4">
          <Swords className="size-5 text-brand" />
          <div className="flex-1 text-sm"><span className="font-medium text-text-1">{active.name}</span> <span className="text-text-2">— {active.status === "running" ? "contest in progress" : "waiting in the lobby"}</span></div>
          <Button asChild variant="brand" size="sm"><Link href={`/rooms/${active.id}`}>{active.status === "running" ? "Back to the arena" : "Open lobby"}</Link></Button>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <CodeEntry initial={params.get("code") ?? ""} />
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-1"><Sparkles className="size-5 text-brand" /> Host a room</h2>
            {pro ? (
              <>
                <p className="mt-1 text-sm text-text-2">Name it, pick the length, the number of problems, difficulty and topics per problem, the scoring and the anti-cheat strictness. Approve who gets in, then start when everyone is there.</p>
                <p className="mt-2 text-xs text-text-3">Today the judge can run about 45 executions in total, so keep rooms small (the wizard shows the estimate).</p>
                <Button asChild variant="brand" className="mt-4 w-full"><Link href="/rooms/new"><Plus className="size-4" /> Create a room</Link></Button>
              </>
            ) : (
              <div className="mt-3 rounded-card border border-brand/30 bg-brand-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-text-1"><Lock className="size-4 text-brand" /> Pro feature</p>
                <p className="mt-1 text-sm text-text-2">Joining rooms is free (3 per day). Hosting your own contests is part of Pro.</p>
                <Button asChild variant="brand" size="sm" className="mt-3"><Link href="/settings#plan"><Sparkles className="size-4" /> Upgrade to Pro</Link></Button>
              </div>
            )}
          </Card>
          {live.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold tracking-tight text-text-1">My live rooms</h2>
              <ul className="mt-2 divide-y divide-line">{live.map((r) => <RoomRow key={r.id} r={r} />)}</ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-1"><Globe className="size-5 text-brand" /> Public rooms</h2>
              <Segmented value={filter} onChange={setFilter} label="Filter" size="sm" options={[{ value: "all", label: "All" }, { value: "open", label: "Open now" }, { value: "rated", label: "Rated" }, { value: "starting", label: "Starting soon" }]} />
            </div>
            {pub.loading && !pub.data ? <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              : list.length === 0 ? <EmptyState compact icon={<Globe />} title="No public lobbies right now" description="Ask a host for a code, or create your own room." />
              : <ul className="mt-2 divide-y divide-line">{list.map((r) => <RoomRow key={r.id} r={r} onJoin={() => void join(r)} busy={joining === r.id} />)}</ul>}
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-text-1">Past contests</h2>
            {history.loading && !history.data ? <Skeleton className="mt-4 h-14" /> : (history.data?.rooms.length ?? 0) === 0 ? <EmptyState compact icon={<Swords />} title="No contests yet" description="Your results, ranks and rating changes collect here." />
              : <ul className={cn("mt-2 divide-y divide-line")}>{history.data!.rooms.map((r) => <RoomRow key={r.id} r={r} />)}</ul>}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function RoomsPage() {
  return <Suspense fallback={<Skeleton className="h-40" />}><Hub /></Suspense>;
}
