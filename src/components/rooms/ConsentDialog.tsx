"use client";
/** Contest rules consent (Module 06 §3.9): generated from the room's settings — exactly what the server applies. */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PenaltyRule } from "@/lib/rooms/integrity";
import { PENALTY_CAP } from "@/lib/rooms/integrity";

export function ConsentDialog({ open, roomName, summary, rules, onAccept, onDecline, busy }: { open: boolean; roomName: string; summary: string[]; rules: PenaltyRule[]; onAccept: () => void; onDecline: () => void; busy?: boolean }) {
  const [agree, setAgree] = useState(false);
  const penalised = rules.filter((r) => !r.logOnly);
  const logged = rules.filter((r) => r.logOnly && r.type !== "heartbeat");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDecline(); }}>
      <DialogContent showClose={false} className="rounded-modal border-line bg-card sm:max-w-2xl" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /> Contest rules — {roomName}</DialogTitle>
          <DialogDescription>Read this once. Everything listed here is detected in your browser, shown to you live in the Integrity panel, and applied to your score exactly as written.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <div>
            <p className="font-medium text-text-1">Format</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-2">{summary.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
          <div>
            <p className="font-medium text-text-1">What is detected and what it costs</p>
            <table className="mt-1 w-full text-left text-xs">
              <thead><tr className="text-text-3"><th className="py-1 pr-2 font-medium">Detection</th><th className="py-1 pr-2 font-medium">Counts when</th><th className="py-1 text-right font-medium">Penalty</th></tr></thead>
              <tbody className="divide-y divide-line">
                {penalised.map((r) => (
                  <tr key={r.type}><td className="py-1.5 pr-2 font-medium text-text-1">{r.label}</td><td className="py-1.5 pr-2 text-text-2">{r.detected}</td><td className="py-1.5 text-right tabular-nums text-text-1">{r.base}%{r.perRepeat ? ` (+${r.perRepeat}% each repeat)` : ""}{r.perThirtySec ? ` (+${r.perThirtySec}%/30 s, max ${r.maxPerEvent}%)` : ""}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-text-3">Penalties are percentages of the points you earn, capped at {PENALTY_CAP}%. {logged.length ? `Also recorded without a penalty: ${logged.map((r) => r.label.toLowerCase()).join(", ")}.` : ""} AI hints, editorial, tutor and completion are unavailable during the contest. What cannot be detected: a second device or another person helping you — the post-contest similarity check and the host&apos;s review are the backstop.</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-line p-3 text-sm text-text-1">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
          <span>I have read the rules. I understand what is detected and how it affects my score, and I consent to take part on these terms.</span>
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onDecline} disabled={busy}>Leave the contest</Button>
          <Button variant="brand" onClick={onAccept} disabled={!agree} loading={busy}>Enter the arena</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
