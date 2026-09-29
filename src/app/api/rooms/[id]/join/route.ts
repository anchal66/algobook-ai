import { handler } from "@/lib/api/handler";
import { joinRoom } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.join" }, async ({ user, params }) => { const out = await joinRoom(user, params.id); return { roomId: out.room.id, state: out.member.state }; });
