import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { setReady } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.ready", body: z.object({ ready: z.boolean() }) }, async ({ user, body, params }) => { await setReady(user, params.id, body.ready); return { ok: true }; });
