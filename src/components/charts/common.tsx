"use client";
/** Shared chart bits (Module 05 U-07): tokens read from CSS variables, tooltip shell, empty state. */
import type { ReactNode } from "react";
import type { Difficulty } from "@/types";
import { cn } from "@/lib/utils";

export const CHART = {
  easy: "var(--chart-easy)",
  medium: "var(--chart-medium)",
  hard: "var(--chart-hard)",
  brand: "var(--chart-brand)",
  brand2: "var(--chart-brand-2)",
  grid: "var(--chart-grid)",
  text2: "var(--text-2)",
  text3: "var(--text-3)",
  surface: "var(--card)",
} as const;

export const DIFF_COLOR: Record<Difficulty, string> = { Easy: CHART.easy, Medium: CHART.medium, Hard: CHART.hard };
export const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];

export function ChartTooltip({ title, rows, className }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[]; className?: string }) {
  return (
    <div className={cn("rounded-[8px] border border-line bg-popover px-3 py-2 text-xs shadow-xl", className)}>
      {title && <div className="mb-1 font-medium text-text-1">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-2">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />}
              {r.label}
            </span>
            <span className="tabular font-medium text-text-1">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmpty({ children = "Not enough data yet", className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("flex h-full min-h-24 items-center justify-center text-sm text-text-3", className)}>{children}</div>;
}

/** Legend row: swatch + label (+ value). Text wears text tokens, never the series color. */
export function Legend({ items, className }: { items: { label: ReactNode; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          <span>{it.label}</span>
          {it.value !== undefined && <span className="tabular font-medium text-text-1">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
