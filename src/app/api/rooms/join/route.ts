import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { joinByCode } from "@/lib/rooms/service";

/** Join a room with its 6-digit code (quota `roomJoin`). Returns the room id; the client navigates to the lobby. */
export const POST = handler({ evt: "rooms.join_code", body: z.object({ code: z.string().min(6).max(12) }) }, async ({ user, body }) => {
  const out = await joinByCode(user, body.code);
  return { roomId: out.room.id, state: out.member.state };
});
