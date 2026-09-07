"use client";
/** Solved-by-difficulty ring (LeetCode profile parity). Three arcs with 2° surface gaps; centre = total solved. */
import { useId } from "react";
import type { Difficulty } from "@/types";
import { AnimatedNumber } from "@/components/design/motion";
import { DIFF_COLOR, DIFFS } from "@/components/charts/common";
import { cn } from "@/lib/utils";

export interface StatRingProps {
  solved: Record<Difficulty, number>;
  /** Available problems per difficulty (drives arc length); falls back to solved totals. */
  totals?: Partial<Record<Difficulty, number>>;
  size?: number;
  stroke?: number;
  centerLabel?: string;
  className?: string;
  /** Show the per-difficulty legend column on the right (LeetCode layout). */
  legend?: boolean;
  beats?: number | null;
}

export function StatRing({ solved, totals, size = 132, stroke = 9, centerLabel = "Solved", className, legend = true, beats }: StatRingProps) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = DIFFS.reduce((a, d) => a + (totals?.[d] ?? solved[d] ?? 0), 0) || 1;
  const solvedTotal = DIFFS.reduce((a, d) => a + (solved[d] ?? 0), 0);
  const GAP = 2.5; // degrees of surface between arcs
  const spans = DIFFS.map((d) => ((totals?.[d] ?? solved[d] ?? 0) / total) * 360);
  const arcs = DIFFS.map((d, i) => ({
    d,
    start: -90 + spans.slice(0, i).reduce((a, b) => a + b, 0),
    span: Math.max(0, spans[i] - GAP),
    fill: totals?.[d] ? Math.min(1, (solved[d] ?? 0) / totals[d]!) : 1,
  }));

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>{solvedTotal} solved: {DIFFS.map((d) => `${solved[d] ?? 0} ${d}`).join(", ")}</title>
          {arcs.map((a) => {
            const trackLen = (a.span / 360) * c;
            const fillLen = trackLen * a.fill;
            return (
              <g key={a.d} transform={`rotate(${a.start} ${size / 2} ${size / 2})`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DIFF_COLOR[a.d]} strokeOpacity={0.18} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${trackLen} ${c}`} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DIFF_COLOR[a.d]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${fillLen} ${c}`} className="transition-[stroke-dasharray] duration-600 ease-out-quart" />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber value={solvedTotal} className="text-xl font-semibold leading-none text-text-1" />
          <span className="mt-1 text-2xs uppercase tracking-wider text-text-3">{centerLabel}</span>
          {typeof beats === "number" && <span className="mt-1 text-2xs text-text-2">Beats <span className="tabular font-medium text-text-1">{beats.toFixed(1)}%</span></span>}
        </div>
      </div>
      {legend && (
        <ul className="flex flex-col gap-2">
          {DIFFS.map((d) => (
            <li key={d} className="flex w-28 items-center justify-between rounded-[8px] bg-surface-2 px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 text-text-2"><span className="size-2 rounded-full" style={{ background: DIFF_COLOR[d] }} aria-hidden />{d === "Medium" ? "Med." : d}</span>
              <span className="tabular font-semibold text-text-1">{solved[d] ?? 0}{totals?.[d] ? <span className="font-normal text-text-3">/{totals[d]}</span> : null}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
