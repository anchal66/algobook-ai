import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import { serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "projects.get" }, async ({ user, params }) => {
  const project = await projects.getOwned(params.id, user.uid);
  const items = await projects.getItems(project.id);
  return { project: serialize(project), items: serialize(items) };
});

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  purpose: z.string().max(200).optional(),
  selectedTopics: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
});

/** Module 05 (U-15 Settings tab): rename, topics, duration. */
export const PATCH = handler({ evt: "projects.patch", body: PatchSchema }, async ({ user, params, body }) => ({
  project: serialize(await projects.update(params.id, user.uid, body)),
}));

export const DELETE = handler({ evt: "projects.delete" }, async ({ user, params }) => {
  await projects.remove(params.id, user.uid);
  return { ok: true };
});
