/**
 * Room settings (Module 06 §3.3): one zod schema shared by the wizard and the API, scoring presets,
 * the difficulty/topic slot planner and a plain-language summary used by the lobby and the consent dialog.
 * Pure — no Firestore.
 */
import { z } from "zod";
import { DifficultySchema, LanguageSchema, type Difficulty, type Language } from "@/lib/data/schema";
import { CORE_TOPICS } from "@/lib/practice/topics";

export const AVATAR_ICONS = ["swords", "trophy", "flame", "rocket", "zap", "target", "crown", "puzzle", "brain", "shield", "star", "gem"] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

export const ROOM_LIMITS = {
  nameMin: 3, nameMax: 60, descriptionMax: 300,
  membersMin: 2, membersMax: 50,
  durationMin: 10, durationMax: 300,
  countMin: 1, countMax: 10,
  scheduleMaxDays: 7,
} as const;

export const ScoringPresetSchema = z.enum(["leetcode", "icpc", "custom"]);
export type ScoringPreset = z.infer<typeof ScoringPresetSchema>;
export const StrictnessSchema = z.enum(["lenient", "standard", "strict"]);
export type Strictness = z.infer<typeof StrictnessSchema>;

export const ScoringSettingsSchema = z.object({
  preset: ScoringPresetSchema.default("leetcode"),
  points: z.object({ Easy: z.number().int().min(10).max(1000), Medium: z.number().int().min(10).max(1000), Hard: z.number().int().min(10).max(1000) }).default({ Easy: 100, Medium: 200, Hard: 300 }),
  timeDecay: z.enum(["none", "linear"]).default("linear"),
  /** Points left at the very end of the contest with linear decay (percent of the problem's points). */
  minPct: z.number().int().min(10).max(100).default(50),
  /** ICPC-style minutes added to the tie-break time per wrong submission before the first AC. */
  wrongPenaltyMin: z.number().int().min(0).max(30).default(5),
  /** LeetCode-style percent of the problem's points lost per wrong submission before the first AC. */
  wrongPenaltyPct: z.number().int().min(0).max(50).default(10),
  partialCredit: z.enum(["none", "proportional"]).default("none"),
  showVerdict: z.enum(["full", "verdictOnly", "hidden"]).default("full"),
  showLeaderboard: z.enum(["live", "frozen", "hidden"]).default("live"),
  freezeLastMin: z.number().int().min(5).max(60).default(15),
  runOnSamples: z.boolean().default(true),
});
export type ScoringSettings = z.infer<typeof ScoringSettingsSchema>;

export const IntegritySettingsSchema = z.object({
  strictness: StrictnessSchema.default("standard"),
  requireFullscreen: z.boolean().default(false),
  blockPaste: z.boolean().default(true),
  blockCopy: z.boolean().default(true),
  similarityCheck: z.boolean().default(true),
});
export type IntegritySettings = z.infer<typeof IntegritySettingsSchema>;

export const CapsSchema = z.object({
  maxSubmitsPerProblem: z.number().int().min(1).max(10).default(3),
  maxRunsPerProblem: z.number().int().min(0).max(10).default(3),
});

const ALL_LANGUAGES: Language[] = ["java", "python", "cpp", "javascript"];

export const RoomSettingsSchema = z.object({
  name: z.string().trim().min(ROOM_LIMITS.nameMin).max(ROOM_LIMITS.nameMax),
  description: z.string().trim().max(ROOM_LIMITS.descriptionMax).default(""),
  avatar: z.object({ icon: z.enum(AVATAR_ICONS).default("swords"), hue: z.number().int().min(0).max(360).default(250) }).default({ icon: "swords", hue: 250 }),
  visibility: z.enum(["public", "private"]).default("private"),
  joinApproval: z.enum(["manual", "auto"]).default("manual"),
  maxMembers: z.number().int().min(ROOM_LIMITS.membersMin).max(ROOM_LIMITS.membersMax).default(6),
  allowRejoin: z.boolean().default(true),
  /** ISO time; the lobby opens immediately, Start unlocks at this time (host may start earlier). */
  scheduledAt: z.string().nullable().default(null),
  durationMin: z.number().int().min(ROOM_LIMITS.durationMin).max(ROOM_LIMITS.durationMax).default(60),
  startCountdownSec: z.number().int().min(5).max(60).default(10),
  problemMode: z.enum(["all-open", "sequential"]).default("all-open"),
  count: z.number().int().min(ROOM_LIMITS.countMin).max(ROOM_LIMITS.countMax).default(3),
  difficultyMode: z.enum(["any", "fixed", "incremental", "perProblem"]).default("incremental"),
  fixedDifficulty: DifficultySchema.default("Medium"),
  perProblemDifficulty: z.array(DifficultySchema).max(ROOM_LIMITS.countMax).default([]),
  topicMode: z.enum(["any", "pool", "perProblem"]).default("any"),
  topicPool: z.array(z.string()).max(25).default([]),
  perProblemTopics: z.array(z.array(z.string()).max(25)).max(ROOM_LIMITS.countMax).default([]),
  languages: z.array(LanguageSchema).min(1).default(ALL_LANGUAGES),
  excludeSeen: z.boolean().default(true),
  generateIfMissing: z.boolean().default(true),
  scoring: ScoringSettingsSchema.default(ScoringSettingsSchema.parse({})),
  caps: CapsSchema.default(CapsSchema.parse({})),
  integrity: IntegritySettingsSchema.default(IntegritySettingsSchema.parse({})),
  rated: z.boolean().default(true),
  chat: z.enum(["off", "lobby-only"]).default("lobby-only"),
}).superRefine((s, ctx) => {
  if (s.difficultyMode === "perProblem" && s.perProblemDifficulty.length !== s.count) ctx.addIssue({ code: "custom", path: ["perProblemDifficulty"], message: `Set a difficulty for each of the ${s.count} problems` });
  if (s.topicMode === "pool" && s.topicPool.length === 0) ctx.addIssue({ code: "custom", path: ["topicPool"], message: "Pick at least one topic" });
  if (s.topicMode === "perProblem" && (s.perProblemTopics.length !== s.count || s.perProblemTopics.some((t) => t.length === 0))) ctx.addIssue({ code: "custom", path: ["perProblemTopics"], message: `Pick at least one topic for each of the ${s.count} problems` });
  const unknown = [...s.topicPool, ...s.perProblemTopics.flat()].filter((t) => !(CORE_TOPICS as readonly string[]).includes(t));
  if (unknown.length) ctx.addIssue({ code: "custom", path: ["topicPool"], message: `Unknown topics: ${[...new Set(unknown)].join(", ")}` });
  if (s.scheduledAt) {
    const t = Date.parse(s.scheduledAt);
    if (Number.isNaN(t)) ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Invalid date" });
    else if (t > Date.now() + ROOM_LIMITS.scheduleMaxDays * 86_400_000) ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: `At most ${ROOM_LIMITS.scheduleMaxDays} days ahead` });
  }
  if (s.languages.length !== new Set(s.languages).size) ctx.addIssue({ code: "custom", path: ["languages"], message: "Duplicate language" });
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;
export type RoomSettingsInput = z.input<typeof RoomSettingsSchema>;

/** Scoring defaults per preset (the wizard applies these when the preset changes). */
export const SCORING_PRESETS: Record<Exclude<ScoringPreset, "custom">, Partial<ScoringSettings>> = {
  leetcode: { timeDecay: "linear", minPct: 50, wrongPenaltyPct: 10, wrongPenaltyMin: 5, partialCredit: "none", showVerdict: "full", showLeaderboard: "live" },
  icpc: { timeDecay: "none", minPct: 100, wrongPenaltyPct: 0, wrongPenaltyMin: 20, partialCredit: "none", showVerdict: "verdictOnly", showLeaderboard: "frozen" },
};

export function defaultSettings(overrides: Partial<RoomSettingsInput> = {}): RoomSettings {
  return RoomSettingsSchema.parse({ name: "Contest", ...overrides });
}

export interface Slot { index: number; difficulty: Difficulty | null; topics: string[] }

/** Incremental ramp: thirds of Easy / Medium / Hard (1 → M, 2 → E M, 3 → E M H, 4 → E M M H, 6 → E E M M H H). */
export function rampDifficulties(count: number): Difficulty[] {
  if (count <= 0) return [];
  if (count === 1) return ["Medium"];
  if (count === 2) return ["Easy", "Medium"];
  const easy = Math.max(1, Math.floor(count / 3));
  const hard = Math.max(1, Math.floor(count / 3));
  const medium = count - easy - hard;
  return [...Array<Difficulty>(easy).fill("Easy"), ...Array<Difficulty>(medium).fill("Medium"), ...Array<Difficulty>(hard).fill("Hard")];
}

/** Expands the settings into per-problem slots (difficulty null = any). */
export function expandSlots(s: RoomSettings): Slot[] {
  const ramp = rampDifficulties(s.count);
  return Array.from({ length: s.count }, (_, index) => {
    const difficulty: Difficulty | null =
      s.difficultyMode === "any" ? null
      : s.difficultyMode === "fixed" ? s.fixedDifficulty
      : s.difficultyMode === "incremental" ? ramp[index]
      : s.perProblemDifficulty[index] ?? null;
    const topics = s.topicMode === "any" ? [] : s.topicMode === "pool" ? [...s.topicPool] : [...(s.perProblemTopics[index] ?? [])];
    return { index, difficulty, topics };
  });
}

const LANG_LABEL: Record<Language, string> = { java: "Java", python: "Python", cpp: "C++", javascript: "JavaScript" };

/** Plain-language lines describing a room (lobby summary and the consent dialog). */
export function summarize(s: RoomSettings): string[] {
  const slots = expandSlots(s);
  const lines: string[] = [];
  lines.push(`${s.count} ${s.count === 1 ? "problem" : "problems"}, ${s.durationMin} minutes${s.problemMode === "sequential" ? ", unlocked one after another" : ", all open from the start"}.`);
  const diff = s.difficultyMode === "any" ? "any difficulty" : s.difficultyMode === "fixed" ? `all ${s.fixedDifficulty}` : slots.map((x) => x.difficulty?.[0] ?? "?").join(" → ");
  const topics = s.topicMode === "any" ? "any topic" : s.topicMode === "pool" ? `topics: ${s.topicPool.join(", ")}` : "topics set per problem";
  lines.push(`Difficulty ${diff}; ${topics}.`);
  lines.push(`Languages: ${s.languages.map((l) => LANG_LABEL[l]).join(", ")}. Up to ${s.caps.maxSubmitsPerProblem} submits and ${s.caps.maxRunsPerProblem} runs per problem.`);
  const sc = s.scoring;
  const decay = sc.timeDecay === "linear" ? `points fall linearly to ${sc.minPct}% by the end` : "no time decay";
  const wrong = sc.wrongPenaltyPct > 0 ? `each wrong submission before your first accept costs ${sc.wrongPenaltyPct}% of that problem` : sc.wrongPenaltyMin > 0 ? `each wrong submission adds ${sc.wrongPenaltyMin} min to your tie-break time` : "wrong submissions are free";
  lines.push(`Scoring (${sc.preset}): Easy ${sc.points.Easy} / Medium ${sc.points.Medium} / Hard ${sc.points.Hard}; ${decay}; ${wrong}${sc.partialCredit === "proportional" ? "; up to half credit for partially passing code" : ""}.`);
  lines.push(`Verdicts ${sc.showVerdict === "full" ? "shown with the first failing sample" : sc.showVerdict === "verdictOnly" ? "shown without details" : "hidden until the end"}; leaderboard ${sc.showLeaderboard === "live" ? "live" : sc.showLeaderboard === "frozen" ? `frozen for the last ${sc.freezeLastMin} minutes` : "hidden until the end"}.`);
  lines.push(`Integrity: ${s.integrity.strictness}${s.integrity.blockPaste ? ", paste from outside blocked" : ""}${s.integrity.blockCopy ? ", copying blocked" : ""}${s.integrity.requireFullscreen ? ", full screen required" : ""}${s.integrity.similarityCheck ? ", code similarity checked after the contest" : ""}. AI help is off inside the arena.`);
  lines.push(`${s.rated ? "Rated: your contest rating changes with the result." : "Unrated."} ${s.joinApproval === "manual" ? "The host approves each participant." : "Anyone with the code joins directly."}`);
  return lines;
}

export function languageLabel(l: Language): string { return LANG_LABEL[l]; }
