import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { LanguageSchema, serialize } from "@/lib/data/schema";
import { roomProblem, skipProblem } from "@/lib/rooms/play";

const QuerySchema = z.object({ lang: LanguageSchema.optional() });

/** Problem `index` of the room for the arena (public fields, allowed languages, my per-problem state). */
export const GET = handler({ evt: "rooms.problem", query: QuerySchema }, async ({ user, params, query }) => {
  const index = Number(params.index);
  if (!Number.isInteger(index) || index < 0) throw ApiError.validation("Bad problem index");
  const out = await roomProblem(user, params.id, index, query.lang);
  return { problem: serialize(out.problem), languages: out.languages, mine: out.mine ? serialize(out.mine) : null };
});

/** Sequential mode: skip the current problem. */
export const POST = handler({ evt: "rooms.problem_skip" }, async ({ user, params }) => skipProblem(user, params.id, Number(params.index)));
