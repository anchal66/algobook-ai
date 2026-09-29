import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { sseResponse } from "@/lib/api/sse";
import { prepareSlot } from "@/lib/rooms/service";

export const maxDuration = 300;

/** SSE: generates one missing slot (stages like /solve/next), then `done` with the slot result. */
export const POST = handler({ evt: "rooms.prepare", body: z.object({ index: z.number().int().min(0).max(9) }) }, async ({ user, body, params }) => {
  return sseResponse(async (send) => {
    const out = await prepareSlot(user, params.id, body.index, (stage, info) => send("stage", { stage, ...(info ?? {}) }));
    send("done", out);
  });
});
