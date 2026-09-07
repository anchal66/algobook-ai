import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";

/** Vercel Cron authentication: `Authorization: Bearer $CRON_SECRET`, compared in constant time. */
export function assertCron(req: Request): void {
  const secret = env.CRON_SECRET;
  if (!secret) throw ApiError.forbidden("CRON_SECRET is not configured");
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw ApiError.unauthenticated("Bad cron secret");
}
