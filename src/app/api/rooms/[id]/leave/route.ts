import { handler } from "@/lib/api/handler";
import { leaveRoom } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.leave" }, async ({ user, params }) => { await leaveRoom(user, params.id); return { ok: true }; });
