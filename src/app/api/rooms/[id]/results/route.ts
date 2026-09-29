import { handler } from "@/lib/api/handler";
import { results } from "@/lib/rooms/play";

/** Final standings, per-problem stats, timeline, my integrity report, similarity flags (host sees all). */
export const GET = handler({ evt: "rooms.results", auth: "optional" }, async ({ user, params }) => results(user, params.id));
