import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as rooms from "@/lib/data/rooms";
import { consentVersion, getRoomOrThrow, settingsOf, summarize, updateSettings } from "@/lib/rooms/service";
import { buildLeaderboard, finaliseIfDue } from "@/lib/rooms/play";
import { estimateBatches, budgetLevel } from "@/lib/rooms/budget";
import { budgetStatus } from "@/lib/judge/budget";
import { rulesFor } from "@/lib/rooms/integrity";
import { roomCard } from "@/app/api/rooms/route";

/** Room detail for the lobby / arena / results shell: room, roster, my member doc, leaderboard, consent text. Polled by the client. */
export const GET = handler({ evt: "rooms.get" }, async ({ user, params }) => {
  let room = await getRoomOrThrow(params.id);
  room = await finaliseIfDue(room);
  const members = await rooms.listMembers(room.id);
  const me = members.find((m) => m.uid === user.uid) ?? null;
  const isHost = room.hostUid === user.uid || user.isAdmin;
  const isMember = !!me && (me.state === "accepted" || me.state === "pending" || me.state === "left");
  if (!isMember && !isHost && room.visibility !== "public") throw ApiError.notFound("Room not found");
  const settings = settingsOf(room);
  const visibleMembers = members.filter((m) => m.state === "accepted" || m.state === "left" || (isHost && m.state === "pending"));
  const board = (room.status === "running" || room.status === "finalising" || room.status === "finished") ? buildLeaderboard(room, members, user.uid) : null;
  const b = isHost && room.status === "lobby" ? await budgetStatus() : null;
  return {
    room: {
      ...roomCard(room, me), code: isMember || isHost ? room.code : null, settings, summary: summarize(settings),
      slots: room.slots.map((s) => ({ index: s.index, difficulty: s.difficulty, topics: s.topics, status: s.status, error: s.error, problemId: isHost ? s.problemId : null })),
      problemSet: room.status === "lobby" ? [] : room.problemSet, capacityHit: room.capacityHit, finalised: room.finalised, rematchOf: room.rematchOf,
      rules: rulesFor(settings.integrity.strictness), consentVersion: consentVersion(settings),
    },
    members: visibleMembers.map((m) => ({ uid: m.uid, username: m.username, displayName: m.displayName, photoURL: m.photoURL, role: m.role, state: m.state, ready: m.ready, online: !!m.presence.lastSeenAt && Date.now() - m.presence.lastSeenAt.toMillis() < 45_000, joinedAt: m.joinedAt.toDate().toISOString() })),
    me: me ? { uid: me.uid, state: me.state, role: me.role, ready: me.ready, consented: !!me.consentedAt && me.consentVersion === consentVersion(settings), unlockedIndex: me.unlockedIndex, score: { raw: me.score.raw, final: me.score.final, solved: me.score.solved, penaltyPct: me.violations.penaltyPct }, violations: me.violations, perProblem: Object.fromEntries(Object.entries(me.perProblem).map(([pid, p]) => [pid, { status: p.status, points: p.points, attempts: p.attempts, runs: p.runs }])), rank: me.rank, ratingDelta: me.ratingDelta } : null,
    leaderboard: board,
    budget: b ? { ...b, estimate: estimateBatches(room.acceptedCount, settings.count, settings.caps), level: budgetLevel(estimateBatches(room.acceptedCount, settings.count, settings.caps), b.remaining, b.cap) } : null,
    now: new Date().toISOString(),
  };
});

/** Host edits settings while in the lobby (problem settings re-plan the slots). */
export const PATCH = handler({ evt: "rooms.patch", body: z.record(z.string(), z.unknown()) }, async ({ user, body, params }) => {
  const room = await updateSettings(user, params.id, body);
  return { room: roomCard(room) };
});
