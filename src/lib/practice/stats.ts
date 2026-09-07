/**
 * Stats application on submit (Module 04 §3.7). Replaces the Module 01 stub.
 *
 * `applySubmissionToStats` is pure: it takes the current user document + achievements doc and
 * returns the full replacement values plus what happened (xp, rating, achievements). The `InTx`
 * wrapper writes them inside `/api/submit`'s transaction. Idempotent per submission id via
 * `users.lastAppliedSubmissionId`.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { UserSchema, type Difficulty, type Language, type PracticeState, type TopicSkill, type User, type UserStats } from "@/lib/data/schema";
import { normalizeTags } from "@/lib/practice/topics";
import { applyOutcomeToSkill, averageMastery, emptyTopicSkill, timeEfficiencyFor } from "@/lib/practice/mastery";
import { addDays, daysBetween, dayKey, normalizeSrs, reviewQuality, updateSrs } from "@/lib/practice/srs";
import { applyRating, ratedOutcomeFor, type RatingUpdate } from "@/lib/practice/rating";
import { CALIBRATION_STEPS, computePracticeState } from "@/lib/practice/state";
import { evaluateAchievements } from "@/lib/practice/achievements";

export const XP_FIRST_ACCEPT: Record<Difficulty, number> = { Easy: 10, Medium: 25, Hard: 50 };
export const XP_PER_ATTEMPT = 2;
export const XP_CLEAN_BONUS = 5;
export const XP_DAILY_BONUS = 20;
export const XP_EDITORIAL_FACTOR = 0.7;
export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EVERY_DAYS = 7;

export interface SubmissionOutcome {
  submissionId: string;
  problemId: string;
  accepted: boolean;
  /** First accepted submission for this problem by this user. */
  firstAccept: boolean;
  /** The user already had an AC on this problem before this submission. */
  alreadyAccepted: boolean;
  attemptNumber: number;
  difficulty: Difficulty;
  tags: string[];
  language: Language;
  timeSpentSec: number;
  hintsUsed: number;
  runCount: number;
  editorialViewed: boolean;
  /** Current Elo of the problem (`problems.rating`). */
  problemRating: number;
  /** This is today's daily challenge and the daily bonus has not been awarded yet. */
  isDailyChallenge: boolean;
  /** Client-reported local hour (0–23) for the night-owl achievement; UTC when absent. */
  localHour?: number;
  /** Company whose template list is completed by this submission. */
  templateCompleted?: string | null;
  now?: Date;
}

export interface StatsResult {
  applied: boolean;
  xpEarned: number;
  rating: (RatingUpdate & { before: number; problemBefore: number }) | null;
  newlyUnlocked: string[];
  streakFreezeUsed: number;
  stats: UserStats;
  topicSkills: Record<string, TopicSkill>;
  practiceState: PracticeState;
  calibration: User["calibration"];
  /** Firestore update map for `users/{uid}`. */
  updates: Record<string, unknown>;
}

export function xpFor(o: Pick<SubmissionOutcome, "accepted" | "firstAccept" | "difficulty" | "hintsUsed" | "editorialViewed" | "isDailyChallenge"> & { isFirstTry: boolean }): number {
  let xp = XP_PER_ATTEMPT;
  if (o.accepted && o.firstAccept) xp += XP_FIRST_ACCEPT[o.difficulty];
  if (o.accepted && o.isFirstTry && o.hintsUsed === 0) xp += XP_CLEAN_BONUS;
  if (o.accepted && o.isDailyChallenge) xp += XP_DAILY_BONUS;
  if (o.editorialViewed) xp = xp * XP_EDITORIAL_FACTOR;
  return Math.round(xp);
}

export function levelFor(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}

/** `solvedWeighted·2 + currentStreak·5 + avgMastery·0.5 + longestStreak·2 + rating/50` with solvedWeighted = easy + 2·medium + 3·hard. */
export function scoreFor(stats: Pick<UserStats, "easy" | "medium" | "hard" | "currentStreak" | "longestStreak" | "rating">, avgMastery: number): number {
  const solvedWeighted = stats.easy + 2 * stats.medium + 3 * stats.hard;
  return Math.round(solvedWeighted * 2 + stats.currentStreak * 5 + avgMastery * 0.5 + stats.longestStreak * 2 + stats.rating / 50);
}

export interface StreakUpdate { currentStreak: number; longestStreak: number; streakFreezes: number; freezesUsed: number; freezeEarned: boolean }

/**
 * UTC-day streaks. A missed day consumes a banked freeze instead of resetting; freezes are earned
 * one per 7 consecutive days (max 2). Same-day activity leaves the streak untouched.
 */
export function applyStreak(stats: Pick<UserStats, "currentStreak" | "longestStreak" | "lastActiveDate" | "streakFreezes">, today: string): StreakUpdate {
  const last = stats.lastActiveDate;
  let current = stats.currentStreak;
  let freezes = stats.streakFreezes ?? 0;
  let freezesUsed = 0;
  let freezeEarned = false;
  if (last !== today) {
    const gap = last ? daysBetween(last, today) : Infinity;
    const missed = Number.isFinite(gap) ? Math.max(0, gap - 1) : Infinity;
    if (gap === 1) {
      current += 1;
    } else if (missed > 0 && missed <= freezes) {
      freezes -= missed;
      freezesUsed = missed;
      current += 1;
    } else {
      current = 1;
    }
    if (current > 0 && current % FREEZE_EVERY_DAYS === 0 && freezes < MAX_STREAK_FREEZES) {
      freezes += 1;
      freezeEarned = true;
    }
  }
  return { currentStreak: current, longestStreak: Math.max(stats.longestStreak, current), streakFreezes: freezes, freezesUsed, freezeEarned };
}

function skillTopics(tags: string[]): string[] {
  const canon = normalizeTags(tags);
  if (canon.length) return canon;
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Pure core. `userData` is the raw `users/{uid}` document; `unlocked` the ids already in `achievements/{uid}`.
 */
export function applySubmissionToStats(userData: FirebaseFirestore.DocumentData, unlocked: Iterable<string>, o: SubmissionOutcome): StatsResult {
  const now = o.now ?? new Date();
  const today = dayKey(now);
  const user = UserSchema.parse({ ...userData, createdAt: userData.createdAt ?? Timestamp.fromDate(now), updatedAt: userData.updatedAt ?? Timestamp.fromDate(now) });

  const noop = (): StatsResult => ({
    applied: false, xpEarned: 0, rating: null, newlyUnlocked: [], streakFreezeUsed: 0,
    stats: user.stats, topicSkills: user.topicSkills, practiceState: user.practiceState, calibration: user.calibration, updates: {},
  });
  if (user.lastAppliedSubmissionId === o.submissionId) return noop();

  const isFirstTry = o.accepted && o.attemptNumber === 1;
  const stats: UserStats = { ...user.stats, languagesAccepted: [...user.stats.languagesAccepted] };
  const topicSkills: Record<string, TopicSkill> = { ...user.topicSkills };

  // 1. topic skills: counters, mastery, SRS
  const timeEfficiency = timeEfficiencyFor(o.difficulty, o.timeSpentSec);
  const quality = reviewQuality({ accepted: o.accepted, hintsUsed: o.hintsUsed, isFirstTry, timeEfficiency, editorialViewed: o.editorialViewed });
  for (const topic of skillTopics(o.tags)) {
    const prev = topicSkills[topic] ?? emptyTopicSkill();
    const next = applyOutcomeToSkill(prev, {
      accepted: o.accepted, difficulty: o.difficulty, isFirstTry, hintsUsed: o.hintsUsed, runCount: o.runCount,
      editorialViewed: o.editorialViewed, timeSpentSec: o.timeSpentSec, firstAccept: o.firstAccept,
    });
    next.srs = updateSrs(normalizeSrs(prev.srs, today), quality, today);
    next.lastSeen = Timestamp.fromDate(now);
    topicSkills[topic] = next;
  }

  // 2. counters, streak, xp, level
  if (o.accepted) stats.totalSolved += 1; else stats.totalFailed += 1;
  if (o.accepted && o.firstAccept) {
    if (o.difficulty === "Easy") stats.easy += 1; else if (o.difficulty === "Medium") stats.medium += 1; else stats.hard += 1;
  }
  if (o.accepted && o.hintsUsed === 0) stats.noHintSolves += 1;
  if (o.accepted && !stats.languagesAccepted.includes(o.language)) stats.languagesAccepted.push(o.language);
  if (o.accepted && o.isDailyChallenge) stats.dailySolved += 1;
  const streak = applyStreak(stats, today);
  stats.currentStreak = streak.currentStreak;
  stats.longestStreak = streak.longestStreak;
  stats.streakFreezes = streak.streakFreezes;
  stats.lastActiveDate = today;
  const xpEarned = xpFor({ accepted: o.accepted, firstAccept: o.firstAccept, difficulty: o.difficulty, isFirstTry, hintsUsed: o.hintsUsed, editorialViewed: o.editorialViewed, isDailyChallenge: o.isDailyChallenge });
  stats.xp += xpEarned;
  stats.level = levelFor(stats.xp);

  // 3. rating (first-attempt outcomes only)
  let rating: StatsResult["rating"] = null;
  const outcome = ratedOutcomeFor({ accepted: o.accepted, attemptNumber: o.attemptNumber, alreadyAccepted: o.alreadyAccepted });
  if (outcome) {
    const upd = applyRating(stats.rating, o.problemRating, stats.ratedSolves, outcome);
    rating = { ...upd, before: stats.rating, problemBefore: o.problemRating };
    stats.rating = upd.user;
    stats.ratedSolves += 1;
  }
  stats.score = scoreFor(stats, averageMastery(topicSkills));

  // 4. calibration step
  const calibration = { ...user.calibration };
  if (!calibration.complete && o.accepted) {
    calibration.step = Math.min(CALIBRATION_STEPS, calibration.step + 1);
    if (calibration.step >= CALIBRATION_STEPS) calibration.complete = true;
  }

  // 5. practice state + achievements over the updated document
  const updatedUser = { ...user, stats, topicSkills, calibration };
  const practiceState = computePracticeState(updatedUser, today);
  const newlyUnlocked = evaluateAchievements({
    stats, topicSkills,
    submission: {
      accepted: o.accepted, firstAccept: o.firstAccept, difficulty: o.difficulty, language: o.language, timeSpentSec: o.timeSpentSec,
      hintsUsed: o.hintsUsed, isFirstTry, localHour: o.localHour ?? now.getUTCHours(),
    },
    templateCompleted: o.templateCompleted ?? null,
  }, unlocked);

  const updates: Record<string, unknown> = {
    stats, topicSkills, calibration, practiceState,
    lastAppliedSubmissionId: o.submissionId,
    updatedAt: Timestamp.fromDate(now),
  };
  return { applied: true, xpEarned, rating, newlyUnlocked, streakFreezeUsed: streak.freezesUsed, stats, topicSkills, practiceState, calibration, updates };
}

export interface TxRefs {
  userRef: FirebaseFirestore.DocumentReference;
  userData: FirebaseFirestore.DocumentData;
  achievementsRef: FirebaseFirestore.DocumentReference;
  achievementsData: FirebaseFirestore.DocumentData | null;
  problemRef: FirebaseFirestore.DocumentReference;
}

/** Applies the engine inside the caller's transaction (user doc, problem rating, achievements). */
export function applySubmissionToStatsInTx(tx: FirebaseFirestore.Transaction, refs: TxRefs, o: SubmissionOutcome): StatsResult {
  const unlocked = ((refs.achievementsData?.unlocked as { id: string }[] | undefined) ?? []).map((u) => u.id);
  const result = applySubmissionToStats(refs.userData, unlocked, o);
  if (!result.applied) return result;
  tx.update(refs.userRef, result.updates);
  if (result.rating) tx.update(refs.problemRef, { rating: result.rating.problem });
  if (result.newlyUnlocked.length) {
    const at = Timestamp.now();
    tx.set(refs.achievementsRef, { unlocked: FieldValue.arrayUnion(...result.newlyUnlocked.map((id) => ({ id, at }))) }, { merge: true });
  }
  return result;
}

/** Streak preview used by `/api/me` style reads: whether yesterday was missed and a freeze would cover it. */
export function streakStatus(stats: Pick<UserStats, "currentStreak" | "lastActiveDate" | "streakFreezes">, today: string): { active: boolean; atRisk: boolean; coveredByFreeze: boolean } {
  if (!stats.lastActiveDate) return { active: false, atRisk: false, coveredByFreeze: false };
  const gap = daysBetween(stats.lastActiveDate, today);
  if (gap <= 0) return { active: true, atRisk: false, coveredByFreeze: false };
  if (gap === 1) return { active: true, atRisk: true, coveredByFreeze: false };
  const missed = gap - 1;
  return { active: missed <= (stats.streakFreezes ?? 0), atRisk: true, coveredByFreeze: missed <= (stats.streakFreezes ?? 0) };
}

export { addDays };
