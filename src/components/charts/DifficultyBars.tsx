"use client";
/** Horizontal solved/total bars per difficulty; ≤ 24 px thick, 4 px rounded data-end, value at the tip. */
import type { Difficulty } from "@/types";
import { DIFF_COLOR, DIFFS } from "@/components/charts/common";
import { cn } from "@/lib/utils";

export function DifficultyBars({ solved, totals, className, thickness = 10 }: { solved: Record<Difficulty, number>; totals?: Partial<Record<Difficulty, number>>; className?: string; thickness?: number }) {
  const max = Math.max(1, ...DIFFS.map((d) => totals?.[d] ?? solved[d] ?? 0));
  return (
    <ul className={cn("space-y-2.5", className)} aria-label="Solved by difficulty">
      {DIFFS.map((d) => {
        const s = solved[d] ?? 0;
        const t = totals?.[d] ?? s;
        const pct = t ? Math.round((s / t) * 100) : 0;
        return (
          <li key={d} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-text-2"><span className="size-2 rounded-full" style={{ background: DIFF_COLOR[d] }} aria-hidden />{d}</span>
            <div className="relative overflow-hidden rounded-full bg-surface-2" style={{ height: thickness, width: `${(t / max) * 100}%`, minWidth: 24 }}>
              <div className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-600 ease-out-quart" style={{ width: `${pct}%`, background: DIFF_COLOR[d] }} />
            </div>
            <span className="tabular text-text-1"><span className="font-semibold">{s}</span>{totals?.[d] !== undefined && <span className="text-text-3">/{t}</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}
