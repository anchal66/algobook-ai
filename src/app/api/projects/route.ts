import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as projects from "@/lib/data/projects";
import { ExperienceLevelSchema, GoalTypeSchema, serialize } from "@/lib/data/schema";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  purpose: z.string().max(200).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  experienceLevel: ExperienceLevelSchema.optional(),
  goalType: GoalTypeSchema.optional(),
  selectedTopics: z.array(z.string().trim().min(1)).max(30).optional(),
  templateId: z.string().regex(/^[a-z]+$/).nullable().optional(),
});

export const GET = handler({ evt: "projects.list" }, async ({ user }) => ({
  projects: serialize(await projects.listForUser(user.uid)),
}));

export const POST = handler({ evt: "projects.create", body: CreateSchema }, async ({ user, body }) => ({
  project: serialize(await projects.create({ uid: user.uid, ...body })),
}));
