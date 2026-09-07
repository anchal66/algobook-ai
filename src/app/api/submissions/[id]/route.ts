import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as submissions from "@/lib/data/submissions";
import { serialize } from "@/lib/data/schema";

/** Includes the code and the first failed case. */
export const GET = handler({ evt: "submissions.get" }, async ({ user, params }) => {
  const s = await submissions.get(params.id, user.uid);
  if (!s) throw ApiError.notFound("Submission not found");
  return { submission: serialize(s) };
});
