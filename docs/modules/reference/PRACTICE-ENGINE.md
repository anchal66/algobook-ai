# Practice Engine v2 — formulas and behaviour (Module 04)

Replaces v1's `Working.md`. Everything below is implemented in `src/lib/practice/*` as pure functions (unit-tested with vitest) and applied server-side by `/api/submit` (`stats.ts`) and `/api/projects/:id/next` (`recommend.ts`). Nothing here is computed on the client.

## 1. Mastery (`mastery.ts`)

Composite 0–100 per topic, **no recency term** (recency is handled by SRS — fixes C11).

| Factor | Formula | Weight |
|---|---|---|
| accuracy | `solved / attempts` | 35 |
| firstTryRate | `firstTrySuccesses / max(1, solved)` (≤ 1 by construction) | 15 |
| breadth | `(#difficulties with ≥ 1 solve) / 3` | 15 |
| timeEfficiency | `clamp(expected / actual, 0, 1.2) / 1.2` — rolling mean of per-submission `clamp(expected/actual, 0.3, 2)` | 15 |
| independence | `1 − clamp(avgHintsPerSolve·0.25 + editorialRate·0.4, 0, 1)` | 10 |
| volume | `min(1, solved / 6)` | 10 |

`raw = Σ factor × weight`. **Struggle adjustment** on accepted solves: `runCount / EXPECTED_RUNS > 2 → raw × 0.85`; `< 0.5` and first try `→ raw × 1.10`. Then `mastery = round(adjustedRaw × confidence)` with `confidence = sqrt(min(1, solved / 3))` — one lucky AC reads at most ~58 (spec: ≤ 60), three solves count fully.

Constants: `EXPECTED_TIME` Easy 600 / Medium 1200 / Hard 2400 s; `EXPECTED_RUNS` 3 / 5 / 8. Weak: `mastery < 50` (practised). Mastered: `mastery ≥ 80` and `solved ≥ 3`. Difficulty counters and breadth count **first** ACs only.

## 2. Spaced repetition (`srs.ts`)

SM-2 with the v1 interval bug fixed (C10).

```
quality: 0 fail | 1 heavy help (≥3 hints, editorial viewed, or efficiency < 0.4) | 2 moderate (any hint, not first try, efficiency < 0.7) | 3 clean
q < 2: interval = 1, ease = max(1.3, ease − 0.2), reps = 0
q ≥ 2: reps += 1; interval = reps == 1 ? 1 : reps == 2 ? 3 : round(prevInterval × prevEase)
       ease = max(1.3, ease + 0.1 − (3 − q)(0.08 + (3 − q)·0.02)); interval clamped 1..180
nextReview = today + interval (UTC day keys)
```

Three clean solves on consecutive days: intervals 1 → 3 → 8 (ease 2.5 → 2.6 → 2.7). Legacy skills without `srs` are due today. `urgency = 0.6·min(1, overdueDays/14) + 0.4·(1 − mastery/100)`; `getDueTopics` returns practised topics with `nextReview ≤ today`, most urgent first. An idle month makes a topic **due** but does not change its mastery.

## 3. Practice state (`state.ts`)

| State | Trigger (evaluated in order) |
|---|---|
| warm-up | calibration incomplete · returning user (`stats.lastActiveDate` ≥ 14 days ago and ≥ 1 submission) · brand-new beginner |
| learning | brand-new non-beginner · `totalSolved < 10` (solved, not attempts) |
| revision | ≥ 3 due topics, or ≥ 1 due + ≥ 2 weak (interview-prep goal: only when ≥ 5 due) |
| interview-prep | `goalType = interview-prep` (unless ≥ 5 topics are due) |
| strengthening | any weak topic, or pass rate < 60 % |
| maintenance | otherwise |

Guidance: warm-up/revision → familiar/due topics at Easy; learning → new topics; strengthening → weak-first; interview-prep → patterns at ≥ Medium; maintenance → mixed. **Calibration** (returning user): `/next` sets `calibration {complete:false, step:0}`; steps are Easy familiar → Medium familiar → Easy weakest; each accepted submission advances a step, step 3 completes it.

Session health (client `session-tracker.ts`, sent as `sessionHealthScore`): `< 30` → −1 level + break suggestion, `< 60` → −1, `≥ 90` → +1; the server clamps to ±1.

## 4. Rating (`rating.ts`)

Elo. Users start at 1200, problems are seeded 1100 / 1500 / 1900 by difficulty. One rated outcome per (user, problem):

```
expected = 1 / (1 + 10^((Rp − Ru) / 400))
S = 1 (AC on attempt 1) | 0.7 (AC on a later attempt) | 0 (third attempt fails with no AC)
K = 32 while stats.ratedSolves < 30, then 16
Ru += K·(S − expected)  (400..3500);  Rp −= K·(S − expected)/4  (800..2600)
```

`difficultyForRating(r)` = the seed closest to `r + 100` (1200 → Easy on the tie, 1250 → Medium, 1650 → Hard). Practised topics shift the input by `(mastery − 50) × 3`.

## 5. Recommender (`recommend.ts`)

Flow: calibration → signals (weak, due, familiar, unpracticed, last-3 tags) → strategy by state → candidate pool → **bandit** → topic filter → difficulty → prerequisite redirect → variety guard → user prompt.

```
score(topic) = 0.8·[in strategy set] + 0.6·urgency + 0.4·(1 − mastery/100) + 0.3/√(attempts+1) − recency(0.8/0.7/0.6 for the last 3 items) + jitter(0.05)
pick = Boltzmann sample over the ranked candidates, τ = 0.3 (seeded mulberry32 → deterministic for a seed); alternates = next two
```

Strict strategies sample only their set (familiar/due, interview patterns, unpracticed-with-prerequisites-met); open ones (weak-first, mixed) rank every core topic. Prerequisite redirect when a prerequisite has `mastery < 45` **and** `solved < 2` (one unlucky fail never redirects); the marginal band 45–49 is allowed. Difficulty: Elo band → state bias (warm-up/revision Easy, interview ≥ Medium) → session adjust → prompt override. Output adds `rationaleFacts[]` ("Why this problem?" strip), `promptTopicsForPool` (primary + alternates for `problems.search`), `state`, `strategy`, `startCalibration`.

Measured (vitest, 100 seeded picks on a user with 3 weak topics out of 25): max topic share ≤ 25 %, weak topics ≥ 40 %.

Template projects (`scoreTemplatePool`): +30 difficulty match, +25 weak topic, +20 due topic, −15 recent tag, +10·(earlier order), + jitter(5); a prompt that matches a title wins outright. `index.ts` then prefers, among the top 5, an entry that already has a pre-generated verified problem (`problems.findByTemplateTitle`) so template projects rarely pay for generation.

`summarizeForPrompt` ≤ 400 chars: state, rating, pass rate, top-3 weak, top-3 strong, ≤ 3 due topics (C8).

## 6. Submit application (`stats.ts`)

Inside the `/api/submit` transaction, idempotent per `submissionId` (`users.lastAppliedSubmissionId`):

1. Per canonical tag: counters, mastery (§1), SRS (§2), `lastSeen`.
2. `totalSolved/Failed`, `easy/medium/hard` (first AC only), `noHintSolves`, `languagesAccepted`, `dailySolved`.
3. Streak (UTC): consecutive day +1; same day no-op; a missed day consumes a banked freeze (`stats.streakFreezes`, earned 1 per 7-day streak, max 2) else reset to 1.
4. XP: +2 per attempt; first AC +10 / +25 / +50; clean first try (no hints) +5; daily challenge +20; ×0.7 when the editorial was viewed. `level = 1 + floor(sqrt(xp / 50))` (deviation from the spec's `floor(sqrt(xp/50))` so a new user is level 1, matching the Module 01 stub).
5. Rating (§4), `ratedSolves`.
6. `score = (easy + 2·medium + 3·hard)·2 + currentStreak·5 + avgMastery·0.5 + longestStreak·2 + rating/50`.
7. Calibration step, `practiceState` recomputed, achievements evaluated → `newlyUnlocked[]` in the submit response (also `xpEarned`, `rating {before, after, delta}`, `streakFreezeUsed`, `daily.solved`).

Also on submit: `activity/{uid}_{date}` gains `projectIds[]` and `dailySolved`; `projects.progress` gains `onTrack` / `expectedSolved` (items spread evenly over `durationDays`; on track when `solved ≥ expected − 1`); `problems.rating` moves per §4.

## 7. Achievements (`achievements.ts`)

`first_ac`, `streak_7/30/100`, `easy_10`, `medium_25`, `hard_10`, `night_owl` (AC with client `localHour` 0–3), `speedrunner` (AC under 25 % of expected time), `no_hints_20`, `polyglot` (ACs in 2 languages), `rating_1500/1800`, `daily_10`, `topic_master_<topic>` (mastery ≥ 80, 25 topics), `template_complete_<company>` (6). Stored in `achievements/{uid}.unlocked[{id, at}]`.

## 8. Leaderboard (`leaderboard.ts`, `jobs/leaderboard-snapshot.ts`)

- Global: `users where stats.score > 0 orderBy stats.score desc` (single-field index) page of 50 → ≤ 51 reads (logged as `leaderboard.reads`); my rank = `count(users where stats.score > mine) + 1` (ties share); percentile from `leaderboard/meta.totalRanked` cached 10 min.
- Template cohorts (`leaderboard/template_{company}`): users sharing a company template ranked by best project progress %.
- Weekly (`leaderboard/week_{yyyy-Www}`): `activity` docs of the ISO week aggregated per user (`accepted·10 + activeDays·5 + xp/10`).
- Hourly `GET /api/cron/leaderboard` (`CRON_SECRET`), admin `POST /api/admin/leaderboard-snapshot`.

## 9. Daily challenge (`jobs/daily-challenge.ts`)

`dailyChallenge/{date}` chosen at 00:00 UTC (`GET /api/cron/daily`, lazily by `GET /api/daily`): a verified problem not used in the last 90 days, difficulty rotating Easy/Medium/Medium/Hard by weekday, deterministic per date. Solving happens in the user's system "Daily" project (`users.dailyProjectId`, `projects.purpose = "daily"`); an AC awards +20 XP once per day (`activity.dailySolved`) and counts toward `daily_10`.

## 10. Mock interview (`interview.ts`, D-11)

`POST /api/interview/start {durationMin: 30|45|60, difficulty: mixed|medium|hard}` → 2 problems by rating (Medium near `rating+100`, then Medium/Hard near `rating+300`; Hard when rating ≥ 1500) linked into the system "Interview" project; `interviews/{id}` with `endsAt`. `POST /api/interview/:id/finish` → transcript of the window's submissions → model purpose `review` with the interviewer instruction set → `{score 0–10, verdict, strengths, weaknesses, summary, perProblem}` stored on the doc. Quota key `interview` (Pro: 5/day).
