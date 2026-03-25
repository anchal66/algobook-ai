"use client";

import { useState, useEffect, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HeatmapProps {
  userId: string;
}

interface HeatmapData {
  heatmap: Record<string, number>;
  totalSubmissions: number;
  activeDays: number;
  maxStreak: number;
  year: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getColor(count: number): string {
  if (count === 0) return "bg-muted/60";
  if (count === 1) return "bg-emerald-900/60";
  if (count <= 3) return "bg-emerald-700/70";
  if (count <= 6) return "bg-emerald-500/80";
  return "bg-emerald-400";
}

function buildGrid(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // Start from the Sunday of the week containing Jan 1
  const firstDay = new Date(startDate);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());

  const weeks: Date[][] = [];
  let currentDate = new Date(firstDay);

  while (currentDate <= endDate || (weeks.length > 0 && weeks[weeks.length - 1].length < 7)) {
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
      weeks.push([]);
    }
    weeks[weeks.length - 1].push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Ensure the last week is complete
  while (weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return weeks;
}

export default function SubmissionHeatmap({ userId }: HeatmapProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/profile/heatmap?userId=${encodeURIComponent(userId)}&year=${year}`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Error fetching heatmap:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmap();
  }, [userId, year]);

  const weeks = useMemo(() => buildGrid(year), [year]);
  const heatmap = data?.heatmap || {};

  // Calculate month label positions
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      // Use the first day of the week that's in the target year
      const day = week.find((d) => d.getFullYear() === year) || week[0];
      const month = day.getMonth();
      if (month !== lastMonth) {
        labels.push({ month: MONTHS[month], weekIndex });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks, year]);

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">
            {data ? data.totalSubmissions : "—"} submissions in {year}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total active days: <strong className="text-foreground">{data?.activeDays || 0}</strong></span>
          <span>Max streak: <strong className="text-foreground">{data?.maxStreak || 0}</strong></span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="h-[120px] flex items-center justify-center">
          <div className="h-6 w-6 rounded bg-primary animate-pulse" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: "0px" }}>
            {monthLabels.map((label, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground"
                style={{
                  position: "relative",
                  left: `${label.weekIndex * 14}px`,
                  marginRight: i < monthLabels.length - 1
                    ? `${(monthLabels[i + 1]?.weekIndex - label.weekIndex) * 14 - 30}px`
                    : "0px",
                  width: "30px",
                  flexShrink: 0,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <TooltipProvider delayDuration={0}>
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    const dateStr = day.toISOString().slice(0, 10);
                    const count = heatmap[dateStr] || 0;
                    const isInYear = day.getFullYear() === year;

                    return (
                      <Tooltip key={di}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-[11px] h-[11px] rounded-[2px] ${
                              isInYear ? getColor(count) : "bg-transparent"
                            }`}
                          />
                        </TooltipTrigger>
                        {isInYear && (
                          <TooltipContent side="top" className="text-xs">
                            <span className="font-semibold">{count} submission{count !== 1 ? "s" : ""}</span>
                            {" "}on {day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-muted/60" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-900/60" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-700/70" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500/80" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400" />
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
}
