import "server-only";
/**
 * Practice-intelligence surface consumed by `/api/projects/:id/next` (Module 02) and the
 * Module 04 routes. `recommend()` / `summarizeForPrompt()` keep the Module 02 signatures;
 * the pure engine lives in `recommend.ts` and friends.
 */
import type { Project, ProjectItem, User, WithId } from "@/lib/data/schema";
import { todayKey } from "@/lib/data/schema";
import * as projects from "@/lib/data/projects";
import * as problems from "@/lib/data/problems";
import * as submissions from "@/lib/data/submissions";
import { CORE_TOPICS, INTERVIEW_PATTERNS, normalizeTags, type CoreTopic } from "@/lib/practice/topics";
import { recommendPure, scoreTemplatePool, summarizeForPrompt as summarizePure, templateRecommendation, topicsFromTitle, type Recommendation } from "@/lib/practice/recommend";

export { CORE_TOPICS, INTERVIEW_PATTERNS, normalizeTags, topicsFromTitle };
export type { CoreTopic, Recommendation };

export interface RecommendInput {
  uid: string;
  user: User;
  project: WithId<Project>;
  existingItems: WithId<ProjectItem>[];
  userPrompt?: string;
  topicFilter?: string[];
  /** Client session-health score (0–100) from `session-tracker.ts`; the server clamps its effect to ±1 level. */
  sessionHealthScore?: number | null;
  seed?: number;
}

/** Union of every problem linked to the user's projects and every accepted submission. */
export async function getSeenProblemIds(uid: string): Promise<string[]> {
  const [fromItems, fromAccepted] = await Promise.all([projects.itemProblemIdsForUser(uid), submissions.acceptedProblemIds(uid)]);
  return [...new Set([...fromItems, ...fromAccepted])];
}

/**
 * Template projects: score the pending company-list entries (v1 scoring) and prefer the best-scored
 * entry that already has a pre-generated verified problem the user has not seen (Module 02 A-17), so
 * template projects rarely pay for generation. A prompt that matches a title still wins outright.
 * Other projects: the bandit recommender.
 */
export async function recommend(input: RecommendInput): Promise<Recommendation> {
  const today = todayKey();
  const { user, project, existingItems } = input;

  if (project.templateId) {
    const pool = await projects.listPendingPool(project.id, 40);
    if (pool.length) {
      const scored = scoreTemplatePool(user, pool, existingItems, { userPrompt: input.userPrompt, topicFilter: input.topicFilter, seed: input.seed, today });
      let pick = scored[0];
      const facts: string[] = [];
      if (!pick.matchedPrompt) {
        const [seenIds, ready] = await Promise.all([getSeenProblemIds(input.uid), problems.verifiedTemplateTitles(project.templateId)]);
        const seen = new Set(seenIds);
        const prepared = scored.find((c) => (ready.get(c.entry.title) ?? []).some((id) => !seen.has(id)));
        if (prepared && prepared !== pick) {
          facts.push(`Chosen ahead of "${pick.entry.title}" (#${pick.entry.order + 1}) because a verified problem for it is already prepared`);
          pick = prepared;
        } else if (prepared) {
          facts.push("A verified problem for this entry is already prepared");
        }
      }
      return templateRecommendation(user, pick, project.templateId, existingItems, today, facts);
    }
  }

  return recommendPure({
    user, project, existingItems, userPrompt: input.userPrompt, topicFilter: input.topicFilter,
    sessionHealthScore: input.sessionHealthScore, seed: input.seed, today,
  });
}

/** ≤ 400-char profile summary for generation prompts (Module 04 §3.6). */
export function summarizeForPrompt(user: User): string {
  return summarizePure(user, todayKey());
}
