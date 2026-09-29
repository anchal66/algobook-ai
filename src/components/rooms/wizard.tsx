"use client";
/** Create-room wizard steps (Module 06 §3.7). State lives in the page; each step is a view over `RoomSettings`. */
import { Check, Globe, Lock, ShieldAlert, ShieldCheck, ShieldHalf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge, DifficultyBadge } from "@/components/ui/badge";
import { RoomAvatar } from "@/components/rooms/RoomAvatar";
import { AVATAR_ICONS, ROOM_LIMITS, SCORING_PRESETS, expandSlots, summarize, type RoomSettings } from "@/lib/rooms/settings";
import { rulesFor } from "@/lib/rooms/integrity";
import { budgetLevel, estimateBatches } from "@/lib/rooms/budget";
import { CORE_TOPICS, TOPIC_META } from "@/lib/practice/topics";
import type { Difficulty, Language } from "@/types";
import { cn } from "@/lib/utils";

type Set = (p: Partial<RoomSettings>) => void;
const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];
const LANGS: { key: Language; label: string }[] = [{ key: "java", label: "Java" }, { key: "python", label: "Python" }, { key: "cpp", label: "C++" }, { key: "javascript", label: "JavaScript" }];

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium text-text-2">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-xs text-err">{error}</p> : hint ? <p className="mt-1 text-xs text-text-3">{hint}</p> : null}
    </div>
  );
}

function Option({ selected, onClick, title, text, icon, disabled }: { selected: boolean; onClick: () => void; title: React.ReactNode; text?: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={cn("flex h-full flex-col rounded-card border bg-card p-3 text-left transition-[border-color,box-shadow] duration-200 hover:border-line-strong focus-visible:ring-[3px] focus-visible:ring-brand/40 disabled:opacity-50", selected ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-line")}>
      <span className="flex items-center gap-2 text-sm font-semibold text-text-1">{icon}{title}{selected && <Check className="ml-auto size-4 text-brand" />}</span>
      {text && <span className="mt-1 text-xs text-text-2">{text}</span>}
    </button>
  );
}

function NumberField({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className="w-24" />
      {suffix && <span className="text-sm text-text-3">{suffix}</span>}
    </div>
  );
}

export function StepIdentity({ s, set, errors }: { s: RoomSettings; set: Set; errors: Record<string, string> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Field label="Room name" error={errors.name}><Input value={s.name} maxLength={ROOM_LIMITS.nameMax} placeholder="Friday night clash" onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Description" hint="Optional. Shown in the lobby and the public list." error={errors.description}><Textarea value={s.description} maxLength={ROOM_LIMITS.descriptionMax} rows={3} placeholder="Weekly practice for the DSA study group — bring your A game." onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Who can find it">
          <div className="grid grid-cols-2 gap-2">
            <Option selected={s.visibility === "private"} onClick={() => set({ visibility: "private" })} icon={<Lock className="size-4 text-text-3" />} title="Private" text="Only people with the 6-digit code." />
            <Option selected={s.visibility === "public"} onClick={() => set({ visibility: "public" })} icon={<Globe className="size-4 text-text-3" />} title="Public" text="Listed on the Rooms page while the lobby is open." />
          </div>
        </Field>
        <Field label="Joining">
          <div className="grid grid-cols-2 gap-2">
            <Option selected={s.joinApproval === "manual"} onClick={() => set({ joinApproval: "manual" })} title="You approve each person" text="Requests wait in the lobby until you accept them." />
            <Option selected={s.joinApproval === "auto"} onClick={() => set({ joinApproval: "auto" })} title="Anyone with access joins" text="No approval step, up to the participant limit." />
          </div>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Max participants" hint="Including you."><NumberField value={s.maxMembers} min={ROOM_LIMITS.membersMin} max={ROOM_LIMITS.membersMax} onChange={(n) => set({ maxMembers: n })} suffix="people" /></Field>
          <Field label="Scheduled start (optional)" hint="The lobby opens now; Start unlocks at this time." error={errors.scheduledAt}>
            <Input type="datetime-local" value={s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 16) : ""} onChange={(e) => set({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </Field>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-text-2">Avatar</Label>
        <div className="mt-1.5 rounded-card border border-line bg-card p-4">
          <div className="flex items-center gap-3"><RoomAvatar icon={s.avatar.icon} hue={s.avatar.hue} size={56} /><div><p className="font-medium text-text-1">{s.name || "Your room"}</p><p className="text-xs text-text-3">{s.visibility} · {s.maxMembers} max</p></div></div>
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {AVATAR_ICONS.map((icon) => <button key={icon} type="button" aria-label={icon} aria-pressed={s.avatar.icon === icon} onClick={() => set({ avatar: { ...s.avatar, icon } })} className={cn("flex items-center justify-center rounded-[10px] border p-1 transition-colors", s.avatar.icon === icon ? "border-brand" : "border-transparent hover:border-line-strong")}><RoomAvatar icon={icon} hue={s.avatar.hue} size={34} /></button>)}
          </div>
          <input type="range" min={0} max={360} value={s.avatar.hue} onChange={(e) => set({ avatar: { ...s.avatar, hue: Number(e.target.value) } })} aria-label="Colour" className="mt-4 w-full" style={{ accentColor: `hsl(${s.avatar.hue} 70% 50%)` }} />
        </div>
      </div>
    </div>
  );
}

function TopicPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CORE_TOPICS.map((t) => { const on = value.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])} className={cn("h-7 rounded-full border px-2.5 text-xs transition-colors", on ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2 hover:border-line-strong")}>{TOPIC_META[t].name}</button>; })}
    </div>
  );
}

export function StepProblems({ s, set, errors }: { s: RoomSettings; set: Set; errors: Record<string, string> }) {
  const slots = expandSlots(s);
  const setCount = (count: number) => set({ count, perProblemDifficulty: Array.from({ length: count }, (_, i) => s.perProblemDifficulty[i] ?? "Medium"), perProblemTopics: Array.from({ length: count }, (_, i) => s.perProblemTopics[i] ?? []) });
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Duration" hint="10 to 300 minutes (5 hours)."><NumberField value={s.durationMin} min={ROOM_LIMITS.durationMin} max={ROOM_LIMITS.durationMax} onChange={(n) => set({ durationMin: n })} suffix="min" /></Field>
        <Field label="Problems"><NumberField value={s.count} min={ROOM_LIMITS.countMin} max={ROOM_LIMITS.countMax} onChange={setCount} suffix="problems" /></Field>
        <Field label="Order">
          <div className="grid grid-cols-2 gap-2">
            <Option selected={s.problemMode === "all-open"} onClick={() => set({ problemMode: "all-open" })} title="All open" text="Solve in any order." />
            <Option selected={s.problemMode === "sequential"} onClick={() => set({ problemMode: "sequential" })} title="One by one" text="Next unlocks after solve or skip." />
          </div>
        </Field>
      </div>
      <Field label="Difficulty">
        <div className="grid gap-2 sm:grid-cols-4">
          <Option selected={s.difficultyMode === "any"} onClick={() => set({ difficultyMode: "any" })} title="Any" text="Whatever the pool has." />
          <Option selected={s.difficultyMode === "incremental"} onClick={() => set({ difficultyMode: "incremental" })} title="Ramp up" text="Easy first, then harder." />
          <Option selected={s.difficultyMode === "fixed"} onClick={() => set({ difficultyMode: "fixed" })} title="All the same" text="Pick one level for every problem." />
          <Option selected={s.difficultyMode === "perProblem"} onClick={() => set({ difficultyMode: "perProblem", perProblemDifficulty: Array.from({ length: s.count }, (_, i) => s.perProblemDifficulty[i] ?? slots[i]?.difficulty ?? "Medium") })} title="Per problem" text="Choose each one yourself." />
        </div>
        {s.difficultyMode === "fixed" && <div className="mt-2 flex gap-2">{DIFFS.map((d) => <button key={d} type="button" aria-pressed={s.fixedDifficulty === d} onClick={() => set({ fixedDifficulty: d })} className={cn("rounded-full border px-3 py-1 text-sm", s.fixedDifficulty === d ? "border-brand bg-brand-soft" : "border-line")}><DifficultyBadge difficulty={d} /></button>)}</div>}
      </Field>
      <Field label="Topics" error={errors.topicPool ?? errors.perProblemTopics}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Option selected={s.topicMode === "any"} onClick={() => set({ topicMode: "any" })} title="Any topic" text="Mixed bag from the whole catalogue." />
          <Option selected={s.topicMode === "pool"} onClick={() => set({ topicMode: "pool" })} title="From these topics" text="Each problem drawn from your list." />
          <Option selected={s.topicMode === "perProblem"} onClick={() => set({ topicMode: "perProblem", perProblemTopics: Array.from({ length: s.count }, (_, i) => s.perProblemTopics[i] ?? []) })} title="Per problem" text="Set the topics of each problem." />
        </div>
        {s.topicMode === "pool" && <div className="mt-3"><TopicPicker value={s.topicPool} onChange={(topicPool) => set({ topicPool })} /></div>}
      </Field>
      {(s.difficultyMode === "perProblem" || s.topicMode === "perProblem") && (
        <div className="rounded-card border border-line bg-card p-4">
          <p className="text-sm font-medium text-text-1">Problem by problem</p>
          <ol className="mt-3 space-y-3">
            {Array.from({ length: s.count }, (_, i) => (
              <li key={i} className="grid gap-2 border-t border-line pt-3 first:border-0 first:pt-0 sm:grid-cols-[60px_1fr]">
                <span className="text-sm font-semibold text-text-2">#{i + 1}</span>
                <div className="space-y-2">
                  {s.difficultyMode === "perProblem" && <div className="flex gap-1.5">{DIFFS.map((d) => <button key={d} type="button" aria-pressed={s.perProblemDifficulty[i] === d} onClick={() => set({ perProblemDifficulty: s.perProblemDifficulty.map((x, k) => (k === i ? d : x)) })} className={cn("rounded-full border px-2 py-0.5", s.perProblemDifficulty[i] === d ? "border-brand bg-brand-soft" : "border-line")}><DifficultyBadge difficulty={d} size="sm" /></button>)}</div>}
                  {s.topicMode === "perProblem" && <TopicPicker value={s.perProblemTopics[i] ?? []} onChange={(v) => set({ perProblemTopics: s.perProblemTopics.map((x, k) => (k === i ? v : x)) })} />}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Languages allowed" error={errors.languages}>
          <div className="flex flex-wrap gap-1.5">{LANGS.map((l) => { const on = s.languages.includes(l.key); return <button key={l.key} type="button" aria-pressed={on} onClick={() => set({ languages: on ? s.languages.filter((x) => x !== l.key) : [...s.languages, l.key] })} className={cn("h-8 rounded-full border px-3 text-sm", on ? "border-brand bg-brand-soft text-brand" : "border-line text-text-2")}>{l.label}</button>; })}</div>
        </Field>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Avoid problems participants have already seen</span><Switch checked={s.excludeSeen} onCheckedChange={(v) => set({ excludeSeen: v })} /></label>
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Generate fresh problems when the pool has none <span className="text-xs text-text-3">(uses your AI generations)</span></span><Switch checked={s.generateIfMissing} onCheckedChange={(v) => set({ generateIfMissing: v })} /></label>
        </div>
      </div>
      <div className="rounded-card border border-line bg-surface-1 p-3 text-sm text-text-2">Preview: {slots.map((sl) => `#${sl.index + 1} ${sl.difficulty ?? "any"}${sl.topics.length ? ` (${sl.topics.slice(0, 2).join(", ")}${sl.topics.length > 2 ? "…" : ""})` : ""}`).join(" · ")}</div>
    </div>
  );
}

export function BudgetNote({ s, budget, members }: { s: RoomSettings; budget: { remaining: number | null; cap: number } | null; members: number }) {
  if (!budget) return null;
  const est = estimateBatches(members, s.count, s.caps);
  const level = budgetLevel(est, budget.remaining ?? Infinity, budget.cap);
  if (level === "unlimited") return null;
  return (
    <p className={cn("rounded-[8px] px-3 py-2 text-xs", level === "over" ? "bg-err/10 text-err" : level === "tight" ? "bg-warn/10 text-text-1" : "bg-ok/10 text-text-1")}>
      Judge budget: this room will likely use <b>{est.likely}</b> code executions (worst case {est.need}) of the <b>{budget.remaining ?? 0}</b> left today. {level === "over" ? "That does not fit — lower participants, problems or the caps." : level === "tight" ? "Tight, but workable." : "Fits comfortably."}
    </p>
  );
}

export function StepScoring({ s, set, budget }: { s: RoomSettings; set: Set; budget: { remaining: number | null; cap: number } | null }) {
  const sc = s.scoring;
  const setSc = (p: Partial<RoomSettings["scoring"]>) => set({ scoring: { ...sc, ...p, preset: p.preset ?? "custom" } });
  const applyPreset = (preset: "leetcode" | "icpc") => set({ scoring: { ...sc, ...SCORING_PRESETS[preset], preset } });
  const integ = s.integrity;
  return (
    <div className="space-y-6">
      <Field label="Scoring preset">
        <div className="grid gap-2 sm:grid-cols-3">
          <Option selected={sc.preset === "leetcode"} onClick={() => applyPreset("leetcode")} title="LeetCode style" text="Points fall over time; each wrong submission costs 10% of that problem." />
          <Option selected={sc.preset === "icpc"} onClick={() => applyPreset("icpc")} title="ICPC style" text="Solved count first, then total time with +20 min per wrong submission; leaderboard frozen at the end." />
          <Option selected={sc.preset === "custom"} onClick={() => setSc({})} title="Custom" text="Tune everything below." />
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        {DIFFS.map((d) => <Field key={d} label={`${d} points`}><NumberField value={sc.points[d]} min={10} max={1000} onChange={(n) => setSc({ points: { ...sc.points, [d]: n } })} /></Field>)}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Time decay">
          <div className="grid grid-cols-2 gap-2"><Option selected={sc.timeDecay === "linear"} onClick={() => setSc({ timeDecay: "linear" })} title="Linear" text={`Down to ${sc.minPct}% at the end.`} /><Option selected={sc.timeDecay === "none"} onClick={() => setSc({ timeDecay: "none" })} title="None" text="Full points whenever solved." /></div>
          {sc.timeDecay === "linear" && <div className="mt-2"><NumberField value={sc.minPct} min={10} max={100} onChange={(n) => setSc({ minPct: n })} suffix="% left at the end" /></div>}
        </Field>
        <Field label="Wrong submissions" hint="Compile errors on samples are free.">
          <div className="flex flex-wrap gap-3"><NumberField value={sc.wrongPenaltyPct} min={0} max={50} onChange={(n) => setSc({ wrongPenaltyPct: n })} suffix="% of the problem" /><NumberField value={sc.wrongPenaltyMin} min={0} max={30} onChange={(n) => setSc({ wrongPenaltyMin: n })} suffix="min tie-break" /></div>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Partial credit"><div className="grid gap-2"><Option selected={sc.partialCredit === "none"} onClick={() => setSc({ partialCredit: "none" })} title="None" /><Option selected={sc.partialCredit === "proportional"} onClick={() => setSc({ partialCredit: "proportional" })} title="Up to half" text="Passed ÷ total × half the points." /></div></Field>
        <Field label="Verdicts during the contest"><div className="grid gap-2"><Option selected={sc.showVerdict === "full"} onClick={() => setSc({ showVerdict: "full" })} title="Full" text="Verdict + first failing sample." /><Option selected={sc.showVerdict === "verdictOnly"} onClick={() => setSc({ showVerdict: "verdictOnly" })} title="Verdict only" /><Option selected={sc.showVerdict === "hidden"} onClick={() => setSc({ showVerdict: "hidden" })} title="Hidden" text="“Received” until the end." /></div></Field>
        <Field label="Leaderboard"><div className="grid gap-2"><Option selected={sc.showLeaderboard === "live"} onClick={() => setSc({ showLeaderboard: "live" })} title="Live" /><Option selected={sc.showLeaderboard === "frozen"} onClick={() => setSc({ showLeaderboard: "frozen" })} title={`Frozen for the last ${sc.freezeLastMin} min`} /><Option selected={sc.showLeaderboard === "hidden"} onClick={() => setSc({ showLeaderboard: "hidden" })} title="Hidden until the end" /></div>{sc.showLeaderboard === "frozen" && <div className="mt-2"><NumberField value={sc.freezeLastMin} min={5} max={60} onChange={(n) => setSc({ freezeLastMin: n })} suffix="min" /></div>}</Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Per-problem caps" hint="Keeps the room inside today's judge budget.">
          <div className="flex flex-wrap gap-3"><NumberField value={s.caps.maxSubmitsPerProblem} min={1} max={10} onChange={(n) => set({ caps: { ...s.caps, maxSubmitsPerProblem: n } })} suffix="submits" /><NumberField value={s.caps.maxRunsPerProblem} min={0} max={10} onChange={(n) => set({ caps: { ...s.caps, maxRunsPerProblem: n } })} suffix="runs" /></div>
          <label className="mt-2 flex items-center justify-between gap-3 text-sm text-text-1"><span>Allow Run on sample cases</span><Switch checked={sc.runOnSamples} onCheckedChange={(v) => setSc({ runOnSamples: v })} /></label>
        </Field>
        <BudgetNote s={s} budget={budget} members={s.maxMembers} />
      </div>
      <Field label="Integrity strictness">
        <div className="grid gap-2 sm:grid-cols-3">
          <Option selected={integ.strictness === "lenient"} onClick={() => set({ integrity: { ...integ, strictness: "lenient" } })} icon={<ShieldHalf className="size-4 text-text-3" />} title="Lenient" text="Half penalties. Friendly practice." />
          <Option selected={integ.strictness === "standard"} onClick={() => set({ integrity: { ...integ, strictness: "standard" } })} icon={<ShieldCheck className="size-4 text-text-3" />} title="Standard" text="The defaults below." />
          <Option selected={integ.strictness === "strict"} onClick={() => set({ integrity: { ...integ, strictness: "strict" } })} icon={<ShieldAlert className="size-4 text-text-3" />} title="Strict" text="1.5× penalties, dev-tools logged." />
        </div>
        <ul className="mt-3 grid gap-1 text-xs text-text-2 sm:grid-cols-2">{rulesFor(integ.strictness).filter((r) => !r.logOnly).map((r) => <li key={r.type}><span className="font-medium text-text-1">{r.label}</span> — {r.base}%{r.perRepeat ? ` (+${r.perRepeat}% per repeat)` : ""}{r.perThirtySec ? ` (+${r.perThirtySec}% / 30 s)` : ""}</li>)}</ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Block paste from outside the editor</span><Switch checked={integ.blockPaste} onCheckedChange={(v) => set({ integrity: { ...integ, blockPaste: v } })} /></label>
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Block copying the problem and code</span><Switch checked={integ.blockCopy} onCheckedChange={(v) => set({ integrity: { ...integ, blockCopy: v } })} /></label>
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Require full screen</span><Switch checked={integ.requireFullscreen} onCheckedChange={(v) => set({ integrity: { ...integ, requireFullscreen: v } })} /></label>
          <label className="flex items-center justify-between gap-3 text-sm text-text-1"><span>Check code similarity after the contest</span><Switch checked={integ.similarityCheck} onCheckedChange={(v) => set({ integrity: { ...integ, similarityCheck: v } })} /></label>
        </div>
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-card border border-line p-3 text-sm text-text-1"><span>Rated <span className="block text-xs text-text-3">Changes everyone&apos;s contest rating (needs 3+ finishers).</span></span><Switch checked={s.rated} onCheckedChange={(v) => set({ rated: v })} /></label>
        <label className="flex items-center justify-between gap-3 rounded-card border border-line p-3 text-sm text-text-1"><span>Lobby chat <span className="block text-xs text-text-3">Off inside the arena either way.</span></span><Switch checked={s.chat === "lobby-only"} onCheckedChange={(v) => set({ chat: v ? "lobby-only" : "off" })} /></label>
      </div>
    </div>
  );
}

export function StepReview({ s, budget }: { s: RoomSettings; budget: { remaining: number | null; cap: number } | null }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-card border border-line bg-card p-5">
        <div className="flex items-center gap-3"><RoomAvatar icon={s.avatar.icon} hue={s.avatar.hue} size={48} /><div><p className="text-lg font-semibold text-text-1">{s.name}</p><p className="text-sm text-text-2">{s.description || "No description"}</p></div></div>
        <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="outline">{s.visibility}</Badge><Badge variant="outline">{s.joinApproval === "manual" ? "host approves" : "auto-join"}</Badge><Badge variant="outline">{s.maxMembers} max</Badge>{s.rated && <Badge variant="brand">rated</Badge>}</div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-text-2">{summarize(s).map((l, i) => <li key={i}>{l}</li>)}</ul>
        <div className="mt-4"><BudgetNote s={s} budget={budget} members={s.maxMembers} /></div>
      </div>
      <div className="rounded-card border border-line bg-card p-5">
        <p className="text-sm font-medium text-text-1">Participants will consent to</p>
        <table className="mt-2 w-full text-left text-xs"><tbody className="divide-y divide-line">{rulesFor(s.integrity.strictness).filter((r) => !r.logOnly).map((r) => <tr key={r.type}><td className="py-1.5 pr-2 font-medium text-text-1">{r.label}</td><td className="py-1.5 pr-2 text-text-2">{r.detected}</td><td className="py-1.5 text-right tabular-nums text-text-1">{r.base}%</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
