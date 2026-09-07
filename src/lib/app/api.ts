"use client";
/**
 * Typed client for the routes the app pages use (Module 05). Complements `src/lib/workspace/api.ts`
 * (workspace routes). Shapes mirror the route handlers as implemented — see the Module 05 status log.
 */
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Difficulty, ItemStatus, Language, PracticeState, Serialized, User, WithId, Project, ProjectItem, Submission, Interview, RecommendationReason } from "@/types";
import type { MeResponse, ProblemListResponse, ProblemSummaryDTO, ProjectResponse, SubmissionListItem } from "@/lib/workspace/types";

export { ApiError };
export type { MeResponse, ProblemListResponse, ProblemSummaryDTO, ProjectResponse, SubmissionListItem };

// ── Me ──────────────────────────────────────────────────────────────────────
export const getMe = () => apiFetch<MeResponse>("/api/me");
export type MePatch = Partial<Pick<User, "displayName" | "bio" | "company" | "college" | "location" | "githubUrl" | "linkedinUrl" | "skills" | "experienceLevel" | "goalType">>;
export const patchMe = (body: MePatch & { publicProfile?: boolean }) => apiFetch<MeResponse>("/api/me", { method: "PATCH", body });
export const deleteMe = () => apiFetch<{ ok: true }>("/api/me", { method: "DELETE" });
export const checkUsername = (u: string) => apiFetch<{ username: string; available: boolean }>(`/api/users/username/check?u=${encodeURIComponent(u)}`);
export const setUsername = (username: string) => apiFetch<{ username: string; changesLeft: number }>("/api/me/username", { method: "POST", body: { username } });
export const patchNotifications = (notifications: { dailyReminder?: boolean; streakAlerts?: boolean }) =>
  apiFetch<{ settings: User["settings"] }>("/api/me/settings", { method: "PATCH", body: { notifications } });

// ── Projects ────────────────────────────────────────────────────────────────
export type ProjectDTO = Serialized<WithId<Project>>;
export type ProjectItemDTO = Serialized<WithId<ProjectItem>>;
export const listProjects = () => apiFetch<{ projects: ProjectDTO[] }>("/api/projects");
export interface CreateProjectBody {
  title: string; description?: string; purpose?: string; durationDays?: number;
  experienceLevel?: User["experienceLevel"]; goalType?: User["goalType"]; selectedTopics?: string[]; templateId?: string | null;
}
export const createProject = (body: CreateProjectBody) => apiFetch<{ project: ProjectDTO }>("/api/projects", { method: "POST", body });
export const getProject = (id: string) => apiFetch<ProjectResponse>(`/api/projects/${id}`);
export const deleteProject = (id: string) => apiFetch<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" });
export const patchProject = (id: string, body: { title?: string; description?: string; purpose?: string; selectedTopics?: string[]; durationDays?: number }) =>
  apiFetch<{ project: ProjectDTO }>(`/api/projects/${id}`, { method: "PATCH", body });

export interface ProjectInsights {
  totalRecommended: number; easyCount: number; mediumCount: number; hardCount: number; estimatedHoursPerWeek: number;
  keyTopics: string[]; milestones: { label: string; questionsTarget: number; description: string }[]; tip: string;
  weeklyPlan: { week: number; focus: string[]; target: number }[];
}
export const getInsights = (id: string, force = false) =>
  apiFetch<{ insights: ProjectInsights; cached: boolean }>(`/api/projects/${id}/insights`, { method: "POST", body: { force } });

// ── Problems ────────────────────────────────────────────────────────────────
export interface ExploreQuery {
  tags?: string; difficulty?: Difficulty | ""; q?: string; cursor?: string; limit?: number;
  company?: string; sort?: "number" | "acceptance" | "rating" | "newest"; order?: "asc" | "desc"; status?: "solved" | "attempting" | "todo" | "";
  minRating?: number; maxRating?: number;
}
export interface ExploreItem extends ProblemSummaryDTO { userStatus: ItemStatus | null }
export interface ExploreResponse { items: ExploreItem[]; nextCursor: string | null; total: number | null; topics: { tag: string; count: number }[] }
export const exploreProblems = (q: ExploreQuery = {}) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return apiFetch<ExploreResponse>(`/api/problems${s ? `?${s}` : ""}`);
};
export interface ContinueItem { id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; tags: string[]; language: Language; at: string; projectId: string | null; solved: boolean; draftChars: number; href: string }
export const getContinue = () => apiFetch<{ item: ContinueItem | null }>("/api/me/continue");
export interface CatalogRow { id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; tags: string[]; companies: string[]; acceptanceRate: number; attempts: number; rating: number; languages: Language[]; source: "generated" | "template" | "curated"; createdAt: string }
export const getCatalog = () => apiFetch<{ items: CatalogRow[]; total: number; cachedAt: string }>("/api/problems/catalog");
export const getProblemStatus = () => apiFetch<{ solved: string[]; attempting: string[] }>("/api/me/problem-status");
export interface RecommendedProblem { id: string; slug: string; title: string; difficulty: Difficulty; tags: string[]; rating: number; reason: RecommendationReason; projectId: string | null }
export const getRecommended = () => apiFetch<{ items: RecommendedProblem[]; practiceState: PracticeState }>("/api/problems/recommended");
export const randomProblem = (q: { difficulty?: string; tags?: string } = {}) => {
  const sp = new URLSearchParams({ random: "1" });
  for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v);
  return apiFetch<{ item: ExploreItem | null }>(`/api/problems?${sp}`);
};

export type SubmissionDTO = Serialized<WithId<Submission>>;
export const listSubmissions = (q: { projectId?: string; problemId?: string; cursor?: string; limit?: number } = {}) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return apiFetch<{ items: SubmissionListItem[]; nextCursor: string | null }>(`/api/submissions${s ? `?${s}` : ""}`);
};

// ── Practice intelligence (Module 04) ───────────────────────────────────────
export interface ActivityDay { date: string; submissions: number; accepted: number; timeSpentSec: number; runs: number; xpEarned: number; projectIds: string[]; dailySolved: boolean }
export interface ActivityResponse {
  year: number; heatmap: Record<string, number>; totalSubmissions: number; totalAccepted: number; activeDays: number;
  maxStreak: number; currentStreak: number; longestStreak: number; streakFreezes: number;
  streak: { active: boolean; atRisk: boolean; coveredByFreeze: boolean }; days: ActivityDay[];
}
export const getActivity = (year?: number, username?: string) => {
  const sp = new URLSearchParams();
  if (year) sp.set("year", String(year));
  if (username) sp.set("username", username);
  const s = sp.toString();
  return apiFetch<ActivityResponse>(`/api/activity${s ? `?${s}` : ""}`, { anonymous: !!username });
};

export interface DailyResponse {
  date: string;
  challenge: { id: string; date: string; problemId: string; title: string; slug: string; difficulty: Difficulty; tags: string[]; solvers: number } | null;
  solved: boolean; projectId: string | null; itemStatus?: ItemStatus; xpBonus: number; dailySolvedTotal: number;
  history?: { date: string; solved: boolean; title: string; slug: string; difficulty: Difficulty }[];
}
export const getDaily = (days?: number) => apiFetch<DailyResponse>(`/api/daily${days ? `?days=${days}` : ""}`);

export interface SkillTopic {
  topic: string; name: string; icon: string; description: string; depth: number; prerequisites: string[];
  status: "locked" | "available" | "learning" | "weak" | "mastered"; gap: number; mastery: number;
  breakdown: { accuracy: number; firstTryRate: number; breadth: number; timeEfficiency: number; independence: number; volume: number; raw: number; confidence: number; mastery: number } | null;
  solved: number; attempts: number; easy: number; medium: number; hard: number;
  srs: { interval: number; ease: number; nextReview: string | null; reps: number } | null;
  due: { topic: string; urgency: number; overdueDays: number } | null; lastSeen: string | null; suggestedDifficulty: Difficulty;
}
export interface SkillsResponse {
  state: PracticeState; stateDescription: string; stateProgress: number; rating: number; band: Difficulty; level: number; xp: number; score: number;
  streak: { current: number; longest: number; freezes: number; active: boolean; atRisk: boolean; coveredByFreeze: boolean };
  thresholds: { weak: number; mastered: number }; counts: { mastered: number; weak: number; due: number }; topics: SkillTopic[];
}
export const getSkills = (username?: string) => apiFetch<SkillsResponse>(`/api/me/skills${username ? `?username=${encodeURIComponent(username)}` : ""}`, { anonymous: !!username });

export interface AchievementsResponse {
  unlocked: { id: string; at: string; name?: string; description?: string; icon?: string }[];
  catalog: { id: string; name: string; description: string; icon: string; unlocked: boolean; at?: string }[];
  counts: { unlocked: number; total: number };
}
export const getAchievements = (username?: string) => apiFetch<AchievementsResponse>(`/api/me/achievements${username ? `?username=${encodeURIComponent(username)}` : ""}`, { anonymous: !!username });

// ── Leaderboard ─────────────────────────────────────────────────────────────
export interface GlobalEntry { uid: string; username: string; displayName: string; photoURL: string; score: number; totalSolved: number; currentStreak: number; longestStreak: number; rating: number; level: number; rank: number }
export interface TemplateEntry { uid: string; username: string; displayName: string; photoURL: string; solved: number; items: number; progressPct: number; rank: number }
export interface WeekEntry { uid: string; username: string; displayName: string; photoURL: string; accepted: number; submissions: number; xpEarned: number; activeDays: number; rank: number }
export type LeaderboardResponse =
  | { scope: "global"; entries: GlobalEntry[]; nextCursor: string | null; me: { uid: string; score: number; rank: number | null; percentile: number | null; total: number }; reads: number }
  | { scope: "template"; company: string; label: string; updatedAt: string | null; entries: TemplateEntry[]; me: TemplateEntry | null }
  | { scope: "week"; week: string; range: { from: string; to: string }; updatedAt: string | null; entries: WeekEntry[]; me: WeekEntry | null };
export const getLeaderboard = (q: { scope?: "global" | "template" | "week"; company?: string; week?: string; cursor?: string; limit?: number } = {}) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return apiFetch<LeaderboardResponse>(`/api/leaderboard?${sp}`);
};

// ── Interview ───────────────────────────────────────────────────────────────
export type InterviewDTO = Serialized<WithId<Interview>>;
export const startInterview = (body: { durationMin?: 30 | 45 | 60; difficulty?: "mixed" | "medium" | "hard" }) =>
  apiFetch<{ interview: InterviewDTO; projectId: string; mode: { hints: boolean; editorial: boolean; tutor: boolean; countdown: boolean } }>("/api/interview/start", { method: "POST", body });
export const getInterview = (id: string) => apiFetch<{ interview: InterviewDTO; remainingSec: number; expired: boolean }>(`/api/interview/${id}`);
export const listInterviews = () => apiFetch<{ interviews: InterviewDTO[] }>("/api/interview");
export const finishInterview = (id: string) => apiFetch<{ interview: InterviewDTO; cached: boolean }>(`/api/interview/${id}/finish`, { method: "POST", body: {} });

// ── Templates / subscription ────────────────────────────────────────────────
export interface TemplateDTO { id: string; company: string; title: string; description: string; purpose: string; count: number; difficulties: { easy: number; medium: number; hard: number }; updatedAt: string | null }
export const listTemplates = () => apiFetch<{ templates: TemplateDTO[] }>("/api/templates");
export const getSubscriptionStatus = () => apiFetch<{ active: boolean; tier: "free" | "pro"; status: string; plan: { name: string; slug: string } | null; endDate: string | null }>("/api/subscription/status");
export const startCheckout = (planSlug: "pro-monthly" | "pro-yearly") => apiFetch<{ checkoutUrl: string }>("/api/subscription/checkout", { method: "POST", body: { planSlug } });
export const listInvoices = () => apiFetch<{ invoices: { id: string; planSlug: string; amountInPaise: number; currency: string; status: string; createdAt: string; startDate: string | null; endDate: string | null }[] }>("/api/subscription/invoices");

// ── Admin ───────────────────────────────────────────────────────────────────
export interface UsageBucket { calls: number; failed: number; costUsd: number; inputTokens: number; cachedTokens: number; outputTokens: number; reasoningTokens: number; latencyMs: number; avgLatencyMs: number }
export interface AiUsageResponse { from: string; to: string; truncated: boolean; total: UsageBucket; byPurpose: Record<string, UsageBucket>; byModel: Record<string, UsageBucket>; byDay: Record<string, UsageBucket> }
export const getAiUsage = (from?: string, to?: string) => {
  const sp = new URLSearchParams(); if (from) sp.set("from", from); if (to) sp.set("to", to);
  const s = sp.toString();
  return apiFetch<AiUsageResponse>(`/api/admin/ai-usage${s ? `?${s}` : ""}`);
};
export interface PregenJob { id: string; status: string; batchId?: string | null; requested?: number; processed?: number; createdAt?: string; updatedAt?: string; [k: string]: unknown }
export const getFlagged = () => apiFetch<{ items: FlaggedProblem[] }>("/api/admin/problems/flagged");
export const pregen = (body: { action: "status" | "deficits" | "submit" | "collect"; jobId?: string; maxRequests?: number; poolMin?: number; companies?: string[] }) =>
  apiFetch<{ jobs?: PregenJob[]; poolMin?: number; cells?: { topic: string; difficulty: Difficulty; have: number; need: number }[]; totalNeed?: number; job?: PregenJob | null; message?: string; collected?: { id: string; status: string; processed: number; batchStatus: string }[] }>("/api/admin/pregen", { method: "POST", body });
export const leaderboardSnapshot = (action: "snapshot" | "daily" = "snapshot") =>
  apiFetch<{ global?: { total: number }; week?: { week: string }; ms?: number; created?: boolean; challenge?: unknown }>("/api/admin/leaderboard-snapshot", { method: "POST", body: { action } });
export interface FlaggedProblem { id: string; slug: string; title: string; difficulty: Difficulty; status: "draft" | "verified" | "retired"; tags: string[]; flagCount: number; flagReasons: string[]; reports: { id: string; uid: string; reason: string; details: string; createdAt: string | null }[] }
export const setProblemStatus = (id: string, status: "verified" | "retired") => apiFetch<{ ok: true; status: string }>(`/api/admin/problems/${id}`, { method: "PATCH", body: { status } });

// ── Contact ─────────────────────────────────────────────────────────────────
export const sendContact = (body: { name: string; email: string; subject: string; message: string }) =>
  apiFetch<{ ok: true }>("/api/contact", { method: "POST", body, anonymous: true });

export type { Difficulty, Language, ItemStatus, PracticeState };
