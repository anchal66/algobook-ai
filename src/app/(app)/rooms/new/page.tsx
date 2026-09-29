"use client";
/** Create-room wizard (Module 06 §3.7): Identity → Time & problems → Scoring & integrity → Review. */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Lock, Rocket, Sparkles } from "lucide-react";
import { useMe } from "@/store/me";
import { useQuery, invalidate } from "@/lib/app/query";
import { rooms } from "@/lib/app/api";
import { errorText } from "@/lib/app/errors";
import { PageHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoomSettingsSchema, defaultSettings, type RoomSettings } from "@/lib/rooms/settings";
import { StepIdentity, StepProblems, StepReview, StepScoring } from "@/components/rooms/wizard";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const STEPS = ["Identity", "Problems & time", "Scoring & integrity", "Review"] as const;

export default function NewRoomPage() {
  const me = useMe((s) => s.me);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<RoomSettings>(() => defaultSettings({ name: "" }));
  const set = (p: Partial<RoomSettings>) => setS((prev) => ({ ...prev, ...p }));
  const budget = useQuery(me ? "/api/judge/budget" : null, rooms.budget, { staleMs: 30_000 });
  const pro = me?.plan.tier === "pro";
  const validation = useMemo(() => RoomSettingsSchema.safeParse(s), [s]);
  const errors = useMemo(() => Object.fromEntries((validation.success ? [] : validation.error.issues).map((i) => [i.path.join("."), i.message])), [validation]);
  useEffect(() => { track("upgrade_click", { source: "rooms_new_open" }); }, []);

  const stepValid = step === 0 ? !errors.name && !errors.description : step === 1 ? !errors.perProblemDifficulty && !errors.topicPool && !errors.perProblemTopics && !errors.languages && !errors.scheduledAt : true;

  const submit = async () => {
    if (!validation.success) { toast.error(Object.values(errors)[0] ?? "Check the form"); return; }
    setBusy(true);
    try {
      const out = await rooms.create(validation.data);
      invalidate("/api/rooms"); invalidate("/api/me");
      toast.success(out.missing ? `Room created — ${out.missing} problem slot${out.missing === 1 ? "" : "s"} still need preparing.` : "Room created — share the code!");
      router.push(`/rooms/${out.room.id}`);
    } catch (e) { toast.error(errorText(e, "Could not create the room.")); setBusy(false); }
  };

  if (me && !pro) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Rooms" title="Hosting is a Pro feature" description="Joining rooms is free on every plan. Creating and hosting contests — with all the settings below — is part of Pro." />
        <Card className="p-6"><Button asChild variant="brand"><Link href="/settings#plan"><Sparkles className="size-4" /> Upgrade to Pro</Link></Button></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="New room" title={step === 0 ? "Name your room" : step === 1 ? "Problems & time" : step === 2 ? "Scoring & integrity" : "Review & create"} description={step === 0 ? "Who can find it and how many can join." : step === 1 ? "How many problems, which difficulty and topics, for how long." : step === 2 ? "How points are earned and what counts as cheating. Participants consent to exactly this." : undefined} />
      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step} className={cn("flex h-8 items-center gap-2 rounded-full pr-3 text-sm transition-colors", i <= step ? "text-text-1" : "text-text-3")}>
              <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-ok text-white" : i === step ? "bg-brand text-white" : "bg-surface-3 text-text-2")}>{i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-ok" : "bg-line")} aria-hidden />}
          </li>
        ))}
      </ol>
      <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        {step === 0 && <StepIdentity s={s} set={set} errors={errors} />}
        {step === 1 && <StepProblems s={s} set={set} errors={errors} />}
        {step === 2 && <StepScoring s={s} set={set} budget={budget.data ?? null} />}
        {step === 3 && <StepReview s={s} budget={budget.data ?? null} />}
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <Button variant="ghost" onClick={() => (step === 0 ? router.push("/rooms") : setStep(step - 1))} disabled={busy}><ArrowLeft className="size-4" /> {step === 0 ? "Cancel" : "Back"}</Button>
        {step < STEPS.length - 1 ? (
          <Button variant="brand" onClick={() => setStep(step + 1)} disabled={!stepValid}>Next <ArrowRight className="size-4" /></Button>
        ) : (
          <Button variant="brand" size="lg" onClick={() => void submit()} loading={busy} disabled={!validation.success}><Rocket className="size-4" /> Create room</Button>
        )}
      </div>
      {!me && <p className="mt-3 flex items-center gap-1 text-xs text-text-3"><Lock className="size-3" /> Loading your plan…</p>}
    </div>
  );
}
