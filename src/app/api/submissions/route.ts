import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as submissions from "@/lib/data/submissions";
import { serialize } from "@/lib/data/schema";

const QuerySchema = z.object({
  problemId: z.string().optional(),
  projectId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = handler({ evt: "submissions.list", query: QuerySchema }, async ({ user, query }) => {
  const { items, nextCursor } = await submissions.list(user.uid, query);
  return { items: serialize(items), nextCursor };
});
