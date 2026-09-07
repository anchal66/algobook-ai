# Module 01 — Foundation: Auth, Schema v2, Judge Service, Run/Submit, Rules, Quotas

| Field | Value |
|---|---|
| **Status** | NOT STARTED |
| Branch | `module/01-foundation` |
| Depends on | — (first module) |
| Unblocks | 02, 03, 04, 05 |
| Decisions used | D-01 (languages), D-02 (wipe), D-04 (free tier), D-05 (Judge0 backend), D-13, D-14 |
| Estimated size | ~3,500 LOC changed/added |

## 0. Context for a fresh assistant (read in this order)
1. `docs/modules/00-MASTER-PLAN.md` — especially §3 (audit), §5 (schema v2), §6 (API surface), §10 (Definition of Done).
2. `docs/modules/DECISIONS.md` — use defaults for OPEN items.
3. Current code you will replace or wrap: `src/lib/firebase-admin.ts` (keep), `src/lib/firebase.ts` (keep), `src/app/api/code/run/route.ts`, `src/app/api/profile/*`, `src/app/api/project/*`, `src/app/api/subscription/*`, `src/lib/subscription.ts`, `src/lib/plans.ts`, `src/lib/check-subscription.ts`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `src/types/index.ts`.
4. Environment: `.env.local` exists locally with Firebase client keys, `FIREBASE_SERVICE_ACCOUNT_PATH` (service-account JSON under `firebase/`), `OPENAI_API_KEY` (validated 2026-09-07), `RAPIDAPI_KEY`, `NEXT_PUBLIC_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com`, `CQ_PAYMENT_GATEWAY_URL/KEY`. **Missing**: `NEXT_PUBLIC_APP_URL`, `ADMIN_UIDS`. `node_modules` is not installed — run `npm install` first.

## 1. Goal
Make the backend **secure, typed, cheap and language-agnostic** so every later module builds on solid ground:
- Every API call is authenticated by Firebase ID token; the server derives `uid` and plan; the client never sends `userId`.
- Firestore schema v2 (Master Plan §5) with a wipe script, typed repositories, rules that hide hidden tests and prevent client-side stat writes.
- A Judge service that runs **all** test cases of a problem in **one** batched Judge0 round-trip, compares outputs server-side with configurable checkers, supports multiple languages, and returns LeetCode-style verdicts.
- `POST /api/run` and `POST /api/submit` (server-side, quota-checked) replacing the client-driven loop.
- Quotas/rate limits per plan, hardened subscription flow, env validation, structured errors, `.env.example`, updated README.

## 2. Scope
**In:** everything in §1 plus dashboard/project/profile/username/templates/reports/drafts/notes endpoints, seed script for company templates, admin guard.
**Out:** any OpenAI call (Module 02 — but this module must leave a `problems` repository and a `JudgeService.verifyReference()` that Module 02 will call), all UI beyond a minimal temporary "API smoke" page, intelligence formulas (Module 04 — this module writes a *stub* `applySubmissionToStats()` that only updates counters; Module 04 replaces it).

## 3. Technical specification

### 3.1 Dependencies
Add: `zod`, `zustand` (for later modules, harmless now), `nanoid`, `server-only`. Remove: `react-firebase-hooks` (unused), `@opentelemetry/api` (unused). Keep `openai` (Module 02 upgrades usage). Add dev: `tsx`, `vitest` (unit tests for checkers, quotas, schema), `eslint` config if missing (Next 16 ships `eslint-config-next`).

### 3.2 Environment validation — `src/lib/env.ts`
```ts
import { z } from "zod";
const server = z.object({
  OPENAI_API_KEY: z.string().startsWith("sk-"),
  RAPIDAPI_KEY: z.string().min(10),
  JUDGE0_BASE_URL: z.string().url().default("https://judge0-ce.p.rapidapi.com"),
  JUDGE0_HOST_HEADER: z.string().default("judge0-ce.p.rapidapi.com"),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  CQ_PAYMENT_GATEWAY_URL: z.string().url(),
  CQ_PAYMENT_GATEWAY_KEY: z.string(),
  ADMIN_UIDS: z.string().default(""),           // comma-separated
  CRON_SECRET: z.string().min(16).optional(),
});
const client = z.object({ NEXT_PUBLIC_APP_URL: z.string().url(), NEXT_PUBLIC_FIREBASE_API_KEY: z.string(), /* … all NEXT_PUBLIC_FIREBASE_* */ });
```
Fail fast on first import server-side with a readable message. Create `.env.example` listing every variable with a comment. `NEXT_PUBLIC_RAPIDAPI_HOST` is renamed to `JUDGE0_HOST_HEADER` (it was never needed client-side).

### 3.3 Auth — `src/lib/auth/requireUser.ts`
```ts
export interface AuthedUser { uid: string; email: string|null; plan: PlanInfo; isAdmin: boolean; quotas: Quotas }
export async function requireUser(req: Request, opts?: { feature?: FeatureKey }): Promise<AuthedUser>
```
- Reads `Authorization: Bearer <token>`; `adminAuth.verifyIdToken(token, true)` (checkRevoked). 401 `{error:{code:"UNAUTHENTICATED"}}` on failure.
- Loads `users/{uid}` (creating it on first call via `ensureUser()` — port of `getOrCreateProfile` incl. username generation/claim).
- Resolves plan: `users.plan` cache (5 min) else `getActiveSubscription(uid)` and writes back `plan{slug,status,endDate,checkedAt}`.
- If `opts.feature` is given, calls `assertQuota(user, feature)` → 402 `PAYMENT_REQUIRED` (feature not in plan) or 429 `QUOTA_EXCEEDED` with `{resetAt}`.
- `isAdmin = ADMIN_UIDS.includes(uid)`.
- Client helper `src/lib/api-client.ts`: `apiFetch(path, init)` attaches `await auth.currentUser.getIdToken()`, parses the error envelope, throws `ApiError{code,status,message}`. Every existing `fetch('/api/…')` in the app must move to `apiFetch` (Modules 03/05 do the UI; this module migrates the calls in existing pages so nothing breaks in the interim).

### 3.4 Quotas & plans — `src/lib/auth/quotas.ts`, `src/lib/plans.ts`
Feature keys: `generate`, `run`, `submit`, `hint3`, `editorial`, `chat`, `completion`, `review`, `interview`.
```ts
export const PLAN_LIMITS = {
  free: { generate: 3, run: 30, submit: 50, hint3: 0, editorial: 0, chat: 0, completion: 0, review: 0, interview: 0 },
  pro:  { generate: 200, run: 2000, submit: 2000, hint3: 500, editorial: -1, chat: 300, completion: 3000, review: 200, interview: 5 }, // -1 = unlimited
} as const;
```
Counters live in `users/{uid}.quotas` as `{ date: "YYYY-MM-DD", [feature]: n }`; reset when `date` changes (UTC). Increment with a transaction; `assertQuota` reads before, `consumeQuota` increments after success. Keep `PLANS` (pro-monthly/pro-yearly) from v1.

### 3.5 Firestore schema v2 — `src/lib/data/schema.ts`
One zod schema per document type in Master Plan §5; `export type User = z.infer<typeof UserSchema>` etc. `src/types/index.ts` re-exports these types (delete the hand-written duplicates). Timestamps are `Timestamp` server-side, ISO strings in API responses (add `serialize()` helpers).

### 3.6 Repositories — `src/lib/data/*.ts`
Thin, typed, admin-SDK-only modules: `users.ts` (`ensureUser, getUser, updateSettings, updateProfileFields, claimUsername, updateUsername, getByUsername`), `problems.ts` (`getPublic(id)`, `getPrivateTests(id)`, `getDrivers(id)`, `create(draft)`, `markVerified`, `search({tags,difficulty,excludeIds,limit})`, `findNearest(embedding, k)` using `collection.findNearest('embedding', vector, {limit, distanceMeasure:'COSINE'})` — Firestore vector search, admin SDK ≥ 12; create the vector index with `gcloud firestore indexes composite create … --field-config=vector-config='{"dimension":"1536","flat":"{}"}',field-path=embedding`), `projects.ts` (`create, get, listForUser (with progress aggregation), delete (recursive: items, templatePool, submissions, drafts), addItem, updateItemStatus, getItems`), `submissions.ts` (`create, list, get`), `drafts.ts`, `notes.ts`, `activity.ts` (`recordSubmit(uid, date, delta)` upsert), `subscriptions.ts` (port of v1), `reports.ts`, `templates.ts` (Firestore-backed; `seed()` reads `templates/*.md`), `aiUsage.ts` (`log()` — used by Module 02).

### 3.7 Wipe & seed scripts — `scripts/`
- `scripts/firestore-wipe.ts`: exports every top-level collection to `backups/<timestamp>/<collection>.json` (recursively, subcollections included), then deletes **everything, including `subscriptions`** via `adminDb.recursiveDelete()` (D-02 decided 2026-09-07). Requires `--yes` flag and prints counts before/after. Never run against a project ID that is not `algobook-c9caa` unless `--project` is passed explicitly.
- `scripts/grant-plan.ts --uid <uid> --plan pro-yearly --days 365`: creates a `subscriptions` doc manually (used to re-grant paid users after the wipe and for testing Pro flows).
- `docs/modules/reference/JUDGE0-SELF-HOST.md`: docker-compose for Judge0 CE + the two env vars to switch (`JUDGE0_BASE_URL`, `JUDGE0_HOST_HEADER` empty, `JUDGE0_AUTH_TOKEN`), per D-05.
- `scripts/seed-templates.ts`: parses `templates/*.md` (regex `^(\d+)\.\s+(.+?)\s+-\s+(.+)$`, `Med.`→Medium) into `templates/{company}` + `items` subcollection in batches of 500.
- Both run with `npx tsx scripts/<name>.ts`; document in README.

### 3.8 Security rules v2 — `firebase/firestore.rules`
```
users/{uid}: read if auth.uid == uid; write: false
usernames/{u}: read if auth; write false
problems/{id}: read if auth; write false
problems/{id}/private/{doc}: read false; write false          ← hidden tests & drivers
problems/{id}/content/{doc}: read false (served via API)      ← hints/editorial gated by plan
projects/{id}: read if resource.data.uid == auth.uid; write false
projects/{id}/items/{i}: read if get(project).uid == auth.uid; write false
submissions/{id}: read if resource.data.uid == auth.uid; write false
drafts/{key}, notes/{key}: read/write if key starts with auth.uid + "_" and request.resource.data.uid == auth.uid (size < 200KB)
activity/{key}: read if key starts with auth.uid + "_"; write false
leaderboard/{doc}, dailyChallenge/{d}, templates/**: read if auth; write false
everything else: read false, write false
```
Deploy with `firebase deploy --only firestore:rules,firestore:indexes`. Indexes v2 (`firestore.indexes.json`): `submissions(uid asc, createdAt desc)`, `submissions(uid, problemId, createdAt desc)`, `submissions(projectId, uid, createdAt desc)`, `submissions(problemId, verdict, runtimeMs)` (percentiles), `problems(status, difficulty, createdAt)`, `problems(status, tags array-contains, difficulty)`, `projects(uid, createdAt desc)`, `users(stats.score desc)`, `activity(uid, date)`, plus the vector index. Remove v1 indexes.

### 3.9 Judge service — `src/lib/judge/`
**Language config** `languages.ts`:
```ts
export const LANGUAGES = {
  java:       { id: 62,  label: "Java",        ext: "java", mainFile: "Main.java", monaco: "java",       version: "OpenJDK 13"   },
  python:     { id: 71,  label: "Python3",     ext: "py",   monaco: "python",     version: "3.8" },
  cpp:        { id: 54,  label: "C++",         ext: "cpp",  monaco: "cpp",        version: "GCC 9" },
  javascript: { id: 63,  label: "JavaScript",  ext: "js",   monaco: "javascript", version: "Node 12" },
} as const;  // ids are Judge0 CE; verify with GET /languages at startup and cache
```
All four are `enabled: true` (D-01 decided 2026-09-07). Verify the four Judge0 language ids against `GET /languages` on startup and fail loudly if any is missing.

**Harness model.** A problem stores per language: `starter[lang]` (what the user edits: class `Solution` with the function), `drivers[lang]` (private: reads stdin per `params[]` spec, calls the function, prints per `returnType` spec). Test inputs are a strict machine format defined **once per problem** by `params[]` and shared by all languages, e.g.
```
params: [{name:"nums", type:"int[]"}, {name:"target", type:"int"}]  →  stdin: "4\n2 7 11 15\n9\n"
```
The canonical stdin encoding (Module 02 prompts must obey it, and Module 03 must render/parse it): `int|long|double|bool|string` → one token per line; `T[]` → `N` then N space-separated tokens on the next line (strings: one per line after `N`); `T[][]` → `R C` then R lines; `char` → one char; `ListNode/TreeNode` → array encoding like LeetCode (`[1,2,null,3]`). `assemble.ts` merges user code + driver per language (Java: strip `public` from non-`Main` classes, dedupe imports — port from v1; Python: driver appended below; C++: driver appended; JS: driver appended).

**Client** `judge0.ts`: `submitBatch(items[{source_code, language_id, stdin, expected_output?, cpu_time_limit, memory_limit}]) → tokens[]`, then poll `GET /submissions/batch?tokens=…&base64_encoded=true&fields=token,status_id,stdout,stderr,compile_output,time,memory` every 700 ms up to 20 s (Judge0 CE has no `wait` for batch). All payloads base64 (avoids the v1 encoding issues). Map Judge0 status ids → `verdict`: 3 Accepted, 4 Wrong Answer (when `expected_output` supplied), 5 TLE, 6 CE, 7–12 RE (signal/NZEC), 13 internal → retry once, 14 exec format error. Abstract `JUDGE0_BASE_URL` + headers so self-hosting (D-05) is config only.

**Checkers** `checkers.ts`: `exact` (trim each line's trailing whitespace, trim trailing newlines), `unordered_lines` (sort lines), `float` (parse tokens, |a−b| ≤ eps). Unit-tested with vitest.

**Service** `service.ts`:
```ts
runCases(problem, lang, userCode, cases: {input, expected?}[]) → CaseResult[]   // used by /api/run
judgeSubmission(problem, lang, userCode) → { verdict, passed, total, failedCase?, runtimeMs (max over cases), memoryKb (max), cases: CaseResult[] } // hidden+sample
verifyReference(problem, lang, referenceCode) → same shape                          // used by Module 02 during generation
```
Limits default `cpuTimeSec: 2 (java 4)`, `memoryKb: 256000`; per-problem override. Output is capped at 64 KB per case.

### 3.10 Routes (this module)
Implement with a shared `handler(schema, fn)` helper that parses JSON with zod, calls `requireUser`, catches `ApiError`, and returns the error envelope.

- `GET /api/me`, `PATCH /api/me`, `PATCH /api/me/settings`, `GET /api/users/username/check`, `POST /api/me/username`.
- `POST/GET /api/projects`, `GET/DELETE /api/projects/:id` — `GET /api/projects` returns each project with `progress` (already denormalized on the project doc; no client-side aggregation).
- `GET /api/problems/:id?lang=` → public doc + `starter[lang]` + `sampleTests` (never `private/*`). `GET /api/problems` (explore list, cursor pagination, filters).
- `POST /api/run` body `{problemId, language, code, cases: [{input, expected?}]}` (max 6 cases; `expected` only for sample cases, custom cases have none) → `{cases: CaseResult[]}`; consumes `run` quota; records `runCount` nowhere (client sends it on submit).
- `POST /api/submit` body `{problemId, projectId?, language, code, meta:{hintsUsed, editorialViewed, timeSpentSec, runCount}}` → `{submission}`; server: judge hidden+sample → write `submissions` → `activity` upsert → `projects/{id}/items` status → `problems.stats` increment + runtime sample append (cap 500) → `beats%` from samples → `applySubmissionToStats(uid, …)` (stub here; Module 04 owns the real one) → consume `submit` quota. Wrap in a transaction where possible; the judge call happens before the transaction.
- `GET /api/submissions`, `GET /api/submissions/:id` (includes code and first failed case).
- `PUT /api/drafts/:problemId`, `PUT /api/notes/:problemId` (also readable directly via client SDK per rules).
- `POST /api/problems/:id/report` → `reports` + `problems.flagged.count++`; when count ≥ 2 set `status:'retired'` (Module 02 respects it).
- `GET /api/templates`.
- `POST /api/subscription/checkout`, `GET /api/subscription/activate`, `GET /api/subscription/status`: require auth on checkout/status; activation validates `transaction.userId` against the gateway response and is idempotent on `gatewayTransactionId`; use `NEXT_PUBLIC_APP_URL`.
- Delete v1 routes: `api/code/run`, `api/profile/*`, `api/project/*`, `api/question/flag`, `api/leaderboard` (Module 04 re-adds), `api/templates/seed`. `api/question/generate`, `api/hints`, `api/solution`, `api/project/insights` are replaced in Module 02 — leave them **disabled** (return 410) so the old editor page keeps compiling until Module 03.

### 3.11 Interim compatibility
The v1 pages will not work against schema v2 (collections renamed). To keep the app runnable between modules, this module ships a **temporary** minimal page `/dev/api-smoke` (admin only) that exercises `me`, `problems/:id`, `run`, `submit` against a seeded sample problem (`scripts/seed-sample-problem.ts` inserts one hand-written, verified "Two Sum" with Java + Python drivers and 10 hidden tests). Old pages may render empty states; that is acceptable until Modules 03/05 replace them. Note this in the status log.

### 3.12 README & docs
Rewrite `README.md` to describe v2 (setup, env, scripts, architecture pointer to `docs/modules`). Delete `Working.md` after Module 04 re-documents formulas (leave until then).

## 4. Tasks
- [ ] F-01 `npm install`; add/remove dependencies (§3.1); `npm run build` passes on a clean checkout.
- [ ] F-02 `src/lib/env.ts` + `.env.example`; add `NEXT_PUBLIC_APP_URL`, `ADMIN_UIDS`, `JUDGE0_*` to `.env.local`.
- [ ] F-03 `src/lib/data/schema.ts` (all zod schemas from Master Plan §5) and regenerate `src/types/index.ts`.
- [ ] F-04 `requireUser`, `ApiError`, `handler()` helper, `apiFetch` client helper.
- [ ] F-05 Quotas + plans (§3.4) with vitest tests for reset/consume.
- [ ] F-06 Repositories: users, problems (incl. vector `findNearest`), projects, submissions, drafts, notes, activity, subscriptions, reports, templates, aiUsage.
- [ ] F-07 `scripts/firestore-wipe.ts` (backup + wipe, `--yes` guard). Run it once (D-02) and record counts in the status log.
- [ ] F-08 `scripts/seed-templates.ts`; run it; verify `templates/*` in the Firebase console.
- [ ] F-09 `scripts/seed-sample-problem.ts` (hand-written Two Sum; Java, Python, C++ and JavaScript starter/driver/reference; 3 sample + 10 hidden tests) + `scripts/grant-plan.ts` + `docs/modules/reference/JUDGE0-SELF-HOST.md`.
- [ ] F-10 Security rules v2 + indexes v2 (incl. vector index via gcloud); deploy; verify with the Firestore rules playground that `problems/*/private/*` is unreadable.
- [ ] F-11 Judge: `languages.ts` (+ startup verification against `GET /languages`), `assemble.ts` (port Java merge), `judge0.ts` batch submit/poll with base64.
- [ ] F-12 Judge: `checkers.ts` + vitest tests (exact/unordered/float, trailing whitespace, CRLF).
- [ ] F-13 Judge: `service.ts` (`runCases`, `judgeSubmission`, `verifyReference`) with verdict mapping and limits.
- [ ] F-14 `GET /api/me`, `PATCH /api/me`, `PATCH /api/me/settings`, username check/update.
- [ ] F-15 Projects routes (create/list/get/delete with recursive cleanup and progress).
- [ ] F-16 `GET /api/problems/:id`, `GET /api/problems` (explore list with cursor).
- [ ] F-17 `POST /api/run`.
- [ ] F-18 `POST /api/submit` (+ `applySubmissionToStats` stub, activity upsert, beats %, project item status).
- [ ] F-19 Submissions list/detail, drafts, notes routes.
- [ ] F-20 Report route with auto-retire at 2 flags.
- [ ] F-21 Templates route (Firestore-backed).
- [ ] F-22 Subscription routes hardened (auth, idempotent activation, `NEXT_PUBLIC_APP_URL`).
- [ ] F-23 Disable/delete v1 routes per §3.10; migrate remaining page `fetch` calls to `apiFetch` so nothing throws at build time.
- [ ] F-24 `/dev/api-smoke` admin page (§3.11).
- [ ] F-25 README rewrite; `docs/modules/qa/01/` screenshots.
- [ ] F-26 Structured logging (`console.info(JSON.stringify({evt, uid, ms, …}))`) on every route; no secrets in logs.
- [ ] F-27 **Ship it.** All tasks ticked, `npm run build` + `vitest` green, browser checklist (§6) passed, `STATUS.md` and this file's status log updated → commit, merge `module/01-foundation` into `main`, rebuild, `git push origin main`, and record the commit SHA in the status log (Master Plan §10 step 7).

## 5. Acceptance criteria
- Calling any `/api/*` route without a token → 401 envelope. With a token for user A, requesting user B's project → 404 (not 403, to avoid enumeration).
- Free-plan user hitting `generate` 4 times in a day → 429 with `resetAt`.
- `POST /api/submit` with a correct Two Sum in each of Java, Python, C++ and JavaScript → `verdict: "AC"`, `passed: 13/13`, `runtimeMs` and `memoryKb` numbers, `beatsRuntimePct` between 0 and 100; a submission doc exists with `uid` set by the server; `activity/{uid}_{today}.accepted == 1`.
- Wrong solution → `WA` with `failedCase.index` and `expected/actual`; infinite loop → `TLE`; syntax error → `CE` with compiler text; the hidden test inputs of cases the user did not fail are **not** in the response.
- One submit = exactly one Judge0 batch request + polling (verify in logs).
- Firestore rules playground: reading `problems/x/private/tests` as an authenticated user is denied.
- `npm run build` passes; `vitest` passes.

## 6. Browser test checklist (run at the end)
1. Sign in with Google → `users/{uid}` created with a username; `/api/me` returns plan `free` (or `pro` if a subscription exists).
2. `/dev/api-smoke`: load the sample problem in Java, run 3 sample cases + 1 custom case → 4 results with output; repeat for Python, C++ and JavaScript → same.
3. Submit correct / wrong / TLE / CE code → correct verdict UI text and no console errors.
4. Open DevTools → Network: no request carries `userId` in the body; every `/api` request carries `Authorization`.
5. As a second Google account, try to `GET /api/projects/<first user's id>` via the browser console → 404.
6. Firebase console: `problems/<id>/private/tests` exists; client SDK `getDoc` on it from the console → permission denied.
7. Old pages (`/dashboard`, `/profile`) load without runtime exceptions (empty states allowed).

## 7. Status log
- 2026-09-07 — Module specified. NOT STARTED.
