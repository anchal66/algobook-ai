import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { sseResponse } from "@/lib/api/sse";
import * as problems from "@/lib/data/problems";
import { assertNotInActiveInterview } from "@/lib/practice/interview";
import { LanguageSchema } from "@/lib/data/schema";
import { consumeQuota } from "@/lib/auth/quotas";
import { ChatTurnSchema } from "@/lib/ai/schemas";
import { streamChat } from "@/lib/ai/features";

export const maxDuration = 60;
const BodySchema = z.object({
  messages: z.array(ChatTurnSchema).min(1).max(16),
  code: z.string().max(100_000).optional(),
  language: LanguageSchema.optional(),
});

/** Scoped tutor chat (SSE: `delta` events, then `done`). Stateless — the client sends the last turns. */
export const POST = handler({ evt: "problems.chat", feature: "chat", body: BodySchema }, async ({ user, body, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  await assertNotInActiveInterview(user.uid, p.id);
  if (body.messages[body.messages.length - 1].role !== "user") throw ApiError.validation("The last message must be from the user");
  return sseResponse(async (send) => {
    try {
      const res = await streamChat(p, { uid: user.uid, language: body.language ?? user.doc.settings.editor.language, code: body.code, turns: body.messages }, (delta) => send("delta", { text: delta }));
      await consumeQuota(user.uid, "chat");
      send("done", { text: res.text, ...(user.isAdmin ? { costUsd: res.costUsd } : {}) });
    } catch (e) {
      send("error", { code: "UPSTREAM", message: (e as Error)?.message ?? "Chat failed" });
    }
  });
});
