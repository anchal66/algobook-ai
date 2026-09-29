import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { startRoom } from "@/lib/rooms/service";

export const maxDuration = 120;

/** Host starts the contest (budget guard §3.12, language fan-out, reveal). `force` overrides the schedule / solo checks. */
export const POST = handler({ evt: "rooms.start", body: z.object({ force: z.boolean().optional() }).default({}) }, async ({ user, body, params }) => {
  const room = await startRoom(user, params.id, { force: body.force });
  return { status: room.status, startedAt: room.startedAt?.toDate().toISOString() ?? null, endsAt: room.endsAt?.toDate().toISOString() ?? null };
});
