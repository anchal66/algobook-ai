/**
 * Adapters from v2 API wire shapes to the v1 types still used by the legacy
 * pages (dashboard, profile, project pages). Delete with the legacy pages
 * (Modules 03/05). Pure functions — safe in client components.
 */
import type { Timestamp } from "firebase/firestore";
import type { Serialized, User, Project, Submission, WithId, TopicSkill } from "@/lib/data/schema";
import type { UserProfile, TopicSkill as LegacyTopicSkill, Submission as LegacySubmission, ProjectInsights, TemplateInfo } from "@/types/legacy";

export type UserDTO = Serialized<User> & { uid: string };
export type ProjectDTO = Serialized<WithId<Project>>;
export type SubmissionDTO = Serialized<Omit<WithId<Submission>, "code">>;

function fakeTimestamp(iso: string | null | undefined): Timestamp {
  const d = iso ? new Date(iso) : new Date(0);
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d, toMillis: () => d.getTime() } as unknown as Timestamp;
}

export function toLegacyTopicSkill(s: Serialized<TopicSkill>): LegacyTopicSkill {
  return {
    solved: s.solved, failed: s.failed, lastSeen: fakeTimestamp(s.lastSeen), easyCount: s.easy, mediumCount: s.medium, hardCount: s.hard,
    totalAttempts: s.attempts, firstTrySuccesses: s.firstTrySuccesses, avgTimeSeconds: s.avgTimeSec, masteryScore: s.mastery,
    nextReviewDate: s.srs.nextReview ?? "", interval: s.srs.interval, easeFactor: s.srs.ease, timeEfficiency: s.timeEfficiency,
    totalHintsUsed: s.hintsUsed, totalRunCount: s.runCount,
  };
}

export function toLegacyProfile(u: UserDTO): UserProfile {
  const topicSkills: Record<string, LegacyTopicSkill> = {};
  for (const [k, v] of Object.entries(u.topicSkills ?? {})) topicSkills[k] = toLegacyTopicSkill(v);
  return {
    userId: u.uid, username: u.username, usernameChangesLeft: u.usernameChangesLeft, displayName: u.displayName, email: u.email,
    photoURL: u.photoURL, bio: u.bio, company: u.company, address: u.location, college: u.college, githubUrl: u.githubUrl,
    linkedinUrl: u.linkedinUrl, skills: u.skills, experienceLevel: u.experienceLevel, goalType: u.goalType, practiceState: u.practiceState,
    topicSkills, totalSolved: u.stats.totalSolved, totalFailed: u.stats.totalFailed, currentStreak: u.stats.currentStreak,
    longestStreak: u.stats.longestStreak, lastActiveDate: u.stats.lastActiveDate, calibrationComplete: u.calibration.complete,
    calibrationStep: u.calibration.step,
  };
}

export function toLegacyProject(p: ProjectDTO) {
  return {
    id: p.id, title: p.title, description: p.description, purpose: p.purpose, duration: p.durationDays,
    activeDays: p.progress.activeDays, templateId: p.templateId ?? undefined, experienceLevel: p.experienceLevel, goalType: p.goalType,
    insights: (p.insights ?? undefined) as ProjectInsights | undefined,
    createdAt: { seconds: Math.floor(new Date(p.createdAt).getTime() / 1000), nanoseconds: 0 },
  };
}

export function toLegacyProgress(p: ProjectDTO) {
  return {
    totalQuestions: p.progress.items, totalSubmissions: 0, successfulSubmissions: p.progress.solved,
    lastActivity: p.lastActivityAt ? new Date(p.lastActivityAt) : null,
    easySolved: p.progress.easy, mediumSolved: p.progress.medium, hardSolved: p.progress.hard, attempting: p.progress.attempting,
  };
}

export function toLegacySubmission(s: SubmissionDTO): LegacySubmission {
  return {
    id: s.id, userId: s.uid, projectId: s.projectId ?? "", questionId: s.problemId, code: "",
    status: s.verdict === "AC" ? "success" : "fail", attemptNumber: s.attemptNumber, hintsUsed: s.hintsUsed,
    timeSpentSeconds: s.timeSpentSec, isFirstTry: s.isFirstTry, runCount: s.runCount, submittedAt: fakeTimestamp(s.createdAt),
  };
}

export function toLegacyTemplate(t: { id: string; company: string; title: string; description: string; purpose: string; count: number; difficulties: { easy: number; medium: number; hard: number } }): TemplateInfo {
  return { id: t.id, company: t.company, title: t.title, description: t.description, purpose: t.purpose, questionCount: t.count, difficulties: t.difficulties };
}
