/**
 * Shared types (v2). Generated from the zod schemas in `src/lib/data/schema.ts`.
 * Only type re-exports live here so client bundles never import firebase-admin.
 *
 * v1 shapes used by the legacy pages/libs that Modules 02–05 replace live in
 * `src/types/legacy.ts` and must not be used by new code.
 */
export type {
  Language, Difficulty, Verdict, ExperienceLevel, GoalType, PracticeState, PlanTier, FeatureKey,
  ProblemStatus, ProblemSource, ItemStatus, CheckerType, ReportReason,
  TopicSkill, UserStats, EditorSettings, UserSettings, UserPlan, Quotas, User, UsernameDoc,
  ProblemParam, Example, TestCase, Checker, Limits, ProblemStats, Problem,
  ProblemPrivateTests, ProblemPrivateDrivers, ProblemHints, ProblemEditorial,
  ProjectProgress, Project, RecommendationReason, ProjectItem, TemplatePoolEntry,
  FailedCase, Submission, Draft, Note, Activity, Subscription, Report, AiUsage,
  Template, TemplateItem, LeaderboardEntry, LeaderboardSnapshot, DailyChallenge, Achievements,
  Interview, InterviewFeedback, InterviewStatus, LeaderboardMeta, CohortEntry, WeeklyEntry,
  WithId, Serialized,
} from "@/lib/data/schema";

export type { CaseResult, JudgeResult, CaseStatus } from "@/lib/judge/types";
export type { ApiErrorBody, ApiErrorCode } from "@/lib/api/errors";
export type { PlanInfo, AuthedUserDTO } from "@/lib/auth/types";
