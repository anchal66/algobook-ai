/** Test fixtures for the practice engine (not a test file). */
import { Timestamp } from "firebase-admin/firestore";
import { UserSchema, type TopicSkill, type User } from "@/lib/data/schema";
import { emptyTopicSkill } from "@/lib/practice/mastery";

export const TODAY = "2026-09-08";
export const NOW = new Date("2026-09-08T10:00:00.000Z");

export function skill(over: Partial<TopicSkill> = {}): TopicSkill {
  return { ...emptyTopicSkill(), ...over, srs: { ...emptyTopicSkill().srs, ...(over.srs ?? {}) } };
}

/** A practised skill: `solved` clean solves out of `attempts`, with mastery set explicitly. */
export function practiced(mastery: number, over: Partial<TopicSkill> = {}): TopicSkill {
  const solved = over.solved ?? 3;
  const attempts = over.attempts ?? solved + 1;
  return skill({ solved, attempts, failed: attempts - solved, easy: over.easy ?? solved, firstTrySuccesses: over.firstTrySuccesses ?? solved, mastery, srs: { interval: 8, ease: 2.6, nextReview: "2026-12-01", reps: 3 }, ...over });
}

export type UserOverrides = Partial<Omit<User, "stats" | "calibration">> & { stats?: Partial<User["stats"]>; calibration?: Partial<User["calibration"]> };

export function makeUser(over: UserOverrides = {}): User {
  const base = UserSchema.parse({ username: "tester", createdAt: Timestamp.fromDate(NOW), updatedAt: Timestamp.fromDate(NOW) });
  return {
    ...base,
    ...over,
    stats: { ...base.stats, ...(over.stats ?? {}) },
    calibration: { ...base.calibration, ...(over.calibration ?? {}) },
    topicSkills: over.topicSkills ?? {},
  };
}

/** Raw Firestore-shaped document (what `applySubmissionToStats` receives). */
export function userDoc(over: UserOverrides = {}): Record<string, unknown> {
  return { ...makeUser(over) };
}
