"use client";
/** New-project wizard steps (Module 05 U-14). State lives in the page; each step is a pure view. */
import { Building2, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPANY_LABEL } from "@/components/dashboard/ProjectCard";
import { CORE_TOPICS, TOPIC_META } from "@/lib/practice/topics";
import type { TemplateDTO } from "@/lib/app/api";
import type { ExperienceLevel, GoalType } from "@/types";
import { titleCase } from "@/lib/app/format";
import { cn } from "@/lib/utils";

export interface WizardState {
  templateId: string | null; title: string; description: string; purpose: string;
  goalType: GoalType; experienceLevel: ExperienceLevel; selectedTopics: string[]; durationDays: number; weeklyHours: number;
}
export const DURATION_MIN = 7, DURATION_MAX = 90;
export const GOALS: { v: GoalType; title: string; text: string }[] = [
  { v: "interview-prep", title: "Interview prep", text: "A dated target — company-style problems that ramp in difficulty." },
  { v: "daily-practice", title: "Daily practice", text: "Stay sharp with a steady mix across topics." },
  { v: "learn-basics", title: "Learn the basics", text: "Start from arrays and strings; unlock topics as you master prerequisites." },
  { v: "returning-after-break", title: "Returning after a break", text: "Three calibration problems, then a plan that meets you where you are." },
];
export const LEVELS: { v: ExperienceLevel; title: string; text: string }[] = [
  { v: "beginner", title: "Beginner", text: "New to DSA or rusty. Mostly Easy to start." },
  { v: "intermediate", title: "Intermediate", text: "Comfortable with common patterns. Easy → Medium." },
  { v: "advanced", title: "Advanced", text: "Solves Mediums routinely. Medium → Hard." },
];

export function clampDuration(n: number) { return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(n))); }
/** v1 rule: template projects default to ~half the list length in days. */
export function templateDuration(count: number) { return clampDuration(Math.ceil(count / 2)); }

function OptionCard({ selected, onClick, title, text, icon, className, children }: { selected: boolean; onClick: () => void; title: React.ReactNode; text?: React.ReactNode; icon?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("group relative flex h-full flex-col rounded-card border bg-card p-4 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-line-strong focus-visible:ring-[3px] focus-visible:ring-brand/40", selected ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-line", className)}>
      <span className={cn("absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border transition-colors", selected ? "border-brand bg-brand text-white" : "border-line-strong text-transparent")}><Check className="size-3" strokeWidth={3} /></span>
      {icon && <span className="mb-3 flex size-9 items-center justify-center rounded-[8px] bg-brand-soft text-brand">{icon}</span>}
      <span className="pr-6 text-md font-semibold text-text-1">{title}</span>
      {text && <span className="mt-1 text-sm text-text-2">{text}</span>}
      {children}
    </button>
  );
}

export function StepTemplate({ templates, loading, value, onPick }: { templates: TemplateDTO[]; loading: boolean; value: string | null; onPick: (t: TemplateDTO | null) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OptionCard selected={value === null} onClick={() => onPick(null)} icon={<Sparkles className="size-4" />} title="Custom project" text="Describe your goal; AlgoBook AI plans the topics and generates verified problems as you go." />
      {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40" />) : templates.map((t) => {
        const total = Math.max(1, t.count);
        return (
          <OptionCard key={t.id} selected={value === t.id} onClick={() => onPick(t)} icon={<Building2 className="size-4" />} title={COMPANY_LABEL[t.company] ?? titleCase(t.company)} text={t.description || t.title}>
            <span className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <span className="bg-easy" style={{ width: `${(t.difficulties.easy / total) * 100}%` }} /><span className="ml-px bg-medium" style={{ width: `${(t.difficulties.medium / total) * 100}%` }} /><span className="ml-px bg-hard" style={{ width: `${(t.difficulties.hard / total) * 100}%` }} />
            </span>
            <span className="mt-2 flex items-center gap-2 text-xs tabular text-text-3"><span className="font-medium text-text-1">{t.count}</span> problems · <span className="text-easy">{t.difficulties.easy}</span>/<span className="text-[#b58500] dark:text-medium">{t.difficulties.medium}</span>/<span className="text-hard">{t.difficulties.hard}</span></span>
          </OptionCard>
        );
      })}
    </div>
  );
}

export function StepGoal({ s, set }: { s: WizardState; set: (p: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-1">What are you preparing for?</h3>
        <div className="grid gap-3 sm:grid-cols-2">{GOALS.map((g) => <OptionCard key={g.v} selected={s.goalType === g.v} onClick={() => set({ goalType: g.v })} title={g.title} text={g.text} />)}</div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-1">Your current level</h3>
        <div className="grid gap-3 sm:grid-cols-3">{LEVELS.map((l) => <OptionCard key={l.v} selected={s.experienceLevel === l.v} onClick={() => set({ experienceLevel: l.v })} title={l.title} text={l.text} />)}</div>
      </div>
    </div>
  );
}

export function StepDetails({ s, set, templateCount }: { s: WizardState; set: (p: Partial<WizardState>) => void; templateCount: number | null }) {
  const perWeek = templateCount ? Math.round((templateCount / s.durationDays) * 7) : Math.max(2, Math.round(s.weeklyHours * 1.5));
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div className="grid gap-1.5"><Label htmlFor="w-title">Project title</Label><Input id="w-title" value={s.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={templateCount ? "Google interview — October" : "Graphs & DP bootcamp"} /></div>
        <div className="grid gap-1.5"><Label htmlFor="w-desc">Description</Label><Textarea id="w-desc" value={s.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} rows={3} placeholder="What does success look like? Interview date, target role, topics you dread…" /><span className="text-right text-2xs tabular text-text-3">{s.description.length}/2000</span></div>
        <div className="grid gap-1.5"><Label htmlFor="w-purpose">Purpose <span className="text-text-3">(shown on the card)</span></Label><Input id="w-purpose" value={s.purpose} onChange={(e) => set({ purpose: e.target.value })} maxLength={200} placeholder="SDE-2 loop at Google in 6 weeks" /></div>
        <div>
          <Label>Focus topics <span className="text-text-3">(optional — leave empty for AI-recommended topics)</span></Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CORE_TOPICS.map((t) => {
              const on = s.selectedTopics.includes(t);
              return <button key={t} type="button" aria-pressed={on} onClick={() => set({ selectedTopics: on ? s.selectedTopics.filter((x) => x !== t) : [...s.selectedTopics, t] })} className={cn("h-8 rounded-full border px-3 text-sm transition-colors", on ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2 hover:border-line-strong hover:text-text-1")}>{TOPIC_META[t].name}</button>;
            })}
          </div>
        </div>
      </div>
      <div className="space-y-6 rounded-card border border-line bg-surface-1 p-5">
        <div>
          <div className="flex items-baseline justify-between"><Label>Duration</Label><span className="tabular text-sm font-semibold text-text-1">{s.durationDays} days</span></div>
          <Slider className="mt-3" min={DURATION_MIN} max={DURATION_MAX} step={1} value={[s.durationDays]} onValueChange={([v]) => set({ durationDays: v })} aria-label="Duration in days" />
          <div className="mt-1 flex justify-between text-2xs text-text-3"><span>1 week</span><span>3 months</span></div>
        </div>
        <div>
          <div className="flex items-baseline justify-between"><Label>Weekly hours</Label><span className="tabular text-sm font-semibold text-text-1">{s.weeklyHours} h</span></div>
          <Slider className="mt-3" min={1} max={30} step={1} value={[s.weeklyHours]} onValueChange={([v]) => set({ weeklyHours: v })} aria-label="Weekly hours" />
        </div>
        <div className="rounded-[10px] bg-card p-3 text-sm text-text-2">
          <p><span className="font-medium text-text-1">≈ {perWeek} problems / week</span>{templateCount ? ` to finish all ${templateCount} in ${s.durationDays} days.` : ` at ${s.weeklyHours} h/week.`}</p>
          {templateCount && perWeek > s.weeklyHours * 2 && <p className="mt-1 text-xs text-[#b58500] dark:text-medium">That&rsquo;s a brisk pace — consider a longer duration.</p>}
        </div>
      </div>
    </div>
  );
}

export function StepReview({ s, template }: { s: WizardState; template: TemplateDTO | null }) {
  const rows: [string, React.ReactNode][] = [
    ["Type", template ? <span className="flex items-center gap-1.5"><Building2 className="size-4 text-brand" />{COMPANY_LABEL[template.company] ?? titleCase(template.company)} template · {template.count} problems</span> : "Custom"],
    ["Title", s.title], ["Description", s.description], ["Purpose", s.purpose || "—"],
    ["Goal", GOALS.find((g) => g.v === s.goalType)?.title], ["Level", LEVELS.find((l) => l.v === s.experienceLevel)?.title],
    ["Focus topics", s.selectedTopics.length ? <span className="flex flex-wrap gap-1">{s.selectedTopics.map((t) => <Badge key={t} size="sm">{TOPIC_META[t as keyof typeof TOPIC_META]?.name ?? t}</Badge>)}</span> : "AI-recommended"],
    ["Duration", `${s.durationDays} days · ${s.weeklyHours} h/week`],
  ];
  return (
    <dl className="divide-y divide-line rounded-card border border-line bg-card">
      {rows.map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-sm text-text-3">{k}</dt><dd className="text-sm text-text-1">{v}</dd></div>)}
    </dl>
  );
}
