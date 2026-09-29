import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { memberAction } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.member_action", body: z.object({ action: z.enum(["accept", "reject", "kick"]) }) }, async ({ user, body, params }) => {
  await memberAction(user, params.id, params.uid, body.action);
  return { ok: true };
});
