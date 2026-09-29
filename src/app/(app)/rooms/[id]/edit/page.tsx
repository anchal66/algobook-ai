"use client";
/** Host edits room settings while the lobby is open (Module 06). Re-uses the wizard steps. */
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { rooms } from "@/lib/app/api";
import { errorText } from "@/lib/app/errors";
import { useRoom } from "@/store/room";
import { useQuery } from "@/lib/app/query";
import { PageHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RoomSettingsSchema, type RoomSettings } from "@/lib/rooms/settings";
import { StepIdentity, StepProblems, StepScoring } from "@/components/rooms/wizard";
import { Segmented } from "@/components/ui/segmented";

export default function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const detail = useRoom((s) => s.detail);
  const load = useRoom((s) => s.load);
  const budget = useQuery("/api/judge/budget", rooms.budget, { staleMs: 30_000 });
  const [s, setS] = useState<RoomSettings | null>(null);
  const [tab, setTab] = useState<"identity" | "problems" | "scoring">("identity");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void load(id); return () => { useRoom.getState().stop(); }; }, [id, load]);
  const loaded = detail?.room.id === id ? detail : null;
  const initial = loaded?.room.settings ?? null;
  const form = s ?? initial;
  if (!loaded || !form) return <Skeleton className="h-64" />;
  const set = (p: Partial<RoomSettings>) => setS((prev) => ({ ...(prev ?? initial!), ...p }));
  const parsed = RoomSettingsSchema.safeParse(form);
  const errors = Object.fromEntries((parsed.success ? [] : parsed.error.issues).map((i) => [i.path.join("."), i.message]));
  const save = async () => {
    if (!parsed.success) { toast.error(Object.values(errors)[0] ?? "Check the form"); return; }
    setBusy(true);
    try { await rooms.patch(id, parsed.data); toast.success("Room updated"); await load(id, true); router.push(`/rooms/${id}`); } catch (e) { toast.error(errorText(e)); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Edit room" title={loaded.room.name} description="Changes to the problem settings re-plan the problem slots." actions={<Segmented value={tab} onChange={setTab} label="Section" size="sm" options={[{ value: "identity", label: "Identity" }, { value: "problems", label: "Problems" }, { value: "scoring", label: "Scoring & integrity" }]} />} />
      {tab === "identity" && <StepIdentity s={form} set={set} errors={errors} />}
      {tab === "problems" && <StepProblems s={form} set={set} errors={errors} />}
      {tab === "scoring" && <StepScoring s={form} set={set} budget={budget.data ?? null} />}
      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <Button variant="ghost" onClick={() => router.push(`/rooms/${id}`)} disabled={busy}><ArrowLeft className="size-4" /> Back to lobby</Button>
        <Button variant="brand" onClick={() => void save()} loading={busy} disabled={!parsed.success}><Save className="size-4" /> Save changes</Button>
      </div>
    </div>
  );
}
