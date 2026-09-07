"use client";
/** Report-issue modal ported from v1 (Module 03 §1.3): five reasons + optional details → POST /api/problems/:id/report. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ApiError, reportProblem } from "@/lib/workspace/api";
import type { ReportReason } from "@/types";

export const REPORT_REASONS: { id: ReportReason; label: string; description: string }[] = [
  { id: "not-relevant", label: "Not related to my topic", description: "This question doesn't match the topics I'm practicing" },
  { id: "incomplete-or-broken", label: "Incomplete or broken question", description: "The question statement, examples, or constraints are missing or incorrect" },
  { id: "runtime-error", label: "Runtime error despite correct code", description: "The driver code or test cases cause errors even when my solution is correct" },
  { id: "wrong-test-cases", label: "Wrong test cases", description: "The expected outputs don't match the problem statement" },
  { id: "other", label: "Other issue", description: "Something else is wrong with this question" },
];

export function ReportIssueDialog({ open, onOpenChange, problemId, title }: { open: boolean; onOpenChange: (o: boolean) => void; problemId: string; title: string }) {
  const [reason, setReason] = useState<ReportReason>("incomplete-or-broken");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await reportProblem(problemId, reason, details.trim() || undefined);
      toast.success(res.retired ? "Thanks — this problem has been removed from rotation." : "Thanks for reporting! AI can occasionally generate imperfect questions — your feedback helps us improve.");
      onOpenChange(false);
      setDetails("");
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "CONFLICT" ? "You already reported this problem" : "Could not send the report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className={cn("flex cursor-pointer items-start gap-3 rounded-[8px] border px-3 py-2 transition-colors", reason === r.id ? "border-brand-from/60 bg-brand-from/10" : "border-line hover:bg-ws-hover")}>
              <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="mt-1 accent-[#6366f1]" />
              <span>
                <span className="block text-sm font-medium text-fg-1">{r.label}</span>
                <span className="block text-xs text-fg-3">{r.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          className="ws-scroll w-full resize-none rounded-[8px] border border-line bg-bg-2 px-3 py-2 text-sm text-fg-1 outline-none placeholder:text-fg-3 focus-visible:ring-2 focus-visible:ring-brand-from/50"
        />
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-[8px] px-4 text-sm font-medium text-fg-2 hover:bg-ws-hover hover:text-fg-1">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="flex h-9 items-center gap-2 rounded-[8px] bg-wrong px-4 text-sm font-medium text-white hover:bg-wrong/90 disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />} Submit report
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
