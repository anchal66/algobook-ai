# AlgoBook v2 — Module Status Tracker

Legend: `NOT STARTED` · `STARTED` (branch created, reading done) · `IN PROGRESS` (code being written) · `COMPLETE` (Definition of Done in `00-MASTER-PLAN.md §10` met)

Update this table **and** the header of the module file whenever a status changes. Keep the history table append-only.

## Overview

| # | Module | Status | Branch | Started | Completed | Owner / assistant | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Foundation — auth, schema v2, wipe, Judge service, run/submit, rules, quotas | NOT STARTED | `module/01-foundation` | — | — | — | Step zero: `npm install`. D-01 (4 languages), D-02 (wipe all incl. subscriptions), D-04, D-05 are DECIDED — see DECISIONS.md. |
| 02 | AI Engine — model policy, verified generation, hints/editorial/review/chat/completion, pre-gen, cost telemetry | NOT STARTED | `module/02-ai-engine` | — | — | — | Blocked by 01. |
| 03 | Editor Workspace — LeetCode-parity problem page + AI extras | NOT STARTED | `module/03-workspace` | — | — | — | Blocked by 01, 02. |
| 04 | Practice Intelligence — mastery/SRS fixes, recommender v2, rating, streaks, leaderboard, achievements, daily, mock interview | NOT STARTED | `module/04-intelligence` | — | — | — | Blocked by 01, 02. Can run in parallel with 03. |
| 05 | Design System & Pages — tokens, motion/3D, landing, dashboard, explore, wizard, profile, leaderboard, settings, admin, final QA | NOT STARTED | `module/05-design-pages` | — | — | — | Blocked by 01–04. |

## Task roll-up (update counts when you tick tasks)

| Module | Total tasks | Done | Deferred | Pushed to `main` (SHA) |
|---|---|---|---|---|
| 01 | 27 | 0 | 0 | — |
| 02 | 23 | 0 | 0 | — |
| 03 | 35 | 0 | 0 | — |
| 04 | 25 | 0 | 0 | — |
| 05 | 29 | 0 | 0 | — |

The last task of every module is "Ship it": commit, merge the module branch into `main`, rebuild, push, and record the SHA above. A module is not `COMPLETE` until it is pushed.

## History (append-only)

| Date | Module | Event | By |
|---|---|---|---|
| 2026-09-07 | all | Plan authored; audit of v1 complete; OpenAI key validated; LeetCode UI surveyed | Claude (planning session) |
| 2026-09-07 | all | Owner decided D-01 (Java+Python+C+++JS), D-02 (wipe everything incl. subscriptions), D-04 (free tier default), D-05 (RapidAPI now, abstracted); Modules 01/02/03 updated accordingly | Avinash + Claude |
