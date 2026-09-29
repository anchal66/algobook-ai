import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as rooms from "@/lib/data/rooms";
import { roomCard } from "@/app/api/rooms/route";
import { closeRoom } from "@/lib/rooms/service";

export const GET = handler({ evt: "admin.rooms", admin: true, query: z.object({ status: z.enum(["lobby", "running", "finalising", "finished", "cancelled"]).default("running") }) }, async ({ query }) => ({ rooms: (await rooms.listByStatus(query.status, 100)).map((r) => roomCard(r)) }));
export const POST = handler({ evt: "admin.rooms_cancel", admin: true, body: z.object({ roomId: z.string() }) }, async ({ body }) => { const r = await rooms.getRoom(body.roomId); if (r && r.status !== "finished") await closeRoom(r, "cancelled"); return { ok: true }; });
