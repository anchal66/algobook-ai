import { handler } from "@/lib/api/handler";
import { serialize } from "@/lib/data/schema";
import { listInterviews } from "@/lib/practice/interview";

/** `GET /api/interview` (Module 05 U-18): the user's past and active mock interviews, newest first. */
export const GET = handler({ evt: "interview.list" }, async ({ user }) => ({ interviews: serialize(await listInterviews(user.uid, 30)) }));
