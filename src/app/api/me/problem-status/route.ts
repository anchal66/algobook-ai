import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import * as submissions from "@/lib/data/submissions";

/** `GET /api/me/problem-status` (Module 05 U-13): solved / attempting problem ids for the Explore status column. */
export const GET = handler({ evt: "me.problemStatus" }, async ({ user }) => {
  const [solved, attempting] = await Promise.all([submissions.acceptedProblemIds(user.uid), projects.attemptingProblemIdsForUser(user.uid)]);
  const solvedSet = new Set(solved);
  return { solved, attempting: attempting.filter((id) => !solvedSet.has(id)) };
});
