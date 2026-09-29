import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { deleteChat, listChat, postChat } from "@/lib/rooms/play";

export const GET = handler({ evt: "rooms.chat_list", query: z.object({ after: z.string().optional() }) }, async ({ user, params, query }) => ({ messages: await listChat(user, params.id, Number(query.after ?? 0) || 0) }));
export const POST = handler({ evt: "rooms.chat_post", body: z.object({ text: z.string().min(1).max(300) }) }, async ({ user, body, params }) => ({ message: await postChat(user, params.id, body.text) }));
export const DELETE = handler({ evt: "rooms.chat_delete", query: z.object({ id: z.string() }) }, async ({ user, params, query }) => { await deleteChat(user, params.id, query.id); return { ok: true }; });
