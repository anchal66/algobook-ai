import { handler } from "@/lib/api/handler";
import { rematch } from "@/lib/rooms/play";
export const maxDuration = 60;
export const POST = handler({ evt: "rooms.rematch" }, async ({ user, params }) => { const out = await rematch(user, params.id); return { roomId: out.room.id, code: out.code }; });
