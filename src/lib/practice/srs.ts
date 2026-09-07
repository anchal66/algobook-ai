/**
 * Spaced repetition v2 (Module 04 §3.3) — SM-2 with the v1 interval bug fixed (C10):
 * a topic that starts at interval 1 now grows 1 → 3 → round(3·ease) → … instead of staying at 1.
 * Pure functions; dates are UTC day keys (YYYY-MM-DD) like the rest of the app.
 */
import type { TopicSkill } from "@/lib/data/schema";

export interface SrsState { interval: number; ease: number; nextReview: string | null; reps: number }

export const DEFAULT_SRS: SrsState = { interval: 1, ease: 2.5, nextReview: null, reps: 0 };
export const MAX_INTERVAL_DAYS = 180;
export const MIN_EASE = 1.3;

/** 0 fail · 1 heavy help (≥3 hints, editorial, or efficiency < 0.4) · 2 moderate help · 3 clean first-try */
export function reviewQuality(o: { accepted: boolean; hintsUsed: number; isFirstTry: boolean; timeEfficiency: number; editorialViewed?: boolean }): 0 | 1 | 2 | 3 {
  if (!o.accepted) return 0;
  if (o.hintsUsed >= 3 || o.editorialViewed || o.timeEfficiency < 0.4) return 1;
  if (o.hintsUsed >= 1 || !o.isFirstTry || o.timeEfficiency < 0.7) return 2;
  return 3;
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

export function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const b = new Date(`${toKey}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Legacy entries (no `srs`) behave as brand-new cards due today. */
export function normalizeSrs(srs: Partial<SrsState> | undefined, today: string): SrsState {
  if (!srs) return { ...DEFAULT_SRS, nextReview: today };
  return {
    interval: srs.interval && srs.interval > 0 ? srs.interval : 1,
    ease: srs.ease && srs.ease >= MIN_EASE ? srs.ease : 2.5,
    nextReview: srs.nextReview ?? today,
    reps: srs.reps ?? 0,
  };
}

/**
 * q < 2: interval = 1, ease = max(1.3, ease − 0.2), reps = 0
 * q ≥ 2: reps += 1; interval = reps == 1 ? 1 : reps == 2 ? 3 : round(prevInterval · ease);
 *        ease += 0.1 − (3 − q)·(0.08 + (3 − q)·0.02); interval clamped to 1..180
 */
export function updateSrs(prev: SrsState, quality: 0 | 1 | 2 | 3, today: string): SrsState {
  if (quality < 2) {
    return { interval: 1, ease: Math.max(MIN_EASE, round2(prev.ease - 0.2)), reps: 0, nextReview: addDays(today, 1) };
  }
  const reps = prev.reps + 1;
  const ease = Math.max(MIN_EASE, round2(prev.ease + 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)));
  let interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(prev.interval * prev.ease);
  interval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, interval));
  return { interval, ease, reps, nextReview: addDays(today, interval) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 0–1: 0.6 · overdue (saturates at 14 days) + 0.4 · mastery deficit. */
export function topicUrgency(skill: TopicSkill, today: string): number {
  const srs = normalizeSrs(skill.srs, today);
  const overdueDays = Math.max(0, daysBetween(srs.nextReview ?? today, today));
  const overdue = Math.min(1, overdueDays / 14);
  const deficit = Math.max(0, 1 - skill.mastery / 100);
  return overdue * 0.6 + deficit * 0.4;
}

export interface DueTopic { topic: string; urgency: number; overdueDays: number }

/** Practiced topics whose `nextReview` ≤ today, most urgent first. */
export function getDueTopics(topicSkills: Record<string, TopicSkill>, today: string): DueTopic[] {
  const out: DueTopic[] = [];
  for (const [topic, skill] of Object.entries(topicSkills)) {
    if (skill.solved === 0) continue;
    const srs = normalizeSrs(skill.srs, today);
    if ((srs.nextReview ?? today) <= today) {
      out.push({ topic, urgency: topicUrgency(skill, today), overdueDays: Math.max(0, daysBetween(srs.nextReview ?? today, today)) });
    }
  }
  return out.sort((a, b) => b.urgency - a.urgency);
}
