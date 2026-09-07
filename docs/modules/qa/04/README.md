# Module 04 — QA evidence (2026-09-08)

Environment: worktree `.claude/worktrees/module-04` (branch `module/04-intelligence` from `main` 75c61f7, in parallel with Module 03),
dev server `JUDGE_BACKEND=local npx next dev --turbopack -p 3004` (javac / python3 / g++ / node on the host), Firestore project
`algobook-c9caa`, OpenAI `gpt-5.6-luna`, desktop Browser pane signed in with a custom token as `biu416…` (admin, free plan); `Wa9Ms…` (pro) via scripts.
Rules v2.1 (adds `interviews` owner-read) released with `npm run db:deploy -- --rules-only`; no new composite index was needed.

## Automated
- `npm test` — **152 vitest tests** (97 for the practice engine: DAG, mastery, SRS, rating, state machine, achievements, stats/streaks/xp, recommender incl. the 100-pick distribution, template scoring, calendar/rank helpers): green.
- `npm run typecheck`, `npm run lint` (0 errors, no warnings in Module 04 files), `npm run build`: green. `grep -r "OPENAI\|RAPIDAPI_KEY" .next/static` → nothing.
- `npm run api:smoke -- --uidA … --uidB … --finishInterview` — **80/80** (`api-smoke.log`): Modules 01/02 unchanged, plus the Module 04 section: stats applied on submit (xp/level/`lastAppliedSubmissionId`), rating moves on user B's first AC (`ratedSolves` 2, rating 1231.1), topic skills carry mastery + SRS, `/api/me/skills` 25 topics, `/api/me/achievements` (`first_ac`), `/api/activity` streak + `projectIds`, global leaderboard (rank 2 of 2, ≤ 52 reads), week/template snapshots, `/api/daily` (Two Sum, system Daily project), cron routes reject without `CRON_SECRET`, admin snapshot 200, `sessionHealthScore` validation, free user interview → 402, pro interview start (2 problems) → GET → other user 404 → finish → AI debrief (`score`, `verdict`).
  A first run hit OpenAI `429 no credits remaining` on chat/review (owner topped up; re-run green).
- `scripts/m04-acceptance.ts` (`m04-acceptance-template-post.log` + console runs):
  - daily bonus: user B already solved today's challenge by the time the script ran → skipped (the +20 xp path is covered by `stats.test.ts` and the smoke's `daily.solved:true`);
  - leaderboard as two users: same page and ranks, my rank equals my row, ties share a rank ✓;
  - template preference: B's Google project generated "Integer to Roman" (#3, `templateRef` present); A's Google project then got **`source: reused`** for the same entry with rationale "A verified problem for this entry is already prepared" (528 ms, no generation) ✓;
  - returning user: `lastActiveDate` set 20 days back → `/next` answered **"Calibration step 1/3"**, `users.calibration {complete:false, step:0}`, each accepted solve advanced the step, "Calibration step 3/3", then `{complete:true, step:3}`; the post-calibration `/next` returned a normal recommendation ("Prerequisite: string", state revision, strategy familiar, with rationale facts) ✓ (one middle step hit a Module 02 generation failure — hidden-test encoding — and was retried by the loop);
  - streak freeze: `lastActiveDate` two days back with 1 freeze → streak 9 → 10, freezes 1 → 0; with no freeze → streak resets to 1; `/api/activity` reflects it ✓.
- `npm run load:leaderboard -- --users 1000 --subs 20 --requests 40` (`load-test-leaderboard.log`): 1,000 users × 20 submissions pushed through the real engine and seeded in 55 s; `GET /api/leaderboard?scope=global` × 40 → **reads/page ≤ 52** (51 for the page + the cursor doc), p50 369–383 ms, **p95 413–473 ms**, max 679 ms. The target (p95 < 300 ms) is not met on this setup: a bare authenticated `GET /api/me` (token check + one user read) measures 325–400 ms from this machine to the Firestore region, and the dev server adds Turbopack overhead; the leaderboard route itself adds one page query in parallel with the rank aggregation and the cached meta read. Expect < 300 ms in-region / on the emulator; the O(page) read count is the property that scales. Seeded users deleted with `--cleanup`.
- `npm run db:migrate:stats -- --apply` — the 2 existing users recomputed (score/level, new counters, `editorialViews`, normalised `srs`).

## Browser checklist (module §6) — Browser pane on http://localhost:3004
| # | Check | Result |
|---|---|---|
| 1 | `/dev/api-smoke` → simulate submissions → mastery/srs/rating/xp/achievements | ✓ `dev-page-simulation.txt`: 10 synthetic submissions → per-step xp, Elo deltas (+25.5 … −25), streak 1→10 with a freeze banked at 7 (`streak_7` unlocked), mastery/SRS per topic table, state "revision" with 11 due topics, locked topics with unmet prerequisites |
| 2 | Solve today's daily → `GET /api/daily` solved, xp +20, heatmap cell | ✓ via API: today's challenge Two Sum; A's AC counted (`solved:true`, `dailySolvedTotal:1`), `activity.dailySolved`; the +20 is asserted in `stats.test.ts` (Module 03's workspace page is not in this branch) |
| 3 | `/api/leaderboard?scope=global` as two users → consistent ranks, ties share | ✓ acceptance script + smoke |
| 4 | Skip a day with a freeze → streak preserved, `streakFreezes` decremented | ✓ acceptance `freeze` section (lastActiveDate edited server-side) |
| 5 | Template project "Next" prefers pre-generated problems (`source: reused`, `templateRef`) | ✓ acceptance `template` section |
| 6 | Returning user → 3 × "Calibration step n/3" | ✓ acceptance `calibration` section |
| 7 | No console errors; cron routes reject without `CRON_SECRET` | ✓ `read_console_messages` → none on the dev page; cron → 403 (secret not configured locally) / 401 with a wrong bearer |

Screenshots: the Module 04 surface is API + the admin-only dev page (Module 05 builds the user-facing pages), so the evidence is the
text captures and logs above, like Module 02. No PNGs were captured for the authenticated dev page.
