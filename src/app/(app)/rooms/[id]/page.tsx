"use client";
/** Room page (Module 06 §3.7): lobby while waiting, a hand-off into the arena while running, results when finished. */
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRoom } from "@/store/room";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Lobby } from "@/components/rooms/Lobby";
import { Results } from "@/components/rooms/Results";
import { Swords } from "lucide-react";

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const detail = useRoom((s) => s.detail);
  const error = useRoom((s) => s.error);
  const load = useRoom((s) => s.load);

  useEffect(() => {
    if (!user) return;
    void load(id);
    return () => { useRoom.getState().stop(); };
  }, [user, id, load]);

  const status = detail?.room.status;
  const meState = detail?.me?.state;
  useEffect(() => {
    if (status === "running" && meState === "accepted") router.replace(`/rooms/${id}/play/${detail?.me?.unlockedIndex ?? 0}`);
  }, [status, meState, id, router, detail?.me?.unlockedIndex]);

  if (error && !detail) return <EmptyState icon={<Swords />} title="Room unavailable" description={error} />;
  if (!detail || detail.room.id !== id) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (status === "finished" || status === "finalising") return <Results roomId={id} />;
  if (status === "cancelled") return <EmptyState icon={<Swords />} title="This room was cancelled" description="The host closed the lobby before the contest started." />;
  if (status === "running") return <EmptyState icon={<Swords />} title="Contest in progress" description={meState === "accepted" ? "Opening the arena…" : "You are not a participant of this contest. Results appear here when it ends."} />;
  return <Lobby />;
}
