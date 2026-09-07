import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import { serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "projects.get" }, async ({ user, params }) => {
  const project = await projects.getOwned(params.id, user.uid);
  const items = await projects.getItems(project.id);
  return { project: serialize(project), items: serialize(items) };
});

export const DELETE = handler({ evt: "projects.delete" }, async ({ user, params }) => {
  await projects.remove(params.id, user.uid);
  return { ok: true };
});
