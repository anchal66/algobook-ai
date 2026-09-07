/**
 * End-to-end API acceptance checks for Module 01 (§5) against a running dev server.
 *   npm run api:smoke -- --uidA <uid> --uidB <uid> [--base http://localhost:3000] [--languages java,python,cpp,javascript]
 * Prints one line per check; exits 1 if any check fails. Consumes a few run/submit quota units for user A.
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

  // 9. Firestore rules: private tests unreadable with a real ID token (REST = client SDK semantics)
  const fs = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/problems/two-sum/private/tests`, { headers: { Authorization: `Bearer ${A.idToken}` } });
  check("client read of problems/two-sum/private/tests → denied", fs.status === 403, `status=${fs.status}`);
  const pub = await fetch(`https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/problems/two-sum`, { headers: { Authorization: `Bearer ${A.idToken}` } });
  check("client read of problems/two-sum (public) → allowed under rules v2", pub.status === 200, `status=${pub.status} (403 means rules v2 are not deployed yet)`);

  // 10. gone routes
  r = await call(base, "/api/hints", A.idToken, { method: "POST", json: {} });
  check("v1 /api/hints → 410 GONE", r.status === 410);

  // cleanup
  r = await call(base, `/api/projects/${projectId}`, A.idToken, { method: "DELETE" });
  check("DELETE /api/projects/:id (recursive)", r.status === 200 && !(await db.collection("projects").doc(projectId).get()).exists);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}  (admin=${isAdmin})`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
