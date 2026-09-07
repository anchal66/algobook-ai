"use client";
/** Hints 1→2→3 (Module 03 W-16). Level 3 is contextual (sends the code) and Pro-gated (D-04). */
import { useState } from "react";
import { ChevronDown, Lightbulb, Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, getHint } from "@/lib/workspace/api";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/store/workspace";
import { isPro, quotaLeft, useMe } from "@/store/me";
import { StatementMarkdown } from "@/components/workspace/Description/StatementMarkdown";

const LEVELS: (1 | 2 | 3)[] = [1, 2, 3];

export function HintsAccordion() {
  const problem = useWorkspace((s) => s.problem);
  const hints = useWorkspace((s) => s.hints);
  const revealed = useWorkspace((s) => s.hintsRevealed);
  const setHint = useWorkspace((s) => s.setHint);
  const me = useMe((s) => s.me);
  const bumpQuota = useMe((s) => s.bumpQuota);
  const [loading, setLoading] = useState<number | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true });
  const [error, setError] = useState<string | null>(null);
  const pro = isPro(me);

  if (!problem) return null;

  const reveal = async (level: 1 | 2 | 3) => {
    if (loading) return;
    setLoading(level);
    setError(null);
    try {
      const ws = useWorkspace.getState();
      const res = await getHint(problem.id, level, level === 3 ? { code: ws.code[ws.language], language: ws.language } : undefined);
      setHint(level, res);
      if (res.source === "contextual") bumpQuota("hint3");
      track("hint", { level, source: res.source });
    } catch (e) {
      setError(e instanceof ApiError ? (e.code === "PAYMENT_REQUIRED" ? "Contextual hints are part of the Pro plan." : e.code === "QUOTA_EXCEEDED" ? "You have used today's contextual hints." : e.message) : "Could not load the hint");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="my-4 space-y-2" aria-label="Hints">
      {LEVELS.map((level) => {
        const hint = hints[level];
        const locked = level > revealed + 1;
        const proGate = level === 3 && !pro;
        const left = level === 3 ? quotaLeft(me, "hint3") : Infinity;
        return (
          <div key={level} className="overflow-hidden rounded-[8px] border border-line/70">
            <button
              type="button"
              disabled={locked || loading !== null}
              onClick={() => (hint ? setOpen((o) => ({ ...o, [level]: !o[level] })) : void reveal(level))}
              aria-expanded={!!hint && open[level]}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-ws-hover disabled:cursor-not-allowed disabled:opacity-60", hint ? "text-fg-1" : "text-fg-2")}
            >
              {level === 3 ? <Sparkles className="size-4 text-brand-to" /> : <Lightbulb className="size-4 text-medium" />}
              <span>{hint ? hint.label || `Hint ${level}` : `Hint ${level}`}</span>
              {level === 3 && <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[11px] text-fg-3">looks at your code</span>}
              <span className="ml-auto flex items-center gap-2 text-fg-3">
                {loading === level && <Loader2 className="size-4 animate-spin" />}
                {!hint && proGate && <Lock className="size-3.5" />}
                {!hint && !proGate && level === 3 && Number.isFinite(left) && <span className="text-[11px]">{left} left today</span>}
                {hint && <ChevronDown className={cn("size-4 transition-transform", open[level] && "rotate-180")} />}
                {!hint && !locked && loading !== level && <span className="text-xs">Reveal</span>}
              </span>
            </button>
            {hint && open[level] && (
              <div className="border-t border-line/70 px-3 py-2.5 text-sm text-fg-1/90">
                <StatementMarkdown markdown={hint.text} />
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-wrong" role="alert">{error}</p>}
      {revealed > 0 && <p className="text-[11px] text-fg-3">Using hints lowers the mastery credit for this solve.</p>}
    </section>
  );
}
