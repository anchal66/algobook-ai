import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { Timestamp } from "firebase-admin/firestore";
import * as drafts from "@/lib/data/drafts";
import { adminDb } from "@/lib/firebase-admin";
import { LanguageSchema, serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "drafts.get" }, async ({ user, params }) => ({
  draft: serialize(await drafts.get(user.uid, params.problemId)),
}));

export const PUT = handler(
  { evt: "drafts.put", body: z.object({ language: LanguageSchema, code: z.string().max(100_000) }) },
  async ({ user, params, body }) => {
    const draft = await drafts.put(user.uid, params.problemId, body.language, body.code);
    // Module 05: remember the last problem worked on for the dashboard "Continue" card (fire-and-forget).
    void adminDb.collection("users").doc(user.uid).update({ lastOpened: { problemId: params.problemId, language: body.language, at: Timestamp.now() } }).catch(() => {});
    return { draft: serialize(draft) };
  },
);
