import { handler } from "@/lib/api/handler";
import { endRoom } from "@/lib/rooms/play";
export const maxDuration = 120;
export const POST = handler({ evt: "rooms.end" }, async ({ user, params }) => { const room = await endRoom(user, params.id); return { status: room.status }; });
