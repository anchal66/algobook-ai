"use client";
/** Distribution of "Beats %" across a user's accepted submissions, 10-point buckets; ≤ 24 px columns, 2 px gaps, value on hover. */
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartEmpty, ChartTooltip } from "@/components/charts/common";

export function BeatsHistogram({ values, height = 140, highlight, className }: { values: number[]; height?: number; highlight?: number | null; className?: string }) {
  if (values.length === 0) return <ChartEmpty className={className}>Accepted submissions will show their runtime percentile here.</ChartEmpty>;
  const buckets = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, label: `${i * 10}–${i * 10 + 10}`, n: 0 }));
  for (const v of values) buckets[Math.min(9, Math.max(0, Math.floor(v / 10)))].n++;
  const hl = typeof highlight === "number" ? Math.min(9, Math.floor(highlight / 10)) : -1;
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
          <XAxis dataKey="from" tickLine={false} axisLine={{ stroke: CHART.grid }} tick={{ fill: CHART.text3, fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} interval={1} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: CHART.text3, fontSize: 10 }} width={32} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) => (active && payload?.length ? <ChartTooltip title={`Beats ${payload[0].payload.label}%`} rows={[{ label: "Submissions", value: payload[0].payload.n, color: CHART.brand }]} /> : null)} />
          <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {buckets.map((b, i) => <Cell key={b.from} fill={i === hl ? CHART.brand2 : CHART.brand} fillOpacity={i === hl ? 1 : 0.8} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
