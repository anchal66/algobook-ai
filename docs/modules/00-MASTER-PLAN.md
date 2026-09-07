# AlgoBook AI v2 — Master Plan

> **Read this file first.** It is the entry point for every AI assistant (or human) working on the v2 rebuild.
> Then read `STATUS.md`, `DECISIONS.md`, and the module file you were assigned.
> Do NOT start coding a module until its dependencies in the table below are `COMPLETE`.

- Repo: `https://github.com/anchal66/algobook-ai` (branch `main`)
- Stack: Next.js 16 (App Router, Turbopack), React 19.2, TypeScript 5, Tailwind v4, shadcn/ui (new-york), Monaco, Firebase (Auth + Firestore), firebase-admin, OpenAI SDK v6, Judge0 CE via RapidAPI, framer-motion.
- Plan authored: 2026-09-07. Current OpenAI key was validated on that date (HTTP 200 on `/v1/models`) and has access to `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra`, `text-embedding-3-small`.

---

## 1. How to work with these documents

1. Every module lives in `docs/modules/0N-MODULE-*.md`. Each has: context, scope, dependencies, full technical spec, task list with IDs, acceptance criteria, a **browser test checklist**, and a status log.
2. Status values: `NOT STARTED` → `STARTED` → `IN PROGRESS` → `COMPLETE`. Update **both** the module file header and `docs/modules/STATUS.md` when the status changes. Add a dated line to the module's "Status log".
3. Task checkboxes inside a module (`- [ ] F-03 …`) are the fine-grained tracker. Tick them as you finish. If you consciously skip or defer a task, write why next to it. Never delete a task silently.
4. Work on a git branch named `module/0N-short-name`. Commit small. Do not commit `.env*` or `firebase/*-adminsdk-*.json`. **When the module is finished and fully tested, merge it into `main` and push** — see §10 step 7. Nothing is pushed to `main` before its browser test checklist passes.
5. Before marking a module `COMPLETE`, run the module's browser test checklist in a real browser (Claude in Chrome / the desktop Browser pane) against `npm run dev`, fix everything that breaks, and run `npm run build` successfully.
6. If a decision in `DECISIONS.md` is still `OPEN` and your module depends on it, use the documented **default** and note it in the status log. Do not invent a different default.
7. Keep the shared contracts in this file (schema names, API routes, model policy, design tokens) as the single source of truth. If a module must change a shared contract, edit this file in the same commit and note it in the module's status log.

---

## 2. What AlgoBook is (product definition)

**Today (v1):** An AI-powered, LeetCode-style practice platform for Java. A user creates a *project* (goal, duration, experience level, optional company template such as Google/Amazon). Inside a project the app generates problems with GPT (or reuses a curated pool), the user solves them in a Monaco editor, code is executed on Judge0, submissions are stored, and a per-user "intelligence" layer (mastery scores, SM-2 spaced repetition, practice state machine, prerequisite graph, session fatigue) decides what to serve next. There is a paid Pro plan (INR 499/mo, 4,999/yr) via a custom payment gateway (`CQ_PAYMENT_GATEWAY_*`), profiles with public username pages, leaderboard, heatmap, project insights, and question flagging.

**Target (v2):** The same product idea, rebuilt to be **trustworthy, cheap to run, and more capable than LeetCode's problem page**:

- Problems are **verified before a user ever sees them** (a reference solution is executed against every test case on Judge0). Broken driver code is the #1 v1 bug and must be impossible in v2.
- Hidden test cases are never sent to the browser. Run/Submit are server-side and batched (one Judge0 round-trip, not N).
- AI costs drop by ~10x: `gpt-5.6-luna` for almost everything, structured outputs, prompt-cache-friendly prompts, pre-generated hints/editorials shared across users, batch pre-generation of a topic×difficulty pool, embeddings-based reuse instead of tag guessing.
- Every API call is authenticated with a Firebase ID token. The client can no longer spoof `userId`, write fake "success" submissions, or bypass the subscription check by omitting a field.
- The problem workspace is a pixel-faithful LeetCode-style page (dynamic resizable/collapsible/maximizable panels, settings modal, shortcuts, testcase panel with named parameters, Test Result with Beats %, Editorial, Solutions, Submissions, Notes, timer, Problem List drawer) **plus** features LeetCode does not have: AI inline code completion, "explain my error", per-problem AI tutor chat, AI editorial in every language, mock-interview mode, skill tree, daily challenge.
- Multi-language execution — Java, Python 3, C++ and JavaScript at launch (D-01 decided) — with the Java driver verified at generation time and the other three generated and verified in the background right after (or eagerly by the pre-generation job).
- A design system with motion and 3D accents so the app no longer looks template-generated.

---

## 3. Current-state audit (v1) — what is there and what is wrong

### 3.1 Inventory
| Area | Files | Notes |
|---|---|---|
| Landing / auth | `src/app/page.tsx`, `login/page.tsx`, `context/AuthContext.tsx` | Google sign-in only. Copy still says "GPT-4". |
| Dashboard | `src/app/dashboard/page.tsx` (801 lines) | N+1 Firestore queries per project from the client. |
| Project creation | `src/app/projects/new/page.tsx` | Templates (6 company `.md` lists: amazon 651, apple 336, google 2000, meta 456, microsoft 1204, uber 324 titles). |
| Workspace | `src/app/project/[projectId]/editor/page.tsx` (2,094 lines, single file) | Monaco, 3-panel layout, hints, solution review, report modal, session health. |
| Project pages | `history/`, `insights/`, `_components/ProjectHeader.tsx`, `AttendanceModal.tsx` | Attendance modal on every visit. |
| Profile | `profile/`, `profile/edit/`, `[username]/`, `SubmissionHeatmap.tsx` | Public profile by username. |
| Leaderboard / settings / legal | `leaderboard/`, `settings/`, `about/`, `contact/`, `privacy/`, `terms/` | Leaderboard computed by reading **all** profiles on every request. |
| API | 21 route handlers under `src/app/api/**` | See issues below. |
| Intelligence | `lib/user-profile.ts`, `recommendation.ts`, `practice-engine.ts`, `spaced-repetition.ts`, `prerequisite-graph.ts`, `session-tracker.ts`, `leaderboard.ts` | Good ideas, several bugs (below). |
| AI | `lib/question-generator.ts`, `api/hints`, `api/solution`, `api/project/insights` | Chat Completions, `json_object` mode, `gpt-5.4` / `gpt-5.4-mini`, `max_tokens`, `temperature`. |
| Execution | `api/code/run/route.ts` | Judge0 CE (`judge0-ce.p.rapidapi.com`), `wait=true`, one HTTP call per test case, Java only (`language_id 62`). |
| Payments | `api/subscription/*`, `lib/subscription.ts`, `lib/plans.ts` | External gateway; `NEXT_PUBLIC_APP_URL` is **not set** in `.env.local` (activation redirects fall back to localhost). |
| Firestore | `firebase/firestore.rules`, `firestore.indexes.json` | Collections: `projects` (+`projectQuestions`, `attendance`, `templatePool`), `questions`, `submissions`, `userProfiles`, `usernames`, `subscriptions`. |
| Docs | `README.md`, `Working.md` | README describes the March 2026 version (GPT-4, Next 15); `Working.md` documents the intelligence formulas. |
| Local env | — | `node_modules` is **not installed** in this checkout; `npm install` is step zero. |

### 3.2 Critical issues (must be fixed by v2)
| # | Severity | Issue | Where |
|---|---|---|---|
| C1 | Critical | **No authentication on API routes.** `userId` is trusted from the request body/query. Anyone can generate questions, read any profile, update any profile's stats, or delete any project by guessing an ID. | all `src/app/api/**` |
| C2 | Critical | **Subscription bypass**: `/api/code/run` and `/api/hints` only check the subscription `if (userId)` is present — omit it and the paid feature is free. | `api/code/run`, `api/hints` |
| C3 | Critical | **Client writes submissions directly** with a client-chosen `status: "success"`, `hintsUsed`, `timeSpentSeconds`, and then calls `/api/profile/update` with client-chosen `passed: true`. Mastery, streaks and the leaderboard are fully spoofable. | `editor/page.tsx` `handleRunCode`, `api/profile/update` |
| C4 | Critical | **Hidden test cases are public.** The full `questions/{id}` doc (all test cases + driver code) is readable by any signed-in user and is fetched by the client. | `firestore.rules`, `editor/page.tsx` `loadQuestion` |
| C5 | High | **Generated problems are never verified.** No reference solution is run; driver/test mismatches surface as `NoSuchElementException` for the user. The README itself calls this "the most common source of bugs". | `lib/question-generator.ts` |
| C6 | High | Run/Submit execute test cases **sequentially, one HTTP request each** (client → API → Judge0 with `wait=true`). A 10-test submit takes ~10× the latency and 10× the RapidAPI quota. | `editor/page.tsx`, `api/code/run` |
| C7 | High | Old model usage: `gpt-5.4`, `gpt-5.4-mini`, Chat Completions `json_object` mode, deprecated `max_tokens`, `temperature` on a reasoning model, no `reasoning.effort` control (default `medium` reasoning burns tokens on trivial hint calls). | `question-generator.ts`, `api/hints`, `api/solution`, `api/project/insights` |
| C8 | High | Prompt bloat: the generation system prompt embeds the **entire** per-topic performance table and the **entire** list of project question titles, both unbounded; the user's free-text prompt is interpolated into the *system* prompt (prompt-injection surface). | `question-generator.ts` |
| C9 | High | Leaderboard reads **every** `userProfiles` document per request; heatmap reads every submission of the year; dashboard performs 2 queries per project from the browser; history page does N+1. Costs scale linearly with users. | `lib/leaderboard.ts`, `api/profile/heatmap`, `dashboard/page.tsx` |
| C10 | Medium | SM-2 bug: `if (prevInterval <= 1) interval = 1` — a topic whose interval starts at 1 can **never grow**, so every topic is "due" every day. | `lib/spaced-repetition.ts` |
| C11 | Medium | Mastery bugs: recency is baked into mastery (a mastered topic decays to "weak" after 30 idle days and is then *redirected to as a prerequisite gap*); `firstTryRate` divides by `solved` which can exceed 1 relative to attempts; `require()` inside an ES module. | `lib/user-profile.ts` |
| C12 | Medium | Curated-pool reuse is `array-contains-any` on up to 10 tags with `limit(20)` and no difficulty filter — effectively random, and the same problem is served to the same user across projects. | `question-generator.ts` `searchCuratedPool` |
| C13 | Medium | Java-only; single `starterCode`/`driverCode` per question; no `language` field anywhere. | schema |
| C14 | Medium | `attendance` rules let any signed-in user create attendance docs under any project; `activeDays` is incremented from the client. | `firestore.rules`, `AttendanceModal.tsx` |
| C15 | Low | 2,094-line editor component with `any`-typed Monaco refs, `contentEditable` + `dangerouslySetInnerHTML` for test inputs, custom-input "expected output" sentinel string `"N/A (Custom Input)"` compared everywhere. | `editor/page.tsx` |
| C16 | Low | Stale copy ("GPT-4"), placeholder `og-image.png` missing, `NEXT_PUBLIC_APP_URL` unset, README outdated, `.env.example` missing. | misc |

### 3.3 What is worth keeping (port, do not rewrite from scratch)
- The intelligence concepts in `Working.md`: 6-factor mastery, SM-2, 6-state practice machine, 5 topic strategies, prerequisite DAG, session health, template scoring. They are re-specified with fixes in Module 04.
- The company template lists in `templates/*.md` (become Firestore seed data).
- The Monaco theme + Java snippet list in the editor (moved into `lib/editor/`).
- Subscription/plan model and the gateway integration (hardened in Module 01).
- shadcn/ui primitives, framer-motion usage patterns, heatmap component logic.

---

## 4. Target architecture (v2)

```
Browser (Next.js App Router, React 19)
 ├─ Firebase Auth (Google)            → ID token attached to every /api call (Authorization: Bearer)
 ├─ Firestore client SDK              → READ-ONLY for a few user-owned docs (drafts, settings, own submissions list)
 └─ Workspace store (zustand)         → layout, editor state, results

Next.js Route Handlers (/api/**)  — all run on Node runtime, all use firebase-admin
 ├─ lib/auth/requireUser.ts           → verifyIdToken, loads plan + quotas, rate limits
 ├─ lib/data/*                        → typed Firestore repositories (schema v2, zod-validated)
 ├─ lib/judge/*                       → Judge0 batch submit + poll, per-language config, output checkers
 ├─ lib/ai/*                          → OpenAI Responses API wrapper, model policy, prompts, structured outputs, usage log
 ├─ lib/practice/*                    → mastery, SRS, state machine, recommender, rating/Elo, streaks
 └─ jobs/*                            → pre-generation (Batch API), leaderboard snapshot, daily challenge (Vercel Cron or manual admin trigger)

External
 ├─ OpenAI  (gpt-5.6-luna default; terra fallback; embeddings-3-small)
 ├─ Judge0 CE (RapidAPI now; self-host later — see DECISIONS D-05)
 └─ CQ payment gateway
```

### 4.1 Folder structure (v2)
```
src/
  app/
    (marketing)/            landing, pricing, about, contact, privacy, terms
    (auth)/login
    (app)/                  authenticated shell: dashboard, explore, projects, profile, leaderboard, settings, admin
    problems/[slug]/        the LeetCode-style workspace (also reachable as /project/[id]/solve/[problemId])
    api/                    route handlers (see §6)
  components/
    ui/                     shadcn primitives
    workspace/              editor page components (Module 03)
    design/                 design-system components: Motion, Glass, Orb3D, StatRing, Heatmap… (Module 05)
  lib/
    auth/  data/  judge/  ai/  practice/  editor/  utils/
  store/                    zustand stores
  types/                    shared types (generated from zod schemas in lib/data/schema.ts)
scripts/                    firestore-wipe.ts, seed-templates.ts, pregen.ts, ai-eval.ts
docs/modules/               these plans
```

---

## 5. Firestore schema v2 (single source of truth)

Decision D-02 (decided 2026-09-07: **full wipe of every collection, including `subscriptions`**, before Module 01 ships — no migration of v1 data; paid users re-granted with `scripts/grant-plan.ts`). All writes go through firebase-admin; clients get read access only where marked.

| Collection / doc | Client read? | Purpose & key fields |
|---|---|---|
| `users/{uid}` | own | `username, displayName, email, photoURL, bio, company, college, location, githubUrl, linkedinUrl, skills[]`, `experienceLevel, goalType, practiceState, calibration{complete,step}`, `stats{totalSolved,totalFailed,easy,medium,hard,currentStreak,longestStreak,lastActiveDate,score,rating,xp,level}`, `topicSkills{[topic]: TopicSkill}`, `settings{editor{font,fontSize,ligatures,keyBinding,tabSize,wordWrap,relativeLineNumbers,theme,language,aiCompletion}, layout, timer, shortcuts, notifications}`, `plan{slug,planSlug,status,endDate,checkedAt}` (denormalized from subscriptions, 5-min cache), `quotas{date, generate, run, submit, hint3, editorial, chat, completion, review, interview}` (Module 01: one counter per feature key, reset when the UTC date changes), `createdAt, updatedAt` |
| `usernames/{username}` | any auth | `{ uid }` — uniqueness lock |
| `problems/{problemId}` | any auth (public fields only) | `slug, number, title, difficulty, tags[], companies[], statementMd, examples[] {input,output,explanation}, constraints[], followUp, params[] {name,type}, returnType, functionName, sampleTests[] {input,expectedOutput}` (visible cases only), `checker{type: 'exact'|'unordered_lines'|'float', eps?}`, `limits{cpuTimeSec, memoryKb}`, `languages[]` (which drivers are verified), `starter{[lang]: string}`, `hintsPreview` (count only), `stats{attempts,accepted,acceptanceRate,avgRuntimeMs{[lang]}, runtimeSamples{[lang]: number[]}, memorySamples{[lang]: number[]}}` (Module 01: memory samples added for Beats % on memory), `rating` (Elo, starts 1200/1500/1900 by difficulty), `source: 'generated'|'template'|'curated'`, `templateRef{company,number,title}`, `embedding` (vector, 1536), `flagged{count, reasons[]}`, `status: 'draft'|'verified'|'retired'`, `createdBy, createdAt, verifiedAt, model` |
| `problems/{id}/private/tests` | **no** | `hiddenTests[] {input, expectedOutput}` (8–15), `referenceSolution{[lang]: string}` |
| `problems/{id}/private/drivers` | **no** | `drivers{[lang]: string}` (verified harness per language) |
| `problems/{id}/content/hints` | via API | `hints[3] {label, text}` |
| `problems/{id}/content/editorial` | via API | `approaches[] {title, intuition, algorithm, code{[lang]}, time, space}`, `model, createdAt` |
| `projects/{projectId}` | own | `uid, title, description, purpose, durationDays, experienceLevel, goalType, selectedTopics[], templateId, insights{…}, progress{items, solved, attempting, easy, medium, hard, activeDays}, lastActivityAt, createdAt` |
| `projects/{id}/items/{problemId}` | own | `order, problemId, title, difficulty, tags[], reason{short,detail}, source, status: 'todo'|'attempting'|'solved', addedAt, solvedAt` |
| `projects/{id}/templatePool/{docId}` | no | `title, number, difficulty, order, status: 'pending'|'used', problemId` |
| `submissions/{submissionId}` | own (list) | `uid, projectId, problemId, language, code, verdict: 'AC'|'WA'|'RE'|'CE'|'TLE'|'MLE', passed, total, failedCase{index,input,expected,actual,stderr}` (first failure only), `runtimeMs, memoryKb, beatsRuntimePct, beatsMemoryPct, attemptNumber, hintsUsed, editorialViewed, timeSpentSec, runCount, isFirstTry, createdAt` |
| `drafts/{uid}_{problemId}` | own (r/w) | `code{[lang]}, language, updatedAt` — autosave |
| `notes/{uid}_{problemId}` | own (r/w) | `markdown, updatedAt` |
| `activity/{uid}_{YYYY-MM-DD}` | own | `submissions, accepted, problemsSolved[], timeSpentSec, runs, xpEarned` — heatmap + streak source |
| `leaderboard/global` | any auth | snapshot `{ updatedAt, entries[100] }`; user rank computed by `count()` on `users.stats.score` |
| `leaderboard/project_{projectId}` | own | snapshot for project scope |
| `dailyChallenge/{YYYY-MM-DD}` | any auth | `problemId, solvers` |
| `subscriptions/{id}` | no | as v1 but keyed by `uid` (v1 used `userId`): `uid, planSlug, planName, status, startDate, endDate, gatewayTransactionId, amountPaid, currency, createdAt` |
| `reports/{id}` | no | `problemId, uid, reason, details, resolved` |
| `aiUsage/{id}` | admin | `purpose, model, inputTokens, cachedTokens, outputTokens, reasoningTokens, costUsd, latencyMs, uid?, problemId?, ok, createdAt` |
| `templates/{company}` | any auth | `company, title, description, purpose, count, difficulties{}`, subcollection `items/{n}` `{number,title,difficulty,order}` (seeded from `templates/*.md`) |
| `achievements/{uid}` | own | `unlocked[] {id, at}` |

TopicSkill (unchanged shape, fixed semantics): `solved, failed, easy, medium, hard, attempts, firstTrySuccesses, avgTimeSec, timeEfficiency, hintsUsed, runCount, mastery (0–100, no recency term), lastSeen (Timestamp), srs{interval, ease, nextReview, reps}`.

---

## 6. API surface v2 (route handlers)

Problem I/O contract (canonical stdin/stdout encodings shared by all languages and by Module 02 prompts / Module 03 UI): `docs/modules/reference/IO-FORMAT.md` (Module 01).

All routes: `Authorization: Bearer <FirebaseIdToken>` required unless marked public. Errors are always `{ error: { code: string, message: string } }` with proper HTTP status. Bodies validated with zod.

| Method & path | Purpose | Module |
|---|---|---|
| `GET /api/me` | profile + settings + plan + quotas | 01 |
| `PATCH /api/me` / `PATCH /api/me/settings` | profile fields / editor+layout settings | 01 |
| `GET /api/users/username/check?u=` , `POST /api/me/username` | username | 01 |
| `POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `DELETE /api/projects/:id` | projects (server-side aggregation for dashboard) | 01 |
| `POST /api/projects/:id/next` | recommend + reuse-or-generate + verify + link; returns `{ item, problem, reason, source }` | 02/04 |
| `GET /api/problems/:id` | public fields + sample tests + starter for a language | 01 |
| `GET /api/problems?tags&difficulty&status&q&cursor` | explore / problem bank | 01/05 |
| `POST /api/problems/:id/languages` | ensure driver for `{language}` exists (generate + verify on demand) | 02 |
| `POST /api/run` | `{problemId, language, code, cases[]}` → per-case results (sample + custom) | 01 |
| `POST /api/submit` | `{problemId, projectId?, language, code, meta{hintsUsed,timeSpentSec,runCount,editorialViewed}}` → verdict; writes submission, activity, stats, project item, rating | 01/04 |
| `GET /api/submissions?problemId&projectId&cursor`, `GET /api/submissions/:id` | history | 01 |
| `PUT /api/drafts/:problemId`, `PUT /api/notes/:problemId` | autosave | 01 |
| `POST /api/problems/:id/hints` `{level, code?}` | hint 1–3 (pre-generated; level 3 contextual) | 02 |
| `GET /api/problems/:id/editorial` | AI editorial (generated once, cached) | 02 |
| `POST /api/problems/:id/review` | post-AC code review | 02 |
| `POST /api/problems/:id/explain-error` | compile/runtime error explanation | 02 |
| `POST /api/problems/:id/chat` | scoped AI tutor chat (SSE stream) | 02 |
| `POST /api/ai/complete` | inline completion (ghost text) | 02 |
| `POST /api/problems/:id/report` | flag | 01 |
| `GET /api/leaderboard?scope&projectId&cursor` | snapshot + my rank | 04 |
| `GET /api/activity?year=` | heatmap from `activity` docs | 01 (basic) / 04 (extend) |
| `GET /api/daily` | daily challenge | 04 |
| `POST /api/interview/start`, `POST /api/interview/:id/finish` | mock interview | 04 |
| `GET /api/templates` | templates from Firestore | 01 |
| `POST /api/subscription/checkout`, `GET /api/subscription/activate`, `GET /api/subscription/status` | payments (hardened) | 01 |
| `POST /api/admin/pregen`, `POST /api/admin/leaderboard-snapshot`, `GET /api/admin/ai-usage` | admin (env `ADMIN_UIDS`) | 02/04 |

---

## 7. AI model policy (v2)

Verified against the OpenAI model list on 2026-09-07 and public model cards. Prices per 1M tokens: Luna $0.20 in / $0.02 cached / $1.20 out; Terra $2 / $0.20 / $12; Sol $4 / $0.40 / $20 (promo); Astra $10 / $1 / $50. All GPT-5.6 tiers: 1.05M context, 128K max output, `reasoning.effort` ∈ `none|low|medium|high|xhigh|max` (default `medium`), structured outputs, function calling, prompt caching, Responses + Chat Completions. Astra ignores `temperature`/`top_p` and cannot use `none`.

| Purpose | Model | reasoning.effort | max_output_tokens | Notes |
|---|---|---|---|---|
| Problem generation (spec + tests + reference solution) | `gpt-5.6-luna` | `high` | 6,000 | Retry #1 on validation failure: `gpt-5.6-luna` `xhigh` with judge feedback; Retry #2: `gpt-5.6-terra` `medium`. Never Astra by default (D-03). |
| Driver generation for an extra language | `gpt-5.6-luna` | `medium` | 2,500 | Verified against hidden tests before saving. |
| Hints (all 3 at once, at generation time) | part of generation call | — | — | No separate call. |
| Level-3 contextual hint / explain-error / code review | `gpt-5.6-luna` | `low` | 600 / 500 / 900 | `verbosity: low`. |
| Editorial (once per problem, shared) | `gpt-5.6-luna` | `medium` | 4,000 | Cached in `problems/{id}/content/editorial`. |
| Tutor chat | `gpt-5.6-luna` | `low` | 700 | Streaming; last 8 turns only. |
| Inline completion | `gpt-5.6-luna` | `none` | 96 | 600 ms debounce, opt-in setting, cached prefix. |
| Project insights / plan | `gpt-5.6-luna` | `low` | 700 | |
| Embeddings for dedupe | `text-embedding-3-small` | — | — | 1536 dims, stored on the problem doc. |
| Nightly pool pre-generation | `gpt-5.6-luna` via **Batch API** | `high` | 6,000 | 50% cheaper; fills topic×difficulty matrix. |

Rules: Responses API only (`client.responses.create`/`parse`); zod schemas → `text.format` (json_schema, `strict: true`); `store: false`; static instructions first, dynamic context last (prompt cache); `max_output_tokens` always set; no `temperature`; log every call to `aiUsage`. Full prompt texts live in Module 02.

Estimated cost per **new verified problem** ≈ $0.006–$0.02 on Luna (vs ~$0.15+ on gpt-5.4 today); hints/editorial amortized to ~$0 per user because they are generated once and shared.

---

## 8. Shared design tokens (used by Modules 03 and 05)

- **Theme**: dark-first, LeetCode-like neutral surfaces, plus a brand accent. Light theme is required and must be tested.
  - Surface scale (dark): `bg-0 #0f0f10`, `bg-1 #1a1a1a` (panels), `bg-2 #262626` (cards/inputs), `bg-3 #333333` (hover), border `#3e3e3e`, text `#f5f5f5 / #a3a3a3 / #737373`.
  - Surface scale (light): `#ffffff`, `#f7f8fa`, `#eff1f4`, `#e5e7eb`, border `#d0d4da`, text `#111827 / #4b5563 / #6b7280`.
  - Difficulty: Easy `#00b8a3`, Medium `#ffc01e`, Hard `#ff375f` (LeetCode's semantics). Accepted green `#2cbb5d`, Wrong red `#ef4743`.
  - Brand accent: indigo→cyan gradient `#6366f1 → #22d3ee` (used for primary buttons, rings, hero).
- **Type**: Inter (UI), JetBrains Mono (code/numbers). Sizes: 12/13/14/16/20/24/32/48.
- **Radius**: 6 (chips), 8 (inputs/buttons), 12 (cards), 16 (modals). **Panels in the workspace use 8.**
- **Motion**: durations 120 ms (hover), 200 ms (tabs/toggles), 320 ms (panels/modals), 600 ms (hero); easing `cubic-bezier(0.2, 0.8, 0.2, 1)`; spring for confetti/rings. Respect `prefers-reduced-motion`.
- **Elevation**: panels flat with 1px border; modals `shadow-2xl`; glass (`backdrop-blur-xl bg-white/5`) only on marketing pages.
- Tokens are defined once in `src/app/globals.css` as CSS variables (Tailwind v4 `@theme`) in Module 05, but Module 03 may add them early under the exact names above.

---

## 9. Modules — order, dependencies, status

| # | Module file | Depends on | Status |
|---|---|---|---|
| 01 | `01-MODULE-FOUNDATION.md` — auth, schema v2 + wipe, repositories, Judge service, run/submit APIs, rules, quotas | — | NOT STARTED |
| 02 | `02-MODULE-AI-ENGINE.md` — model policy, structured outputs, verified generation pipeline, hints/editorial/review/chat/completion, pre-generation, cost telemetry | 01 | NOT STARTED |
| 03 | `03-MODULE-EDITOR-WORKSPACE.md` — LeetCode-parity problem page (+ AI extras) | 01, 02 | NOT STARTED |
| 04 | `04-MODULE-PRACTICE-INTELLIGENCE.md` — mastery/SRS fixes, recommender v2, rating, streaks, leaderboard snapshots, achievements, daily challenge, mock interview, templates | 01, 02 | NOT STARTED |
| 05 | `05-MODULE-DESIGN-SYSTEM-PAGES.md` — design system, motion/3D, landing, dashboard, explore, project wizard, profile, leaderboard, settings, admin, final QA | 01–04 (pages consume their APIs) | NOT STARTED |

Suggested calendar: 01 → 02 → 03 → 04 → 05. Modules 03 and 04 can run in parallel by two assistants once 02 is complete.

---

## 10. Definition of Done (every module)
1. All tasks ticked or explicitly deferred with a reason.
2. `npm run build` passes with zero TypeScript errors and zero ESLint errors.
3. Browser test checklist executed in Chrome at 1440×900 and 390×844 (mobile) in **both** dark and light themes; screenshots of key states attached to the status log (paths under `docs/modules/qa/0N/`).
4. No console errors on the tested pages.
5. Secrets never in the client bundle (`grep -r "OPENAI\|RAPIDAPI_KEY" .next/static` returns nothing).
6. `STATUS.md` updated; module header updated; status log has a dated `COMPLETE` line.
7. **Committed and pushed to `main`.** Only after steps 1–6 pass:
   ```bash
   git add -A && git status                 # confirm no .env*, no firebase/*-adminsdk-*.json, no backups/
   git commit -m "feat(module-0N): <module name> — <one-line summary>"
   git checkout main && git pull --rebase origin main
   git merge --no-ff module/0N-short-name
   npm run build                            # build again on the merged tree
   git push origin main
   ```
   If the merged build fails, fix on `main` before pushing. Record the pushed commit SHA in the module's status log. Never push a module that has failing tests, a red build, or an unticked task without a written reason.
