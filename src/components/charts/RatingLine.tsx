"use client";
/** Rating over time: 2 px line, 10 % area wash, end-dot with surface ring, crosshair tooltip. Single series → no legend box. */
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartEmpty, ChartTooltip } from "@/components/charts/common";
import { fmtDate } from "@/lib/app/format";

export interface RatingPoint { date: string; rating: number }

export function RatingLine({ points, height = 180, mini = false, className }: { points: RatingPoint[]; height?: number; mini?: boolean; className?: string }) {
  if (points.length < 2) return <ChartEmpty className={className}>{points.length === 1 ? `Rating ${Math.round(points[0].rating)} — solve rated problems to see a trend.` : "No rating history yet — a point is recorded after each rated solve from now on."}</ChartEmpty>;
  const data = points.map((p) => ({ ...p, r: Math.round(p.rating) }));
  const last = data[data.length - 1];
  const min = Math.min(...data.map((d) => d.r)), max = Math.max(...data.map((d) => d.r));
  const pad = Math.max(20, Math.round((max - min) * 0.15));
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: mini ? 8 : 28, bottom: mini ? 0 : 4, left: mini ? 0 : -18 }}>
          <defs>
            <linearGradient id="rating-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!mini && <CartesianGrid stroke={CHART.grid} vertical={false} strokeWidth={1} />}
          <XAxis dataKey="date" hide={mini} tickLine={false} axisLine={false} tick={{ fill: CHART.text3, fontSize: 11 }} tickFormatter={(v: string) => fmtDate(v, { month: "short", day: "numeric" })} minTickGap={32} />
          <YAxis hide={mini} domain={[min - pad, max + pad]} tickLine={false} axisLine={false} tick={{ fill: CHART.text3, fontSize: 11 }} tickCount={4} />
          <Tooltip cursor={{ stroke: CHART.text3, strokeWidth: 1 }} content={({ active, payload }) => (active && payload?.length ? <ChartTooltip title={fmtDate(String(payload[0].payload.date))} rows={[{ label: "Rating", value: payload[0].payload.r, color: CHART.brand }]} /> : null)} />
          <Area type="monotone" dataKey="r" stroke={CHART.brand} strokeWidth={2} fill="url(#rating-wash)" dot={false} activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2, fill: CHART.brand }} isAnimationActive={false} />
          <ReferenceDot x={last.date} y={last.r} r={4.5} fill={CHART.brand} stroke={CHART.surface} strokeWidth={2} label={mini ? undefined : { value: String(last.r), position: "right", fill: CHART.text2, fontSize: 12, fontWeight: 600 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 12-point sparkline for stat tiles. */
export function Sparkline({ values, height = 36, color = CHART.brand, className }: { values: number[]; height?: number; color?: string; className?: string }) {
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
