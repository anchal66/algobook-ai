import { handler } from "@/lib/api/handler";
import * as problems from "@/lib/data/problems";
import * as projects from "@/lib/data/projects";
import * as drafts from "@/lib/data/drafts";
import * as submissions from "@/lib/data/submissions";

/** `GET /api/me/continue` (Module 05 U-12): the last problem the user typed in, with the project it belongs to (if any). */
export const GET = handler({ evt: "me.continue" }, async ({ user }) => {
  const last = user.doc.lastOpened;
  if (!last) return { item: null };
  const p = await problems.getPublic(last.problemId);
  if (!p || p.status !== "verified") return { item: null };
  const [projectId, solved, draft] = await Promise.all([
    projects.findProjectWithItem(user.uid, p.id),
    submissions.hasAccepted(user.uid, p.id),
    drafts.get(user.uid, p.id),
  ]);
  return {
    item: {
      id: p.id, slug: p.slug, number: p.number, title: p.title, difficulty: p.difficulty, tags: p.tags,
      language: last.language, at: last.at.toDate().toISOString(), projectId, solved,
      draftChars: draft?.code?.[last.language]?.length ?? 0,
      href: projectId ? `/project/${projectId}/solve/${p.id}` : `/problems/${p.slug}`,
    },
  };
});
