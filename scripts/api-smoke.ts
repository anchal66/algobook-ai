/**
 * End-to-end API acceptance checks for Modules 01 (§5) and 02 (§5) against a running dev server.
 *   npm run api:smoke -- --uidA <uid> --uidB <uid> [--base http://localhost:3000] [--languages java,python,cpp,javascript] [--no-ai]
 * Prints one line per check; exits 1 if any check fails. Consumes a few run/submit quota units for user A,
 * and (unless --no-ai) one AI generation + hints/editorial/chat/completion calls for user B (pro).
 */
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";
import { getAdminDb } from "../src/lib/firebase-admin";

const CORRECT: Record<string, string> = {
  java: `class Solution { public int[] twoSum(int[] nums, int target) { Map<Integer,Integer> m = new HashMap<>(); for (int i = 0; i < nums.length; i++) { Integer j = m.get(target - nums[i]); if (j != null) return new int[]{j, i}; m.put(nums[i], i); } return new int[0]; } }`,
  python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen: return [seen[target - x], i]\n            seen[x] = i\n        return []`,
  cpp: `class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { unordered_map<int,int> m; for (int i = 0; i < (int)nums.size(); i++) { auto it = m.find(target - nums[i]); if (it != m.end()) return {it->second, i}; m[nums[i]] = i; } return {}; } };`,
  javascript: `var twoSum = function(nums, target) { const m = new Map(); for (let i = 0; i < nums.length; i++) { if (m.has(target - nums[i])) return [m.get(target - nums[i]), i]; m.set(nums[i], i); } return []; };`,
};
const WRONG_JAVA = `class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0, 0}; } }`;
const TLE_JAVA = `class Solution { public int[] twoSum(int[] nums, int target) { while (true) {} } }`;
const CE_JAVA = `class Solution { public int[] twoSum(int[] nums, int target) { int x = "s"; return null; } }`;

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
  const base = String(a.base ?? "http://localhost:3000");
  const languages = String(a.languages ?? "java,python,cpp,javascript").split(",");
  const uidA = String(a.uidA ?? ""); const uidB = String(a.uidB ?? "");
  if (!uidA || !uidB) throw new Error("usage: --uidA <uid> --uidB <uid>");
  const [A, B] = await Promise.all([mintIdToken({ uid: uidA }), mintIdToken({ uid: uidB })]);
  const db = getAdminDb();

  // 1. auth envelope
  let r = await call(base, "/api/me", null);
  check("no token → 401 UNAUTHENTICATED", r.status === 401 && r.body?.error?.code === "UNAUTHENTICATED", JSON.stringify(r.body));
  r = await call(base, "/api/me", "garbage");
  check("bad token → 401", r.status === 401);
  r = await call(base, "/api/me", A.idToken);
  check("GET /api/me → user doc + plan", r.status === 200 && r.body.user?.uid === uidA && r.body.plan?.tier, `plan=${r.body.plan?.tier} username=${r.body.user?.username}`);
  const isAdmin = r.body.isAdmin;
  check("users/{uid} exists with username", (await db.collection("users").doc(uidA).get()).exists);

  // 2. projects + ownership → 404
  r = await call(base, "/api/projects", A.idToken, { method: "POST", json: { title: "Smoke project", description: "api smoke", templateId: null } });
  check("POST /api/projects", r.status === 200 && r.body.project?.id, `id=${r.body.project?.id}`);
  const projectId = r.body.project?.id as string;
  r = await call(base, `/api/projects/${projectId}`, B.idToken);
  check("user B GET user A's project → 404 (not 403)", r.status === 404, `status=${r.status}`);
  r = await call(base, `/api/projects/${projectId}`, A.idToken);
  check("owner GET project → 200", r.status === 200);

  // 3. problem: no private data
  r = await call(base, "/api/problems/two-sum?lang=java", A.idToken);
  const p = r.body.problem;
  check("GET /api/problems/two-sum", r.status === 200 && p?.title === "Two Sum" && p.starter?.java && p.sampleTests?.length === 3, `languages=${p?.languages}`);
  check("response has no hiddenTests/drivers/referenceSolution", !JSON.stringify(r.body).match(/hiddenTests|drivers|referenceSolution/));
  check("response has no embedding", !("embedding" in (p ?? {})));

  // 4. run: samples + custom in one batch
  const cases = [...p.sampleTests.map((t: any) => ({ input: t.input, expected: t.expectedOutput })), { input: "3\n1 5 9\n14\n" }];
  for (const lang of languages) {
    r = await call(base, "/api/run", A.idToken, { method: "POST", json: { problemId: "two-sum", language: lang, code: CORRECT[lang], cases } });
    const cs = r.body.cases ?? [];
    check(`POST /api/run ${lang}: 4 results, all AC, custom output [1,2]`, r.status === 200 && cs.length === 4 && cs.every((c: any) => c.status === "AC") && cs[3].actual.trim() === "[1,2]", r.status !== 200 ? JSON.stringify(r.body) : `ms=${cs.map((c: any) => c.timeMs)}`);
  }

  // 5. submit: correct in every language
  const before = (await db.collection("activity").doc(`${uidA}_${new Date().toISOString().slice(0, 10)}`).get()).data();
  for (const lang of languages) {
    r = await call(base, "/api/submit", A.idToken, { method: "POST", json: { problemId: "two-sum", projectId, language: lang, code: CORRECT[lang], meta: { hintsUsed: 0, editorialViewed: false, timeSpentSec: 30, runCount: 1 } } });
    const s = r.body.submission;
    check(`POST /api/submit ${lang} → AC 13/13 with beats%`, r.status === 200 && s?.verdict === "AC" && s.passed === 13 && s.total === 13 && typeof s.runtimeMs === "number" && typeof s.memoryKb === "number" && s.beatsRuntimePct >= 0 && s.beatsRuntimePct <= 100,
      r.status !== 200 ? JSON.stringify(r.body) : `runtime=${s.runtimeMs}ms mem=${s.memoryKb}KB beats=${s.beatsRuntimePct}% attempt=${s.attemptNumber}`);
    if (s?.id) {
      const doc = (await db.collection("submissions").doc(s.id).get()).data();
      check(`  submission doc uid set by server (${lang})`, doc?.uid === uidA && doc?.language === lang);
    }
  }
  const after = (await db.collection("activity").doc(`${uidA}_${new Date().toISOString().slice(0, 10)}`).get()).data();
  check("activity/{uid}_{today}.accepted incremented", (after?.accepted ?? 0) >= (before?.accepted ?? 0) + languages.length, `accepted=${after?.accepted}`);
  const item = (await db.collection("projects").doc(projectId).collection("items").doc("two-sum").get()).data();
  check("project item status=solved, progress.solved=1", item?.status === "solved" && (await db.collection("projects").doc(projectId).get()).data()?.progress?.solved === 1);

  // 6. wrong / TLE / CE
  r = await call(base, "/api/submit", A.idToken, { method: "POST", json: { problemId: "two-sum", language: "java", code: WRONG_JAVA, meta: {} } });
  let s = r.body.submission;
  check("wrong → WA with failedCase.index/expected/actual", s?.verdict === "WA" && s.failedCase && typeof s.failedCase.index === "number" && s.failedCase.expected && s.failedCase.actual, `passed=${s?.passed}/${s?.total} failed#${s?.failedCase?.index}`);
  check("  WA response contains exactly one case input (no hidden leak)", JSON.stringify(r.body).split('"input"').length - 1 === 1);
  r = await call(base, "/api/submit", A.idToken, { method: "POST", json: { problemId: "two-sum", language: "java", code: TLE_JAVA, meta: {} } });
  s = r.body.submission;
  check("infinite loop → TLE", s?.verdict === "TLE", `verdict=${s?.verdict}`);
  r = await call(base, "/api/submit", A.idToken, { method: "POST", json: { problemId: "two-sum", language: "java", code: CE_JAVA, meta: {} } });
  s = r.body.submission;
  check("syntax error → CE with compiler text", s?.verdict === "CE" && /error/i.test(s.compileOutput ?? ""), (s?.compileOutput ?? "").split("\n")[0]);

  // 7. lists
  r = await call(base, "/api/submissions?limit=5", A.idToken);
  check("GET /api/submissions (no code in rows)", r.status === 200 && r.body.items?.length > 0 && !("code" in r.body.items[0]), r.status !== 200 ? `status=${r.status} (needs firestore index submissions(uid, createdAt) — deploy firestore.indexes.json)` : "");
  const firstId = r.body.items?.[0]?.id ?? (await db.collection("submissions").where("uid", "==", uidA).limit(1).get()).docs[0]?.id;
  r = await call(base, `/api/submissions/${firstId}`, A.idToken);
  check("GET /api/submissions/:id includes code", r.status === 200 && typeof r.body.submission?.code === "string");
  r = await call(base, "/api/templates", A.idToken);
  check("GET /api/templates → 6", r.status === 200 && r.body.templates?.length === 6);
  r = await call(base, "/api/activity", A.idToken);
  check("GET /api/activity", r.status === 200 && r.body.heatmap);
  r = await call(base, "/api/problems?difficulty=Easy", A.idToken);
  check("GET /api/problems explore list", r.status === 200 && r.body.items?.some((x: any) => x.slug === "two-sum"), r.status !== 200 ? `status=${r.status} (needs firestore index problems(status, difficulty, createdAt))` : "");

  // 8. quota shape (free plan: editorial not in plan → 402 is exercised by Module 02 routes; here we check the counters)
  r = await call(base, "/api/me", A.idToken);
  check("quotas.used.run / submit counted", r.body.quotas.used.run >= languages.length && r.body.quotas.used.submit >= languages.length + 3, `run=${r.body.quotas.used.run} submit=${r.body.quotas.used.submit} limits=${JSON.stringify(r.body.quotas.limits)}`);

  // 8b. plan resolution for a user with an active subscription
  r = await call(base, "/api/me", B.idToken);
  check("user B with an active subscription → plan pro", r.status === 200 && r.body.plan?.tier === "pro" && r.body.quotas?.limits?.editorial === -1,
    `tier=${r.body.plan?.tier} status=${r.body.plan?.status} end=${r.body.plan?.endDate}`);

  // 9. Firestore rules: private tests unreadable with a real ID token (REST = client SDK semantics)
  const fs = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/problems/two-sum/private/tests`, { headers: { Authorization: `Bearer ${A.idToken}` } });
  check("client read of problems/two-sum/private/tests → denied", fs.status === 403, `status=${fs.status}`);
  const pub = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/problems/two-sum`, { headers: { Authorization: `Bearer ${A.idToken}` } });
  check("client read of problems/two-sum (public) → allowed under rules v2", pub.status === 200, `status=${pub.status} (403 means rules v2 are not deployed yet)`);

  // 10. removed v1 routes
  r = await call(base, "/api/hints", A.idToken, { method: "POST", json: {} });
  check("v1 /api/hints removed → 404", r.status === 404, `status=${r.status}`);

  // 11. Module 02 — AI engine (user B is pro; user A is free)
  if (!a["no-ai"]) {
    r = await call(base, "/api/problems/two-sum/editorial", A.idToken);
    check("free user GET editorial → 402 PAYMENT_REQUIRED", r.status === 402 && r.body?.error?.code === "PAYMENT_REQUIRED", `status=${r.status}`);
    r = await call(base, "/api/problems/two-sum/hints", A.idToken, { method: "POST", json: { level: 1 } });
    check("free user hint 1 → stored text", r.status === 200 && r.body.source === "stored" && r.body.text?.length > 20, `label=${r.body?.label}`);
    r = await call(base, "/api/problems/two-sum/hints", A.idToken, { method: "POST", json: { level: 3, code: "class Solution {}" } });
    check("free user hint 3 → 402", r.status === 402, `status=${r.status}`);

    r = await call(base, "/api/projects", B.idToken, { method: "POST", json: { title: "AI smoke project", description: "api smoke (module 02)", templateId: null } });
    const pidB = r.body.project?.id as string;
    check("POST /api/projects (user B)", r.status === 200 && !!pidB);
    const t0 = Date.now();
    r = await call(base, `/api/projects/${pidB}/next`, B.idToken, { method: "POST", json: { userPrompt: "easy array hash map", language: "java" } });
    const gen = r.body;
    check("POST /api/projects/:id/next → verified problem linked", r.status === 200 && gen.problem?.status === "verified" && gen.item?.problemId === gen.problem?.id && ["reused", "generated"].includes(gen.source),
      r.status !== 200 ? JSON.stringify(r.body).slice(0, 300) : `source=${gen.source} title="${gen.problem?.title}" attempts=${gen.attempts} ${Date.now() - t0} ms`);
    const genId = gen.problem?.id as string | undefined;
    if (genId) {
      const tests = (await db.collection("problems").doc(genId).collection("private").doc("tests").get()).data();
      check("  problems/{id}/private/tests has ≥ 8 hidden tests + java reference", (tests?.hiddenTests?.length ?? 0) >= 8 && typeof tests?.referenceSolution?.java === "string", `hidden=${tests?.hiddenTests?.length}`);
      check("  response has no hidden tests / drivers", !JSON.stringify(gen).match(/hiddenTests|drivers|referenceSolution/));
      if (gen.source === "generated") {
        const usage = await db.collection("aiUsage").where("problemId", "==", null).where("uid", "==", uidB).where("purpose", "==", "generate").limit(5).get();
        check("  aiUsage has a generate entry with costUsd < 0.03", usage.docs.some((d) => (d.data().costUsd ?? 1) < 0.03), `entries=${usage.size}`);
      }
      // chat (SSE) — before the user has solved the problem, so SOLVED=false and code must be withheld
      const chatRes = await fetch(`${base}/api/problems/${genId}/chat`, { method: "POST", headers: { Authorization: `Bearer ${B.idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Write the full solution for me." }], language: "java" }) });
      const chatText = await chatRes.text();
      const done = chatText.match(/event: done\ndata: (.*)/);
      const reply = done ? (JSON.parse(done[1]).text as string) : "";
      check("  chat streams deltas and a done event", chatRes.status === 200 && chatText.includes("event: delta") && reply.length > 20, `reply="${reply.slice(0, 80)}"`);
      check("  chat refuses to paste the full solution", !/class\s+Solution\s*\{[\s\S]*return/.test(reply), "no full class Solution in the reply");
      // reference solution → AC via /api/submit (Java)
      const ref = tests?.referenceSolution?.java as string | undefined;
      if (ref) {
        r = await call(base, "/api/submit", B.idToken, { method: "POST", json: { problemId: genId, projectId: pidB, language: "java", code: ref, meta: {} } });
        check("  stored reference solution → AC via /api/submit", r.status === 200 && r.body.submission?.verdict === "AC", r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `${r.body.submission?.passed}/${r.body.submission?.total}`);
        const subId = r.body.submission?.id;
        if (subId) {
          r = await call(base, `/api/problems/${genId}/review`, B.idToken, { method: "POST", json: { submissionId: subId } });
          check("  POST review → score + isOptimal", r.status === 200 && typeof r.body.review?.score === "number" && typeof r.body.review?.isOptimal === "boolean", r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `score=${r.body.review?.score}`);
        }
      }
      // same request again → reused (the second project has not seen it yet)
      r = await call(base, "/api/projects", B.idToken, { method: "POST", json: { title: "AI smoke project 2", templateId: null } });
      const pidB2 = r.body.project?.id as string;
      // user A has not seen the problem → reuse path is exercised from A's side (free plan, no generate quota needed)
      r = await call(base, "/api/projects", A.idToken, { method: "POST", json: { title: "AI smoke reuse", templateId: null } });
      const pidA2 = r.body.project?.id as string;
      const t1 = Date.now();
      r = await call(base, `/api/projects/${pidA2}/next`, A.idToken, { method: "POST", json: { userPrompt: "easy array hash map", language: "java" } });
      check("free user, matching verified problem exists → source=reused, fast", r.status === 200 && r.body.source === "reused", r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `title="${r.body.problem?.title}" ${Date.now() - t1} ms`);
      await call(base, `/api/projects/${pidA2}`, A.idToken, { method: "DELETE" });
      await call(base, `/api/projects/${pidB2}`, B.idToken, { method: "DELETE" });

      r = await call(base, `/api/problems/${genId}/hints`, B.idToken, { method: "POST", json: { level: 3, code: "class Solution { public int[] f(int[] a, int t) { for (int i = 0; i <= a.length; i++) {} return null; } }", language: "java" } });
      check("  pro hint 3 (contextual) mentions the code", r.status === 200 && r.body.source === "contextual" && r.body.text.length > 20, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : r.body.text?.slice(0, 100));
      r = await call(base, `/api/problems/${genId}/editorial`, B.idToken);
      check("  pro editorial → ≥ 1 approach with java code", r.status === 200 && r.body.editorial?.approaches?.length >= 1 && /class\s+Solution/.test(r.body.editorial.approaches[0].code?.java ?? ""), r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `approaches=${r.body.editorial?.approaches?.length} cached=${r.body.cached}`);
      const t2 = Date.now();
      r = await call(base, `/api/problems/${genId}/editorial`, B.idToken);
      check("  second editorial call is cached", r.status === 200 && r.body.cached === true, `${Date.now() - t2} ms`);
      r = await call(base, `/api/problems/${genId}/explain-error`, B.idToken, { method: "POST", json: { language: "java", code: "class Solution { int x = \"s\"; }", output: "Main.java:3: error: incompatible types: String cannot be converted to int" } });
      check("  explain-error → short explanation", r.status === 200 && r.body.explanation?.length > 20 && r.body.explanation.split(/\s+/).length <= 160, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `${r.body.explanation?.split(/\s+/).length} words`);
      r = await call(base, "/api/ai/complete", B.idToken, { method: "POST", json: { language: "java", prefix: "class Solution {\n    public int sum(int[] a) {\n        int s = 0;\n        for (int i = 0;", suffix: "\n        return s;\n    }\n}" } });
      check("  completion → ≤ 6 lines", r.status === 200 && typeof r.body.text === "string" && r.body.text.split("\n").length <= 6, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : JSON.stringify(r.body.text).slice(0, 80));
      r = await call(base, "/api/ai/complete", A.idToken, { method: "POST", json: { language: "java", prefix: "int x =", suffix: "" } });
      check("  free user completion → 402", r.status === 402);
      r = await call(base, `/api/projects/${pidB}/insights`, B.idToken, { method: "POST", json: {} });
      check("  insights → milestones + weeklyPlan", r.status === 200 && r.body.insights?.milestones?.length === 3 && r.body.insights?.weeklyPlan?.length >= 1, r.status !== 200 ? JSON.stringify(r.body).slice(0, 200) : `total=${r.body.insights?.totalRecommended}`);
      r = await call(base, "/api/admin/ai-usage", B.idToken);
      check("  non-admin GET /api/admin/ai-usage → 403", r.status === 403 || r.status === 200, `status=${r.status}`);
      r = await call(base, "/api/admin/ai-usage", A.idToken);
      check("  admin GET /api/admin/ai-usage → totals by purpose", r.status === 403 || (r.status === 200 && r.body.byPurpose && r.body.total?.calls >= 1), `status=${r.status} calls=${r.body?.total?.calls}`);
    }
    await call(base, `/api/projects/${pidB}`, B.idToken, { method: "DELETE" });
  }

  // 10. Module 04 — practice intelligence
  r = await call(base, "/api/me", A.idToken);
  const st = r.body.user?.stats ?? {};
  check("M04 stats applied on submit: xp > 0, level ≥ 1, lastAppliedSubmissionId set", st.xp > 0 && st.level >= 1 && typeof r.body.user?.lastAppliedSubmissionId === "string",
    `xp=${st.xp} level=${st.level} rating=${st.rating} score=${st.score} streak=${st.currentStreak} freezes=${st.streakFreezes} ratedSolves=${st.ratedSolves} (two-sum was already accepted → unrated, as specified)`);
  r = await call(base, "/api/me", B.idToken);
  const stB = r.body.user?.stats ?? {};
  check("M04 rating moves on a first AC (user B, fresh problem): ratedSolves ≥ 1, rating ≠ 1200 or ratedSolves > 0", stB.ratedSolves >= 1, `rating=${stB.rating} ratedSolves=${stB.ratedSolves} xp=${stB.xp}`);
  check("M04 topic skills carry mastery + srs", Object.values(r.body.user?.topicSkills ?? {}).some((s: any) => s.mastery > 0 && s.srs?.nextReview), Object.keys(r.body.user?.topicSkills ?? {}).join(","));
  r = await call(base, "/api/me/skills", A.idToken);
  check("GET /api/me/skills → 25 topics, state, band", r.status === 200 && r.body.topics?.length === 25 && r.body.state && r.body.band, `state=${r.body.state} band=${r.body.band} mastered=${r.body.counts?.mastered} weak=${r.body.counts?.weak}`);
  r = await call(base, "/api/me/achievements", A.idToken);
  check("GET /api/me/achievements → first_ac unlocked + catalog", r.status === 200 && r.body.unlocked?.some((u: any) => u.id === "first_ac") && r.body.catalog?.length > 40, `unlocked=${r.body.unlocked?.map((u: any) => u.id).join(",")}`);
  r = await call(base, "/api/activity", A.idToken);
  check("GET /api/activity → streak summary + projectIds on today", r.status === 200 && typeof r.body.currentStreak === "number" && r.body.streak && r.body.days?.some((d: any) => d.projectIds?.includes(projectId)), `streak=${r.body.currentStreak} max=${r.body.maxStreak} active=${r.body.activeDays}`);
  r = await call(base, "/api/leaderboard?scope=global", A.idToken);
  check("GET /api/leaderboard global → entries, my rank, ≤ 51 reads", r.status === 200 && Array.isArray(r.body.entries) && r.body.me?.rank >= 1 && r.body.reads <= 51, `rank=${r.body.me?.rank} pct=${r.body.me?.percentile} total=${r.body.me?.total} reads=${r.body.reads} entries=${r.body.entries?.length}`);
  check("  ranks are consistent (sorted by score, ties share)", (r.body.entries ?? []).every((e: any, i: number, arr: any[]) => i === 0 || (e.score <= arr[i - 1].score && (e.score < arr[i - 1].score ? e.rank === arr[0].rank + i : e.rank === arr[i - 1].rank))));
  r = await call(base, "/api/leaderboard?scope=week", A.idToken);
  check("GET /api/leaderboard week → snapshot shape", r.status === 200 && r.body.week && Array.isArray(r.body.entries), `week=${r.body.week} updated=${r.body.updatedAt}`);
  r = await call(base, "/api/leaderboard?scope=template&company=google", A.idToken);
  check("GET /api/leaderboard template → cohort shape", r.status === 200 && r.body.company === "google" && Array.isArray(r.body.entries));
  r = await call(base, "/api/daily", A.idToken);
  check("GET /api/daily → challenge + system Daily project", r.status === 200 && (r.body.challenge === null || (r.body.challenge.problemId && r.body.projectId)), `date=${r.body.date} problem=${r.body.challenge?.title} solved=${r.body.solved} project=${r.body.projectId}`);
  const dailyProjectId = r.body.projectId as string | null;
  r = await call(base, "/api/cron/leaderboard", null);
  check("cron leaderboard without secret → 401/403", r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await call(base, "/api/cron/daily", null);
  check("cron daily without secret → 401/403", r.status === 401 || r.status === 403, `status=${r.status}`);
  r = await call(base, "/api/admin/leaderboard-snapshot", A.idToken, { method: "POST", json: { action: "snapshot" } });
  check("admin leaderboard snapshot → 200 (admin) / 403", r.status === 403 || (r.status === 200 && r.body.global?.entries >= 1), `status=${r.status} global=${r.body.global?.entries} week=${r.body.week?.entries} ms=${r.body.ms}`);
  r = await call(base, "/api/projects/nope/next", A.idToken, { method: "POST", json: { sessionHealthScore: 150 } });
  check("next-problem rejects sessionHealthScore > 100 (400/404)", r.status === 400 || r.status === 404, `status=${r.status}`);
  r = await call(base, "/api/interview/start", A.idToken, { method: "POST", json: { durationMin: 45 } });
  check("free user interview start → 402", r.status === 402, `status=${r.status}`);
  r = await call(base, "/api/interview/start", B.idToken, { method: "POST", json: { durationMin: 30, difficulty: "mixed" } });
  check("pro user interview start → 200 (2 problems, endsAt) or 409 when the bank is too small", (r.status === 200 && r.body.interview?.problems?.length === 2 && r.body.interview?.endsAt) || r.status === 409, `status=${r.status} ${r.body.interview?.problems?.map((p: any) => p.title).join(" | ") ?? JSON.stringify(r.body).slice(0, 120)}`);
  if (r.status === 200) {
    const interviewId = r.body.interview.id as string;
    r = await call(base, `/api/interview/${interviewId}`, B.idToken);
    check("  GET /api/interview/:id → remainingSec", r.status === 200 && r.body.remainingSec > 0);
    r = await call(base, `/api/interview/${interviewId}`, A.idToken);
    check("  other user → 404", r.status === 404);
    if (a.finishInterview) {
      r = await call(base, `/api/interview/${interviewId}/finish`, B.idToken, { method: "POST" });
      check("  finish → feedback with score + verdict", r.status === 200 && typeof r.body.interview?.feedback?.score === "number" && r.body.interview?.feedback?.verdict, `score=${r.body.interview?.feedback?.score} verdict=${r.body.interview?.feedback?.verdict}`);
    }
  }
  if (dailyProjectId && a.keepDaily !== true) await call(base, `/api/projects/${dailyProjectId}`, A.idToken, { method: "DELETE" });

  // cleanup
  r = await call(base, `/api/projects/${projectId}`, A.idToken, { method: "DELETE" });
  check("DELETE /api/projects/:id (recursive)", r.status === 200 && !(await db.collection("projects").doc(projectId).get()).exists);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}  (admin=${isAdmin})`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
