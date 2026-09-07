/** Pure calendar helpers shared by the leaderboard, activity and daily-challenge code (UTC day keys). */
import type { Difficulty } from "@/lib/data/schema";
import { daysBetween } from "@/lib/practice/srs";

/** ISO week key `YYYY-Www` plus its Monday..Sunday date range, for a UTC day key. */
export function isoWeekOf(dayKey: string): { week: string; from: string; to: string } {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dow + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
  const weekNo = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return { week: `${isoYear}-W${String(weekNo).padStart(2, "0")}`, from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

/** Longest run of consecutive active days among the given day keys. */
export function longestRun(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Daily challenge difficulty rotates Easy / Medium / Medium / Hard by weekday (Module 04 §3.11). */
export const DAILY_ROTATION: Difficulty[] = ["Easy", "Medium", "Medium", "Hard"];

export function difficultyForDate(date: string): Difficulty {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return DAILY_ROTATION[dow % DAILY_ROTATION.length];
}
