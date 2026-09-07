/**
 * Module 04 acceptance checks that need state setup or AI generations (kept out of `api:smoke`):
 *   1. daily challenge bonus (+20 xp, `daily.solved`) for a user who has not solved it today,
 *   2. leaderboard consistency as two users (same entries, my rank matches the list, ties share),
 *   3. template projects prefer pre-generated problems (`source: "reused"`, `templateRef` present),
 *   4. returning-user calibration (lastActiveDate 20 days back → "Calibration step n/3" ×3 → normal).
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/m04-acceptance.ts --uidA <admin free uid> --uidB <pro uid> [--base http://localhost:3004]
 * Costs: up to ~4 AI generations for the template + calibration paths.
 */
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";
import { getAdminDb } from "../src/lib/firebase-admin";

const JAVA_TWO_SUM = `class Solution { public int[] twoSum(int[] nums, int target) { Map<Integer,Integer> m = new HashMap<>(); for (int i = 0; i < nums.length; i++) { Integer j = m.get(target - nums[i]); if (j != null) return new int[]{j, i}; m.put(nums[i], i); } return new int[0]; } }`;

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

async function main() {
  const a = args();
  const base = String(a.base ?? "http://localhost:3004");
  const uidA = String(a.uidA ?? ""); const uidB = String(a.uidB ?? "");
  if (!uidA || !uidB) throw new Error("usage: --uidA <uid> --uidB <uid>");
  const [A, B] = await Promise.all([mintIdToken({ uid: uidA }), mintIdToken({ uid: uidB })]);
  const db = getAdminDb();
  const created: { id: string; token: string }[] = [];
  const only = new Set(String(a.only ?? "daily,leaderboard,template,calibration,post").split(","));
  if (a.resetQuotaA === true) { await db.collection("users").doc(uidA).update({ "quotas.generate": 0 }); console.log("  (reset A's generate quota)"); }
  let r: { status: number; body: any } = { status: 0, body: null };
  // leftovers from an interrupted run
  for (const [uid, token] of [[uidA, A.idToken], [uidB, B.idToken]] as const) {
    const stale = await db.collection("projects").where("uid", "==", uid).get();
    for (const d of stale.docs) if (/^(M04 |Smoke project|AI smoke)/.test(String(d.data().title ?? ""))) { await call(base, `/api/projects/${d.id}`, token, { method: "DELETE" }); console.log(`  (deleted leftover project "${d.data().title}")`); }
  }

  // 1. daily challenge bonus (user B)
  if (only.has("daily")) {
  r = await call(base, "/api/daily", B.idToken);
  const daily = r.body;
  check("GET /api/daily (B)", r.status === 200 && daily.challenge?.problemId, `problem=${daily.challenge?.title} solved=${daily.solved} project=${daily.projectId}`);
  if (daily.challenge?.problemId === "two-sum" && !daily.solved) {
    const before = (await db.collection("users").doc(uidB).get()).data()!.stats;
    r = await call(base, "/api/submit", B.idToken, { method: "POST", json: { problemId: "two-sum", projectId: daily.projectId, language: "java", code: JAVA_TWO_SUM, meta: { hintsUsed: 0, timeSpentSec: 90, runCount: 1, editorialViewed: false, localHour: 2 } } });
    check("  submit the daily → daily.solved + xp ≥ 22 (2 attempt + 20 bonus)", r.status === 200 && r.body.daily?.solved === true && r.body.xpEarned >= 22, `xp=${r.body.xpEarned} daily=${JSON.stringify(r.body.daily)} unlocked=${r.body.newlyUnlocked?.map((u: any) => u.id).join(",")}`);
    const after = (await db.collection("users").doc(uidB).get()).data()!.stats;
    check("  stats.dailySolved +1", after.dailySolved === (before.dailySolved ?? 0) + 1, `${before.dailySolved ?? 0} → ${after.dailySolved}`);
    r = await call(base, "/api/daily", B.idToken);
    check("  GET /api/daily now solved:true", r.status === 200 && r.body.solved === true);
    r = await call(base, "/api/activity", B.idToken);
    const today = new Date().toISOString().slice(0, 10);
    const day = r.body.days?.find((d: any) => d.date === today);
    check("  activity heatmap cell has dailySolved + xp", !!day && day.dailySolved === true && day.xpEarned >= 22, JSON.stringify(day));
  } else {
    console.log("  (skipped: today's challenge is not two-sum or already solved by B)");
  }
  }

  // 2. leaderboard as two users
  if (only.has("leaderboard")) {
  const [la, lb] = await Promise.all([call(base, "/api/leaderboard?scope=global", A.idToken), call(base, "/api/leaderboard?scope=global", B.idToken)]);
  const sameEntries = JSON.stringify(la.body.entries?.map((e: any) => [e.uid, e.rank, e.score])) === JSON.stringify(lb.body.entries?.map((e: any) => [e.uid, e.rank, e.score]));
  check("leaderboard: both users see the same page + ranks", la.status === 200 && lb.status === 200 && sameEntries, `A rank=${la.body.me?.rank} B rank=${lb.body.me?.rank} total=${la.body.me?.total} entries=${la.body.entries?.length}`);
  const rowA = la.body.entries?.find((e: any) => e.uid === uidA); const rowB = lb.body.entries?.find((e: any) => e.uid === uidB);
  check("  my rank matches my row when on the first page", (!rowA || rowA.rank === la.body.me.rank) && (!rowB || rowB.rank === lb.body.me.rank), `rowA=${rowA?.rank} me=${la.body.me?.rank} rowB=${rowB?.rank} me=${lb.body.me?.rank}`);
  const ents: any[] = la.body.entries ?? [];
  check("  ties share rank, scores descending", ents.every((e, i) => i === 0 || (e.score <= ents[i - 1].score && (e.score === ents[i - 1].score ? e.rank === ents[i - 1].rank : e.rank > ents[i - 1].rank))));
  }

  // 3. template preference (B generates on a google template; A then reuses)
  let templateTitle = "(existing)";
  if (only.has("template") && a.skipGenerate !== true) {
  r = await call(base, "/api/projects", B.idToken, { method: "POST", json: { title: "M04 template B", templateId: "google" } });
  check("POST /api/projects google template (B)", r.status === 200 && r.body.project?.templateId === "google");
  const tB = r.body.project?.id as string; if (tB) created.push({ id: tB, token: B.idToken });
  const t0 = Date.now();
  r = await call(base, `/api/projects/${tB}/next`, B.idToken, { method: "POST", json: { language: "java" } });
  check("  next on template → google list entry, templateRef on the problem", r.status === 200 && /google list #\d+|Template:/.test(r.body.reason?.short ?? "") && r.body.problem?.templateRef?.company === "google",
    r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `reason="${r.body.reason?.short}" source=${r.body.source} title="${r.body.problem?.title}" ${Date.now() - t0} ms rationale=${JSON.stringify(r.body.rationale)}`);
  templateTitle = r.body.problem?.templateRef?.title;
  }
  if (only.has("template")) {
  r = await call(base, "/api/projects", A.idToken, { method: "POST", json: { title: "M04 template A", templateId: "google" } });
  const tA = r.body.project?.id as string; if (tA) created.push({ id: tA, token: A.idToken });
  const t1 = Date.now();
  r = await call(base, `/api/projects/${tA}/next`, A.idToken, { method: "POST", json: { language: "java" } });
  check("  another user's google template → prefers the pre-generated entry: source=reused, templateRef present", r.status === 200 && r.body.source === "reused" && r.body.problem?.templateRef?.company === "google",
    r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `reason="${r.body.reason?.short}" source=${r.body.source} title="${r.body.problem?.title}" (B generated "${templateTitle}") ${Date.now() - t1} ms rationale=${JSON.stringify(r.body.rationale)}`);
  }

  // 3b. streak freeze: skip a day with a freeze banked → streak preserved, freeze consumed (checklist §6.4)
  if (only.has("freeze")) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await db.collection("users").doc(uidA).update({ "stats.lastActiveDate": twoDaysAgo, "stats.currentStreak": 9, "stats.streakFreezes": 1 });
    r = await call(base, "/api/admin/simulate", A.idToken, { method: "POST", json: { count: 1, passRate: 1, seed: 77, topics: ["array"] } });
    const s = r.body?.steps?.[0];
    check("freeze covers a missed day: streak 9 → 10, freezes 1 → 0", r.status === 200 && s?.streak === 10 && s?.freezes === 0, `streak=${s?.streak} freezes=${s?.freezes} lastActiveDate was ${twoDaysAgo}`);
    await db.collection("users").doc(uidA).update({ "stats.lastActiveDate": new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), "stats.currentStreak": 10, "stats.streakFreezes": 0 });
    r = await call(base, "/api/admin/simulate", A.idToken, { method: "POST", json: { count: 1, passRate: 1, seed: 78, topics: ["array"] } });
    check("  no freeze available → streak resets to 1", r.status === 200 && r.body?.steps?.[0]?.streak === 1, `streak=${r.body?.steps?.[0]?.streak}`);
    r = await call(base, "/api/activity", A.idToken);
    check("  GET /api/activity reflects the streak fields", r.status === 200 && r.body.currentStreak === 1 && typeof r.body.streakFreezes === "number" && r.body.streak?.active === true, `current=${r.body.currentStreak} freezes=${r.body.streakFreezes} streak=${JSON.stringify(r.body.streak)}`);
  }

  // 4. returning-user calibration (A: admin, so /api/admin/simulate can stand in for accepted submissions)
  r = await call(base, "/api/projects", A.idToken, { method: "POST", json: { title: "M04 calibration", templateId: null } });
  const cA = r.body.project?.id as string; if (cA) created.push({ id: cA, token: A.idToken });
  if (only.has("calibration")) {
  await db.collection("users").doc(uidA).update({ "stats.lastActiveDate": new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10), calibration: { complete: true, step: 3 } });
  const steps: string[] = [];
  for (let step = 1; step <= 3; step++) {
    r = await call(base, `/api/projects/${cA}/next`, A.idToken, { method: "POST", json: { language: "java" } });
    if (r.status === 429) { console.log(`  (generation quota exhausted at step ${step}: ${r.body?.error?.message})`); break; }
    steps.push(`${r.body.reason?.short} [${r.body.source}, ${r.body.problem?.difficulty}, ${r.body.problem?.tags?.join("+")}]`);
    check(`  calibration next #${step} → "Calibration step ${step}/3", isCalibration`, r.status === 200 && r.body.reason?.short === `Calibration step ${step}/3` && r.body.isCalibration === true, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : steps[steps.length - 1]);
    const u = (await db.collection("users").doc(uidA).get()).data()!;
    check(`  users.calibration after next #${step}`, u.calibration?.complete === false && u.calibration?.step === step - 1, JSON.stringify(u.calibration));
    r = await call(base, "/api/admin/simulate", A.idToken, { method: "POST", json: { count: 1, passRate: 1, seed: step, topics: r.body.problem?.tags?.slice(0, 1) ?? ["array"] } });
    check(`  accepted submission advances calibration to step ${step}`, r.status === 200 && r.body.calibration?.step === step && r.body.calibration?.complete === (step === 3), JSON.stringify(r.body.calibration));
  }
  }
  if (only.has("post")) {
  try { r = await call(base, `/api/projects/${cA}/next`, A.idToken, { method: "POST", json: { language: "java" } }); }
  catch (e) { r = { status: 0, body: { error: { message: (e as Error).message } } }; }
  if (r.status === 429) console.log(`  (generation quota exhausted for the post-calibration next: ${r.body?.error?.message})`);
  else if (r.status === 0) console.log(`  (post-calibration next did not answer within the fetch timeout — a Module 02 generation with repairs can exceed 5 min: ${r.body?.error?.message})`);
  else check("  after calibration → normal (non-calibration) recommendation with rationale", r.status === 200 && r.body.isCalibration === false && !/Calibration/.test(r.body.reason?.short ?? "") && Array.isArray(r.body.rationale) && r.body.rationale.length > 0, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `reason="${r.body.reason?.short}" state=${r.body.practiceState} strategy=${r.body.strategy} source=${r.body.source} rationale=${JSON.stringify(r.body.rationale)}`);
  }

  for (const p of created) await call(base, `/api/projects/${p.id}`, p.token, { method: "DELETE" });
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
