import "server-only";
/**
 * Play-time room operations (Module 06 §3.5 / §3.8 / §3.9): problem access, run, submit, integrity events,
 * leaderboard, end, finalisation (similarity + ranks + rating + achievements), results, chat, rematch, sweep.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import * as rooms from "@/lib/data/rooms";
import * as problems from "@/lib/data/problems";
import * as submissions from "@/lib/data/submissions";
import * as activity from "@/lib/data/activity";
import { RoomChatSchema, RoomEventSchema, RoomRatingSchema, RoomSubmissionSchema, SubmissionSchema, todayKey, type Language, type Room, type RoomMember, type RoomSubmission, type WithId } from "@/lib/data/schema";
import type { AuthedUser } from "@/lib/auth/types";
import { consumeQuota, consumeQuotaInTx } from "@/lib/auth/quotas";
import { judgeSubmission, redactForClient, runCases } from "@/lib/judge/service";
import type { CaseInput } from "@/lib/judge/types";
import { JUDGE_BUSY_MESSAGE } from "@/lib/judge/budget";
import { rank, scoreMember, type MemberScore, type ScoringSubmission } from "@/lib/rooms/scoring";
import { INTEGRITY_EVENT_TYPES, penaltyFor, PENALTY_CAP, type IntegrityEventInput, type IntegrityEventType } from "@/lib/rooms/integrity";
import { pairwiseSimilarity } from "@/lib/rooms/similarity";
import { MIN_RANKED_FOR_RATING, ROOM_RATING_START, ratingDeltas } from "@/lib/rooms/rating";
import { closeRoom, getRoomOrThrow, requireParticipant, settingsOf, createRoom } from "@/lib/rooms/service";
import type { RoomSettings } from "@/lib/rooms/settings";
import { LANGUAGES } from "@/lib/judge/languages";

function isRunning(room: Room, now = Date.now()): boolean {
  return room.status === "running" && !!room.startedAt && !!room.endsAt && room.startedAt.toMillis() <= now && room.endsAt.toMillis() > now;
}

function assertLive(room: WithId<Room>): void {
  const now = Date.now();
  if (room.status !== "running") throw ApiError.conflict("The contest is not running");
  if (room.startedAt && room.startedAt.toMillis() > now) throw ApiError.conflict("The contest starts in a moment");
  if (room.endsAt && room.endsAt.toMillis() <= now) throw ApiError.conflict("The contest has ended");
}

function assertConsented(member: RoomMember): void {
  if (!member.consentedAt) throw new ApiError(403, "FORBIDDEN", "Please read and accept the contest rules first.", { code: "CONSENT_REQUIRED" });
}

function problemAt(room: WithId<Room>, index: number) {
  const p = room.problemSet.find((x) => x.index === index);
  if (!p) throw ApiError.notFound("No such problem in this room");
  return p;
}

function assertUnlocked(settings: RoomSettings, member: RoomMember, index: number): void {
  if (settings.problemMode === "sequential" && index > member.unlockedIndex) throw new ApiError(403, "FORBIDDEN", "Solve or skip the previous problem first.", { code: "ROOM_LOCKED" });
}

// ── Problem access ──────────────────────────────────────────────────────────

export async function roomProblem(user: AuthedUser, roomId: string, index: number, lang?: Language) {
  const { room, member } = await requireParticipant(roomId, user.uid);
  if (room.status === "lobby") throw ApiError.conflict("The contest has not started");
  const settings = settingsOf(room);
  if (room.status === "running") assertUnlocked(settings, member, index);
  const rp = problemAt(room, index);
  const p = await problems.getPublic(rp.problemId);
  if (!p) throw ApiError.notFound("Problem not found");
  const allowed = settings.languages;
  const starter = lang ? { [lang]: p.starter[lang] ?? "" } : Object.fromEntries(allowed.map((l) => [l, p.starter[l] ?? ""]));
  // hints preview is hidden in the arena (no AI help)
  return {
    problem: { ...p, starter, hintsPreview: 0 },
    languages: allowed.map((key) => ({ key, label: LANGUAGES[key].label, version: LANGUAGES[key].version, monaco: LANGUAGES[key].monaco, ready: p.languages.includes(key) })),
    mine: member.perProblem[rp.problemId] ?? null,
  };
}

/** Sequential mode: skip the current problem (it stays attemptable later? No — skipped problems are locked out). */
export async function skipProblem(user: AuthedUser, roomId: string, index: number): Promise<{ unlockedIndex: number }> {
  const { room, member } = await requireParticipant(roomId, user.uid);
  assertLive(room);
  const settings = settingsOf(room);
  if (settings.problemMode !== "sequential") throw ApiError.validation("All problems are already open");
  if (index !== member.unlockedIndex) throw ApiError.validation("You can only skip the current problem");
  const next = Math.min(room.problemSet.length - 1, member.unlockedIndex + 1);
  await rooms.memberRef(roomId, user.uid).update({ unlockedIndex: next });
  return { unlockedIndex: next };
}

// ── Run ─────────────────────────────────────────────────────────────────────

export async function roomRun(user: AuthedUser, roomId: string, index: number, language: Language, code: string, cases: CaseInput[]) {
  const { room, member } = await requireParticipant(roomId, user.uid);
  assertLive(room); assertConsented(member);
  const settings = settingsOf(room);
  if (!settings.languages.includes(language)) throw ApiError.validation("This language is not allowed in this room");
  if (!settings.scoring.runOnSamples) throw ApiError.forbidden("Running on samples is disabled in this room");
  assertUnlocked(settings, member, index);
  const rp = problemAt(room, index);
  const mine = member.perProblem[rp.problemId];
  if ((mine?.runs ?? 0) >= settings.caps.maxRunsPerProblem) throw new ApiError(409, "CONFLICT", `You have used all ${settings.caps.maxRunsPerProblem} runs for this problem.`, { code: "ROOM_CAP_REACHED" });
  const p = await problems.getPublic(rp.problemId);
  if (!p) throw ApiError.notFound("Problem not found");
  if (!p.languages.includes(language)) throw new ApiError(409, "LANGUAGE_NOT_READY", `${language} is not available for this problem yet`);
  const drivers = await problems.getDrivers(p.id);
  if (!drivers) throw ApiError.internal("Problem has no drivers");
  const results = await runCases({ id: p.id, checker: p.checker, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: [], drivers: drivers.drivers }, language, code, cases);
  await Promise.all([
    rooms.memberRef(roomId, user.uid).set({ perProblem: { [rp.problemId]: { runs: FieldValue.increment(1) } } }, { merge: true }),
    consumeQuota(user.uid, "run"),
    activity.recordSubmit(user.uid, todayKey(), { runs: 1 }),
  ]);
  return { cases: results, runsLeft: settings.caps.maxRunsPerProblem - (mine?.runs ?? 0) - 1 };
}

// ── Submit ──────────────────────────────────────────────────────────────────

function toScoring(subs: WithId<RoomSubmission>[]): ScoringSubmission[] {
  return subs.map((s) => ({ problemId: s.problemId, verdict: s.verdict, passed: s.passed, total: s.total, at: s.createdAt.toMillis() }));
}

function memberScoreDoc(score: MemberScore) {
  return {
    score: {
      raw: score.raw, penaltyPct: score.penaltyPct, final: score.final, solved: score.solved, totalTimeSec: score.totalTimeSec, wrongSubmissions: score.wrongSubmissions,
      lastAcceptedAt: score.lastAcceptedAt ? Timestamp.fromMillis(score.lastAcceptedAt) : null,
    },
    perProblemScore: Object.fromEntries(Object.entries(score.perProblem).map(([pid, ps]) => [pid, { status: ps.status, points: ps.points, attempts: ps.attempts, wrong: ps.wrong, acceptedAt: ps.acceptedAt ? Timestamp.fromMillis(ps.acceptedAt) : null, bestPassed: ps.bestPassed, total: ps.total }])),
  };
}

/** Recomputes a member's score from all their room submissions and writes it (used by submit and events). */
export async function recomputeMember(room: WithId<Room>, uid: string, penaltyPct: number, tx?: FirebaseFirestore.Transaction, extra: WithId<RoomSubmission>[] = []): Promise<MemberScore> {
  const settings = settingsOf(room);
  const subs = [...(await rooms.listSubmissions(room.id, uid)), ...extra];
  const score = scoreMember(settings, room.problemSet.map((p) => ({ problemId: p.problemId, difficulty: p.difficulty, points: p.points })), toScoring(subs), room.startedAt!.toMillis(), penaltyPct);
  const doc = memberScoreDoc(score);
  const update: Record<string, unknown> = { score: doc.score };
  for (const [pid, ps] of Object.entries(doc.perProblemScore)) for (const [k, v] of Object.entries(ps)) update[`perProblem.${pid}.${k}`] = v;
  if (tx) tx.update(rooms.memberRef(room.id, uid), update); else await rooms.memberRef(room.id, uid).update(update);
  return score;
}

export async function roomSubmit(user: AuthedUser, roomId: string, index: number, language: Language, code: string) {
  const { room, member } = await requireParticipant(roomId, user.uid);
  assertLive(room); assertConsented(member);
  const settings = settingsOf(room);
  if (!settings.languages.includes(language)) throw ApiError.validation("This language is not allowed in this room");
  assertUnlocked(settings, member, index);
  const rp = problemAt(room, index);
  const mine = member.perProblem[rp.problemId];
  if (mine?.status === "solved") throw new ApiError(409, "CONFLICT", "You already solved this problem.", { code: "ROOM_SOLVED" });
  if ((mine?.attempts ?? 0) >= settings.caps.maxSubmitsPerProblem) throw new ApiError(409, "CONFLICT", `You have used all ${settings.caps.maxSubmitsPerProblem} submits for this problem.`, { code: "ROOM_CAP_REACHED" });
  const p = await problems.getPublic(rp.problemId);
  if (!p) throw ApiError.notFound("Problem not found");
  if (!p.languages.includes(language)) throw new ApiError(409, "LANGUAGE_NOT_READY", `${language} is not available for this problem yet`);
  const [tests, drivers] = await Promise.all([problems.getPrivateTests(p.id), problems.getDrivers(p.id)]);
  if (!tests || !drivers) throw ApiError.internal("Problem is missing private data");

  let result;
  try {
    result = await judgeSubmission({ id: p.id, checker: p.checker, limits: p.limits, sampleTests: p.sampleTests, hiddenTests: tests.hiddenTests, drivers: drivers.drivers }, language, code);
  } catch (e) {
    if (e instanceof ApiError && (e.details as { code?: string } | undefined)?.code === "JUDGE_BUDGET") {
      await rooms.roomRef(roomId).update({ capacityHit: true });
      throw new ApiError(503, "UPSTREAM", "Code execution capacity for today is used up. The contest continues; this attempt was not counted.", { code: "ROOM_CAPACITY" });
    }
    throw e;
  }
  const accepted = result.verdict === "AC";
  const now = Timestamp.now();
  const elapsedSec = Math.max(0, Math.round((now.toMillis() - room.startedAt!.toMillis()) / 1000));
  const subRef = rooms.submissionsCol(roomId).doc();
  const doc = RoomSubmissionSchema.parse({
    uid: user.uid, roomId, problemId: p.id, problemIndex: index, language, code, verdict: result.verdict, passed: result.passed, total: result.total,
    failedCase: result.failedCase ? { index: result.failedCase.index, input: result.failedCase.input, expected: result.failedCase.expected ?? "", actual: result.failedCase.actual, stderr: result.failedCase.stderr } : null,
    compileOutput: result.compileOutput, runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, elapsedSec, pointsAfter: 0, createdAt: now,
  });
  const mirrorRef = submissions.newRef();
  const userRef = adminDb.collection("users").doc(user.uid);
  const score = await adminDb.runTransaction(async (tx) => {
    const [ms, us] = await Promise.all([tx.get(rooms.memberRef(roomId, user.uid)), tx.get(userRef)]);
    const m = rooms.parseMember(ms)!;
    const attempts = m.perProblem[p.id]?.attempts ?? 0;
    if (attempts >= settings.caps.maxSubmitsPerProblem) throw new ApiError(409, "CONFLICT", "Submit cap reached", { code: "ROOM_CAP_REACHED" });
    const sc = await recomputeMember(room, user.uid, m.violations.penaltyPct, tx, [{ id: subRef.id, ...doc }]);
    tx.set(subRef, { ...doc, pointsAfter: sc.final });
    // mirror into the global submissions collection (history / heatmap), without touching mastery
    tx.set(mirrorRef, SubmissionSchema.parse({
      uid: user.uid, projectId: null, problemId: p.id, language, code, verdict: result.verdict, passed: result.passed, total: result.total,
      failedCase: doc.failedCase, compileOutput: result.compileOutput, runtimeMs: result.runtimeMs, memoryKb: result.memoryKb,
      beatsRuntimePct: null, beatsMemoryPct: null, attemptNumber: attempts + 1, hintsUsed: 0, editorialViewed: false, timeSpentSec: elapsedSec, runCount: m.perProblem[p.id]?.runs ?? 0, isFirstTry: accepted && attempts === 0, createdAt: now,
    }));
    tx.update(adminDb.collection("problems").doc(p.id), { "stats.attempts": FieldValue.increment(1), ...(accepted ? { "stats.accepted": FieldValue.increment(1) } : {}) });
    activity.recordInTx(tx, user.uid, todayKey(), { submissions: 1, accepted: accepted ? 1 : 0 });
    if (settings.problemMode === "sequential" && accepted && m.unlockedIndex === index) tx.update(rooms.memberRef(roomId, user.uid), { unlockedIndex: Math.min(room.problemSet.length - 1, index + 1) });
    consumeQuotaInTx(tx, userRef, us.data()!, "submit");
    return sc;
  });
  console.info(JSON.stringify({ evt: "rooms.submit", roomId, uid: user.uid, problemId: p.id, verdict: result.verdict, passed: result.passed, total: result.total, final: score.final }));
  const redacted = redactForClient(result, p.sampleTests.length);
  const vis = settings.scoring.showVerdict;
  const ps = score.perProblem[p.id];
  return {
    submission: {
      id: subRef.id, verdict: vis === "hidden" ? "received" : result.verdict, passed: vis === "full" ? result.passed : null, total: vis === "full" ? result.total : null,
      failedCase: vis === "full" && redacted.failedCase && !redacted.failedCase.hidden ? redacted.failedCase : vis === "full" && redacted.failedCase ? { ...redacted.failedCase, input: "", expected: "", actual: "" } : null,
      compileOutput: vis !== "hidden" ? result.compileOutput : null, runtimeMs: result.runtimeMs, createdAt: now.toDate().toISOString(),
    },
    problem: { index, status: ps.status, points: ps.points, attempts: ps.attempts, submitsLeft: settings.caps.maxSubmitsPerProblem - ps.attempts },
    score: { raw: score.raw, final: score.final, solved: score.solved, penaltyPct: score.penaltyPct },
    hiddenVerdict: vis === "hidden",
  };
}

// ── Integrity events ────────────────────────────────────────────────────────

export interface ClientEvent { type: string; at: number; meta?: Record<string, unknown>; clientSeq: number; sessionId?: string }

const RATE_WINDOW_MS = 60_000, RATE_MAX = 40;
const recent = new Map<string, number[]>();

export async function recordEvents(user: AuthedUser, roomId: string, events: ClientEvent[]) {
  const { room, member } = await requireParticipant(roomId, user.uid);
  const settings = settingsOf(room);
  const running = isRunning(room);
  const key = `${roomId}:${user.uid}`;
  const nowMs = Date.now();
  const bucket = (recent.get(key) ?? []).filter((t) => nowMs - t < RATE_WINDOW_MS);
  recent.set(key, bucket);
  const start = room.startedAt?.toMillis() ?? 0, end = room.endsAt?.toMillis() ?? Infinity;
  const seen = new Set(await knownSeqs(roomId, user.uid));
  const batch = adminDb.batch();
  const counts: Partial<Record<IntegrityEventType, number>> = { ...(member.violations.byType as Partial<Record<IntegrityEventType, number>>) };
  let addedPct = 0, addedCount = 0, spam = false;
  let presence: Record<string, unknown> = { "presence.lastSeenAt": Timestamp.now() };
  const sessionId = events.find((e) => e.sessionId)?.sessionId ?? null;
  for (const ev of events) {
    if (!(INTEGRITY_EVENT_TYPES as readonly string[]).includes(ev.type)) continue;
    if (seen.has(ev.clientSeq)) continue;
    seen.add(ev.clientSeq);
    const type = ev.type as IntegrityEventType;
    if (type === "heartbeat") { presence = { ...presence, "presence.tab": (ev.meta?.tab as string) === "hidden" ? "hidden" : "visible", "presence.sessionId": ev.sessionId ?? null }; continue; }
    if (bucket.length >= RATE_MAX) { spam = true; continue; }
    bucket.push(nowMs);
    if (!running || ev.at < start || ev.at > end) continue;
    const input: IntegrityEventInput = { type, meta: { durationMs: Number(ev.meta?.durationMs ?? 0) || undefined, chars: Number(ev.meta?.chars ?? 0) || undefined } };
    const pct = penaltyFor(input, counts[type] ?? 0, settings.integrity.strictness);
    if (pct === null) continue;
    counts[type] = (counts[type] ?? 0) + 1;
    addedPct += pct; addedCount++;
    batch.set(rooms.eventsCol(roomId).doc(), RoomEventSchema.parse({ uid: user.uid, type, at: Timestamp.fromMillis(ev.at), meta: ev.meta ?? {}, penaltyPct: pct, clientSeq: ev.clientSeq }));
  }
  // second-session detection: a different sessionId within 30 s of the last heartbeat
  if (sessionId && member.presence.sessionId && member.presence.sessionId !== sessionId && member.presence.lastSeenAt && nowMs - member.presence.lastSeenAt.toMillis() < 30_000 && running) {
    const pct = penaltyFor({ type: "multi_session" }, counts.multi_session ?? 0, settings.integrity.strictness) ?? 0;
    counts.multi_session = (counts.multi_session ?? 0) + 1; addedPct += pct; addedCount++;
    batch.set(rooms.eventsCol(roomId).doc(), RoomEventSchema.parse({ uid: user.uid, type: "multi_session", at: Timestamp.now(), meta: { sessionId }, penaltyPct: pct, clientSeq: null }));
  }
  if (spam) batch.set(rooms.eventsCol(roomId).doc(), RoomEventSchema.parse({ uid: user.uid, type: "spam", at: Timestamp.now(), meta: {}, penaltyPct: 0, clientSeq: null }));
  const penaltyPct = Math.min(PENALTY_CAP, Math.round((member.violations.penaltyPct + addedPct) * 10) / 10);
  const violations = { count: member.violations.count + addedCount, byType: counts, penaltyPct };
  batch.update(rooms.memberRef(roomId, user.uid), { violations, ...presence });
  await batch.commit();
  let score = member.score;
  if (addedCount && running) {
    const sc = await recomputeMember(room, user.uid, penaltyPct);
    score = { raw: sc.raw, penaltyPct: sc.penaltyPct, final: sc.final, solved: sc.solved, totalTimeSec: sc.totalTimeSec, wrongSubmissions: sc.wrongSubmissions, lastAcceptedAt: sc.lastAcceptedAt ? Timestamp.fromMillis(sc.lastAcceptedAt) : null };
  }
  return { violations, score: { raw: score.raw, final: score.final, solved: score.solved, penaltyPct: score.penaltyPct }, spam };
}

async function knownSeqs(roomId: string, uid: string): Promise<number[]> {
  const snap = await rooms.eventsCol(roomId).where("uid", "==", uid).select("clientSeq").limit(500).get();
  return snap.docs.map((d) => d.data().clientSeq as number | null).filter((x): x is number => typeof x === "number");
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardRow {
  uid: string; username: string; displayName: string; photoURL: string; state: string; rank: number | null;
  final: number; solved: number; totalTimeSec: number; violations: number; penaltyPct: number;
  perProblem: Record<string, { status: string; points: number; attempts: number; acceptedAt: string | null }>;
  online: boolean; ratingDelta: number | null; leftEarly: boolean;
}

export function buildLeaderboard(room: WithId<Room>, members: WithId<RoomMember>[], viewerUid: string | null, now = Date.now()): { rows: LeaderboardRow[]; frozen: boolean; hidden: boolean; frozenAt: string | null } {
  const settings = settingsOf(room);
  const isHost = viewerUid === room.hostUid;
  const finished = room.status === "finished" || room.status === "finalising";
  const freezeAt = room.endsAt ? room.endsAt.toMillis() - settings.scoring.freezeLastMin * 60_000 : Infinity;
  const frozen = !isHost && !finished && settings.scoring.showLeaderboard === "frozen" && now >= freezeAt;
  const hidden = !isHost && !finished && settings.scoring.showLeaderboard === "hidden";
  const ranked = rank(members.map((m) => ({ uid: m.uid, state: m.state, score: m.score, violations: m.violations.count, joinedAt: m.joinedAt.toMillis(), m })));
  const rows: LeaderboardRow[] = ranked.map(({ member: r, rank: rk }) => {
    const m = r.m;
    return {
      uid: m.uid, username: m.username, displayName: m.displayName, photoURL: m.photoURL, state: m.state, rank: finished && m.rank !== null ? m.rank : rk,
      final: m.score.final, solved: m.score.solved, totalTimeSec: m.score.totalTimeSec, violations: m.violations.count, penaltyPct: m.violations.penaltyPct,
      perProblem: Object.fromEntries(room.problemSet.map((p) => { const ps = m.perProblem[p.problemId]; return [p.problemId, { status: ps?.status ?? "todo", points: ps?.points ?? 0, attempts: ps?.attempts ?? 0, acceptedAt: ps?.acceptedAt ? ps.acceptedAt.toDate().toISOString() : null }]; })),
      online: !!m.presence.lastSeenAt && now - m.presence.lastSeenAt.toMillis() < 45_000,
      ratingDelta: m.ratingDelta, leftEarly: m.leftEarly,
    };
  });
  if (hidden) {
    // members see only themselves
    return { rows: rows.filter((r) => r.uid === viewerUid).map((r) => ({ ...r, rank: null })), frozen: false, hidden: true, frozenAt: null };
  }
  return { rows, frozen, hidden: false, frozenAt: frozen ? new Date(freezeAt).toISOString() : null };
}

// ── End / finalise ──────────────────────────────────────────────────────────

export async function endRoom(host: AuthedUser, roomId: string): Promise<WithId<Room>> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid && !host.isAdmin) throw ApiError.forbidden("Only the host can end the contest");
  if (room.status !== "running") throw ApiError.conflict("The contest is not running");
  await rooms.roomRef(roomId).update({ endsAt: Timestamp.now(), updatedAt: Timestamp.now() });
  await finaliseRoom(roomId);
  return (await rooms.getRoom(roomId))!;
}

/** Idempotent: similarity check → ranks → rating → counters → close. Safe to call from the request path and the cron. */
export async function finaliseRoom(roomId: string): Promise<void> {
  const claimed = await adminDb.runTransaction(async (tx) => {
    const r = rooms.parseRoom(await tx.get(rooms.roomRef(roomId)));
    if (!r || r.status !== "running") return false;
    if (r.endsAt && r.endsAt.toMillis() > Date.now()) return false;
    tx.update(rooms.roomRef(roomId), { status: "finalising", updatedAt: Timestamp.now() });
    return true;
  });
  if (!claimed) return;
  const room = (await rooms.getRoom(roomId))!;
  const settings = settingsOf(room);
  const members = await rooms.listMembers(roomId);
  try {
    // 1. similarity
    if (settings.integrity.similarityCheck && !room.finalised.similarityChecked) {
      const subs = (await rooms.listSubmissions(roomId)).filter((s) => s.verdict === "AC");
      const refs = new Map<string, Partial<Record<Language, string>>>();
      for (const p of room.problemSet) { const t = await problems.getPrivateTests(p.problemId); refs.set(p.problemId, t?.referenceSolution ?? {}); }
      const flags = pairwiseSimilarity(subs.map((s) => ({ uid: s.uid, problemId: s.problemId, language: s.language, code: s.code, at: s.createdAt.toMillis() })));
      // reference similarity per problem
      for (const s of subs) {
        const ref = refs.get(s.problemId)?.[s.language];
        if (!ref) continue;
        const one = pairwiseSimilarity([{ uid: s.uid, problemId: s.problemId, language: s.language, code: s.code, at: s.createdAt.toMillis() }], { [s.language]: ref });
        flags.push(...one.filter((f) => f.b === "reference"));
      }
      const byUid = new Map<string, { problemId: string; with: string; score: number; level: "flag" | "strong"; waived: boolean }[]>();
      const push = (uid: string, f: { problemId: string; score: number; level: "flag" | "strong" }, withWhom: string) => (byUid.get(uid) ?? byUid.set(uid, []).get(uid)!).push({ problemId: f.problemId, with: withWhom, score: f.score, level: f.level, waived: false });
      for (const f of flags) {
        if (f.b === "reference") { push(f.a, f, "reference"); continue; }
        if (f.later) push(f.later, f, f.later === f.a ? f.b : f.a);
        else { push(f.a, f, f.b); push(f.b, f, f.a); }
      }
      const batch = adminDb.batch();
      for (const m of members) {
        const list = byUid.get(m.uid) ?? [];
        if (!list.length) continue;
        const extra = list.reduce((acc, x) => acc + (x.level === "strong" ? 50 : 25), 0);
        const penaltyPct = Math.min(PENALTY_CAP, m.violations.penaltyPct + extra);
        const byType = { ...m.violations.byType } as Record<string, number>;
        for (const x of list) byType[x.level === "strong" ? "similarity_strong" : "similarity_flag"] = (byType[x.level === "strong" ? "similarity_strong" : "similarity_flag"] ?? 0) + 1;
        batch.update(rooms.memberRef(roomId, m.uid), { similarity: list, violations: { count: m.violations.count + list.length, byType, penaltyPct } });
        for (const x of list) batch.set(rooms.eventsCol(roomId).doc(), RoomEventSchema.parse({ uid: m.uid, type: x.level === "strong" ? "similarity_strong" : "similarity_flag", at: Timestamp.now(), meta: { problemId: x.problemId, with: x.with, score: x.score }, penaltyPct: x.level === "strong" ? 50 : 25, clientSeq: null }));
        m.violations = { count: m.violations.count + list.length, byType, penaltyPct };
        m.similarity = list;
      }
      await batch.commit();
      await rooms.roomRef(roomId).update({ "finalised.similarityChecked": true });
    }
    // 2. recompute scores with final penalties, rank
    for (const m of members) if (m.state === "accepted" || m.state === "left") {
      const sc = await recomputeMember(room, m.uid, m.violations.penaltyPct);
      m.score = { raw: sc.raw, penaltyPct: sc.penaltyPct, final: sc.final, solved: sc.solved, totalTimeSec: sc.totalTimeSec, wrongSubmissions: sc.wrongSubmissions, lastAcceptedAt: sc.lastAcceptedAt ? Timestamp.fromMillis(sc.lastAcceptedAt) : null };
    }
    const ranked = rank(members.map((m) => ({ uid: m.uid, state: m.state, score: m.score, violations: m.violations.count, joinedAt: m.joinedAt.toMillis(), m })));
    const rankedOnly = ranked.filter((r) => r.rank !== null);
    // 3. rating
    let deltas: Record<string, number> | null = null;
    if (settings.rated && !room.finalised.ratingsApplied && rankedOnly.length >= MIN_RANKED_FOR_RATING) {
      const ratings = await rooms.getRatings(rankedOnly.map((r) => r.member.uid));
      deltas = ratingDeltas(rankedOnly.map((r) => {
        const rt = ratings.get(r.member.uid);
        const demoted = r.member.m.similarity.some((x) => !x.waived) || r.member.m.violations.penaltyPct >= 50;
        return { uid: r.member.uid, rating: rt?.rating ?? ROOM_RATING_START, contests: rt?.contests ?? 0, rank: r.rank!, demoted };
      }));
      if (deltas) {
        const batch = adminDb.batch();
        for (const r of rankedOnly) {
          const rt = ratings.get(r.member.uid);
          const before = rt?.rating ?? ROOM_RATING_START;
          const delta = deltas[r.member.uid] ?? 0;
          const history = [...(rt?.history ?? []), { roomId, name: room.name, rank: r.rank!, of: rankedOnly.length, delta, at: Timestamp.now() }].slice(-100);
          batch.set(rooms.ratingRef(r.member.uid), RoomRatingSchema.parse({ rating: before + delta, contests: (rt?.contests ?? 0) + 1, best: Math.min(rt?.best ?? r.rank!, r.rank!), history, updatedAt: Timestamp.now() }));
          batch.update(rooms.memberRef(roomId, r.member.uid), { ratingBefore: before, ratingDelta: delta });
        }
        await batch.commit();
      }
    }
    // 4. ranks + user counters
    const batch = adminDb.batch();
    for (const r of ranked) {
      batch.update(rooms.memberRef(roomId, r.member.uid), { rank: r.rank });
      if (r.rank !== null) batch.update(adminDb.collection("users").doc(r.member.uid), { "rooms.played": FieldValue.increment(1), ...(r.rank === 1 ? { "rooms.wins": FieldValue.increment(1) } : {}), ...(r.rank <= 3 ? { "rooms.podiums": FieldValue.increment(1) } : {}) });
    }
    batch.update(rooms.roomRef(roomId), { "finalised.ratingsApplied": !!deltas || room.finalised.ratingsApplied, "finalised.rankedCount": rankedOnly.length });
    await batch.commit();
    await closeRoom((await rooms.getRoom(roomId))!, "finished");
    console.info(JSON.stringify({ evt: "rooms.finalised", roomId, ranked: rankedOnly.length, rated: !!deltas }));
  } catch (e) {
    console.error(JSON.stringify({ evt: "rooms.finalise_failed", roomId, message: (e as Error)?.message }));
    await rooms.roomRef(roomId).update({ status: "running" }); // let the cron retry
    throw e;
  }
}

/** Ends a running room whose clock ran out (called lazily by reads and by the cron). */
export async function finaliseIfDue(room: WithId<Room>): Promise<WithId<Room>> {
  if (room.status === "running" && room.endsAt && room.endsAt.toMillis() <= Date.now()) {
    try { await finaliseRoom(room.id); } catch { /* logged */ }
    return (await rooms.getRoom(room.id)) ?? room;
  }
  return room;
}

// ── Results ─────────────────────────────────────────────────────────────────

export async function results(user: AuthedUser | null, roomId: string) {
  let room = await getRoomOrThrow(roomId);
  room = await finaliseIfDue(room);
  const uid = user?.uid ?? null;
  const members = await rooms.listMembers(roomId);
  const isMember = !!uid && members.some((m) => m.uid === uid);
  if (!isMember && room.visibility !== "public" && !user?.isAdmin) throw ApiError.forbidden("Only participants can see these results");
  if (room.status !== "finished" && room.status !== "finalising") throw ApiError.conflict("The contest has not finished yet");
  const isHost = uid === room.hostUid || !!user?.isAdmin;
  const board = buildLeaderboard(room, members, uid);
  const subs = await rooms.listSubmissions(roomId);
  const timeline = subs.filter((s) => s.verdict === "AC").map((s) => ({ uid: s.uid, problemId: s.problemId, at: s.createdAt.toDate().toISOString(), pointsAfter: s.pointsAfter }));
  const perProblem = room.problemSet.map((p) => {
    const solvers = members.filter((m) => m.perProblem[p.problemId]?.status === "solved");
    const first = solvers.sort((a, b) => (a.perProblem[p.problemId]!.acceptedAt!.toMillis()) - (b.perProblem[p.problemId]!.acceptedAt!.toMillis()))[0];
    return { ...p, solved: solvers.length, attempted: members.filter((m) => (m.perProblem[p.problemId]?.attempts ?? 0) > 0).length, firstSolver: first ? { uid: first.uid, username: first.username, at: first.perProblem[p.problemId]!.acceptedAt!.toDate().toISOString() } : null };
  });
  const me = uid ? members.find((m) => m.uid === uid) : null;
  const myEvents = uid ? await rooms.listEvents(roomId, uid) : [];
  const similarity = isHost ? members.flatMap((m) => m.similarity.map((x) => ({ uid: m.uid, username: m.username, ...x }))) : (me?.similarity.map((x) => ({ uid: me.uid, username: me.username, ...x })) ?? []);
  return {
    room: { id: room.id, name: room.name, description: room.description, avatar: room.avatar, status: room.status, hostUid: room.hostUid, host: room.host, startedAt: room.startedAt?.toDate().toISOString() ?? null, endsAt: room.endsAt?.toDate().toISOString() ?? null, finishedAt: room.finishedAt?.toDate().toISOString() ?? null, settings: settingsOf(room), problemSet: room.problemSet, finalised: room.finalised, rematchOf: room.rematchOf, capacityHit: room.capacityHit },
    standings: board.rows, perProblem, timeline, similarity,
    me: me ? { uid: me.uid, rank: me.rank, score: { raw: me.score.raw, final: me.score.final, solved: me.score.solved, penaltyPct: me.violations.penaltyPct }, ratingBefore: me.ratingBefore, ratingDelta: me.ratingDelta, events: myEvents.map((e) => ({ type: e.type, at: e.at.toDate().toISOString(), penaltyPct: e.penaltyPct, meta: e.meta })) } : null,
    isHost,
  };
}

export async function hostEvents(host: AuthedUser, roomId: string, uid?: string) {
  const room = await getRoomOrThrow(roomId);
  const isHost = room.hostUid === host.uid || host.isAdmin;
  if (!isHost) { await requireParticipant(roomId, host.uid); uid = host.uid; }
  const events = await rooms.listEvents(roomId, uid);
  return events.map((e) => ({ id: e.id, uid: e.uid, type: e.type, at: e.at.toDate().toISOString(), penaltyPct: e.penaltyPct, meta: e.meta }));
}

export async function waiveSimilarity(host: AuthedUser, roomId: string, uid: string, problemId: string): Promise<void> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid && !host.isAdmin) throw ApiError.forbidden("Only the host can waive a flag");
  const m = await rooms.getMember(roomId, uid);
  if (!m) throw ApiError.notFound("Member not found");
  const similarity = m.similarity.map((x) => (x.problemId === problemId ? { ...x, waived: true } : x));
  const extra = similarity.filter((x) => !x.waived).reduce((acc, x) => acc + (x.level === "strong" ? 50 : 25), 0);
  const base = Object.entries(m.violations.byType).filter(([t]) => !t.startsWith("similarity")).length ? m.violations.penaltyPct : 0;
  void base;
  // recompute penalty from stored events (client events + remaining similarity flags)
  const events = await rooms.listEvents(roomId, uid);
  const clientPct = events.filter((e) => !e.type.startsWith("similarity")).reduce((acc, e) => acc + e.penaltyPct, 0);
  const penaltyPct = Math.min(PENALTY_CAP, Math.round((clientPct + extra) * 10) / 10);
  await rooms.memberRef(roomId, uid).update({ similarity, "violations.penaltyPct": penaltyPct });
  await recomputeMember(room, uid, penaltyPct);
  console.info(JSON.stringify({ evt: "rooms.waive", roomId, host: host.uid, uid, problemId }));
}

// ── Chat ────────────────────────────────────────────────────────────────────

const lastChat = new Map<string, number>();

export async function postChat(user: AuthedUser, roomId: string, text: string) {
  const { room, member } = await requireParticipant(roomId, user.uid);
  const settings = settingsOf(room);
  if (settings.chat === "off") throw ApiError.forbidden("Chat is off in this room");
  if (room.status !== "lobby" && room.status !== "finished") throw ApiError.forbidden("Chat is only open in the lobby and after the contest");
  const key = `${roomId}:${user.uid}`;
  if (Date.now() - (lastChat.get(key) ?? 0) < 2000) throw new ApiError(429, "QUOTA_EXCEEDED", "Slow down a little", { resetAt: new Date(Date.now() + 2000).toISOString() });
  lastChat.set(key, Date.now());
  const clean = text.trim().replace(/\b(fuck|shit|bitch|asshole|bastard|cunt|dick)\b/gi, (w) => w[0] + "*".repeat(w.length - 1));
  if (!clean) throw ApiError.validation("Empty message");
  const doc = RoomChatSchema.parse({ uid: user.uid, username: member.username, displayName: member.displayName, text: clean.slice(0, 300), at: Timestamp.now() });
  const ref = rooms.chatCol(roomId).doc();
  await ref.set(doc);
  return { id: ref.id, ...doc, at: doc.at.toDate().toISOString() };
}

export async function listChat(user: AuthedUser, roomId: string, afterMs: number) {
  await requireParticipant(roomId, user.uid);
  const list = await rooms.listChat(roomId, afterMs);
  return list.map((m) => ({ id: m.id, uid: m.uid, username: m.username, displayName: m.displayName, text: m.text, at: m.at.toDate().toISOString() }));
}

export async function deleteChat(host: AuthedUser, roomId: string, msgId: string): Promise<void> {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid && !host.isAdmin) throw ApiError.forbidden("Only the host can delete messages");
  await rooms.chatCol(roomId).doc(msgId).update({ deleted: true });
}

// ── Rematch ─────────────────────────────────────────────────────────────────

export async function rematch(host: AuthedUser, roomId: string) {
  const room = await getRoomOrThrow(roomId);
  if (room.hostUid !== host.uid) throw ApiError.forbidden("Only the host can start a rematch");
  if (room.status !== "finished" && room.status !== "cancelled") throw ApiError.conflict("Finish this contest first");
  const settings = settingsOf(room);
  const out = await createRoom(host, { ...settings, name: settings.name.replace(/ · rematch( \d+)?$/, "") + " · rematch", scheduledAt: null });
  await rooms.roomRef(out.room.id).update({ rematchOf: roomId });
  // invite: members of the old room get an invitation doc (the shell shows a toast on the next /api/me poll)
  const members = await rooms.listMembers(roomId, ["accepted", "left"]);
  const batch = adminDb.batch();
  for (const m of members) if (m.uid !== host.uid) batch.set(adminDb.collection("users").doc(m.uid).collection("inbox").doc(`room_${out.room.id}`), { type: "rematch", roomId: out.room.id, code: out.code, name: out.room.name, from: room.host, at: Timestamp.now() });
  await batch.commit();
  return out;
}

// ── Cron sweep ──────────────────────────────────────────────────────────────

export async function sweep(): Promise<{ finalised: number; cancelled: number; codes: number }> {
  let finalised = 0, cancelled = 0, codes = 0;
  const now = Date.now();
  for (const r of await rooms.listByStatus("running")) if (r.endsAt && r.endsAt.toMillis() + 120_000 <= now) { try { await finaliseRoom(r.id); finalised++; } catch { /* logged */ } }
  for (const r of await rooms.listByStatus("finalising")) if (r.updatedAt.toMillis() + 10 * 60_000 <= now) { await rooms.roomRef(r.id).update({ status: "running" }); try { await finaliseRoom(r.id); finalised++; } catch { /* logged */ } }
  for (const r of await rooms.listByStatus("lobby")) {
    const idle = r.updatedAt.toMillis() + 6 * 60 * 60 * 1000 <= now;
    const missedSchedule = r.scheduledAt && r.scheduledAt.toMillis() + 2 * 60 * 60 * 1000 <= now;
    if (idle || missedSchedule) { await closeRoom(r, "cancelled"); cancelled++; }
  }
  const expired = await adminDb.collection(rooms.CODES).where("expiresAt", "<=", Timestamp.now()).limit(200).get();
  if (!expired.empty) { const batch = adminDb.batch(); expired.docs.forEach((d) => batch.delete(d.ref)); await batch.commit(); codes = expired.size; }
  return { finalised, cancelled, codes };
}

/** 403 when `problemId` is part of the caller's running room (no AI help in the arena). */
export async function assertNotInActiveRoom(uid: string, problemId: string): Promise<void> {
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const roomId = userSnap.data()?.activeRoomId as string | null | undefined;
  if (!roomId) return;
  const room = await rooms.getRoom(roomId);
  if (room && room.status === "running" && room.problemSet.some((p) => p.problemId === problemId)) throw ApiError.forbidden("Not available during a live contest.");
}

export { JUDGE_BUSY_MESSAGE };
