import "server-only";
/**
 * Room lifecycle (Module 06 §3.1 / §3.4 / §3.5): create → lobby (join, approve, edit, prepare) → start → consent.
 * Play-time operations (run, submit, events, leaderboard, finalise, results) live in `play.ts`.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import * as rooms from "@/lib/data/rooms";
import * as problems from "@/lib/data/problems";
import { RoomMemberSchema, RoomSchema, type Difficulty, type Room, type RoomMember, type RoomSlot, type User, type WithId } from "@/lib/data/schema";
import type { AuthedUser } from "@/lib/auth/types";
import { consumeQuota, assertQuota } from "@/lib/auth/quotas";
import { RoomSettingsSchema, expandSlots, summarize, type RoomSettings } from "@/lib/rooms/settings";
import { generateCode, normalizeCode } from "@/lib/rooms/codes";
import { canStart, estimateBatches } from "@/lib/rooms/budget";
import { pointsFor } from "@/lib/rooms/scoring";
import { budgetStatus, USER_RESERVE } from "@/lib/judge/budget";
import { getSeenProblemIds } from "@/lib/practice";
import { ensureLanguage } from "@/lib/ai/drivers";
import { rng } from "@/lib/practice/recommend";
import { CORE_TOPICS } from "@/lib/practice/topics";

export const LOBBY_IDLE_MS = 6 * 60 * 60 * 1000;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const LIVE_STATUSES: Room["status"][] = ["lobby", "running", "finalising"];

/** Firestore cannot store nested arrays: `perProblemTopics: string[][]` is stored as `{ topics: string[] }[]`. */
export function storeSettings(s: RoomSettings): Record<string, unknown> {
  return { ...s, perProblemTopics: s.perProblemTopics.map((topics) => ({ topics })) };
}

export function settingsOf(room: Pick<Room, "settings">): RoomSettings {
  const raw = room.settings as Record<string, unknown>;
  const ppt = Array.isArray(raw.perProblemTopics) ? (raw.perProblemTopics as unknown[]).map((x) => (Array.isArray(x) ? x : (x as { topics?: string[] })?.topics ?? [])) : [];
  return RoomSettingsSchema.parse({ ...raw, perProblemTopics: ppt });
}

export function identity(u: User): { username: string; displayName: string; photoURL: string } {
  return { username: u.username, displayName: u.displayName, photoURL: u.photoURL };
}

// ── Problem-set planning (§3.4) ─────────────────────────────────────────────

/** Fills slots from the verified pool (deterministic per seed); unfilled slots stay `missing`. */
export async function planSlots(settings: RoomSettings, exclude: Set<string>, seed: number): Promise<RoomSlot[]> {
  const rand = rng(seed);
  const chosen = new Set<string>();
  const out: RoomSlot[] = [];
  for (const slot of expandSlots(settings)) {
    const topics = slot.topics.length ? slot.topics : [...CORE_TOPICS];
    const difficulties: (Difficulty | undefined)[] = slot.difficulty ? [slot.difficulty] : [undefined];
    let picked: string | null = null;
    // try each topic (shuffled) until one yields a candidate
    const order = [...topics].sort(() => rand() - 0.5);
    outer: for (const difficulty of difficulties) {
      for (const topic of [...order, null]) {
        if (topic === null && slot.topics.length) break; // topic-restricted: no fallback to any topic
        const res = await problems.search({ tags: topic ? [topic] : undefined, difficulty, status: "verified", limit: 60, excludeIds: [...chosen] });
        const unseen = res.items.filter((p) => !exclude.has(p.id) || !settings.excludeSeen);
        // prefer problems that already have every allowed language (no on-demand driver generation at start)
        const ready = unseen.filter((p) => settings.languages.every((l) => p.languages.includes(l)));
        const pool = ready.length ? ready : unseen.filter((p) => settings.languages.some((l) => p.languages.includes(l)));
        if (!pool.length) continue;
        picked = pool[Math.floor(rand() * pool.length)].id;
        break outer;
      }
    }
    if (picked) chosen.add(picked);
    out.push({ index: slot.index, difficulty: slot.difficulty, topics: slot.topics, problemId: picked, status: picked ? "filled" : "missing", error: null });
  }
  return out;
}

async function seenForMembers(roomId: string): Promise<Set<string>> {
  const members = await rooms.listMembers(roomId, ["accepted"]);
  const lists = await Promise.all(members.map((m) => getSeenProblemIds(m.uid)));
  return new Set(lists.flat());
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createRoom(user: AuthedUser, input: unknown): Promise<{ room: WithId<Room>; code: string; missing: number }> {
  const settings = RoomSettingsSchema.parse(input);
  if (user.doc.activeRoomId) {
    const existing = await rooms.getRoom(user.doc.activeRoomId);
    if (existing && LIVE_STATUSES.includes(existing.status)) throw ApiError.conflict("You are already in a live room. Leave or finish it first.", { roomId: existing.id });
  }
  const seen = settings.excludeSeen ? new Set(await getSeenProblemIds(user.uid)) : new Set<string>();
  const ref = adminDb.collection(rooms.ROOMS).doc();
  const seed = Array.from(ref.id).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const slots = await planSlots(settings, seen, seed);
  const now = Timestamp.now();

  // allocate a unique code among live rooms (transaction, up to 6 tries)
  let code = "";
  for (let attempt = 0; attempt < 6 && !code; attempt++) {
    const candidate = generateCode();
    const ok = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(rooms.codeRef(candidate));
      if (snap.exists && (snap.data()!.expiresAt as Timestamp).toMillis() > Date.now()) return false;
      tx.set(rooms.codeRef(candidate), { roomId: ref.id, expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS) });
      return true;
    });
    if (ok) code = candidate;
  }
  if (!code) throw ApiError.internal("Could not allocate a join code, please try again");

  const room = RoomSchema.parse({
    code, hostUid: user.uid, host: identity(user.doc), status: "lobby", name: settings.name, description: settings.description,
    visibility: settings.visibility, avatar: settings.avatar, settings: storeSettings(settings), slots, problemSet: [], memberCount: 1, acceptedCount: 1,
    scheduledAt: settings.scheduledAt ? Timestamp.fromMillis(Date.parse(settings.scheduledAt)) : null,
    startedAt: null, endsAt: null, finishedAt: null, createdAt: now, updatedAt: now,
  });
  const host = RoomMemberSchema.parse({ uid: user.uid, ...identity(user.doc), role: "host", state: "accepted", joinedAt: now, acceptedAt: now });
  const batch = adminDb.batch();
  batch.set(ref, room);
  batch.set(rooms.memberRef(ref.id, user.uid), host);
  batch.set(rooms.membershipRef(user.uid, ref.id), { roomId: ref.id, joinedAt: now, role: "host" });
  batch.update(adminDb.collection("users").doc(user.uid), { activeRoomId: ref.id, "rooms.hosted": FieldValue.increment(1), updatedAt: now });
  await batch.commit();
  await consumeQuota(user.uid, "roomCreate");
  console.info(JSON.stringify({ evt: "rooms.create", uid: user.uid, roomId: ref.id, slots: slots.map((s) => s.status) }));
  return { room: { id: ref.id, ...room }, code, missing: slots.filter((s) => s.status === "missing").length };
}

// ── Join / approve / leave ──────────────────────────────────────────────────

export async function getRoomOrThrow(id: string): Promise<WithId<Room>> {
  const room = await rooms.getRoom(id);
  if (!room) throw ApiError.notFound("Room not found");
  return room;
}

export async function joinByCode(user: AuthedUser, rawCode: string): Promise<{ room: WithId<Room>; member: WithId<RoomMember> }> {
  const code = normalizeCode(rawCode);
  if (!code) throw ApiError.validation("Enter the 6-digit code");
  const roomId = await rooms.resolveCode(code);
  if (!roomId) throw ApiError.notFound("No room with that code. Codes stop working once a contest starts.");
  return joinRoom(user, roomId);
}

export async function joinRoom(user: AuthedUser, roomId: string): Promise<{ room: WithId<Room>; member: WithId<RoomMember> }> {
  const room = await getRoomOrThrow(roomId);
  const existing = await rooms.getMember(roomId, user.uid);
  if (existing && (existing.state === "accepted" || existing.state === "pending")) return { room, member: existing };
  if (existing?.state === "kicked") throw ApiError.forbidden("The host removed you from this room.");
  if (room.status !== "lobby") {
    if (existing && room.status === "running" && settingsOf(room).allowRejoin && existing.state === "left") {
      await rooms.memberRef(roomId, user.uid).update({ state: "accepted", leftEarly: false });
      return { room, member: { ...existing, state: "accepted" } };
    }
    throw new ApiError(409, "CONFLICT", "This contest has already started.", { code: "ROOM_STARTED" });
  }
  const settings = settingsOf(room);
  if (user.doc.activeRoomId && user.doc.activeRoomId !== roomId) {
    const other = await rooms.getRoom(user.doc.activeRoomId);
    if (other && LIVE_STATUSES.includes(other.status)) throw ApiError.conflict("You are already in another live room.", { roomId: other.id, code: "ALREADY_IN_ROOM" });
  }
  if (!existing) assertQuota(user.plan.tier, "roomJoin", user.quotas);
  const auto = settings.joinApproval === "auto";
  const now = Timestamp.now();
  const member = RoomMemberSchema.parse({ uid: user.uid, ...identity(user.doc), role: "member", state: auto ? "accepted" : "pending", joinedAt: now, acceptedAt: auto ? now : null });
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rooms.roomRef(roomId));
    const r = rooms.parseRoom(snap)!;
    if (r.status !== "lobby") throw new ApiError(409, "CONFLICT", "This contest has already started.", { code: "ROOM_STARTED" });
    if (auto && r.acceptedCount >= settings.maxMembers) throw new ApiError(409, "CONFLICT", "This room is full.", { code: "ROOM_FULL" });
    tx.set(rooms.memberRef(roomId, user.uid), member);
    tx.set(rooms.membershipRef(user.uid, roomId), { roomId, joinedAt: now, role: "member" });
    tx.update(rooms.roomRef(roomId), { memberCount: FieldValue.increment(existing ? 0 : 1), acceptedCount: FieldValue.increment(auto ? 1 : 0), updatedAt: now });
    tx.update(adminDb.collection("users").doc(user.uid), { activeRoomId: roomId, updatedAt: now });
  });
  if (!existing) await consumeQuota(user.uid, "roomJoin");
  return { room, member: { id: user.uid, ...member } };
}

export type MemberAction = "accept" | "reject" | "kick";

export async function memberAction(host: AuthedUser, roomId: string, uid: string, action: MemberAction): Promise<void> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid && !host.isAdmin) throw ApiError.forbidden("Only the host can do that");
  if (uid === room.hostUid) throw ApiError.validation("The host cannot be changed");
  const settings = settingsOf(room);
  await adminDb.runTransaction(async (tx) => {
    const [rs, ms] = await Promise.all([tx.get(rooms.roomRef(roomId)), tx.get(rooms.memberRef(roomId, uid))]);
    const r = rooms.parseRoom(rs)!;
    const m = rooms.parseMember(ms);
    if (!m) throw ApiError.notFound("Member not found");
    const now = Timestamp.now();
    if (action === "accept") {
      if (r.status !== "lobby") throw ApiError.conflict("The contest already started");
      if (m.state !== "pending") return;
      if (r.acceptedCount >= settings.maxMembers) throw new ApiError(409, "CONFLICT", "The room is full.", { code: "ROOM_FULL" });
      tx.update(rooms.memberRef(roomId, uid), { state: "accepted", acceptedAt: now });
      tx.update(rooms.roomRef(roomId), { acceptedCount: FieldValue.increment(1), updatedAt: now });
    } else if (action === "reject") {
      if (m.state !== "pending") return;
      tx.update(rooms.memberRef(roomId, uid), { state: "rejected" });
      tx.update(rooms.roomRef(roomId), { memberCount: FieldValue.increment(-1), updatedAt: now });
      tx.update(adminDb.collection("users").doc(uid), { activeRoomId: null });
    } else {
      const wasAccepted = m.state === "accepted";
      tx.update(rooms.memberRef(roomId, uid), { state: "kicked" });
      tx.update(rooms.roomRef(roomId), { acceptedCount: FieldValue.increment(wasAccepted ? -1 : 0), memberCount: FieldValue.increment(m.state === "pending" || wasAccepted ? -1 : 0), updatedAt: now });
      tx.update(adminDb.collection("users").doc(uid), { activeRoomId: null });
    }
  });
}

export async function leaveRoom(user: AuthedUser, roomId: string): Promise<void> {
  const room = await getRoomOrThrow(roomId);
  const m = await rooms.getMember(roomId, user.uid);
  if (!m) throw ApiError.notFound("You are not in this room");
  if (room.hostUid === user.uid && room.status === "lobby") { await cancelRoom(user, roomId); return; }
  if (room.hostUid === user.uid) throw ApiError.validation("The host cannot leave a running contest — end it instead.");
  const now = Timestamp.now();
  await adminDb.runTransaction(async (tx) => {
    const ms = rooms.parseMember(await tx.get(rooms.memberRef(roomId, user.uid)))!;
    if (ms.state === "left" || ms.state === "kicked" || ms.state === "rejected") return;
    tx.update(rooms.memberRef(roomId, user.uid), { state: "left", leftEarly: room.status === "running" });
    tx.update(rooms.roomRef(roomId), { acceptedCount: FieldValue.increment(ms.state === "accepted" ? -1 : 0), memberCount: FieldValue.increment(-1), updatedAt: now });
    tx.update(adminDb.collection("users").doc(user.uid), { activeRoomId: null });
  });
}

export async function setReady(user: AuthedUser, roomId: string, ready: boolean): Promise<void> {
  const m = await rooms.getMember(roomId, user.uid);
  if (!m || m.state !== "accepted") throw ApiError.forbidden("Join the room first");
  await rooms.memberRef(roomId, user.uid).update({ ready });
}

export async function updateSettings(host: AuthedUser, roomId: string, patch: Record<string, unknown>): Promise<WithId<Room>> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid) throw ApiError.forbidden("Only the host can edit the room");
  if (room.status !== "lobby") throw ApiError.conflict("Settings are locked once the contest starts");
  const settings = RoomSettingsSchema.parse({ ...settingsOf(room), ...patch });
  const problemKeys = ["count", "difficultyMode", "fixedDifficulty", "perProblemDifficulty", "topicMode", "topicPool", "perProblemTopics", "languages", "excludeSeen"] as const;
  const before = settingsOf(room);
  const replan = problemKeys.some((k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
  const updates: Record<string, unknown> = { settings: storeSettings(settings), name: settings.name, description: settings.description, visibility: settings.visibility, avatar: settings.avatar, scheduledAt: settings.scheduledAt ? Timestamp.fromMillis(Date.parse(settings.scheduledAt)) : null, updatedAt: Timestamp.now() };
  if (replan) {
    const seen = settings.excludeSeen ? await seenForMembers(roomId) : new Set<string>();
    const seed = Array.from(roomId).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11) + Date.now() % 1000;
    updates.slots = await planSlots(settings, seen, seed);
  }
  await rooms.roomRef(roomId).update(updates);
  return (await rooms.getRoom(roomId))!;
}

export async function cancelRoom(user: AuthedUser, roomId: string): Promise<void> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== user.uid && !user.isAdmin) throw ApiError.forbidden("Only the host can cancel");
  if (room.status !== "lobby") throw ApiError.conflict("Only a lobby can be cancelled — end the contest instead");
  await closeRoom(room, "cancelled");
}

/** Marks a room closed, releases the code and clears `activeRoomId` for every member. */
export async function closeRoom(room: WithId<Room>, status: "cancelled" | "finished"): Promise<void> {
  const members = await rooms.listMembers(room.id);
  const batch = adminDb.batch();
  batch.update(rooms.roomRef(room.id), { status, finishedAt: Timestamp.now(), updatedAt: Timestamp.now(), code: null });
  if (room.code) batch.delete(rooms.codeRef(room.code));
  for (const m of members) batch.update(adminDb.collection("users").doc(m.uid), { activeRoomId: null });
  await batch.commit();
}

// ── Prepare (generation for missing slots) ──────────────────────────────────

export interface PrepareResult { index: number; status: RoomSlot["status"]; problemId: string | null; error?: string }

/** Fills one missing slot by generating a verified problem (host's `generate` quota). */
export async function prepareSlot(host: AuthedUser, roomId: string, index: number, onStage?: (stage: string, info?: Record<string, unknown>) => void): Promise<PrepareResult> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid) throw ApiError.forbidden("Only the host can prepare problems");
  if (room.status !== "lobby") throw ApiError.conflict("The contest already started");
  const settings = settingsOf(room);
  const slot = room.slots.find((s) => s.index === index);
  if (!slot) throw ApiError.notFound("No such slot");
  if (slot.status === "filled" && slot.problemId) return { index, status: "filled", problemId: slot.problemId };
  if (!settings.generateIfMissing) throw ApiError.validation("Generation is disabled for this room");
  const { generateVerifiedProblem, GenerationFailed } = await import("@/lib/ai/generate");
  const { reserveQuota, refundQuota } = await import("@/lib/auth/quotas");
  await rooms.roomRef(roomId).update({ slots: room.slots.map((s) => (s.index === index ? { ...s, status: "generating", error: null } : s)) });
  const topics = slot.topics.length ? slot.topics : [CORE_TOPICS[Math.floor(Math.random() * CORE_TOPICS.length)]];
  const difficulty = slot.difficulty ?? "Medium";
  let reserved = false;
  try {
    const out = await generateVerifiedProblem({
      uid: host.uid, projectId: null,
      recommendation: { difficulty, topics, avoidTopics: [], reason: { short: `Contest problem ${index + 1}`, detail: `Slot ${index + 1} of room ${room.name}` }, isCalibration: false },
      profileSummary: "Competition room: a fresh, self-contained problem for a timed contest.", recentTitles: [], experienceLevel: difficulty === "Easy" ? "beginner" : difficulty === "Hard" ? "advanced" : "intermediate",
      goalType: "interview-prep", projectDescription: room.description || room.name, seenProblemIds: [...(await seenForMembers(roomId))],
      beforeGenerate: async () => { await reserveQuota(host.uid, host.plan.tier, "generate"); reserved = true; },
      onStage: onStage ? (stage, info) => onStage(stage, info) : undefined,
    });
    const fresh = (await rooms.getRoom(roomId))!;
    await rooms.roomRef(roomId).update({ slots: fresh.slots.map((s) => (s.index === index ? { ...s, status: "filled", problemId: out.problemId, error: null } : s)), updatedAt: Timestamp.now() });
    return { index, status: "filled", problemId: out.problemId };
  } catch (e) {
    if (reserved) await refundQuota(host.uid, "generate");
    const message = e instanceof GenerationFailed ? "Generation failed — try again or drop this slot" : (e as Error)?.message ?? "Generation failed";
    const fresh = (await rooms.getRoom(roomId))!;
    await rooms.roomRef(roomId).update({ slots: fresh.slots.map((s) => (s.index === index ? { ...s, status: "failed", error: message } : s)) });
    return { index, status: "failed", problemId: null, error: message };
  }
}

// ── Start ───────────────────────────────────────────────────────────────────

export async function startRoom(host: AuthedUser, roomId: string, opts: { force?: boolean } = {}): Promise<WithId<Room>> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid && !host.isAdmin) throw ApiError.forbidden("Only the host can start the contest");
  if (room.status !== "lobby") throw ApiError.conflict("The contest already started");
  const settings = settingsOf(room);
  const accepted = await rooms.listMembers(roomId, ["accepted"]);
  if (accepted.length < 2 && settings.rated && !opts.force) throw ApiError.validation("A rated contest needs at least one other participant. Uncheck “rated” to practise alone.");
  if (settings.scheduledAt && Date.parse(settings.scheduledAt) > Date.now() && !opts.force) throw ApiError.validation("The scheduled start time has not arrived yet (use “start now” to override).");

  // budget guard (§3.12)
  const filled = room.slots.filter((s) => s.status === "filled" && s.problemId);
  if (!filled.length) throw ApiError.validation("No problems are ready — prepare at least one slot first");
  const b = await budgetStatus();
  const guard = canStart(estimateBatches(accepted.length, filled.length, settings.caps), b.remaining, b.cap, USER_RESERVE);
  if (!guard.ok && !host.isAdmin) throw new ApiError(409, "CONFLICT", guard.reason!, { code: "JUDGE_BUDGET_LOW", remaining: b.remaining, cap: b.cap });

  // make sure every requested language exists on every problem (user priority, best effort, ≤ 60 s total)
  const details = await Promise.all(filled.map((s) => problems.getPublic(s.problemId!)));
  const deadline = Date.now() + 60_000;
  for (const p of details) {
    if (!p) continue;
    for (const lang of settings.languages) {
      if (p.languages.includes(lang) || Date.now() > deadline) continue;
      try { await ensureLanguage(p.id, lang, { wait: true, uid: host.uid }); } catch { /* the arena shows "Preparing…" */ }
    }
  }
  const problemSet = filled.map((s, i) => {
    const p = details[i]!;
    return { index: s.index, problemId: p.id, slug: p.slug, title: p.title, difficulty: p.difficulty, tags: p.tags, points: pointsFor(settings, p.difficulty) };
  }).sort((a, b) => a.index - b.index).map((p, i) => ({ ...p, index: i }));
  const now = Timestamp.now();
  const startedAt = Timestamp.fromMillis(now.toMillis() + settings.startCountdownSec * 1000);
  const endsAt = Timestamp.fromMillis(startedAt.toMillis() + settings.durationMin * 60_000);
  await adminDb.runTransaction(async (tx) => {
    const r = rooms.parseRoom(await tx.get(rooms.roomRef(roomId)))!;
    if (r.status !== "lobby") throw ApiError.conflict("The contest already started");
    tx.update(rooms.roomRef(roomId), {
      status: "running", startedAt, endsAt, problemSet, code: null, updatedAt: now,
      slots: r.slots.map((s) => (s.status === "filled" ? s : { ...s, status: "dropped" })),
    });
    if (r.code) tx.delete(rooms.codeRef(r.code));
  });
  // pending members never got in: clear their active room
  const pending = await rooms.listMembers(roomId, ["pending"]);
  if (pending.length) {
    const batch = adminDb.batch();
    for (const m of pending) { batch.update(rooms.memberRef(roomId, m.uid), { state: "rejected" }); batch.update(adminDb.collection("users").doc(m.uid), { activeRoomId: null }); }
    batch.update(rooms.roomRef(roomId), { memberCount: FieldValue.increment(-pending.length) });
    await batch.commit();
  }
  console.info(JSON.stringify({ evt: "rooms.start", roomId, host: host.uid, members: accepted.length, problems: problemSet.length, endsAt: endsAt.toDate().toISOString() }));
  return (await rooms.getRoom(roomId))!;
}

export function consentVersion(settings: RoomSettings): string {
  return `v1:${settings.integrity.strictness}:${settings.integrity.blockPaste ? 1 : 0}${settings.integrity.blockCopy ? 1 : 0}${settings.integrity.requireFullscreen ? 1 : 0}${settings.integrity.similarityCheck ? 1 : 0}`;
}

export async function consent(user: AuthedUser, roomId: string): Promise<{ consentVersion: string }> {
  const room = await getRoomOrThrow(roomId);
  const m = await rooms.getMember(roomId, user.uid);
  if (!m || m.state !== "accepted") throw ApiError.forbidden("You are not a participant of this room");
  const version = consentVersion(settingsOf(room));
  await rooms.memberRef(roomId, user.uid).update({ consentedAt: Timestamp.now(), consentVersion: version });
  return { consentVersion: version };
}

/** The member doc of an accepted participant (or the host) — 403 otherwise. */
export async function requireParticipant(roomId: string, uid: string): Promise<{ room: WithId<Room>; member: WithId<RoomMember> }> {
  const [room, member] = await Promise.all([getRoomOrThrow(roomId), rooms.getMember(roomId, uid)]);
  if (!member || (member.state !== "accepted" && member.state !== "left")) throw ApiError.forbidden("You are not a participant of this room");
  return { room, member };
}

export { summarize };
