"use client";
/**
 * Year activity heatmap (port of v1 SubmissionHeatmap, polished): month labels aligned to week columns,
 * hover tooltip, current-streak ring, sequential brand ramp, year selector. Pure CSS grid, no library.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/common";

export interface HeatmapProps {
  /** `YYYY-MM-DD` → submissions that day. */
  data: Record<string, number>;
  year: number;
  onYearChange?: (y: number) => void;
  years?: number[];
  /** Dates in the current streak get a ring. */
  streakDates?: Set<string>;
  totalSubmissions?: number;
  activeDays?: number;
  maxStreak?: number;
  className?: string;
  cell?: number;
}

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const key = (d: Date) => d.toISOString().slice(0, 10);

function bucket(n: number): number { return n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4; }
const LEVEL_STYLE = ["bg-surface-2", "bg-brand/25", "bg-brand/50", "bg-brand/75", "bg-brand"];

export function ActivityHeatmap({ data, year, onYearChange, years, streakDates, totalSubmissions, activeDays, maxStreak, className, cell = 11 }: HeatmapProps) {
  const [hover, setHover] = useState<{ date: string; n: number; x: number; y: number } | null>(null);

  const { weeks, monthCols } = useMemo(() => {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const first = new Date(start.getTime() - start.getUTCDay() * DAY); // back to Sunday
    const weeks: { date: string; n: number; inYear: boolean }[][] = [];
    const monthCols: { label: string; col: number }[] = [];
    let seenMonth = -1;
    for (let t = first.getTime(), w = 0; t <= end.getTime(); w++) {
      const col: { date: string; n: number; inYear: boolean }[] = [];
      for (let d = 0; d < 7; d++, t += DAY) {
        const date = new Date(t);
        const k = key(date);
        const inYear = date.getUTCFullYear() === year;
        if (inYear && date.getUTCMonth() !== seenMonth && (date.getUTCDate() <= 7)) { seenMonth = date.getUTCMonth(); monthCols.push({ label: MONTHS[seenMonth], col: w }); }
        col.push({ date: k, n: inYear ? (data[k] ?? 0) : 0, inYear });
      }
      weeks.push(col);
    }
    return { weeks, monthCols };
  }, [data, year]);

  const gap = 3;
  const width = weeks.length * (cell + gap);
  const yearOpts = years ?? Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className={cn("relative", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-text-2">
          <span className="font-semibold tabular text-text-1">{totalSubmissions ?? Object.values(data).reduce((a, b) => a + b, 0)}</span> submissions in {year}
          {activeDays !== undefined && <> · <span className="font-semibold tabular text-text-1">{activeDays}</span> active days</>}
          {maxStreak !== undefined && <> · max streak <span className="font-semibold tabular text-text-1">{maxStreak}</span></>}
        </p>
        {onYearChange && (
          <div className="flex gap-1">
            {yearOpts.map((y) => (
              <button key={y} type="button" onClick={() => onYearChange(y)} className={cn("h-7 rounded-[6px] px-2 text-xs font-medium transition-colors", y === year ? "bg-surface-3 text-text-1" : "text-text-3 hover:bg-surface-2 hover:text-text-1")}>{y}</button>
            ))}
          </div>
        )}
      </div>
      <div className="scroll-thin overflow-x-auto pb-1" onMouseLeave={() => setHover(null)}>
        <div style={{ width, minWidth: width }} className="relative">
          <div className="relative mb-1 h-4 text-2xs text-text-3">
            {monthCols.map((m) => <span key={m.label + m.col} className="absolute" style={{ left: m.col * (cell + gap) }}>{m.label}</span>)}
          </div>
          <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gap, gridAutoColumns: cell }} role="img" aria-label={`Activity heatmap for ${year}`}>
            {weeks.map((w, wi) => w.map((d, di) => (
              <div
                key={d.date}
                data-date={d.date}
                onMouseEnter={(e) => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const c = e.currentTarget.getBoundingClientRect(); setHover({ date: d.date, n: d.n, x: c.left - r.left + cell / 2, y: c.top - r.top }); }}
                className={cn("rounded-[2px]", d.inYear ? LEVEL_STYLE[bucket(d.n)] : "opacity-0", streakDates?.has(d.date) && "ring-1 ring-brand-2 ring-offset-1 ring-offset-card")}
                style={{ gridRow: di + 1, gridColumn: wi + 1 }}
                aria-hidden
              />
            )))}
          </div>
          {hover && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: hover.x, top: hover.y + 14 }}>
              <ChartTooltip title={new Date(hover.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} rows={[{ label: "Submissions", value: hover.n }]} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-2xs text-text-3">
        Less {LEVEL_STYLE.map((c, i) => <span key={i} className={cn("inline-block size-2.5 rounded-[2px]", c)} aria-hidden />)} More
      </div>
    </div>
  );
}
