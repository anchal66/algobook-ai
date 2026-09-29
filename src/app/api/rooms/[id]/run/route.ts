import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { LanguageSchema } from "@/lib/data/schema";
import { roomRun } from "@/lib/rooms/play";

export const maxDuration = 60;
const BodySchema = z.object({
  index: z.number().int().min(0).max(9),
  language: LanguageSchema,
  code: z.string().max(100_000),
  cases: z.array(z.object({ input: z.string().max(65_536), expected: z.string().max(65_536).optional() })).min(1).max(6),
});

/** Run on samples/custom cases inside the arena (per-problem cap, `run` quota). */
export const POST = handler({ evt: "rooms.run", feature: "run", body: BodySchema }, async ({ user, body, params }) => roomRun(user, params.id, body.index, body.language, body.code, body.cases));
