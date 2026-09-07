/** Dev helper: shows what recommend()+findReusable() would do for a user/prompt without generating. */
import { args } from "./_bootstrap";
import * as users from "../src/lib/data/users";
import * as projects from "../src/lib/data/projects";
import * as problems from "../src/lib/data/problems";
import { recommend, getSeenProblemIds, summarizeForPrompt } from "../src/lib/practice";
import { findReusable } from "../src/lib/ai/generate";

async function main() {
  const a = args();
  const uid = String(a.uid); const projectId = String(a.project); const userPrompt = a.prompt ? String(a.prompt) : undefined;
  const user = (await users.getUser(uid))!;
  const project = (await projects.get(projectId))!;
  const items = await projects.getItems(projectId);
  const rec = await recommend({ uid, user, project, existingItems: items, userPrompt });
  const seen = await getSeenProblemIds(uid);
  console.log("recommendation", JSON.stringify({ difficulty: rec.difficulty, topics: rec.topics, avoid: rec.avoidTopics, reason: rec.reason.short }));
  console.log("seen", seen);
  const s = await problems.search({ tags: ["array"], difficulty: rec.difficulty, status: "verified", excludeIds: seen, limit: 20 });
  console.log("search(array)", s.items.map((i) => `${i.id}:${i.title}:${i.tags}`));
  const r = await findReusable({ uid, projectId, recommendation: rec, profileSummary: summarizeForPrompt(user), recentTitles: [], userPrompt, experienceLevel: project.experienceLevel, goalType: project.goalType, projectDescription: "", seenProblemIds: seen, userRating: user.stats.rating });
  console.log("reusable", r ? `${r.problem.id} ${r.problem.title} ($${r.costUsd})` : null);
}
main().catch((e) => { console.error(e); process.exit(1); });
