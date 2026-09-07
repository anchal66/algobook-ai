import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as notes from "@/lib/data/notes";
import { serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "notes.get" }, async ({ user, params }) => ({
  note: serialize(await notes.get(user.uid, params.problemId)),
}));

export const PUT = handler(
  { evt: "notes.put", body: z.object({ markdown: z.string().max(100_000) }) },
  async ({ user, params, body }) => ({ note: serialize(await notes.put(user.uid, params.problemId, body.markdown)) }),
);
