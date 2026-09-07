import { handler } from "@/lib/api/handler";
import { serialize } from "@/lib/data/schema";
import { getInterview } from "@/lib/practice/interview";

/** Interview state for the workspace countdown (owner only). */
export const GET = handler({ evt: "interview.get" }, async ({ user, params }) => {
  const it = await getInterview(params.id, user.uid);
  const remainingSec = Math.max(0, Math.round((it.endsAt.toMillis() - Date.now()) / 1000));
  return { interview: serialize(it), remainingSec, expired: it.status === "active" && remainingSec === 0 };
});
