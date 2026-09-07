"use client";
/** Topic mastery radar (top N topics by mastery/volume). Brand hue wash at 12 %, 2 px stroke, labels in text tokens. */
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART, ChartEmpty, ChartTooltip } from "@/components/charts/common";

export interface RadarTopic { name: string; mastery: number; solved?: number }

export function SkillRadar({ topics, height = 260, max = 8, className }: { topics: RadarTopic[]; height?: number; max?: number; className?: string }) {
  const data = [...topics].filter((t) => t.mastery > 0 || (t.solved ?? 0) > 0).sort((a, b) => b.mastery - a.mastery).slice(0, max);
  if (data.length < 3) return <ChartEmpty className={className}>Solve problems in at least 3 topics to unlock the skill radar.</ChartEmpty>;
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%" margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <PolarGrid stroke={CHART.grid} />
          <PolarAngleAxis dataKey="name" tick={{ fill: CHART.text2, fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={({ active, payload }) => (active && payload?.length ? <ChartTooltip title={String(payload[0].payload.name)} rows={[{ label: "Mastery", value: `${Math.round(Number(payload[0].value))}`, color: CHART.brand }, ...(payload[0].payload.solved !== undefined ? [{ label: "Solved", value: payload[0].payload.solved }] : [])]} /> : null)} />
          <Radar dataKey="mastery" stroke={CHART.brand} strokeWidth={2} fill={CHART.brand} fillOpacity={0.12} dot={{ r: 3, fill: CHART.brand, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
