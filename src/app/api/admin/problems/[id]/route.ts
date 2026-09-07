import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";

/** `PATCH /api/admin/problems/:id` (Module 05 U-20): retire or restore a problem. */
export const PATCH = handler({ evt: "admin.problems.status", admin: true, body: z.object({ status: z.enum(["verified", "retired"]) }) }, async ({ params, body }) => {
  const p = await problems.getPublic(params.id);
  if (!p) throw ApiError.notFound("Problem not found");
  await problems.setStatus(p.id, body.status);
  return { ok: true as const, status: body.status };
});
