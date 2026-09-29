import { handler } from "@/lib/api/handler";
import * as rooms from "@/lib/data/rooms";
import { requireParticipant } from "@/lib/rooms/service";
import { buildLeaderboard, finaliseIfDue } from "@/lib/rooms/play";

/** Live standings (honours frozen / hidden for members; the host always sees live). */
export const GET = handler({ evt: "rooms.leaderboard" }, async ({ user, params }) => {
  const { room } = await requireParticipant(params.id, user.uid);
  const r = await finaliseIfDue(room);
  const members = await rooms.listMembers(r.id);
  return { ...buildLeaderboard(r, members, user.uid), status: r.status, endsAt: r.endsAt?.toDate().toISOString() ?? null, now: new Date().toISOString() };
});
