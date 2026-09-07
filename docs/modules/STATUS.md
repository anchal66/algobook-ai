# AlgoBook v2 — Module Status Tracker

Legend: `NOT STARTED` · `STARTED` (branch created, reading done) · `IN PROGRESS` (code being written) · `COMPLETE` (Definition of Done in `00-MASTER-PLAN.md §10` met)

Update this table **and** the header of the module file whenever a status changes. Keep the history table append-only.

## Overview

| # | Module | Status | Branch | Started | Completed | Owner / assistant | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Foundation — auth, schema v2, wipe, Judge service, run/submit, rules, quotas | COMPLETE | `module/01-foundation` | 2026-09-07 | 2026-09-08 | Claude (Opus 5) + Avinash | Merged and pushed; rules v2 + 13 indexes live; D-02 wipe run by the owner and the fixtures restored. Acceptance suite green on real Judge0 (AC 13/13 in all four languages, WA/TLE/CE, rules and ownership checks). Open risk: Judge0's free tier allows ~50 executions/day (D-05). |
| 02 | AI Engine — model policy, verified generation, hints/editorial/review/chat/completion, pre-gen, cost telemetry | COMPLETE | `module/02-ai-engine` | 2026-09-07 | 2026-09-08 | Claude (Fable 5.1) | api-smoke 59/59, browser checklist passed on `/dev/api-smoke`, 55 unit tests; verified with the new `JUDGE_BACKEND=local` because Judge0's free tier was exhausted. Open: large-sample eval (≥ 85 % first pass), pregen job never executed, D-03 reasoning effort. |
| 03 | Editor Workspace — LeetCode-parity problem page + AI extras | COMPLETE | `module/03-workspace` | 2026-09-08 | 2026-09-08 | Claude (Fable 5.1) | 14/14 browser checklist on `dev-local`, 78 tests, build green, QA captures in `qa/03`. Bundled Monaco (no CDN). Fixed Module 01 draft persistence + HMR Firestore singleton. Open: re-run once on real Judge0. |
| 04 | Practice Intelligence — mastery/SRS fixes, recommender v2, rating, streaks, leaderboard, achievements, daily, mock interview | NOT STARTED | `module/04-intelligence` | — | — | — | Blocked by 01, 02. Can run in parallel with 03. |
| 05 | Design System & Pages — tokens, motion/3D, landing, dashboard, explore, wizard, profile, leaderboard, settings, admin, final QA | NOT STARTED | `module/05-design-pages` | — | — | — | Blocked by 01–04. |

## Task roll-up (update counts when you tick tasks)

| Module | Total tasks | Done | Deferred | Pushed to `main` (SHA) |
|---|---|---|---|---|
| 01 | 27 | 27 | 0 | `1afb319` (module ship), docs through `bd3fb73` |
| 02 | 23 | 23 | 0 | `fbf0b60` (merge of `module/02-ai-engine`, pushed 2026-09-08) |
| 03 | 35 | 35 | 0 | `8b8dbc5` (merge of `module/03-workspace`, pushed 2026-09-08) |
| 04 | 25 | 0 | 0 | — |
| 05 | 29 | 0 | 0 | — |

The last task of every module is "Ship it": commit, merge the module branch into `main`, rebuild, push, and record the SHA above. A module is not `COMPLETE` until it is pushed.

## History (append-only)

| Date | Module | Event | By |
|---|---|---|---|
| 2026-09-07 | all | Plan authored; audit of v1 complete; OpenAI key validated; LeetCode UI surveyed | Claude (planning session) |
| 2026-09-07 | all | Owner decided D-01 (Java+Python+C+++JS), D-02 (wipe everything incl. subscriptions), D-04 (free tier default), D-05 (RapidAPI now, abstracted); Modules 01/02/03 updated accordingly | Avinash + Claude |
| 2026-09-07 | 01 | STARTED → IN PROGRESS; all code delivered on `module/01-foundation`; deps bumped to latest; Two Sum verified on Judge0 in 4 languages; API + browser checks pass except the 3 that need the Firestore deploy | Claude |
| 2026-09-07 | 01 | Missing-index fallbacks + programmatic `npm run db:deploy`; api-smoke 32/33; merged into `main` and pushed as `1afb319` | Claude |
| 2026-09-07 | 01 | Firestore rules v2 released and all 13 indexes issued; rules verified from a client token. Only the D-02 wipe remains | Claude |
| 2026-09-07 | 01 | Rules v2 confirmed live (ruleset created 17:44 UTC, matches `firebase/firestore.rules`); indexes CREATING; wipe not yet run | Claude |
| 2026-09-07 | 02 | NOT STARTED → STARTED on `module/02-ai-engine`; context read; OpenAI Responses API + zod v4 structured outputs probed OK on `gpt-5.6-luna` | Claude |
| 2026-09-08 | 02 | IN PROGRESS → COMPLETE; merged into `main` and pushed as `fbf0b60` | Claude |
| 2026-09-08 | 01 | D-02 wipe run by the owner; fixtures restored; acceptance suite re-run on real Judge0 against the post-wipe data → Module 01 **COMPLETE** | Claude (Opus 5) |
| 2026-09-08 | 03 | NOT STARTED → STARTED on `module/03-workspace`; context read; Module 03 deps installed | Claude (Fable 5.1) |
| 2026-09-08 | 03 | IN PROGRESS → COMPLETE; workspace delivered and browser-verified; merged into `main` and pushed as `8b8dbc5` | Claude (Fable 5.1) |
