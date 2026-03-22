import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { UserProfile, TopicSkill, ExperienceLevel, GoalType, PracticeState } from "@/types";

const PROFILES_COLLECTION = "userProfiles";

// ── MASTERY SCORE ──
// Composite 0-100 score per topic based on:
//   accuracy (40%), recency (20%), difficulty breadth (20%), first-try rate (20%)

export function computeMasteryScore(skill: TopicSkill): number {
  const total = skill.solved + skill.failed;
  if (total === 0) return 0;

  // Accuracy: solved / total (0-1)
  const accuracy = skill.solved / total;

  // Recency: decay based on days since last practice
  let recency = 0;
  if (skill.lastSeen) {
    const lastSeenMs = typeof skill.lastSeen === "object" && "toDate" in skill.lastSeen
      ? (skill.lastSeen as { toDate: () => Date }).toDate().getTime()
      : typeof skill.lastSeen === "object" && "seconds" in skill.lastSeen
        ? (skill.lastSeen as { seconds: number }).seconds * 1000
        : Date.now();
    const daysSince = (Date.now() - lastSeenMs) / (1000 * 60 * 60 * 24);
    recency = Math.max(0, 1 - daysSince / 30); // decays to 0 over 30 days
  }

  // Difficulty breadth: bonus for solving across Easy/Medium/Hard
  const diffLevels = [skill.easyCount > 0, skill.mediumCount > 0, skill.hardCount > 0];
  const diffBreadth = diffLevels.filter(Boolean).length / 3;

  // First-try rate
  const firstTryRate = skill.totalAttempts > 0
    ? skill.firstTrySuccesses / Math.max(1, skill.solved)
    : 0;

  const score = Math.round(
    accuracy * 40 + recency * 20 + diffBreadth * 20 + firstTryRate * 20
  );

  return Math.min(100, Math.max(0, score));
}

function emptyTopicSkill(): Omit<TopicSkill, "lastSeen"> & { lastSeen: unknown } {
  return {
    solved: 0,
    failed: 0,
    lastSeen: FieldValue.serverTimestamp(),
    easyCount: 0,
    mediumCount: 0,
    hardCount: 0,
    totalAttempts: 0,
    firstTrySuccesses: 0,
    avgTimeSeconds: 0,
    masteryScore: 0,
  };
}

// ── PROFILE CRUD ──

export async function getOrCreateProfile(
  userId: string,
  defaults?: { experienceLevel?: ExperienceLevel; goalType?: GoalType }
): Promise<UserProfile> {
  const ref = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data()!;
    if (defaults) {
      const updates: Record<string, unknown> = {};
      if (defaults.experienceLevel && data.experienceLevel !== defaults.experienceLevel) {
        updates.experienceLevel = defaults.experienceLevel;
      }
      if (defaults.goalType && data.goalType !== defaults.goalType) {
        updates.goalType = defaults.goalType;
      }
      if (Object.keys(updates).length > 0) {
        await ref.update(updates);
        Object.assign(data, updates);
      }
    }
    return normalizeProfile(userId, data);
  }

  const newProfile = {
    userId,
    experienceLevel: defaults?.experienceLevel || "intermediate",
    goalType: defaults?.goalType || "daily-practice",
    practiceState: "learning" as PracticeState,
    topicSkills: {},
    totalSolved: 0,
    totalFailed: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    calibrationComplete: true,
    calibrationStep: 3,
  };

  await ref.set(newProfile);
  return newProfile;
}

function normalizeProfile(userId: string, data: Record<string, unknown>): UserProfile {
  return {
    userId,
    experienceLevel: (data.experienceLevel as ExperienceLevel) || "intermediate",
    goalType: (data.goalType as GoalType) || "daily-practice",
    practiceState: (data.practiceState as PracticeState) || "learning",
    topicSkills: (data.topicSkills as Record<string, TopicSkill>) || {},
    totalSolved: (data.totalSolved as number) || 0,
    totalFailed: (data.totalFailed as number) || 0,
    currentStreak: (data.currentStreak as number) || 0,
    longestStreak: (data.longestStreak as number) || 0,
    lastActiveDate: (data.lastActiveDate as string) || "",
    calibrationComplete: data.calibrationComplete !== false,
    calibrationStep: (data.calibrationStep as number) ?? 3,
  };
}

// ── PROFILE UPDATE AFTER SUBMISSION ──

export interface SubmissionMeta {
  tags: string[];
  passed: boolean;
  difficulty: "Easy" | "Medium" | "Hard";
  hintsUsed: number;
  timeSpentSeconds: number;
  isFirstTry: boolean;
}

export async function updateProfileAfterSubmission(
  userId: string,
  meta: SubmissionMeta
): Promise<void> {
  const ref = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  let snap = await ref.get();

  if (!snap.exists) {
    await getOrCreateProfile(userId);
    snap = await ref.get();
  }

  const data = snap.data()!;
  const topicSkills: Record<string, ReturnType<typeof emptyTopicSkill>> =
    data.topicSkills || {};

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  for (const tag of meta.tags) {
    const key = tag.toLowerCase();
    if (!topicSkills[key]) {
      topicSkills[key] = emptyTopicSkill();
    }
    const skill = topicSkills[key];

    skill.totalAttempts += 1;

    if (meta.passed) {
      skill.solved += 1;
      if (meta.isFirstTry) skill.firstTrySuccesses += 1;
      if (meta.difficulty === "Easy") skill.easyCount += 1;
      else if (meta.difficulty === "Medium") skill.mediumCount += 1;
      else skill.hardCount += 1;
    } else {
      skill.failed += 1;
    }

    // Rolling average time
    const prevTotal = skill.avgTimeSeconds * Math.max(1, skill.totalAttempts - 1);
    skill.avgTimeSeconds = Math.round((prevTotal + meta.timeSpentSeconds) / skill.totalAttempts);

    skill.lastSeen = FieldValue.serverTimestamp();
    skill.masteryScore = computeMasteryScore(skill as unknown as TopicSkill);
  }

  // Streak logic
  let currentStreak = data.currentStreak || 0;
  let longestStreak = data.longestStreak || 0;
  const lastActiveDate: string = data.lastActiveDate || "";

  if (lastActiveDate !== todayStr) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    currentStreak = lastActiveDate === yesterdayStr ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  // Advance calibration for returning users
  let calibrationStep = data.calibrationStep ?? 3;
  let calibrationComplete = data.calibrationComplete !== false;
  if (!calibrationComplete && meta.passed) {
    calibrationStep = Math.min(calibrationStep + 1, 3);
    if (calibrationStep >= 3) calibrationComplete = true;
  }

  const updates: Record<string, unknown> = {
    topicSkills,
    currentStreak,
    longestStreak,
    lastActiveDate: todayStr,
    calibrationStep,
    calibrationComplete,
  };

  if (meta.passed) {
    updates.totalSolved = FieldValue.increment(1);
  } else {
    updates.totalFailed = FieldValue.increment(1);
  }

  await ref.update(updates);
}

// ── ANALYTICS HELPERS ──

export function getWeakTopics(profile: UserProfile): string[] {
  const weak: { topic: string; mastery: number }[] = [];

  for (const [topic, skill] of Object.entries(profile.topicSkills || {})) {
    const total = skill.solved + skill.failed;
    if (total === 0) continue;
    const mastery = skill.masteryScore ?? computeMasteryScore(skill);
    if (mastery < 50) {
      weak.push({ topic, mastery });
    }
  }

  weak.sort((a, b) => a.mastery - b.mastery);
  return weak.map((w) => w.topic);
}

export function getStaleTopics(profile: UserProfile, staleDays = 14): string[] {
  const stale: string[] = [];
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;

  for (const [topic, skill] of Object.entries(profile.topicSkills || {})) {
    if (!skill.lastSeen) continue;
    const lastMs = typeof skill.lastSeen === "object" && "seconds" in skill.lastSeen
      ? (skill.lastSeen as { seconds: number }).seconds * 1000
      : Date.now();
    if (lastMs < cutoff && skill.solved > 0) {
      stale.push(topic);
    }
  }

  return stale;
}

export function getRecommendedDifficulty(profile: UserProfile): "Easy" | "Medium" | "Hard" {
  const total = profile.totalSolved + profile.totalFailed;
  if (total === 0) {
    return profile.experienceLevel === "advanced" ? "Medium" : "Easy";
  }

  const passRate = profile.totalSolved / total;

  if (profile.experienceLevel === "beginner") {
    return passRate > 0.7 && total >= 5 ? "Medium" : "Easy";
  }
  if (profile.experienceLevel === "advanced") {
    if (passRate > 0.7 && total >= 5) return "Hard";
    return "Medium";
  }
  if (passRate > 0.75 && total >= 8) return "Hard";
  if (passRate > 0.5) return "Medium";
  return "Easy";
}

export function buildPerformanceSummary(profile: UserProfile): string {
  const lines: string[] = [];
  const entries = Object.entries(profile.topicSkills || {});

  if (entries.length === 0) {
    lines.push("No topics practiced yet (new user).");
    return lines.join("\n");
  }

  lines.push("Topics practiced:");
  for (const [topic, skill] of entries) {
    const total = skill.solved + skill.failed;
    const mastery = skill.masteryScore ?? computeMasteryScore(skill);
    const firstTryPct = skill.totalAttempts > 0
      ? Math.round((skill.firstTrySuccesses / Math.max(1, skill.solved)) * 100)
      : 0;
    lines.push(
      `  - ${topic}: ${skill.solved}/${total} passed, mastery ${mastery}/100, ` +
      `first-try rate ${firstTryPct}%, avg time ${skill.avgTimeSeconds}s`
    );
  }

  const weak = getWeakTopics(profile);
  if (weak.length > 0) {
    lines.push(`Weak areas (mastery < 50): ${weak.join(", ")}`);
  }

  const stale = getStaleTopics(profile);
  if (stale.length > 0) {
    lines.push(`Stale topics (not practiced in 14+ days): ${stale.join(", ")}`);
  }

  const total = profile.totalSolved + profile.totalFailed;
  if (total > 0) {
    const rate = Math.round((profile.totalSolved / total) * 100);
    lines.push(`Overall success rate: ${rate}%`);
    lines.push(`Practice state: ${profile.practiceState}`);
  }

  return lines.join("\n");
}
