import { handler } from "@/lib/api/handler";
import { assertCron } from "@/lib/api/cron";
import { sweep } from "@/lib/rooms/play";

export const maxDuration = 300;

/** Vercel Cron (hourly): finalise rooms past their end, cancel idle lobbies, drop expired codes. */
export const GET = handler({ evt: "cron.rooms", auth: "none" }, async ({ req }) => { assertCron(req); return sweep(); });
