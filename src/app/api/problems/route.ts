import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as problems from "@/lib/data/problems";
import { DifficultySchema, ProblemStatusSchema } from "@/lib/data/schema";

const QuerySchema = z.object({
  tags: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  status: ProblemStatusSchema.optional(),
  q: z.string().max(80).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = handler({ evt: "problems.list", query: QuerySchema }, async ({ user, query }) => {
  // Only admins may list non-verified problems.
  const status = user.isAdmin ? query.status ?? "verified" : "verified";
  const result = await problems.search({
    tags: query.tags ? query.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    difficulty: query.difficulty,
    status,
    cursor: query.cursor,
    limit: query.limit,
  });
  const q = query.q?.toLowerCase();
  const items = q ? result.items.filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q)) : result.items;
  return { items, nextCursor: result.nextCursor };
});
