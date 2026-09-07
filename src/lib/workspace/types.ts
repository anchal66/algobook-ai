/**
 * Wire types consumed by the workspace (Module 03). Derived from the zod schemas so the
 * client and the route handlers cannot drift. Type-only imports: nothing from firebase-admin
 * reaches the browser bundle.
 */
import type {
  Difficulty, Draft, FailedCase, Language, Note, PlanInfo, Problem, ProblemEditorial, Project, ProjectItem,
  RecommendationReason, Serialized, Submission, User, WithId, CaseResult, FeatureKey, ReportReason,
} from "@/types";

export type { Language, Difficulty, CaseResult, ReportReason };

export type ProblemDTO = Serialized<Omit<WithId<Problem>, "embedding">>;
export interface LanguageInfo { key: Language; label: string; version: string; monaco: string; ready: boolean }
export type DraftDTO = Serialized<Draft>;
export type NoteDTO = Serialized<Note>;

export interface ProblemResponse { problem: ProblemDTO; languages: LanguageInfo[]; draft: DraftDTO | null }

export type ProjectDTO = Serialized<WithId<Project>>;
export type ProjectItemDTO = Serialized<WithId<ProjectItem>>;
export interface ProjectResponse { project: ProjectDTO; items: ProjectItemDTO[] }

export interface ProblemSummaryDTO {
  id: string; slug: string; number: number | null; title: string; difficulty: Difficulty; tags: string[]; companies: string[];
  languages: Language[]; acceptanceRate: number; attempts: number; rating: number; source: Problem["source"]; status: Problem["status"];
}
export interface ProblemListResponse { items: ProblemSummaryDTO[]; nextCursor: string | null }

export interface RunCaseInput { input: string; expected?: string }
export interface RunResponse { cases: CaseResult[] }

export type FailedCaseDTO = FailedCase & { status?: CaseResult["status"]; hidden?: boolean };
export type SubmissionDTO = Omit<Serialized<WithId<Submission>>, "failedCase"> & { failedCase: FailedCaseDTO | null };
export type SubmissionListItem = Omit<SubmissionDTO, "code">;
export interface SubmitMeta { hintsUsed: number; editorialViewed: boolean; timeSpentSec: number; runCount: number }
export interface SubmitResponse { submission: Omit<SubmissionDTO, "code"> & { xpEarned: number }; judge: { runtimeMs: number; memoryKb: number } }
export interface SubmissionsResponse { items: SubmissionListItem[]; nextCursor: string | null }

export interface HintResponse { level: 1 | 2 | 3; label: string; text: string; source: "stored" | "contextual" }
export type EditorialDTO = Pick<ProblemEditorial, "overview" | "approaches" | "pitfalls" | "model">;
export interface EditorialResponse { editorial: EditorialDTO; cached: boolean }
export type ReviewDTO = Serialized<NonNullable<Submission["review"]>>;
export interface ReviewResponse { review: ReviewDTO; cached: boolean }
export interface ExplainResponse { explanation: string }
export interface CompleteResponse { text: string }
export interface EnsureLanguageResponse { language: Language; status: "ready" | "queued" | "running" | "done" | "failed"; starter: string | null }
export interface ChatTurn { role: "user" | "assistant"; content: string }

export type MeUser = Serialized<Omit<User, "plan" | "quotas">> & { uid: string };
export interface MeResponse {
  user: MeUser;
  plan: PlanInfo;
  isAdmin: boolean;
  quotas: { date: string; used: Partial<Record<FeatureKey, number>>; limits: Record<FeatureKey, number>; resetAt: string };
}

export type GenerationStage = "searching" | "generating" | "validating" | "verifying" | "repairing" | "persisting" | "done";
export interface NextResult {
  item: ProjectItemDTO;
  problem: ProblemDTO;
  languages: { key: Language; ready: boolean }[];
  reason: RecommendationReason;
  source: "reused" | "generated";
  attempts: number;
  latencyMs: number;
}
export interface StageEvent { stage: GenerationStage; [k: string]: unknown }
