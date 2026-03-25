import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { UserProfile, TopicSkill, ExperienceLevel, GoalType, PracticeState } from "@/types";
import { computeReviewQuality, updateSpacedRepetition } from "@/lib/spaced-repetition";

const PROFILES_COLLECTION = "userProfiles";
const USERNAMES_COLLECTION = "usernames";

// ── USERNAME GENERATION ──

const ADJECTIVES = [
  "algo", "byte", "code", "data", "dev", "fast", "grid", "hash",
  "loop", "meta", "nano", "node", "pixel", "query", "rust", "stack",
  "sync", "tech", "turbo", "void", "zen", "cyber", "logic", "flux",
  "delta", "sigma", "alpha", "omega", "neo", "quantum",
];

const NOUNS = [
  "ninja", "hawk", "wolf", "fox", "coder", "wizard", "knight", "sage",
  "pilot", "spark", "bolt", "blade", "craft", "drift", "forge", "pulse",
  "rider", "scout", "tiger", "viper", "archer", "chief", "racer", "storm",
  "shark", "eagle", "phoenix", "raven", "panther", "falcon",
];

export const RESERVED_USERNAMES = new Set([
  "dashboard", "login", "project", "projects", "profile", "privacy",
  "terms", "contact", "about", "settings", "api", "admin", "app",
  "auth", "signup", "register", "explore", "search", "help", "support",
  "new", "edit", "delete", "public", "static", "assets", "images",
]);

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  return `${adj}_${noun}_${num}`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z][a-z0-9_]{2,19}$/.test(username) && !RESERVED_USERNAMES.has(username);
}

async function claimUsername(username: string, userId: string): Promise<boolean> {
  const ref = adminDb.collection(USERNAMES_COLLECTION).doc(username);
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) throw new Error("taken");
      tx.set(ref, { userId });
    });
    return true;
  } catch {
    return false;
  }
}

async function generateAndClaimUsername(userId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generateUsername();
    const claimed = await claimUsername(candidate, userId);
    if (claimed) return candidate;
  }
  // Fallback: use userId suffix
  const fallback = `coder_${userId.slice(0, 8).toLowerCase()}`;
  await claimUsername(fallback, userId);
  return fallback;
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  if (!isValidUsername(username)) return false;
  const snap = await adminDb.collection(USERNAMES_COLLECTION).doc(username).get();
  return !snap.exists;
}

export async function updateUsername(
  userId: string,
  newUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUsername(newUsername)) {
    return { success: false, error: "Invalid username format" };
  }

  const profileRef = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) return { success: false, error: "Profile not found" };

  const data = profileSnap.data()!;
  const changesLeft = (data.usernameChangesLeft as number) ?? 0;
  if (changesLeft <= 0) {
    return { success: false, error: "No username changes remaining" };
  }

  const oldUsername = data.username as string;
  if (oldUsername === newUsername) {
    return { success: false, error: "Same as current username" };
  }

  // Atomically swap in a transaction
  const oldRef = adminDb.collection(USERNAMES_COLLECTION).doc(oldUsername);
  const newRef = adminDb.collection(USERNAMES_COLLECTION).doc(newUsername);

  try {
    await adminDb.runTransaction(async (tx) => {
      const newSnap = await tx.get(newRef);
      if (newSnap.exists) throw new Error("Username already taken");
      tx.delete(oldRef);
      tx.set(newRef, { userId });
      tx.update(profileRef, {
        username: newUsername,
        usernameChangesLeft: FieldValue.increment(-1),
      });
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update username";
    return { success: false, error: msg };
  }
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const usernameSnap = await adminDb.collection(USERNAMES_COLLECTION).doc(username).get();
  if (!usernameSnap.exists) return null;
  const { userId } = usernameSnap.data()!;
  const profileSnap = await adminDb.collection(PROFILES_COLLECTION).doc(userId).get();
  if (!profileSnap.exists) return null;
  return normalizeProfile(userId, profileSnap.data()!);
}

// ── MASTERY SCORE ──
// Composite 0-100 score per topic based on 6 weighted factors:
//   accuracy (30%), recency (15%), difficulty breadth (15%),
//   first-try rate (15%), time efficiency (15%), hint independence (10%)

export function computeMasteryScore(skill: TopicSkill): number {
  const total = skill.solved + skill.failed;
  if (total === 0) return 0;

  // 1. Accuracy: solved / total (0-1)
  const accuracy = skill.solved / total;

  // 2. Recency: decay based on days since last practice
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

  // 3. Difficulty breadth: bonus for solving across Easy/Medium/Hard
  const diffLevels = [skill.easyCount > 0, skill.mediumCount > 0, skill.hardCount > 0];
  const diffBreadth = diffLevels.filter(Boolean).length / 3;

  // 4. First-try rate
  const firstTryRate = skill.totalAttempts > 0
    ? skill.firstTrySuccesses / Math.max(1, skill.solved)
    : 0;

  // 5. Time efficiency: how fast vs expected (1.0 = on-pace, >1 = fast, <1 = slow)
  const timeEff = Math.min(1, Math.max(0, (skill.timeEfficiency || 1.0)));

  // 6. Hint independence: penalize heavy hint usage across attempts
  const avgHintsPerSolve = skill.solved > 0
    ? (skill.totalHintsUsed || 0) / skill.solved
    : 0;
  const hintIndependence = Math.max(0, Math.min(1, 1 - avgHintsPerSolve * 0.15));

  const score = Math.round(
    accuracy * 30 +
    recency * 15 +
    diffBreadth * 15 +
    firstTryRate * 15 +
    timeEff * 15 +
    hintIndependence * 10
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
    // Spaced repetition defaults
    nextReviewDate: "",
    interval: 1,
    easeFactor: 2.5,
    // Performance depth defaults
    timeEfficiency: 1.0,
    totalHintsUsed: 0,
    totalRunCount: 0,
  };
}

// ── PROFILE CRUD ──

export async function getOrCreateProfile(
  userId: string,
  defaults?: {
    experienceLevel?: ExperienceLevel;
    goalType?: GoalType;
    displayName?: string;
    email?: string;
    photoURL?: string;
  }
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
      if (defaults.displayName && !data.displayName) {
        updates.displayName = defaults.displayName;
      }
      if (defaults.email && !data.email) {
        updates.email = defaults.email;
      }
      if (defaults.photoURL && !data.photoURL) {
        updates.photoURL = defaults.photoURL;
      }
      if (Object.keys(updates).length > 0) {
        await ref.update(updates);
        Object.assign(data, updates);
      }
    }
    return normalizeProfile(userId, data);
  }

  const username = await generateAndClaimUsername(userId);

  const newProfile = {
    userId,
    username,
    usernameChangesLeft: 2,
    displayName: defaults?.displayName || "",
    email: defaults?.email || "",
    photoURL: defaults?.photoURL || "",
    bio: "",
    company: "",
    address: "",
    college: "",
    githubUrl: "",
    linkedinUrl: "",
    skills: [],
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
  return normalizeProfile(userId, newProfile);
}

function normalizeProfile(userId: string, data: Record<string, unknown>): UserProfile {
  return {
    userId,
    username: (data.username as string) || "",
    usernameChangesLeft: (data.usernameChangesLeft as number) ?? 2,
    displayName: (data.displayName as string) || "",
    email: (data.email as string) || "",
    photoURL: (data.photoURL as string) || "",
    bio: (data.bio as string) || "",
    company: (data.company as string) || "",
    address: (data.address as string) || "",
    college: (data.college as string) || "",
    githubUrl: (data.githubUrl as string) || "",
    linkedinUrl: (data.linkedinUrl as string) || "",
    skills: (data.skills as string[]) || [],
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

// Expected solve times per difficulty (seconds) — used for time efficiency
const EXPECTED_TIME: Record<string, number> = { Easy: 600, Medium: 1200, Hard: 2400 };
// Expected run-before-submit counts per difficulty — used for struggle index
const EXPECTED_RUNS: Record<string, number> = { Easy: 3, Medium: 5, Hard: 8 };

export interface SubmissionMeta {
  tags: string[];
  passed: boolean;
  difficulty: "Easy" | "Medium" | "Hard";
  hintsUsed: number;
  timeSpentSeconds: number;
  isFirstTry: boolean;
  runCount: number;  // how many Run clicks before this Submit
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

  // Compute time efficiency for this submission
  const expectedTime = EXPECTED_TIME[meta.difficulty] || 1200;
  const rawTimeEff = meta.timeSpentSeconds > 0
    ? expectedTime / meta.timeSpentSeconds
    : 1.0;
  const timeEfficiency = Math.max(0.3, Math.min(2.0, rawTimeEff));

  // Compute struggle index: runCount / expected runs
  const expectedRuns = EXPECTED_RUNS[meta.difficulty] || 5;
  const struggleIndex = meta.runCount > 0
    ? meta.runCount / expectedRuns
    : 1.0;

  for (const tag of meta.tags) {
    const key = tag.toLowerCase();
    if (!topicSkills[key]) {
      topicSkills[key] = emptyTopicSkill();
    }
    const skill = topicSkills[key];

    skill.totalAttempts += 1;
    skill.totalHintsUsed = (skill.totalHintsUsed || 0) + meta.hintsUsed;
    skill.totalRunCount = (skill.totalRunCount || 0) + (meta.runCount || 0);

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

    // Rolling average time efficiency
    const prevEffTotal = (skill.timeEfficiency || 1.0) * Math.max(1, skill.totalAttempts - 1);
    skill.timeEfficiency = (prevEffTotal + timeEfficiency) / skill.totalAttempts;

    skill.lastSeen = FieldValue.serverTimestamp();

    // Compute mastery with struggle adjustment
    let rawMastery = computeMasteryScore(skill as unknown as TopicSkill);
    if (meta.passed) {
      if (struggleIndex > 2.0) {
        // High struggle: user ran code many times — discount mastery gain
        rawMastery = Math.round(rawMastery * 0.85);
      } else if (struggleIndex < 0.5 && meta.isFirstTry) {
        // Low struggle + first try: boost mastery (max 100)
        rawMastery = Math.min(100, Math.round(rawMastery * 1.1));
      }
    }
    skill.masteryScore = rawMastery;

    // Spaced repetition: update review schedule based on quality
    const quality = computeReviewQuality(
      meta.passed,
      meta.hintsUsed,
      meta.isFirstTry,
      timeEfficiency
    );
    const sr = updateSpacedRepetition(skill as unknown as TopicSkill, quality);
    skill.interval = sr.interval;
    skill.easeFactor = sr.easeFactor;
    skill.nextReviewDate = sr.nextReviewDate;
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
    const timeEff = skill.timeEfficiency ? `${skill.timeEfficiency.toFixed(2)}x` : "N/A";
    const avgHints = skill.solved > 0 ? ((skill.totalHintsUsed || 0) / skill.solved).toFixed(1) : "0";
    const avgRuns = skill.solved > 0 ? ((skill.totalRunCount || 0) / skill.solved).toFixed(1) : "0";
    const nextReview = skill.nextReviewDate || "not scheduled";
    lines.push(
      `  - ${topic}: ${skill.solved}/${total} passed, mastery ${mastery}/100, ` +
      `first-try ${firstTryPct}%, avg time ${skill.avgTimeSeconds}s, ` +
      `speed ${timeEff}, avg hints/solve ${avgHints}, avg runs/solve ${avgRuns}, ` +
      `next review: ${nextReview}`
    );
  }

  const weak = getWeakTopics(profile);
  if (weak.length > 0) {
    lines.push(`Weak areas (mastery < 50): ${weak.join(", ")}`);
  }

  const { getDueTopics } = require("@/lib/spaced-repetition");
  const due = getDueTopics(profile);
  if (due.length > 0) {
    lines.push(`Topics due for spaced review: ${due.join(", ")}`);
  }

  const total = profile.totalSolved + profile.totalFailed;
  if (total > 0) {
    const rate = Math.round((profile.totalSolved / total) * 100);
    lines.push(`Overall success rate: ${rate}%`);
    lines.push(`Practice state: ${profile.practiceState}`);
  }

  return lines.join("\n");
}

// ── PER-TOPIC DIFFICULTY ──
// Uses topic-specific mastery + breadth + time efficiency instead of global pass rate

export function getTopicDifficulty(
  profile: UserProfile,
  topic: string,
): "Easy" | "Medium" | "Hard" {
  const skill = profile.topicSkills?.[topic.toLowerCase()];

  // Unpracticed topic: fall back to global recommendation
  if (!skill || skill.solved + skill.failed === 0) {
    return getRecommendedDifficulty(profile);
  }

  const mastery = skill.masteryScore ?? computeMasteryScore(skill);
  const timeEff = skill.timeEfficiency || 1.0;

  // If user is consistently slow on this topic, drop one difficulty level
  const slowPenalty = timeEff < 0.5;

  if (mastery >= 80 && skill.mediumCount >= 2 && !slowPenalty) {
    return "Hard";
  }
  if (mastery >= 55 && skill.easyCount >= 2) {
    return slowPenalty ? "Easy" : "Medium";
  }
  if (mastery < 40) {
    return "Easy";
  }

  return slowPenalty ? "Easy" : "Medium";
}

// ── PROFILE FIELD UPDATES (bio, company, etc.) ──

const ALLOWED_PROFILE_FIELDS = new Set([
  "bio", "company", "address", "college", "githubUrl", "linkedinUrl",
  "skills", "displayName", "photoURL",
]);

export async function updateProfileFields(
  userId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_PROFILE_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }
  if (Object.keys(sanitized).length === 0) return;
  const ref = adminDb.collection(PROFILES_COLLECTION).doc(userId);
  await ref.update(sanitized);
}
