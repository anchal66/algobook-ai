/**
 * Achievements (Module 04 §3.8). A static catalog of pure conditions evaluated after each
 * submission over the **updated** user document; ids are stable and stored in `achievements/{uid}`.
 */
import type { Difficulty, Language, UserStats, TopicSkill } from "@/lib/data/schema";
import { CORE_TOPICS, TOPIC_META, type CoreTopic } from "@/lib/practice/topics";
import { EXPECTED_TIME, MASTERED_THRESHOLD } from "@/lib/practice/mastery";

/** Company templates (mirrors `TEMPLATE_META` in `lib/data/templates.ts`, kept here so this module stays pure). */
export const TEMPLATE_COMPANIES: Readonly<Record<string, string>> = { amazon: "Amazon", apple: "Apple", google: "Google", meta: "Meta", microsoft: "Microsoft", uber: "Uber" };

export interface AchievementContext {
  stats: UserStats;
  topicSkills: Record<string, TopicSkill>;
  submission: {
    accepted: boolean;
    firstAccept: boolean;
    difficulty: Difficulty;
    language: Language;
    timeSpentSec: number;
    hintsUsed: number;
    isFirstTry: boolean;
    /** Hour 0–23 in the user's local time when provided by the client; UTC otherwise. */
    localHour: number;
  };
  /** Company whose template list was completed by this submission, if any. */
  templateCompleted: string | null;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** lucide icon name */
  icon: string;
  condition: (ctx: AchievementContext) => boolean;
}

const streak = (n: number) => (ctx: AchievementContext) => ctx.stats.currentStreak >= n || ctx.stats.longestStreak >= n;

const base: AchievementDef[] = [
  { id: "first_ac", name: "First Blood", description: "Your first accepted solution.", icon: "Sparkles", condition: (c) => c.stats.totalSolved >= 1 },
  { id: "streak_7", name: "One Week Strong", description: "A 7-day practice streak.", icon: "Flame", condition: streak(7) },
  { id: "streak_30", name: "Habit Formed", description: "A 30-day practice streak.", icon: "Flame", condition: streak(30) },
  { id: "streak_100", name: "Centurion", description: "A 100-day practice streak.", icon: "Trophy", condition: streak(100) },
  { id: "easy_10", name: "Warmed Up", description: "10 Easy problems solved.", icon: "Leaf", condition: (c) => c.stats.easy >= 10 },
  { id: "medium_25", name: "Getting Serious", description: "25 Medium problems solved.", icon: "Mountain", condition: (c) => c.stats.medium >= 25 },
  { id: "hard_10", name: "Hard Mode", description: "10 Hard problems solved.", icon: "Skull", condition: (c) => c.stats.hard >= 10 },
  {
    id: "night_owl", name: "Night Owl", description: "An accepted solution between midnight and 4 am.", icon: "Moon",
    condition: (c) => c.submission.accepted && c.submission.localHour >= 0 && c.submission.localHour < 4,
  },
  {
    id: "speedrunner", name: "Speedrunner", description: "Solved a problem in under a quarter of the expected time.", icon: "Zap",
    condition: (c) => c.submission.accepted && c.submission.timeSpentSec > 0 && c.submission.timeSpentSec < 0.25 * EXPECTED_TIME[c.submission.difficulty],
  },
  { id: "no_hints_20", name: "Self-Reliant", description: "20 problems solved without a single hint.", icon: "ShieldCheck", condition: (c) => c.stats.noHintSolves >= 20 },
  { id: "polyglot", name: "Polyglot", description: "Accepted solutions in two different languages.", icon: "Languages", condition: (c) => c.stats.languagesAccepted.length >= 2 },
  { id: "rating_1500", name: "Rated 1500", description: "Reached a 1500 rating.", icon: "TrendingUp", condition: (c) => c.stats.rating >= 1500 },
  { id: "rating_1800", name: "Rated 1800", description: "Reached an 1800 rating.", icon: "Crown", condition: (c) => c.stats.rating >= 1800 },
  { id: "daily_10", name: "Daily Devotee", description: "10 daily challenges solved.", icon: "CalendarCheck", condition: (c) => c.stats.dailySolved >= 10 },
];

const topicMasters: AchievementDef[] = CORE_TOPICS.map((t: CoreTopic) => ({
  id: `topic_master_${t.replace(/\s+/g, "_")}`,
  name: `${TOPIC_META[t].name} Master`,
  description: `Reached ${MASTERED_THRESHOLD}% mastery in ${TOPIC_META[t].name.toLowerCase()}.`,
  icon: TOPIC_META[t].icon,
  condition: (c) => (c.topicSkills[t]?.mastery ?? 0) >= MASTERED_THRESHOLD,
}));

const templateCompletes: AchievementDef[] = Object.entries(TEMPLATE_COMPANIES).map(([company, label]) => ({
  id: `template_complete_${company}`,
  name: `${label} List Complete`,
  description: `Finished every problem on the ${label} interview list.`,
  icon: "Building2",
  condition: (c) => c.templateCompleted === company,
}));

export const ACHIEVEMENTS: readonly AchievementDef[] = [...base, ...topicMasters, ...templateCompletes];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): AchievementDef | undefined {
  return BY_ID.get(id);
}

/** Ids newly satisfied by `ctx` that are not in `alreadyUnlocked`, in catalog order. */
export function evaluateAchievements(ctx: AchievementContext, alreadyUnlocked: Iterable<string>): string[] {
  const have = new Set(alreadyUnlocked);
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    let ok = false;
    try { ok = a.condition(ctx); } catch { ok = false; }
    if (ok) out.push(a.id);
  }
  return out;
}

/** Catalog entries without the condition function (wire shape). */
export function catalogForClient(): { id: string; name: string; description: string; icon: string }[] {
  return ACHIEVEMENTS.map(({ id, name, description, icon }) => ({ id, name, description, icon }));
}
