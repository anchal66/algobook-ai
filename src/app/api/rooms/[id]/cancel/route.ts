import { handler } from "@/lib/api/handler";
import { cancelRoom } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.cancel" }, async ({ user, params }) => { await cancelRoom(user, params.id); return { ok: true }; });
