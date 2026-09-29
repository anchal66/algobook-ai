import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { LanguageSchema } from "@/lib/data/schema";
import { roomSubmit } from "@/lib/rooms/play";

export const maxDuration = 60;
const BodySchema = z.object({ index: z.number().int().min(0).max(9), language: LanguageSchema, code: z.string().min(1).max(100_000) });

/** Contest submit: judge, score, leaderboard (per-problem cap, `submit` quota). */
export const POST = handler({ evt: "rooms.submit", feature: "submit", body: BodySchema }, async ({ user, body, params }) => roomSubmit(user, params.id, body.index, body.language, body.code));
