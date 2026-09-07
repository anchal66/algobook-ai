/**
 * Firestore schema v2 — single source of truth (Master Plan §5, Module 01 §3.5).
 * One zod schema per document type. Server-side documents carry Firestore
 * `Timestamp`s; API responses carry ISO strings (see `serialize()`).
 */
import { Timestamp } from "firebase-admin/firestore";

/** Firestore vector value (firebase-admin does not re-export the class, so we duck-type it). */
export interface VectorLike { toArray(): number[] }
function isVector(v: unknown): v is VectorLike {
  return !!v && typeof v === "object" && typeof (v as VectorLike).toArray === "function" && !(v instanceof Timestamp);
}
import { z } from "zod";

// ── Primitives ───────────────────────────────────────────────────────────────

export const timestamp = z.custom<Timestamp>((v) => v instanceof Timestamp, {
  message: "Expected Firestore Timestamp",
});
export const vector = z.custom<VectorLike>((v) => isVector(v), {
  message: "Expected Firestore VectorValue",
});

export const LanguageSchema = z.enum(["java", "python", "cpp", "javascript"]);
export const DifficultySchema = z.enum(["Easy", "Medium", "Hard"]);
export const VerdictSchema = z.enum(["AC", "WA", "RE", "CE", "TLE", "MLE"]);
export const ExperienceLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const GoalTypeSchema = z.enum(["learn-basics", "daily-practice", "interview-prep", "returning-after-break"]);
export const PracticeStateSchema = z.enum(["warm-up", "learning", "strengthening", "revision", "interview-prep", "maintenance"]);
export const PlanTierSchema = z.enum(["free", "pro"]);
export const FeatureKeySchema = z.enum(["generate", "run", "submit", "hint3", "editorial", "chat", "completion", "review", "interview"]);
export const ProblemStatusSchema = z.enum(["draft", "verified", "retired"]);
export const ProblemSourceSchema = z.enum(["generated", "template", "curated"]);
export const ItemStatusSchema = z.enum(["todo", "attempting", "solved"]);
export const CheckerTypeSchema = z.enum(["exact", "unordered_lines", "float"]);
export const ReportReasonSchema = z.enum(["not-relevant", "incomplete-or-broken", "runtime-error", "wrong-test-cases", "other"]);

/** Canonical stdin encoding type grammar (Module 01 §3.9). */
export const ParamTypeSchema = z
  .string()
  .regex(/^(int|long|double|bool|string|char|ListNode|TreeNode)(\[\])?(\[\])?$/, "Invalid param type");
export const ReturnTypeSchema = z
  .string()
  .regex(/^(void|int|long|double|bool|string|char|ListNode|TreeNode)(\[\])?(\[\])?$/, "Invalid return type");

export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const UsernameSchema = z.string().regex(/^[a-z][a-z0-9_]{2,19}$/, "3–20 chars, lowercase letters, digits, underscores; must start with a letter");

const langRecord = <T extends z.ZodTypeAny>(v: T) => z.partialRecord(LanguageSchema, v);

// ── users/{uid} ──────────────────────────────────────────────────────────────

export const SrsSchema = z.object({
  interval: z.number().default(1),
  ease: z.number().default(2.5),
  nextReview: DateKeySchema.nullable().default(null),
  reps: z.number().int().default(0),
});

export const TopicSkillSchema = z.object({
  solved: z.number().int().default(0),
  failed: z.number().int().default(0),
  easy: z.number().int().default(0),
  medium: z.number().int().default(0),
  hard: z.number().int().default(0),
  attempts: z.number().int().default(0),
  firstTrySuccesses: z.number().int().default(0),
  avgTimeSec: z.number().default(0),
  timeEfficiency: z.number().default(1),
  hintsUsed: z.number().int().default(0),
  runCount: z.number().int().default(0),
  /** Module 04: solves where the editorial was viewed (independence factor). */
  editorialViews: z.number().int().default(0),
  mastery: z.number().min(0).max(100).default(0),
  lastSeen: timestamp.nullable().default(null),
  srs: SrsSchema.default({ interval: 1, ease: 2.5, nextReview: null, reps: 0 }),
});

export const UserStatsSchema = z.object({
  totalSolved: z.number().int().default(0),
  totalFailed: z.number().int().default(0),
  easy: z.number().int().default(0),
  medium: z.number().int().default(0),
  hard: z.number().int().default(0),
  currentStreak: z.number().int().default(0),
  longestStreak: z.number().int().default(0),
  lastActiveDate: z.string().default(""),
  score: z.number().default(0),
  rating: z.number().default(1200),
  xp: z.number().default(0),
  level: z.number().int().default(1),
  /** Module 04: streak freezes banked (1 per 7-day streak, max 2); consumed automatically on a missed day. */
  streakFreezes: z.number().int().default(0),
  /** Module 04: rated (user, problem) outcomes so far — Elo K = 32 below 30, then 16. */
  ratedSolves: z.number().int().default(0),
  /** Module 04: daily challenges solved (achievement `daily_10`). */
  dailySolved: z.number().int().default(0),
  /** Module 04: accepted solves without hints (achievement `no_hints_20`). */
  noHintSolves: z.number().int().default(0),
  /** Module 04: languages with at least one accepted submission (achievement `polyglot`). */
  languagesAccepted: z.array(z.string()).default([]),
});

export const EditorSettingsSchema = z.object({
  font: z.string().default("JetBrains Mono"),
  fontSize: z.number().int().min(10).max(24).default(14),
  ligatures: z.boolean().default(true),
  keyBinding: z.enum(["standard", "vim", "emacs"]).default("standard"),
  tabSize: z.number().int().min(2).max(8).default(4),
  wordWrap: z.boolean().default(false),
  relativeLineNumbers: z.boolean().default(false),
  theme: z.string().default("algobook-dark"),
  language: LanguageSchema.default("java"),
  aiCompletion: z.boolean().default(false),
});

export const UserSettingsSchema = z.object({
  editor: EditorSettingsSchema.default(EditorSettingsSchema.parse({})),
  layout: z.record(z.string(), z.unknown()).default({}),
  timer: z.object({ visible: z.boolean().default(true), autoStart: z.boolean().default(true) }).default({ visible: true, autoStart: true }),
  shortcuts: z.record(z.string(), z.string()).default({}),
  notifications: z.object({ dailyReminder: z.boolean().default(false), streakAlerts: z.boolean().default(true) }).default({ dailyReminder: false, streakAlerts: true }),
});

export const UserPlanSchema = z.object({
  slug: PlanTierSchema.default("free"),
  planSlug: z.string().nullable().default(null), // pro-monthly | pro-yearly
  status: z.enum(["none", "active", "expired"]).default("none"),
  endDate: timestamp.nullable().default(null),
  checkedAt: timestamp.nullable().default(null),
});

export const QuotasSchema = z.object({
  date: z.string().default(""),
  generate: z.number().int().default(0),
  run: z.number().int().default(0),
  submit: z.number().int().default(0),
  hint3: z.number().int().default(0),
  editorial: z.number().int().default(0),
  chat: z.number().int().default(0),
  completion: z.number().int().default(0),
  review: z.number().int().default(0),
  interview: z.number().int().default(0),
});

export const UserSchema = z.object({
  username: z.string(),
  usernameChangesLeft: z.number().int().default(2),
  displayName: z.string().default(""),
  email: z.string().default(""),
  photoURL: z.string().default(""),
  bio: z.string().default(""),
  company: z.string().default(""),
  college: z.string().default(""),
  location: z.string().default(""),
  githubUrl: z.string().default(""),
  linkedinUrl: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experienceLevel: ExperienceLevelSchema.default("intermediate"),
  goalType: GoalTypeSchema.default("daily-practice"),
  practiceState: PracticeStateSchema.default("learning"),
  calibration: z.object({ complete: z.boolean().default(true), step: z.number().int().default(3) }).default({ complete: true, step: 3 }),
  stats: UserStatsSchema.default(UserStatsSchema.parse({})),
  topicSkills: z.record(z.string(), TopicSkillSchema).default({}),
  settings: UserSettingsSchema.default(UserSettingsSchema.parse({})),
  plan: UserPlanSchema.default(UserPlanSchema.parse({})),
  quotas: QuotasSchema.default(QuotasSchema.parse({})),
  /** Module 04: idempotency guard for `applySubmissionToStats`. */
  lastAppliedSubmissionId: z.string().nullable().default(null),
  /** Module 04: the auto-created system "Daily" project used by the daily challenge. */
  dailyProjectId: z.string().nullable().default(null),
  /** Module 05: rating after each rated solve, one point per UTC day (last 180 days) — drives the profile rating chart. */
  ratingHistory: z.array(z.object({ d: DateKeySchema, r: z.number() })).default([]),
  /** Module 05: last problem the user typed in (autosave) — the dashboard "Continue" card. */
  lastOpened: z.object({ problemId: z.string(), language: LanguageSchema, at: timestamp }).nullable().default(null),
  /** Module 05: public profile page + leaderboard visibility (Settings → Privacy). */
  publicProfile: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** usernames/{username} — uniqueness lock */
export const UsernameDocSchema = z.object({ uid: z.string() });

// ── problems/{problemId} ─────────────────────────────────────────────────────

export const ProblemParamSchema = z.object({ name: z.string().min(1), type: ParamTypeSchema });
export const ExampleSchema = z.object({ input: z.string(), output: z.string(), explanation: z.string().optional() });
export const TestCaseSchema = z.object({ input: z.string(), expectedOutput: z.string() });
export const CheckerSchema = z.object({ type: CheckerTypeSchema.default("exact"), eps: z.number().positive().optional() });
export const LimitsSchema = z.object({
  cpuTimeSec: z.number().positive().max(15).default(2),
  memoryKb: z.number().int().positive().max(256000).default(256000),
});
export const ProblemStatsSchema = z.object({
  attempts: z.number().int().default(0),
  accepted: z.number().int().default(0),
  acceptanceRate: z.number().default(0),
  avgRuntimeMs: langRecord(z.number()).default({}),
  runtimeSamples: langRecord(z.array(z.number())).default({}),
  memorySamples: langRecord(z.array(z.number())).default({}),
  /** Max runtime of the reference solution over all tests (Module 02): TLE sanity = max(limit, 3× this). */
  referenceRuntimeMs: langRecord(z.number()).default({}),
});
/** problems/{id}.languageJobs[lang] — in-flight driver generation (Module 02 §3.3 step 7). */
export const LanguageJobSchema = z.object({
  status: z.enum(["queued", "running", "done", "failed"]),
  startedAt: timestamp.nullable().default(null),
  updatedAt: timestamp.nullable().default(null),
  error: z.string().nullable().default(null),
});
export const TemplateRefSchema = z.object({ company: z.string(), number: z.number().int(), title: z.string() });

export const ProblemSchema = z.object({
  slug: z.string().min(1),
  number: z.number().int().nullable().default(null),
  title: z.string().min(1),
  difficulty: DifficultySchema,
  tags: z.array(z.string()).default([]),
  companies: z.array(z.string()).default([]),
  statementMd: z.string(),
  examples: z.array(ExampleSchema).default([]),
  constraints: z.array(z.string()).default([]),
  followUp: z.string().nullable().default(null),
  params: z.array(ProblemParamSchema).min(1),
  returnType: ReturnTypeSchema,
  functionName: z.string().min(1),
  sampleTests: z.array(TestCaseSchema).default([]),
  checker: CheckerSchema.default({ type: "exact" }),
  limits: LimitsSchema.default({ cpuTimeSec: 2, memoryKb: 256000 }),
  languages: z.array(LanguageSchema).default([]),
  starter: langRecord(z.string()).default({}),
  hintsPreview: z.number().int().default(0),
  stats: ProblemStatsSchema.default(ProblemStatsSchema.parse({})),
  rating: z.number().default(1200),
  source: ProblemSourceSchema.default("generated"),
  templateRef: TemplateRefSchema.nullable().default(null),
  embedding: vector.nullable().default(null),
  flagged: z.object({ count: z.number().int().default(0), reasons: z.array(z.string()).default([]) }).default({ count: 0, reasons: [] }),
  status: ProblemStatusSchema.default("draft"),
  createdBy: z.string().default("system"),
  createdAt: timestamp,
  verifiedAt: timestamp.nullable().default(null),
  model: z.string().nullable().default(null),
  languageJobs: langRecord(LanguageJobSchema).default({}),
  /** Last time the reuse path served this problem (tie-break: least recently served). */
  lastServedAt: timestamp.nullable().default(null),
});

/** problems/{id}/private/tests */
export const ProblemPrivateTestsSchema = z.object({
  hiddenTests: z.array(TestCaseSchema).min(1),
  referenceSolution: langRecord(z.string()).default({}),
});
/** problems/{id}/private/drivers */
export const ProblemPrivateDriversSchema = z.object({ drivers: langRecord(z.string()).default({}) });
/** problems/{id}/content/hints */
export const ProblemHintsSchema = z.object({ hints: z.array(z.object({ label: z.string(), text: z.string() })).length(3) });
/** problems/{id}/content/editorial */
export const ProblemEditorialSchema = z.object({
  overview: z.string().default(""),
  approaches: z.array(z.object({
    title: z.string(), intuition: z.string(), algorithm: z.string(),
    code: langRecord(z.string()).default({}), time: z.string(), space: z.string(),
  })),
  pitfalls: z.array(z.string()).default([]),
  model: z.string(),
  createdAt: timestamp,
});

/** AI code review stored on the accepted submission (Module 02 §3.2 ReviewSchema = v1 SolutionExplanation + score/isOptimal). */
export const ReviewSchema = z.object({
  analysis: z.string(),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  optimalApproach: z.string(),
  improvements: z.array(z.string()).max(6),
  alternativeApproaches: z.array(z.string()).max(4),
  score: z.number().min(0).max(10),
  isOptimal: z.boolean(),
});
export const StoredReviewSchema = ReviewSchema.extend({ model: z.string(), createdAt: timestamp });

// ── projects ─────────────────────────────────────────────────────────────────

export const ProjectProgressSchema = z.object({
  items: z.number().int().default(0),
  solved: z.number().int().default(0),
  attempting: z.number().int().default(0),
  easy: z.number().int().default(0),
  medium: z.number().int().default(0),
  hard: z.number().int().default(0),
  activeDays: z.number().int().default(0),
  /** Module 04: solved vs the expected pace (`items` spread over `durationDays`). */
  onTrack: z.boolean().default(true),
  expectedSolved: z.number().int().default(0),
});

export const ProjectSchema = z.object({
  uid: z.string(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  purpose: z.string().max(200).default(""),
  durationDays: z.number().int().min(1).max(365).default(30),
  experienceLevel: ExperienceLevelSchema.default("intermediate"),
  goalType: GoalTypeSchema.default("daily-practice"),
  selectedTopics: z.array(z.string()).default([]),
  templateId: z.string().nullable().default(null),
  insights: z.record(z.string(), z.unknown()).nullable().default(null),
  progress: ProjectProgressSchema.default(ProjectProgressSchema.parse({})),
  lastActivityAt: timestamp.nullable().default(null),
  lastActivityDate: z.string().default(""),
  createdAt: timestamp,
});

export const RecommendationReasonSchema = z.object({ short: z.string(), detail: z.string(), /** Module 04: bullet facts for the "Why this problem?" strip. */ facts: z.array(z.string()).default([]) });

/** projects/{id}/items/{problemId} */
export const ProjectItemSchema = z.object({
  order: z.number().int(),
  problemId: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  tags: z.array(z.string()).default([]),
  reason: RecommendationReasonSchema.nullable().default(null),
  source: ProblemSourceSchema.default("generated"),
  status: ItemStatusSchema.default("todo"),
  addedAt: timestamp,
  solvedAt: timestamp.nullable().default(null),
});

/** projects/{id}/templatePool/{docId} */
export const TemplatePoolEntrySchema = z.object({
  title: z.string(),
  number: z.number().int(),
  difficulty: DifficultySchema,
  order: z.number().int(),
  status: z.enum(["pending", "used"]).default("pending"),
  problemId: z.string().nullable().default(null),
});

// ── submissions ──────────────────────────────────────────────────────────────

export const FailedCaseSchema = z.object({
  index: z.number().int(),
  input: z.string(),
  expected: z.string(),
  actual: z.string(),
  stderr: z.string().default(""),
});

export const SubmissionSchema = z.object({
  uid: z.string(),
  projectId: z.string().nullable().default(null),
  problemId: z.string(),
  language: LanguageSchema,
  code: z.string(),
  verdict: VerdictSchema,
  passed: z.number().int(),
  total: z.number().int(),
  failedCase: FailedCaseSchema.nullable().default(null),
  compileOutput: z.string().nullable().default(null),
  runtimeMs: z.number().default(0),
  memoryKb: z.number().default(0),
  beatsRuntimePct: z.number().nullable().default(null),
  beatsMemoryPct: z.number().nullable().default(null),
  attemptNumber: z.number().int().default(1),
  hintsUsed: z.number().int().default(0),
  editorialViewed: z.boolean().default(false),
  timeSpentSec: z.number().int().default(0),
  runCount: z.number().int().default(0),
  isFirstTry: z.boolean().default(false),
  createdAt: timestamp,
  /** Post-AC AI review (Module 02 A-11), at most one per submission. */
  review: StoredReviewSchema.nullable().default(null),
});

// ── drafts / notes / activity ────────────────────────────────────────────────

export const DraftSchema = z.object({
  uid: z.string(),
  problemId: z.string(),
  code: langRecord(z.string()).default({}),
  language: LanguageSchema,
  updatedAt: timestamp,
});

export const NoteSchema = z.object({
  uid: z.string(),
  problemId: z.string(),
  markdown: z.string().max(100_000),
  updatedAt: timestamp,
});

export const ActivitySchema = z.object({
  uid: z.string(),
  date: DateKeySchema,
  submissions: z.number().int().default(0),
  accepted: z.number().int().default(0),
  problemsSolved: z.array(z.string()).default([]),
  timeSpentSec: z.number().int().default(0),
  runs: z.number().int().default(0),
  xpEarned: z.number().default(0),
  /** Module 04: projects touched that day (`projects.progress.activeDays` = count of days containing the project). */
  projectIds: z.array(z.string()).default([]),
  /** Module 04: the daily challenge of that date was solved (awarded once). */
  dailySolved: z.boolean().default(false),
  updatedAt: timestamp,
});

// ── subscriptions / reports / aiUsage / templates / misc ─────────────────────

export const SubscriptionSchema = z.object({
  uid: z.string(),
  planSlug: z.string(),
  planName: z.string(),
  status: z.enum(["active", "expired"]),
  startDate: timestamp,
  endDate: timestamp,
  gatewayTransactionId: z.string(),
  amountPaid: z.number(),
  currency: z.string().default("INR"),
  createdAt: timestamp,
});

export const ReportSchema = z.object({
  problemId: z.string(),
  uid: z.string(),
  reason: ReportReasonSchema,
  details: z.string().max(2000).nullable().default(null),
  resolved: z.boolean().default(false),
  createdAt: timestamp,
});

export const AiUsageSchema = z.object({
  purpose: z.string(),
  model: z.string(),
  inputTokens: z.number().int().default(0),
  cachedTokens: z.number().int().default(0),
  outputTokens: z.number().int().default(0),
  reasoningTokens: z.number().int().default(0),
  costUsd: z.number().default(0),
  latencyMs: z.number().default(0),
  uid: z.string().nullable().default(null),
  problemId: z.string().nullable().default(null),
  ok: z.boolean().default(true),
  error: z.string().nullable().default(null),
  createdAt: timestamp,
});

/** jobs/{id} — background jobs (Module 02 pre-generation via the OpenAI Batch API). */
export const PregenJobSchema = z.object({
  type: z.literal("pregen"),
  status: z.enum(["submitted", "collecting", "done", "failed", "cancelled"]),
  batchId: z.string(),
  inputFileId: z.string(),
  outputFileId: z.string().nullable().default(null),
  requested: z.number().int(),
  /** Output lines already processed by the collector (it works in bounded chunks). */
  cursor: z.number().int().default(0),
  /** custom_id → what was asked for (topic/difficulty or template entry). */
  requests: z.record(z.string(), z.object({
    kind: z.enum(["pool", "template"]),
    difficulty: DifficultySchema,
    topics: z.array(z.string()),
    company: z.string().nullable().default(null),
    templateRef: TemplateRefSchema.nullable().default(null),
  })),
  results: z.object({
    processed: z.number().int().default(0),
    verified: z.number().int().default(0),
    repaired: z.number().int().default(0),
    failed: z.number().int().default(0),
    costUsd: z.number().default(0),
  }).default({ processed: 0, verified: 0, repaired: 0, failed: 0, costUsd: 0 }),
  error: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const TemplateSchema = z.object({
  company: z.string(),
  title: z.string(),
  description: z.string(),
  purpose: z.string(),
  count: z.number().int(),
  difficulties: z.object({ easy: z.number().int(), medium: z.number().int(), hard: z.number().int() }),
  updatedAt: timestamp,
});
export const TemplateItemSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  difficulty: DifficultySchema,
  order: z.number().int(),
});

export const LeaderboardEntrySchema = z.object({
  uid: z.string(), username: z.string(), displayName: z.string(), photoURL: z.string(),
  score: z.number(), totalSolved: z.number().int(), currentStreak: z.number().int(), rank: z.number().int(),
});
export const LeaderboardSnapshotSchema = z.object({ updatedAt: timestamp, entries: z.array(LeaderboardEntrySchema) });
export const DailyChallengeSchema = z.object({
  date: DateKeySchema,
  problemId: z.string(),
  title: z.string().default(""),
  slug: z.string().default(""),
  difficulty: DifficultySchema.default("Medium"),
  tags: z.array(z.string()).default([]),
  solvers: z.number().int().default(0),
  createdAt: timestamp,
});
/** leaderboard/meta — cached totals for percentile (Module 04 §3.10). */
export const LeaderboardMetaSchema = z.object({ totalRanked: z.number().int().default(0), updatedAt: timestamp });
/** leaderboard/template_{company} — cohort of users doing the same company template, ranked by template progress. */
export const CohortEntrySchema = z.object({
  uid: z.string(), username: z.string(), displayName: z.string(), photoURL: z.string(),
  solved: z.number().int(), items: z.number().int(), progressPct: z.number(), rank: z.number().int(),
});
export const CohortSnapshotSchema = z.object({ company: z.string(), updatedAt: timestamp, entries: z.array(CohortEntrySchema) });
/** leaderboard/week_{yyyy-Www} — accepted submissions in the ISO week. */
export const WeeklyEntrySchema = z.object({
  uid: z.string(), username: z.string(), displayName: z.string(), photoURL: z.string(),
  accepted: z.number().int(), submissions: z.number().int(), xpEarned: z.number(), activeDays: z.number().int(), rank: z.number().int(),
});
export const WeeklySnapshotSchema = z.object({ week: z.string(), from: DateKeySchema, to: DateKeySchema, updatedAt: timestamp, entries: z.array(WeeklyEntrySchema) });
/** interviews/{id} — mock interview session (Module 04 §3.12, D-11). */
export const InterviewStatusSchema = z.enum(["active", "finished", "expired"]);
export const InterviewFeedbackSchema = z.object({
  score: z.number().min(0).max(10),
  verdict: z.enum(["strong-hire", "hire", "lean-hire", "no-hire"]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  summary: z.string(),
  perProblem: z.array(z.object({ problemId: z.string(), title: z.string(), solved: z.boolean(), attempts: z.number().int(), timeSpentSec: z.number().int(), note: z.string() })),
  model: z.string(),
  createdAt: timestamp,
});
export const InterviewSchema = z.object({
  uid: z.string(),
  projectId: z.string(),
  status: InterviewStatusSchema.default("active"),
  durationMin: z.number().int(),
  difficulty: z.enum(["mixed", "medium", "hard"]).default("mixed"),
  problems: z.array(z.object({ problemId: z.string(), title: z.string(), difficulty: DifficultySchema, rating: z.number() })),
  startedAt: timestamp,
  endsAt: timestamp,
  finishedAt: timestamp.nullable().default(null),
  feedback: InterviewFeedbackSchema.nullable().default(null),
});
export const AchievementsSchema = z.object({ unlocked: z.array(z.object({ id: z.string(), at: timestamp })).default([]) });

// ── Types ────────────────────────────────────────────────────────────────────

export type Language = z.infer<typeof LanguageSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;
export type GoalType = z.infer<typeof GoalTypeSchema>;
export type PracticeState = z.infer<typeof PracticeStateSchema>;
export type PlanTier = z.infer<typeof PlanTierSchema>;
export type FeatureKey = z.infer<typeof FeatureKeySchema>;
export type ProblemStatus = z.infer<typeof ProblemStatusSchema>;
export type ProblemSource = z.infer<typeof ProblemSourceSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type CheckerType = z.infer<typeof CheckerTypeSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export type TopicSkill = z.infer<typeof TopicSkillSchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UserPlan = z.infer<typeof UserPlanSchema>;
export type Quotas = z.infer<typeof QuotasSchema>;
export type User = z.infer<typeof UserSchema>;
export type UsernameDoc = z.infer<typeof UsernameDocSchema>;

export type ProblemParam = z.infer<typeof ProblemParamSchema>;
export type Example = z.infer<typeof ExampleSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type Checker = z.infer<typeof CheckerSchema>;
export type Limits = z.infer<typeof LimitsSchema>;
export type ProblemStats = z.infer<typeof ProblemStatsSchema>;
export type TemplateRef = z.infer<typeof TemplateRefSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type ProblemPrivateTests = z.infer<typeof ProblemPrivateTestsSchema>;
export type ProblemPrivateDrivers = z.infer<typeof ProblemPrivateDriversSchema>;
export type ProblemHints = z.infer<typeof ProblemHintsSchema>;
export type ProblemEditorial = z.infer<typeof ProblemEditorialSchema>;
export type LanguageJob = z.infer<typeof LanguageJobSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type StoredReview = z.infer<typeof StoredReviewSchema>;
export type PregenJob = z.infer<typeof PregenJobSchema>;

export type ProjectProgress = z.infer<typeof ProjectProgressSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type RecommendationReason = z.infer<typeof RecommendationReasonSchema>;
export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type TemplatePoolEntry = z.infer<typeof TemplatePoolEntrySchema>;

export type FailedCase = z.infer<typeof FailedCaseSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type AiUsage = z.infer<typeof AiUsageSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateItem = z.infer<typeof TemplateItemSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type LeaderboardSnapshot = z.infer<typeof LeaderboardSnapshotSchema>;
export type DailyChallenge = z.infer<typeof DailyChallengeSchema>;
export type LeaderboardMeta = z.infer<typeof LeaderboardMetaSchema>;
export type CohortEntry = z.infer<typeof CohortEntrySchema>;
export type CohortSnapshot = z.infer<typeof CohortSnapshotSchema>;
export type WeeklyEntry = z.infer<typeof WeeklyEntrySchema>;
export type WeeklySnapshot = z.infer<typeof WeeklySnapshotSchema>;
export type Interview = z.infer<typeof InterviewSchema>;
export type InterviewFeedback = z.infer<typeof InterviewFeedbackSchema>;
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;
export type Achievements = z.infer<typeof AchievementsSchema>;

/** A document plus its Firestore id. */
export type WithId<T> = T & { id: string };

/** Deep type transform: Timestamp → ISO string, VectorValue → number[] (API wire shape). */
export type Serialized<T> = T extends Timestamp
  ? string
  : T extends VectorLike
    ? number[]
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/** Convert a server document into its JSON wire shape (Timestamps → ISO strings). */
export function serialize<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) return value as Serialized<T>;
  if (value instanceof Timestamp) return value.toDate().toISOString() as Serialized<T>;
  if (isVector(value)) return value.toArray() as Serialized<T>;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as Serialized<T>;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = serialize(v);
    }
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}

/** Today's date key in UTC (quotas, activity, streaks all use UTC days). */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
