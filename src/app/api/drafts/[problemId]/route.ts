import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as drafts from "@/lib/data/drafts";
import { LanguageSchema, serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "drafts.get" }, async ({ user, params }) => ({
  draft: serialize(await drafts.get(user.uid, params.problemId)),
}));

export const PUT = handler(
  { evt: "drafts.put", body: z.object({ language: LanguageSchema, code: z.string().max(100_000) }) },
  async ({ user, params, body }) => ({ draft: serialize(await drafts.put(user.uid, params.problemId, body.language, body.code)) }),
);
