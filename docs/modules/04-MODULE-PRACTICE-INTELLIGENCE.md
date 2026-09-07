# Module 04 — Practice Intelligence & Gamification

| Field | Value |
|---|---|
| **Status** | NOT STARTED |
| Branch | `module/04-intelligence` |
| Depends on | 01 (schema, `/api/submit` hook `applySubmissionToStats`, activity docs), 02 (`GenerationContext`, `problems.search`, template pre-generation) |
| Unblocks | 05 (dashboard/profile/leaderboard pages consume these APIs), 03 (badges/reason strip data) |
| Decisions used | D-06, D-07, D-11 |
| Estimated size | ~3,000 LOC |

## 0. Context for a fresh assistant
1. Read `00-MASTER-PLAN.md` §3.2 (C9, C10, C11, C12, C14), §5 (`users.stats`, `topicSkills`, `activity`, `leaderboard`, `dailyChallenge`, `achievements`), §6 (routes marked 04).
2. Read `Working.md` (v1 formulas) and the v1 sources you are porting **with fixes**: `src/lib/user-profile.ts`, `spaced-repetition.ts`, `practice-engine.ts`, `recommendation.ts`, `prerequisite-graph.ts`, `session-tracker.ts` (client-side; Module 03 uses it), `leaderboard.ts`. Delete the v1 files when the port is complete.
3. Module 02 expects you to export from `src/lib/practice/index.ts`: `recommend(ctx) → Recommendation`, `summarizeForPrompt(user) → string (≤ 400 chars)`, `getSeenProblemIds(uid)`, `CORE_TOPICS`, `INTERVIEW_PATTERNS`.
4. Module 01 left a stub `applySubmissionToStats(uid, submission, problem)` in `src/lib/practice/stats.ts`; you replace it.

## 1. Goal
Keep every good idea from v1's engine, fix its bugs, make it **cheaper** (no O(users) reads), **fairer** (server-computed only), and **more motivating** than LeetCode: rating, streak protection, XP/levels, achievements, daily challenge, skill tree, mock interviews.

## 2. Scope
**In:** `src/lib/practice/*`, jobs for leaderboard snapshots and daily challenge, routes in §3.9, template-aware recommendation, project insights consumption. **Out:** UI (Module 05 builds dashboard/profile/leaderboard/skill-tree pages; Module 03 shows badges), AI prompts (Module 02).

## 3. Technical specification

### 3.1 Topics & prerequisite graph — `topics.ts`
`CORE_TOPICS` (25, unchanged from v1), `INTERVIEW_PATTERNS` (15), `PREREQUISITES` DAG (v1 map + add `"heap": ["array"]` only, `"matrix": ["array"]`, `"bit manipulation": ["math"]`), `TOPIC_META` with display names, icons and short descriptions (used by the skill tree). Tags on problems are normalized to this list at generation (Module 02 validates).

### 3.2 Mastery v2 — `mastery.ts`
Composite 0–100 **without recency** (recency is handled by SRS, fixing C11):
```
accuracy        = solved / attempts                      (weight 35)
firstTryRate    = firstTrySuccesses / max(1, solved)     (weight 15)  // ≤ 1 by construction
breadth         = (#difficulties solved > 0) / 3         (weight 15)
timeEfficiency  = clamp(expected/actual, 0, 1.2)/1.2     (weight 15)
independence    = 1 - clamp(avgHintsPerSolve*0.25 + editorialRate*0.4, 0, 1)   (weight 10)
volume          = min(1, solved / 6)                     (weight 10)  // prevents 1/1 = "mastered"
```
Struggle adjustment kept (runCount vs expected runs: ×0.85 / ×1.10). `EXPECTED_TIME` Easy 600 / Medium 1200 / Hard 2400 s; `EXPECTED_RUNS` 3/5/8. Weak topic threshold 50; "mastered" ≥ 80 with ≥ 3 solved. Unit tests cover: single solve cannot exceed 60; three clean solves across difficulties ≈ 90+.

### 3.3 Spaced repetition v2 — `srs.ts`
SM-2 with the interval bug fixed:
```
quality: 0 fail | 1 heavy help (≥3 hints or editorial or eff<0.4) | 2 moderate | 3 clean
q < 2: interval = 1, ease = max(1.3, ease-0.2), reps = 0
q ≥ 2: reps += 1; interval = reps==1 ? 1 : reps==2 ? 3 : round(prevInterval * ease); ease += 0.1 - (3-q)*(0.08+(3-q)*0.02); clamp interval 1..180
```
`nextReview = today + interval`. `getDueTopics(user)` unchanged (urgency = 0.6·overdue + 0.4·masteryDeficit). Legacy entries without `srs` get `{interval:1, ease:2.5, reps:0, nextReview: today}`.

### 3.4 Practice state machine — `state.ts`
Port v1 `computePracticeState` and `getStateGuidance`, `getCalibrationSpec`, `getStateProgress` unchanged except: returning-user threshold uses `stats.lastActiveDate`; "learning" exits at 10 **solved** (not attempts); interview-prep no longer overrides revision when ≥ 5 topics are due.

### 3.5 Rating (Elo) — `rating.ts`
User `stats.rating` starts 1200. Problem `rating` seeded 1100/1500/1900 by difficulty. On each **first** submission per (user, problem): expected = 1/(1+10^((Rp−Ru)/400)); user gains K·(S−expected) with S = 1 for AC on first try, 0.7 for AC on later try, 0 for no AC after 3 attempts (evaluated when the 3rd fails); K = 32 while < 30 rated solves, then 16. Problem rating moves by −/+ K/4 the other way (bounded 800–2600). Rating feeds `getTopicDifficulty`: choose difficulty whose problem-rating band is closest to `rating + 100` (pushes slightly up).

### 3.6 Recommender v2 — `recommend.ts`
Input: `{ user, project, existingItems, userPrompt?, topicFilter? }`. Keep v1 flow (calibration → signals → strategy by state → topic filter → per-topic difficulty → prerequisite redirect → variety guard → user prompt), with these changes:
- Topic choice within a strategy uses a **bandit**: score each candidate topic = strategyWeight + 0.6·urgency(SRS) + 0.4·(1−mastery/100) + explorationBonus(1/√(attempts+1)) − recencyPenalty(last 3 items) + jitter(0.05); pick top-1, keep top-2 as alternates. Deterministic given a seed (for tests).
- Difficulty from `rating.ts` band, then session guidance adjust (−1/0/+1) passed by the client (`sessionHealthScore` in the request body; server clamps).
- Prerequisite redirect uses mastery **and** `solved ≥ 2` on the prerequisite (avoid redirecting because of one unlucky fail); marginal gap 45 stays.
- Output `Recommendation` (v1 shape + `rationaleFacts[]` for the "Why this problem?" strip and `promptTopicsForPool` for `problems.search`).
- `recommendFromTemplate` keeps v1 scoring (+30/+25/+20/−15/+10 + jitter) but first prefers already pre-generated `problems` with `templateRef.title` equal to the pool entry (Module 02 A-17) so template projects rarely pay for generation.
- `summarizeForPrompt(user)`: ≤ 400 chars: state, rating, top-3 weak (mastery), top-3 strong, due topics (≤3), pass rate. This replaces v1's unbounded table (C8).

### 3.7 Stats application on submit — `stats.ts`
`applySubmissionToStats({ uid, problem, submission })` inside a Firestore transaction on `users/{uid}`:
1. For each tag: update TopicSkill (attempts, solved/failed, difficulty counters, first-try, time avg, timeEfficiency, hints, runCount, editorial flag), mastery, SRS.
2. `stats.totalSolved/Failed`, `easy/medium/hard` (first AC per problem only), `lastActiveDate`, streak (UTC day; `streakFreezes` consumed automatically when a day is missed and a freeze is available — freezes earned 1 per 7-day streak, max 2), `xp` (+10 Easy/+25 Medium/+50 Hard first AC, +2 per attempt, +5 clean first-try bonus, −30% when editorialViewed), `level = floor(sqrt(xp/50))`, `score` (leaderboard: `solvedWeighted*2 + currentStreak*5 + avgMastery*0.5 + longestStreak*2 + rating/50`).
3. Rating update (§3.5) for first-attempt outcomes.
4. Calibration step advance.
5. Achievements check (§3.8) → append to `achievements/{uid}` and return `newlyUnlocked[]` so `/api/submit` can include them in its response (Module 03 toasts them).
Idempotent per `submissionId` (store `lastAppliedSubmissionId`).

### 3.8 Achievements — `achievements.ts`
Static catalog (id, name, description, icon, condition): `first_ac`, `streak_7`, `streak_30`, `streak_100`, `easy_10`, `medium_25`, `hard_10`, `topic_master_<topic>` (mastery ≥ 80), `night_owl` (AC between 00–04 local), `speedrunner` (AC under 25% expected time), `no_hints_20`, `polyglot` (AC in 2 languages), `template_complete_<company>`, `rating_1500`, `rating_1800`, `daily_10` (10 daily challenges). Conditions are pure functions over `(user, submission, context)`.

### 3.9 Streaks, activity, heatmap — `activity.ts`
`/api/submit` (Module 01) already upserts `activity/{uid}_{date}`. This module adds `GET /api/activity?year=` (reads ≤ 366 docs by key range, returns `{heatmap, totalSubmissions, activeDays, maxStreak, currentStreak}`), streak freeze logic, and removes the attendance concept (D-07): `projects.progress.activeDays` = count of activity docs with `projectIds` containing the project (activity doc gains `projectIds[]`).

### 3.10 Leaderboard — `leaderboard.ts`, job `jobs/leaderboard-snapshot.ts`
- `users` gets a composite index on `stats.score desc`; `GET /api/leaderboard?scope=global&cursor` queries `users` ordered by score (page 50) — O(page), not O(users). My rank = `count()` aggregation of `users where stats.score > mine` + 1; percentile from total count (cached 10 min in `leaderboard/meta`).
- Project scope: `submissions where projectId==` is only the owner's in v2 (projects are private), so project leaderboard becomes **"friends/cohort" leaderboard**: users who share a `templateId` (e.g. everyone doing the Google template) ranked by `templateProgress` — computed by the hourly snapshot job into `leaderboard/template_{company}`.
- Weekly leaderboard: `activity` aggregation for the current ISO week (snapshot job) → `leaderboard/week_{yyyy-ww}`.
- Cron route `GET /api/cron/leaderboard` (hourly) with `CRON_SECRET`; admin trigger.

### 3.11 Daily challenge — `daily.ts`
`dailyChallenge/{date}`: chosen by the cron at 00:00 UTC from verified problems not used in the last 90 days, difficulty rotating Easy/Medium/Medium/Hard by weekday; `GET /api/daily` returns it with the user's status; solving it awards `+20 xp` and counts toward `daily_10`. Solving happens through the normal workspace with `projectId = user's "Daily" system project` (auto-created).

### 3.12 Mock interview (D-11, stretch) — `interview.ts`
`POST /api/interview/start {durationMin: 45, difficulty: "mixed"}` → creates `interviews/{id}` with 2 problems (1 Medium + 1 Medium/Hard by rating), `endsAt`; the workspace runs in interview mode (timer countdown, hints/editorial disabled, tutor disabled). `POST /api/interview/:id/finish` → Module 02 `review` purpose with a special "interviewer" instruction set generating strengths/weaknesses/score; stored on the interview doc. UI in Module 05.

### 3.13 Project insights consumption
`projects.insights` (Module 02) gains `weeklyPlan`; this module computes `projects.progress` on every submit (items/solved/attempting/easy/medium/hard/activeDays) and `onTrack` (solved vs expected pace) for the dashboard.

### 3.14 Routes
`GET /api/leaderboard`, `GET /api/activity`, `GET /api/daily`, `GET /api/me/skills` (topics with mastery/srs/rating for the skill tree), `GET /api/me/achievements`, `POST /api/interview/start`, `POST /api/interview/:id/finish`, `GET /api/cron/leaderboard`, `GET /api/cron/daily`, `POST /api/admin/leaderboard-snapshot`. Also wire `recommend()` into `POST /api/projects/:id/next` replacing Module 02's temporary recommender.

## 4. Tasks
- [ ] P-01 `topics.ts` (topics, patterns, prerequisites, meta) + tests for DAG acyclicity.
- [ ] P-02 `mastery.ts` v2 with tests (§3.2 cases).
- [ ] P-03 `srs.ts` with the interval fix + tests (interval grows 1→3→8→…; failure resets).
- [ ] P-04 `state.ts` port + tests for each transition.
- [ ] P-05 `rating.ts` Elo with tests (K schedule, bounds).
- [ ] P-06 `recommend.ts` v2 (bandit, difficulty band, prerequisite rule, template preference, `summarizeForPrompt`, `getSeenProblemIds`) with seeded deterministic tests.
- [ ] P-07 `stats.ts` transaction (`applySubmissionToStats`) replacing the Module 01 stub; idempotency test.
- [ ] P-08 Streak + freeze logic; `activity` `projectIds[]`; `projects.progress` recompute; remove attendance remnants (rules, docs, code).
- [ ] P-09 `achievements.ts` catalog + evaluation + `newlyUnlocked` in submit response.
- [ ] P-10 XP/level/score formulas + `users.stats` migration for existing v2 users (script).
- [ ] P-11 Leaderboard: index, paginated global query, rank via `count()`, meta cache.
- [ ] P-12 Snapshot job + cron route + admin trigger (template cohorts, weekly).
- [ ] P-13 Daily challenge selection job + `GET /api/daily` + system "Daily" project.
- [ ] P-14 `GET /api/me/skills`, `GET /api/me/achievements`, `GET /api/activity`.
- [ ] P-15 Wire `recommend()` into `/api/projects/:id/next`; remove Module 02's temporary recommender.
- [ ] P-16 Session health: keep `session-tracker.ts` client-side; add `sessionHealthScore` to the next-problem request and clamp server-side.
- [ ] P-17 Calibration flow verified end to end (returning user ≥ 14 days → 3 calibration problems → normal).
- [ ] P-18 Mock interview backend (stretch, D-11).
- [ ] P-19 Delete v1 lib files; rewrite `Working.md` → `docs/modules/reference/PRACTICE-ENGINE.md` documenting v2 formulas with the numbers above.
- [ ] P-20 Vitest suite ≥ 60 tests across the engine; all green.
- [ ] P-21 Load test script: 1,000 simulated users × 20 submissions → leaderboard endpoint p95 < 300 ms (emulator or a test project).
- [ ] P-22 Update `/dev/api-smoke` with "simulate 10 submissions" and show resulting mastery/srs/rating/achievements.
- [ ] P-23 QA screenshots to `docs/modules/qa/04/` (smoke page states).
- [ ] P-24 Status log entries with eval numbers (recommendation distribution over 100 simulated picks: no topic > 25%, weak topics ≥ 40% while weak exist).
- [ ] P-25 **Ship it.** All tasks ticked, ≥ 60 vitest tests green, `npm run build` green, browser checklist (§6) passed, `STATUS.md` and status log updated → commit, merge `module/04-intelligence` into `main`, rebuild, `git push origin main`, record the commit SHA (Master Plan §10 step 7).

## 5. Acceptance criteria
- SRS: a topic solved cleanly three days in a row has intervals 1 → 3 → 8 (ease 2.5→2.6) — v1 stayed at 1.
- Mastery of a topic after one lucky AC ≤ 60; after 5 clean mixed-difficulty ACs ≥ 85; 30 idle days do **not** change mastery but do make the topic due.
- Leaderboard request reads ≤ 51 user docs (log the count); rank uses one aggregation query.
- Submit response includes `newlyUnlocked: ["first_ac"]` on the first AC; `users.stats.xp/level/rating/score` update atomically; a replayed submit does not double count.
- Recommender on a fresh intermediate user returns Easy/Medium with a "new topic" reason; on a user with `graph` mastery 20 and `dfs` requested, returns `graph` prerequisite with the documented reason.
- Daily challenge exists for today after the cron runs; `GET /api/daily` shows `solved:false/true` correctly.

## 6. Browser test checklist
1. `/dev/api-smoke` → simulate submissions → inspect mastery/srs/rating/xp/achievements values change as specified.
2. Solve today's daily challenge in the workspace → `GET /api/daily` shows solved; xp +20; heatmap cell increments.
3. Open `/api/leaderboard?scope=global` as two users → ranks consistent; ties share rank.
4. Skip a day with a freeze available → streak preserved and `streakFreezes` decremented (simulate by editing `lastActiveDate` in the console).
5. Template project: "Next" prefers pre-generated template problems (`source:"reused"`, `templateRef` present).
6. Returning user path: set `lastActiveDate` 20 days back → next 3 problems show "Calibration step n/3".
7. No console errors; all cron routes reject requests without `CRON_SECRET`.

## 7. Status log
- 2026-09-07 — Module specified. NOT STARTED.
