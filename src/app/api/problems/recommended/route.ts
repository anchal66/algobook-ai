import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import * as problems from "@/lib/data/problems";
import { getSeenProblemIds, recommend } from "@/lib/practice";
import { Timestamp } from "firebase-admin/firestore";
import type { Project, WithId } from "@/lib/data/schema";

/**
 * `GET /api/problems/recommended` (Module 05 U-12): three verified pool problems the recommender (Module 04)
 * would serve next, with reasons. Uses the user's most recent non-system project for context (or a synthetic
 * "Explore" project), never generates, and excludes everything the user has already seen.
 */
export const GET = handler({ evt: "problems.recommended" }, async ({ user }) => {
  const [list, seenIds] = await Promise.all([projects.listForUser(user.uid, 10), getSeenProblemIds(user.uid)]);
  const real = list.find((p) => p.id !== user.doc.dailyProjectId && !p.purpose.startsWith("system:"));
  const project: WithId<Project> = real ?? {
    id: "explore", uid: user.uid, title: "Explore", description: "", purpose: "explore", durationDays: 30,
    experienceLevel: user.doc.experienceLevel, goalType: user.doc.goalType, selectedTopics: [], templateId: null, insights: null,
    progress: { items: 0, solved: 0, attempting: 0, easy: 0, medium: 0, hard: 0, activeDays: 0, onTrack: true, expectedSolved: 0 },
    lastActivityAt: null, lastActivityDate: "", createdAt: Timestamp.now(),
  };
  const existingItems = real ? await projects.getItems(real.id) : [];
  const exclude = new Set(seenIds);
  const picks: { id: string; slug: string; title: string; difficulty: string; tags: string[]; rating: number; reason: unknown; projectId: string | null }[] = [];

  for (let seed = 1; seed <= 4 && picks.length < 3; seed++) {
    const rec = await recommend({ uid: user.uid, user: user.doc, project, existingItems, seed });
    const topics = rec.promptTopicsForPool.length ? rec.promptTopicsForPool : rec.topics;
    for (const topic of topics.slice(0, 3)) {
      const res = await problems.search({ tags: [topic], difficulty: rec.difficulty, excludeIds: [...exclude], limit: 3 });
      const cand = res.items.find((p) => !exclude.has(p.id));
      if (cand) {
        exclude.add(cand.id);
        picks.push({ id: cand.id, slug: cand.slug, title: cand.title, difficulty: cand.difficulty, tags: cand.tags, rating: cand.rating, reason: rec.reason, projectId: real?.id ?? null });
        break;
      }
    }
  }
  // Fallback: any verified problems not yet seen.
  if (picks.length < 3) {
    const res = await problems.search({ excludeIds: [...exclude], limit: 3 - picks.length });
    for (const p of res.items) picks.push({ id: p.id, slug: p.slug, title: p.title, difficulty: p.difficulty, tags: p.tags, rating: p.rating, reason: { short: "Fresh from the verified pool", detail: "A problem you have not seen yet.", facts: [] }, projectId: null });
  }
  return { items: picks, practiceState: user.doc.practiceState };
});
