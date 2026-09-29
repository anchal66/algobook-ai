"use client";
/** AI narration of the current step / chapter / failure (Module 07 V-16). Uses the real trace window as input. */
import { useEffect, useRef } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, traceExplainStream } from "@/lib/workspace/api";
import { Replayer, chapters as deriveChapters, formatValue } from "@/lib/trace/replay";
import type { Trace } from "@/lib/trace/types";
import { track } from "@/lib/analytics";
import { useTrace } from "@/store/trace";
import { useWorkspace } from "@/store/workspace";
import { isPro, quotaLeft, useMe } from "@/store/me";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

/** Compact text for the ±N steps around `cursor`: line, event, changed locals and heap objects. */
export function windowText(trace: Trace, cursor: number, radius = 10): string {
  const r = new Replayer(trace);
  const from = Math.max(0, cursor - radius), to = Math.min(trace.steps.length - 1, cursor + radius);
  const lines: string[] = [];
  for (let i = from; i <= to; i++) {
    const s = trace.steps[i];
    const st = r.at(i);
    const top = st.stack[st.stack.length - 1];
    const parts: string[] = [`#${i}${i === cursor ? " <CURRENT>" : ""} L${s.line} ${s.ev}${top ? ` in ${top.fn}() depth ${st.stack.length}` : ""}`];
    if (s.ev === "return" && s.ret !== undefined) parts.push(`returns ${formatValue(s.ret, st.heap)}`);
    if (s.ev === "exception" && s.exc) parts.push(`raises ${s.exc.type}: ${s.exc.message}`);
    const changedLocals = s.changed.filter((c) => c.includes(":")).map((c) => c.split(":")[1]);
    if (top) {
      const locals = st.locals[String(top.id)] ?? {};
      const shown = Object.entries(locals).filter(([k]) => i === cursor || changedLocals.includes(k)).slice(0, 12);
      if (shown.length) parts.push(shown.map(([k, v]) => `${k}=${formatValue(v, st.heap)}`).join(", "));
    }
    if (s.out) parts.push(`prints ${JSON.stringify(s.out)}`);
    lines.push(parts.join(" | "));
    if (lines.join("\n").length > 7500) break;
  }
  return lines.join("\n");
}

export function ExplainPanel({ trace }: { trace: Trace }) {
  const explain = useTrace((s) => s.explain);
  const setExplain = useTrace((s) => s.setExplain);
  const cursor = useTrace((s) => s.cursor);
  const caseIndex = useTrace((s) => s.caseIndex);
  const code = useTrace((s) => s.code);
  const me = useMe((s) => s.me);
  const bumpQuota = useMe((s) => s.bumpQuota);
  const abort = useRef<AbortController | null>(null);
  const left = quotaLeft(me, "visualizeExplain");
  const canFail = trace.divergeAt !== undefined || trace.exception !== null;

  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (question: "step" | "chapter" | "failure") => {
    const ws = useWorkspace.getState();
    if (!ws.problem || explain.streaming) return;
    const c = ws.cases[caseIndex];
    let at = cursor;
    let radius = 10;
    if (question === "failure") { at = trace.divergeAt ?? trace.exception?.step ?? cursor; radius = 14; }
    if (question === "chapter") {
      const ch = deriveChapters(trace).filter((x) => x.kind !== "exception" && cursor >= x.from && cursor <= x.to).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0];
      if (ch) { at = Math.floor((ch.from + ch.to) / 2); radius = Math.max(6, Math.ceil((ch.to - ch.from) / 2)); }
    }
    abort.current?.abort();
    abort.current = new AbortController();
    setExplain({ open: true, streaming: true, text: "", error: null, forStep: cursor, question });
    try {
      const { fromHuman } = await import("@/lib/judge/human");
      const enc = c ? fromHuman(ws.problem.params, c.values) : null;
      const full = await traceExplainStream(ws.problem.id, {
        language: trace.lang, code, caseInput: enc && enc.ok ? enc.stdin : "", expected: c?.expected, question, windowText: windowText(trace, at, radius),
      }, (d) => { const cur = useTrace.getState().explain; useTrace.getState().setExplain({ text: cur.text + d }); }, abort.current.signal);
      setExplain({ text: full, streaming: false });
      bumpQuota("visualizeExplain");
      track("visualize_explain", { question });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const msg = e instanceof ApiError
        ? (e.code === "PAYMENT_REQUIRED" ? "Explanations are part of the Pro plan." : e.code === "QUOTA_EXCEEDED" ? "You have used today's visualizer explanations." : e.code === "FORBIDDEN" ? e.message : e.code === "UPSTREAM" ? "The AI service is unavailable right now — the trace above is still exact. Please try again later." : e.message)
        : "The explanation is unavailable right now";
      setExplain({ streaming: false, error: msg });
    }
  };

  const pill = "flex h-7 items-center gap-1 rounded-[6px] bg-brand-from/15 px-2.5 text-[11px] font-medium text-brand-to transition-colors hover:bg-brand-from/25 disabled:opacity-50";
  return (
    <div className="flex flex-col gap-1.5 border-t border-line bg-ws-bar px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Sparkles className="size-3.5 text-brand-to" />
        <button type="button" className={pill} disabled={explain.streaming} onClick={() => void ask("step")}>Explain this step</button>
        <button type="button" className={pill} disabled={explain.streaming} onClick={() => void ask("chapter")}>Explain this part</button>
        {canFail && <button type="button" className={cn(pill, "bg-wrong/15 text-wrong hover:bg-wrong/25")} disabled={explain.streaming} onClick={() => void ask("failure")}>Why does it fail?</button>}
        <span className="ml-auto text-[11px] text-fg-3">{isPro(me) ? (Number.isFinite(left) ? `${left} left today` : "unlimited") : `${Number.isFinite(left) ? left : 0} free today`}</span>
        {explain.open && <button type="button" aria-label="Close explanation" onClick={() => { abort.current?.abort(); setExplain({ open: false, streaming: false }); }} className="flex size-6 items-center justify-center rounded-[4px] text-fg-3 hover:bg-ws-hover hover:text-fg-1"><X className="size-3.5" /></button>}
      </div>
      {explain.open && (
        <div className="ws-scroll max-h-40 overflow-y-auto rounded-[8px] border border-brand-from/30 bg-brand-from/10 p-2.5 text-sm" aria-live="polite">
          {explain.error ? <p className="text-xs text-wrong" role="alert">{explain.error}</p>
            : explain.text ? <StatementMarkdown markdown={explain.text} /> : <Loader2 className="size-4 animate-spin text-fg-3" />}
          {explain.forStep !== null && !explain.streaming && explain.forStep !== cursor && <p className="mt-1 text-[10px] text-fg-3">Written for step {explain.forStep + 1}.</p>}
        </div>
      )}
    </div>
  );
}
