import { z } from "zod";
import { handler } from "@/lib/api/handler";
import * as rooms from "@/lib/data/rooms";
import { createRoom, settingsOf } from "@/lib/rooms/service";
import { finaliseIfDue } from "@/lib/rooms/play";
import { estimateBatches } from "@/lib/rooms/budget";
import type { Room, RoomMember, WithId } from "@/lib/data/schema";

export const maxDuration = 60;

export function roomCard(room: WithId<Room>, member?: WithId<RoomMember> | null) {
  const s = settingsOf(room);
  return {
    id: room.id, name: room.name, description: room.description, avatar: room.avatar, status: room.status, visibility: room.visibility, host: room.host, hostUid: room.hostUid,
    memberCount: room.memberCount, acceptedCount: room.acceptedCount, maxMembers: s.maxMembers, count: room.status === "lobby" ? s.count : room.problemSet.length,
    durationMin: s.durationMin, difficultyMode: s.difficultyMode, fixedDifficulty: s.fixedDifficulty, topicMode: s.topicMode, topicPool: s.topicPool, languages: s.languages,
    rated: s.rated, joinApproval: s.joinApproval, scheduledAt: room.scheduledAt?.toDate().toISOString() ?? null, startedAt: room.startedAt?.toDate().toISOString() ?? null,
    endsAt: room.endsAt?.toDate().toISOString() ?? null, finishedAt: room.finishedAt?.toDate().toISOString() ?? null, createdAt: room.createdAt.toDate().toISOString(),
    estimate: estimateBatches(room.acceptedCount, room.status === "lobby" ? s.count : room.problemSet.length, s.caps),
    mine: member ? { state: member.state, role: member.role, rank: member.rank, final: member.score.final, solved: member.score.solved, ratingDelta: member.ratingDelta } : null,
  };
}

/** Pro hosts create rooms (quota `roomCreate`). Body = RoomSettings. */
export const POST = handler({ evt: "rooms.create", feature: "roomCreate", body: z.record(z.string(), z.unknown()) }, async ({ user, body }) => {
  const out = await createRoom(user, body);
  return { room: roomCard(out.room), code: out.code, missing: out.missing };
});

const QuerySchema = z.object({ scope: z.enum(["public", "mine", "history"]).default("public") });

/** Public lobbies, my live rooms, or my finished rooms. */
export const GET = handler({ evt: "rooms.list", query: QuerySchema }, async ({ user, query }) => {
  if (query.scope === "public") {
    const list = await rooms.listPublicLobbies(50);
    return { rooms: list.map((r) => roomCard(r)) };
  }
  const mine = await rooms.listForUser(user.uid, 60);
  const wanted = query.scope === "mine" ? ["lobby", "running", "finalising"] : ["finished", "cancelled"];
  const out = [];
  for (const { room, member } of mine) {
    const r = await finaliseIfDue(room);
    if (wanted.includes(r.status) && member.state !== "rejected") out.push(roomCard(r, member));
  }
  return { rooms: out };
});
