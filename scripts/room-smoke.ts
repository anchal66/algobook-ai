/**
 * Competition-room acceptance run (Module 06 R-24) against a running dev server.
 *   npm run room:smoke -- --host <uid> --member <uid> [--base http://localhost:3000]
 *     full API flow: create → join by code → accept → start → consent → submit (reference solution) → events → leaderboard → end → results
 *   npm run room:smoke -- --member <uid> --code 123456 [--base …]
 *     member side only, for a room being driven from the browser: join, wait for start, consent, submit, post two integrity events
 * Uses the admin SDK to read the reference solution so the member's submit is a guaranteed Accepted.
 */
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";
import { getAdminDb } from "../src/lib/firebase-admin";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}
async function call(base: string, path: string, token: string | null, init: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function referenceFor(problemId: string, language: string): Promise<string | null> {
  const snap = await getAdminDb().collection("problems").doc(problemId).collection("private").doc("tests").get();
  return (snap.data()?.referenceSolution?.[language] as string | undefined) ?? null;
}

async function memberPlay(base: string, M: { idToken: string }, roomId: string) {
  // wait for running
  let detail: any = null;
  for (let i = 0; i < 120; i++) {
    const r = await call(base, `/api/rooms/${roomId}`, M.idToken);
    detail = r.body;
    if (detail?.room?.status === "running" && detail.me?.state === "accepted") break;
    if (detail?.room?.status === "finished" || detail?.room?.status === "cancelled") { check("room still open for the member", false, detail.room.status); return; }
    await sleep(2000);
  }
  check("member sees the room running", detail?.room?.status === "running", `status=${detail?.room?.status} me=${detail?.me?.state}`);
  // wait for the start countdown to pass
  const startedAt = Date.parse(detail.room.startedAt);
  if (startedAt > Date.now()) await sleep(startedAt - Date.now() + 500);
  let r = await call(base, `/api/rooms/${roomId}/submit`, M.idToken, { method: "POST", json: { index: 0, language: "python", code: "x" } });
  check("submit before consent → 403 CONSENT_REQUIRED", r.status === 403 && r.body?.error?.details?.code === "CONSENT_REQUIRED", JSON.stringify(r.body).slice(0, 120));
  r = await call(base, `/api/rooms/${roomId}/consent`, M.idToken, { method: "POST" });
  check("consent recorded", r.status === 200 && r.body.consentVersion, r.body.consentVersion);
  r = await call(base, `/api/rooms/${roomId}/problems/0?lang=python`, M.idToken);
  check("member fetches problem 0", r.status === 200 && r.body.problem?.title, r.body.problem?.title);
  const problemId = r.body.problem?.id as string;
  check("problem response carries no hidden tests", !JSON.stringify(r.body).match(/hiddenTests|referenceSolution/));
  const ref = await referenceFor(problemId, "python");
  check("reference solution available for python", !!ref);
  // run on the sample
  const sample = r.body.problem.sampleTests?.[0];
  r = await call(base, `/api/rooms/${roomId}/run`, M.idToken, { method: "POST", json: { index: 0, language: "python", code: ref ?? "x", cases: [{ input: sample.input, expected: sample.expectedOutput }] } });
  check("member Run on sample → AC, runsLeft reported", r.status === 200 && r.body.cases?.[0]?.status === "AC" && typeof r.body.runsLeft === "number", JSON.stringify(r.body).slice(0, 160));
  // a wrong submit, then the reference
  r = await call(base, `/api/rooms/${roomId}/submit`, M.idToken, { method: "POST", json: { index: 0, language: "python", code: "class Solution:\n    def " + (r.body?.cases ? "" : "") + "anything(self): return None\n" } });
  check("member wrong submit → recorded (not AC)", r.status === 200 && r.body.submission?.verdict !== "AC", `verdict=${r.body.submission?.verdict} attempts=${r.body.problem?.attempts}`);
  r = await call(base, `/api/rooms/${roomId}/submit`, M.idToken, { method: "POST", json: { index: 0, language: "python", code: ref ?? "x" } });
  check("member reference submit → AC with points", r.status === 200 && r.body.submission?.verdict === "AC" && r.body.problem?.points > 0 && r.body.problem?.status === "solved", `points=${r.body.problem?.points} score=${r.body.score?.final} submitsLeft=${r.body.problem?.submitsLeft}`);
  const pointsBefore = r.body.score?.final as number;
  r = await call(base, `/api/rooms/${roomId}/submit`, M.idToken, { method: "POST", json: { index: 0, language: "python", code: ref ?? "x" } });
  check("submit after solve → 409 ROOM_SOLVED", r.status === 409, JSON.stringify(r.body).slice(0, 100));
  // integrity events
  r = await call(base, `/api/rooms/${roomId}/events`, M.idToken, { method: "POST", json: { events: [
    { type: "heartbeat", at: Date.now(), meta: { tab: "visible" }, clientSeq: 1, sessionId: "s1" },
    { type: "paste_external", at: Date.now(), meta: { chars: 80 }, clientSeq: 2, sessionId: "s1" },
    { type: "tab_hidden", at: Date.now(), meta: { durationMs: 40_000 }, clientSeq: 3, sessionId: "s1" },
    { type: "tab_hidden", at: Date.now(), meta: { durationMs: 1000 }, clientSeq: 4, sessionId: "s1" },
  ] } });
  check("events → 8% + 4% penalty, short absence ignored, score reduced", r.status === 200 && r.body.violations?.count === 2 && r.body.violations?.penaltyPct === 12 && r.body.score?.final < pointsBefore, JSON.stringify(r.body).slice(0, 200));
  r = await call(base, `/api/rooms/${roomId}/events`, M.idToken, { method: "POST", json: { events: [{ type: "paste_external", at: Date.now(), meta: { chars: 80 }, clientSeq: 2, sessionId: "s1" }] } });
  check("duplicate clientSeq ignored", r.status === 200 && r.body.violations?.count === 2, `count=${r.body.violations?.count}`);
  r = await call(base, `/api/rooms/${roomId}/leaderboard`, M.idToken);
  check("member leaderboard has my row with a rank", r.status === 200 && r.body.rows?.some((x: any) => x.solved === 1), JSON.stringify(r.body.rows?.map((x: any) => [x.username, x.final, x.rank])));
  r = await call(base, `/api/problems/${problemId}/hints`, M.idToken, { method: "POST", json: { level: 1 } });
  check("AI hint on a contest problem → 403 while running", r.status === 403, `status=${r.status}`);
  r = await call(base, `/api/rooms/${roomId}/events`, M.idToken);
  check("member sees own events only", r.status === 200 && r.body.events?.every((e: any) => e.type !== "heartbeat") && r.body.events.length === 2, `n=${r.body.events?.length}`);
  return problemId;
}

async function main() {
  const a = args();
  const base = String(a.base ?? "http://localhost:3000");
  const memberUid = String(a.member ?? "");
  if (!memberUid) throw new Error("usage: --host <uid> --member <uid> | --member <uid> --code 123456");
  const M = await mintIdToken({ uid: memberUid });

  if (a.code) {
    const r = await call(base, "/api/rooms/join", M.idToken, { method: "POST", json: { code: String(a.code) } });
    check("member joins by code", r.status === 200 && r.body.roomId, JSON.stringify(r.body));
    if (!r.body.roomId) process.exit(1);
    await memberPlay(base, M, r.body.roomId);
    console.log(failures ? `\n${failures} check(s) failed` : "\nmember flow done");
    process.exit(failures ? 1 : 0);
  }

  const hostUid = String(a.host ?? "");
  if (!hostUid) throw new Error("usage: --host <uid> --member <uid>");
  const H = await mintIdToken({ uid: hostUid });
  let r = await call(base, "/api/judge/budget", H.idToken);
  console.log(`judge budget: ${JSON.stringify(r.body)}`);

  // create
  r = await call(base, "/api/rooms", H.idToken, { method: "POST", json: { name: "Smoke room", description: "api smoke", count: 2, difficultyMode: "any", topicMode: "any", durationMin: 10, maxMembers: 4, rated: false, joinApproval: "manual", languages: ["python", "java"], caps: { maxSubmitsPerProblem: 3, maxRunsPerProblem: 2 } } });
  check("host creates a room with a 6-digit code", r.status === 200 && /^\d{6}$/.test(r.body.code ?? ""), JSON.stringify(r.body).slice(0, 200));
  const roomId = r.body.room?.id as string, code = r.body.code as string;
  if (!roomId) process.exit(1);
  r = await call(base, "/api/rooms", H.idToken, { method: "POST", json: { name: "Second room" } });
  check("second live room for the same host → 409", r.status === 409, `status=${r.status}`);
  r = await call(base, `/api/rooms/${roomId}`, M.idToken);
  check("non-member cannot see a private lobby (404)", r.status === 404, `status=${r.status}`);
  r = await call(base, "/api/rooms/join", M.idToken, { method: "POST", json: { code: "000000" } });
  check("bad code → 404", r.status === 404);
  r = await call(base, "/api/rooms/join", M.idToken, { method: "POST", json: { code } });
  check("member joins by code → pending", r.status === 200 && r.body.state === "pending", JSON.stringify(r.body));
  r = await call(base, `/api/rooms/${roomId}`, H.idToken);
  check("host sees the pending member and the code", r.body.members?.some((m: any) => m.uid === memberUid && m.state === "pending") && r.body.room?.code === code, `members=${r.body.members?.length} slots=${JSON.stringify(r.body.room?.slots?.map((s: any) => s.status))}`);
  r = await call(base, `/api/rooms/${roomId}/start`, H.idToken, { method: "POST", json: {} });
  check("start with only the host (unrated) allowed → or refused by budget", r.status === 200 || r.body?.error?.details?.code === "JUDGE_BUDGET_LOW", JSON.stringify(r.body).slice(0, 160));
  if (r.status === 200) { console.log("started early (host-only) — recreate with a member for the rest"); process.exit(failures ? 1 : 0); }
  r = await call(base, `/api/rooms/${roomId}/members/${memberUid}`, H.idToken, { method: "POST", json: { action: "accept" } });
  check("host accepts the member", r.status === 200);
  r = await call(base, `/api/rooms/${roomId}`, M.idToken);
  check("member now sees the lobby, no problem titles", r.status === 200 && r.body.me?.state === "accepted" && r.body.room.problemSet.length === 0 && r.body.room.slots.every((s: any) => s.problemId === null), JSON.stringify(r.body.room?.slots).slice(0, 120));
  r = await call(base, `/api/rooms/${roomId}/chat`, M.idToken, { method: "POST", json: { text: "gl hf" } });
  check("lobby chat", r.status === 200 && r.body.message?.text === "gl hf");
  r = await call(base, `/api/rooms/${roomId}/start`, H.idToken, { method: "POST", json: {} });
  check("host starts", r.status === 200 && r.body.status === "running", JSON.stringify(r.body).slice(0, 200));
  if (r.status !== 200) process.exit(1);
  r = await call(base, "/api/rooms/join", M.idToken, { method: "POST", json: { code } });
  check("join by code after start → 404 (code released)", r.status === 404 || r.status === 409, `status=${r.status}`);

  const problemId = await memberPlay(base, M, roomId);
  // host: consent + a wrong submit on problem 0 in java
  r = await call(base, `/api/rooms/${roomId}/consent`, H.idToken, { method: "POST" });
  r = await call(base, `/api/rooms/${roomId}/submit`, H.idToken, { method: "POST", json: { index: 0, language: "java", code: "class Solution { }" } });
  check("host wrong submit (CE) recorded", r.status === 200 && r.body.submission?.verdict === "CE", `verdict=${r.body.submission?.verdict}`);
  r = await call(base, `/api/rooms/${roomId}/leaderboard`, H.idToken);
  const rows = r.body.rows ?? [];
  check("leaderboard ranks the member first", rows[0]?.uid === memberUid && rows[0].rank === 1 && rows.find((x: any) => x.uid === hostUid)?.rank === 2, JSON.stringify(rows.map((x: any) => [x.username, x.final, x.rank])));
  r = await call(base, `/api/rooms/${roomId}/end`, H.idToken, { method: "POST" });
  check("host ends → finished", r.status === 200 && r.body.status === "finished", JSON.stringify(r.body));
  r = await call(base, `/api/rooms/${roomId}/results`, M.idToken);
  check("results: standings, per-problem stats, my report with 2 events", r.status === 200 && r.body.standings?.length === 2 && r.body.perProblem?.[0]?.solved === 1 && r.body.me?.events?.length === 2 && r.body.me.rank === 1, JSON.stringify({ ranks: r.body.standings?.map((x: any) => [x.username, x.rank, x.final]), events: r.body.me?.events?.length }));
  r = await call(base, `/api/rooms/${roomId}/results`, H.idToken);
  check("results: unrated room applied no rating", r.status === 200 && r.body.me?.ratingDelta === null && r.body.room.finalised.ratingsApplied === false);
  r = await call(base, "/api/me", M.idToken);
  check("member activeRoom cleared after finish", r.status === 200 && !r.body.activeRoom, JSON.stringify(r.body.activeRoom));
  r = await call(base, "/api/rooms?scope=history", M.idToken);
  check("history lists the finished room with my rank", r.body.rooms?.some((x: any) => x.id === roomId && x.mine?.rank === 1));
  const db = getAdminDb();
  const mirrored = await db.collection("submissions").where("uid", "==", memberUid).where("problemId", "==", problemId).limit(5).get();
  check("contest submissions mirrored into `submissions` (history/heatmap)", mirrored.size >= 2, `n=${mirrored.size}`);
  const userDoc = (await db.collection("users").doc(memberUid).get()).data();
  check("users.rooms.played incremented, mastery untouched by contest", (userDoc?.rooms?.played ?? 0) >= 1 && userDoc?.lastAppliedSubmissionId !== mirrored.docs[0]?.id, `played=${userDoc?.rooms?.played}`);
  console.log(failures ? `\n${failures} check(s) failed` : "\nall room checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
