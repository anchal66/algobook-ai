/**
 * Anti-cheat penalties (Module 06 §3.9). Every detection is an event; penalties are percents of the
 * member's earned points, capped. The same table renders the consent dialog, so what the participant
 * agrees to is exactly what the server applies. Pure.
 */
import type { Strictness } from "@/lib/rooms/settings";

export const INTEGRITY_EVENT_TYPES = [
  "paste_external", "copy_blocked", "tab_hidden", "window_blur", "fullscreen_exit", "typing_burst", "devtools", "multi_session", "similarity_flag", "similarity_strong", "heartbeat", "spam",
] as const;
export type IntegrityEventType = (typeof INTEGRITY_EVENT_TYPES)[number];

export interface IntegrityEventInput {
  type: IntegrityEventType;
  meta?: { durationMs?: number; chars?: number; problemId?: string; source?: string };
}

export interface PenaltyRule {
  type: IntegrityEventType;
  label: string;
  /** What counts, in plain words (consent dialog). */
  detected: string;
  /** Base percent per event. */
  base: number;
  /** Extra percent per repeat of the same type (paste). */
  perRepeat?: number;
  /** For duration events: percent per 30 s after the first 5 s, and the per-event cap. */
  perThirtySec?: number;
  maxPerEvent?: number;
  /** Threshold in ms below which a duration event is ignored. */
  minDurationMs?: number;
  /** Only shown/applied in strict mode. */
  strictOnly?: boolean;
  /** Logged, never penalised. */
  logOnly?: boolean;
}

export const PENALTY_CAP = 60;

const STANDARD: PenaltyRule[] = [
  { type: "paste_external", label: "Pasting from outside", detected: "Text pasted into the editor that was not copied from the editor itself (the paste is reverted).", base: 8, perRepeat: 4 },
  { type: "copy_blocked", label: "Copying the problem or code", detected: "Copy or cut on the problem statement or the editor.", base: 2 },
  { type: "tab_hidden", label: "Switching tabs", detected: "The contest tab hidden for more than 5 seconds.", base: 3, perThirtySec: 1, maxPerEvent: 10, minDurationMs: 5000 },
  { type: "window_blur", label: "Leaving the window", detected: "Another window focused for more than 5 seconds.", base: 2, perThirtySec: 1, maxPerEvent: 8, minDurationMs: 5000 },
  { type: "fullscreen_exit", label: "Leaving full screen", detected: "Full screen exited when the room requires it.", base: 5 },
  { type: "typing_burst", label: "Code injected at once", detected: "More than 120 characters appearing in one edit that was not a paste, undo or snippet.", base: 8 },
  { type: "devtools", label: "Developer tools", detected: "Developer tools detected (low confidence — recorded, no penalty).", base: 0, strictOnly: true, logOnly: true },
  { type: "multi_session", label: "Second session", detected: "Heartbeats from two browser sessions within 30 seconds.", base: 5 },
  { type: "similarity_flag", label: "Similar code (after the contest)", detected: "Accepted code ≥ 80% similar to another participant's or to the reference solution.", base: 25 },
  { type: "similarity_strong", label: "Near-identical code (after the contest)", detected: "Accepted code ≥ 95% similar.", base: 50 },
  { type: "heartbeat", label: "Presence", detected: "A heartbeat every 20 seconds (never penalised).", base: 0, logOnly: true },
  { type: "spam", label: "Event flood", detected: "More than 40 events in a minute (rate-limited, recorded).", base: 0, logOnly: true },
];

const MULTIPLIER: Record<Strictness, number> = { lenient: 0.5, standard: 1, strict: 1.5 };

/** Rules visible for a strictness level (strict-only rules hidden elsewhere). */
export function rulesFor(strictness: Strictness): PenaltyRule[] {
  return STANDARD.filter((r) => !r.strictOnly || strictness === "strict").map((r) => ({
    ...r,
    base: Math.round(r.base * MULTIPLIER[strictness] * 10) / 10,
    perRepeat: r.perRepeat !== undefined ? Math.round(r.perRepeat * MULTIPLIER[strictness] * 10) / 10 : undefined,
    perThirtySec: r.perThirtySec !== undefined ? Math.round(r.perThirtySec * MULTIPLIER[strictness] * 10) / 10 : undefined,
    maxPerEvent: r.maxPerEvent !== undefined ? Math.round(r.maxPerEvent * MULTIPLIER[strictness] * 10) / 10 : undefined,
  }));
}

/** Percent for one event given how many events of that type happened before it. Null = event ignored. */
export function penaltyFor(ev: IntegrityEventInput, priorOfType: number, strictness: Strictness): number | null {
  const rule = rulesFor(strictness).find((r) => r.type === ev.type);
  if (!rule) return ev.type === "devtools" ? 0 : null;
  if (rule.logOnly) return 0;
  if (rule.minDurationMs !== undefined && (ev.meta?.durationMs ?? 0) < rule.minDurationMs) return null;
  let pct = rule.base;
  if (rule.perRepeat) pct += rule.perRepeat * priorOfType;
  if (rule.perThirtySec && ev.meta?.durationMs) {
    const extra = Math.floor(Math.max(0, ev.meta.durationMs - (rule.minDurationMs ?? 0)) / 30_000);
    pct += rule.perThirtySec * extra;
  }
  if (ev.type === "paste_external" && (ev.meta?.chars ?? 0) > 200) pct *= 1.5;
  if (rule.maxPerEvent !== undefined) pct = Math.min(pct, rule.maxPerEvent);
  return Math.round(pct * 10) / 10;
}

export interface ViolationSummary { count: number; byType: Partial<Record<IntegrityEventType, number>>; penaltyPct: number }

/** Folds a chronological list of events into the member's violation summary (cap applied). */
export function summarizeEvents(events: IntegrityEventInput[], strictness: Strictness): ViolationSummary {
  const byType: Partial<Record<IntegrityEventType, number>> = {};
  let total = 0, count = 0;
  for (const ev of events) {
    const prior = byType[ev.type] ?? 0;
    const pct = penaltyFor(ev, prior, strictness);
    if (pct === null) continue;
    byType[ev.type] = prior + 1;
    if (ev.type !== "heartbeat") count++;
    total += pct;
  }
  return { count, byType, penaltyPct: Math.min(PENALTY_CAP, Math.round(total * 10) / 10) };
}

export function isPenalised(type: IntegrityEventType): boolean {
  const r = STANDARD.find((x) => x.type === type);
  return !!r && !r.logOnly;
}
