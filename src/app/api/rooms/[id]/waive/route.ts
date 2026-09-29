import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { waiveSimilarity } from "@/lib/rooms/play";

export const POST = handler({ evt: "rooms.waive", body: z.object({ uid: z.string(), problemId: z.string() }) }, async ({ user, body, params }) => { await waiveSimilarity(user, params.id, body.uid, body.problemId); return { ok: true }; });
