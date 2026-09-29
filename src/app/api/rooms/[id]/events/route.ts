import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { hostEvents, recordEvents } from "@/lib/rooms/play";

const BodySchema = z.object({
  events: z.array(z.object({ type: z.string().max(30), at: z.number(), meta: z.record(z.string(), z.unknown()).optional(), clientSeq: z.number().int(), sessionId: z.string().max(64).optional() })).min(1).max(20),
});

/** Batched integrity events + heartbeat (§3.9). Returns the member's live violations and score. */
export const POST = handler({ evt: "rooms.events", body: BodySchema }, async ({ user, body, params }) => recordEvents(user, params.id, body.events));

/** Integrity log: the host sees everyone (`?uid=` to filter); a member sees only their own. */
export const GET = handler({ evt: "rooms.events_list", query: z.object({ uid: z.string().optional() }) }, async ({ user, params, query }) => ({ events: await hostEvents(user, params.id, query.uid ?? undefined) }));
