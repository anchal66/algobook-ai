import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { todayKey, type Difficulty } from "@/lib/data/schema";

/**
 * STUB (Module 01). Updates only the user's counters, streak and XP after a submission.
 * Module 04 replaces this with the real mastery / SRS / rating engine — keep the signature.
 */
export interface SubmissionOutcome {
  accepted: boolean;
  /** First accepted submission for this problem by this user. */
  firstAccept: boolean;
  difficulty: Difficulty;
  tags: string[];
  timeSpentSec: number;
}

export const XP_FIRST_ACCEPT: Record<Difficulty, number> = { Easy: 10, Medium: 20, Hard: 40 };

export function xpFor(o: SubmissionOutcome): number {
  if (o.accepted && o.firstAccept) return XP_FIRST_ACCEPT[o.difficulty];
  return o.accepted ? 2 : 1;
}

function yesterdayKey(today: string): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return todayKey(d);
}

/** Applies counters inside the caller's transaction. Returns the XP awarded. */
export function applySubmissionToStatsInTx(
  tx: FirebaseFirestore.Transaction,
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
  o: SubmissionOutcome,
): number {
  const stats = (userData.stats ?? {}) as Record<string, number | string>;
  const today = todayKey();
  const xp = xpFor(o);
  const updates: Record<string, unknown> = { updatedAt: Timestamp.now(), "stats.xp": FieldValue.increment(xp) };

  if (o.accepted) updates["stats.totalSolved"] = FieldValue.increment(1);
  else updates["stats.totalFailed"] = FieldValue.increment(1);
  if (o.accepted && o.firstAccept) {
    updates[`stats.${o.difficulty.toLowerCase()}`] = FieldValue.increment(1);
    updates["stats.score"] = FieldValue.increment(XP_FIRST_ACCEPT[o.difficulty]);
  }

  const lastActive = (stats.lastActiveDate as string) ?? "";
  if (lastActive !== today) {
    const current = lastActive === yesterdayKey(today) ? ((stats.currentStreak as number) ?? 0) + 1 : 1;
    updates["stats.currentStreak"] = current;
    updates["stats.longestStreak"] = Math.max((stats.longestStreak as number) ?? 0, current);
    updates["stats.lastActiveDate"] = today;
  }
  const newXp = ((stats.xp as number) ?? 0) + xp;
  updates["stats.level"] = 1 + Math.floor(Math.sqrt(newXp / 50));
  tx.update(userRef, updates);
  return xp;
}
