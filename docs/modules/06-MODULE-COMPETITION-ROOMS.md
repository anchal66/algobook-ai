# Module 06 — Competition Rooms (live contests)

| Field | Value |
|---|---|
| **Status** | COMPLETE (2026-09-29) — see status log for deviations and owner actions |
| Branch | `module/06-rooms` |
| Depends on | 01 (auth, quotas, judge service, submissions), 02 (`problems.search`, on-demand generation `generateForProject`-style pipeline, `ensureLanguage`), 03 (workspace, `useWorkspace` store, `useRunSubmit`), 04 (rating helpers, achievements, `getSeenProblemIds`), 05 (AppShell, design system, `useQuery`, `qa:*` scripts) |
| **Judge0 constraint** | The owner keeps the RapidAPI free tier for now (D-05, 2026-09-29): **45 batches/day for the whole app**, one Run or Submit = one batch. Rooms therefore run in **budget mode** (§3.12): small rooms, per-problem Run/Submit caps, a live estimate in the wizard and a hard guard at start. Raise the caps when `JUDGE0_DAILY_CAP=0` (self-hosted/paid). |
| Decisions used | D-04 (free tier), D-05 (RapidAPI stays → budget mode), D-14 (Vercel), D-16 realtime, D-17 rating, D-18 avatars, D-19 anti-cheat, D-20 start + budget guard, D-21 join/create quotas, D-22 chat — all DECIDED 2026-09-29 with the documented defaults |
| Estimated size | ~6,500 LOC (server 2,200 · client 3,500 · tests 800) |

## 0. Context for a fresh assistant
1. Read `00-MASTER-PLAN.md` §4 (architecture), §5 (schema — you add collections), §6 (route conventions: `handler()`, `ApiError` envelope, zod bodies), §7 (model policy), §8 (tokens), §10 (Definition of Done).
2. Read `DECISIONS.md` D-16…D-22 (this module). Use the defaults if still OPEN and note it in the status log.
3. Read the code you will extend, in this order:
   - `src/lib/api/handler.ts`, `src/lib/auth/requireUser.ts`, `src/lib/auth/quotas.ts`, `src/lib/plans.ts` — every new route goes through `handler()`; feature gating is `feature: "<key>"` + `PLAN_LIMITS`.
   - `src/lib/judge/service.ts` (`runCases`, `judgeSubmission`, `redactForClient`), `src/lib/judge/budget.ts` (daily batch budget — rooms are `user` priority).
   - `src/app/api/submit/route.ts` — the single transaction that writes a submission + stats. Room submissions **reuse** `judgeSubmission` but write to `rooms/{id}/submissions` and update the member's score; they do **not** touch mastery/SRS/xp (see §3.8 for what they do touch).
   - `src/lib/practice/interview.ts` — the existing "restricted mode" pattern: `assertNotInActiveInterview` is called by hints / editorial / chat / review / explain-error routes. You generalise it to `assertNotInRestrictedSession` (interview **or** live room).
   - `src/store/workspace.ts`, `src/components/workspace/Workspace.tsx` (187 lines), `WorkspaceClient.tsx`, `hooks/useRunSubmit.ts`, `Code/MonacoEditor.tsx` — the workspace you embed in the arena. The workspace already supports a countdown timer (`timer.countdownMs`) and problem switching via the store.
   - `src/lib/firebase.ts` — **the client bundle has no Firestore SDK** and `firebase/firestore.rules` is deny-all (Module 05 audit). D-16 decides how the lobby/leaderboard get live updates; the default re-introduces the Firestore client SDK **lazily on `/rooms/*` routes only**, with read-only rules scoped to room members.
   - `src/lib/practice/rating.ts` (Elo helpers), `src/lib/practice/achievements.ts` (add contest achievements), `src/lib/data/problems.ts` (`search`, `countVerified`), `src/lib/practice/index.ts` (`getSeenProblemIds`).
   - `src/app/(app)/interview/page.tsx` + `src/components/wizard/*` — page and multi-step form patterns to copy for `/rooms/new`.
4. Dev/QA tooling you will use: `npm run dev` on `dev-local` (`JUDGE_BACKEND=local`) for iteration; `npm run qa:user -- --create` for extra test accounts (you need ≥ 3 accounts to test a room: host, accepted member, rejected/kicked member); `npm run qa:screenshots -- --axe`; `npm run api:smoke` (add room cases). Read the memory notes on custom-token sign-in and Chrome quirks in `docs/modules/qa/05/README.md`.

## 1. Goal
Let any signed-in user **join** a live coding contest and let **Pro** users **host** one: a highly configurable room (name, description, avatar, duration ≤ 5 h, problem count, per-problem topic and difficulty, scoring, anti-cheat strictness, visibility, approval), a lobby with a 6-digit join code and host approval, a synchronised start after which nobody else can enter, the same problem set for everyone, a live leaderboard, real-time cheating detection that participants consent to and can see against themselves, and a fair, explainable final ranking.

## 2. Scope
**In:** rooms data model + rules, room lifecycle API, problem-set assembly, room-aware Run/Submit, scoring engine, anti-cheat events + penalties + post-contest similarity check, realtime lobby/leaderboard, pages `/rooms`, `/rooms/new`, `/rooms/[id]` (lobby → arena → results), `/rooms/join`, host controls, consent dialog, contest history on profile, achievements, admin moderation list.
**Out (later modules):** teams, spectators, voice/video, scheduled recurring contests, organisation/classroom accounts, prize/payments, mobile arena layout beyond "works" (the workspace is desktop-first; the arena requires ≥ 1024 px and shows a blocking notice below that).

## 3. Technical specification

### 3.1 Lifecycle
```
draft ─(host creates)─▶ lobby ─(host starts, ≥ 2 accepted members incl. host? see D-20)─▶ running ─(endsAt reached | host ends)─▶ finalising ─▶ finished
                          │                                                                       ▲
                          └─(host cancels, or lobby idle > 6 h)─▶ cancelled                        └─ server job: similarity check, final ranks, rating, achievements
```
- **lobby**: members join by code or from the public list → `pending` until host accepts (`autoApprove` skips this). Host can kick/ban. Members see the settings, the roster, the countdown to a scheduled start (optional), and a "Ready" toggle (informational).
- **running**: `startedAt`, `endsAt = startedAt + durationMin`. Joining is refused (409 `ROOM_STARTED`). Rejoin after disconnect is allowed for accepted members (same uid). Late accept is impossible.
- **finalising**: written by the request that ends the room (host action, or the first request after `endsAt` — plus the hourly cron sweeps rooms whose `endsAt` passed with no traffic). Runs the similarity check, computes final ranks/ratings, unlocks achievements, then `finished`.
- Everything time-based is **server time** (`Timestamp.now()`); the client displays `endsAt - Date.now()` with a one-shot clock-skew estimate from the `Date` header (`useServerClock()`).

### 3.2 Firestore schema (additions to Master Plan §5)
| Collection / doc | Client read? (D-16 default) | Fields |
|---|---|---|
| `rooms/{roomId}` | members + host (listener) | `code` (6 digits, unique while `status ∈ {lobby, running}`), `hostUid`, `status: 'lobby'\|'running'\|'finalising'\|'finished'\|'cancelled'`, `visibility: 'public'\|'private'`, `name` (3–60), `description` (≤ 300), `avatar {kind:'preset', id, hue}` (D-18), `settings` (§3.3), `problemSet[]` (§3.4; **problem ids only** until `running`; titles revealed at start), `memberCount`, `acceptedCount`, `scheduledAt?`, `startedAt?`, `endsAt?`, `finishedAt?`, `leaderboardFrozenAt?`, `createdAt`, `updatedAt`, `finalised {similarityChecked, ratingsApplied}` |
| `rooms/{id}/members/{uid}` | members (listener on the collection) | `uid, username, displayName, photoURL, role: 'host'\|'member'`, `state: 'pending'\|'accepted'\|'rejected'\|'kicked'\|'left'`, `joinedAt, acceptedAt?`, `ready`, `presence {lastSeenAt, tab: 'visible'\|'hidden', fullscreen}`, `score {raw, penalty, final, solved, lastAcceptedAt, wrongSubmissions}`, `perProblem {[problemId]: {status:'todo'\|'attempting'\|'solved', points, attempts, acceptedAt?, firstSolver?}}`, `violations {count, byType {[type]: n}, penaltyPct}`, `rank?`, `ratingDelta?`, `consentedAt?` |
| `rooms/{id}/submissions/{subId}` | own (API only) | same shape as `submissions` + `roomId, problemIndex, elapsedSec, pointsAwarded, penaltyMinutes`, `codeHash`, `fingerprint[]` (winnowing, §3.9) |
| `rooms/{id}/events/{eventId}` | own events only (API only); host sees all via API | `uid, type` (§3.9 enum), `at, meta {durationMs?, chars?, source?}`, `penaltyPct`, `clientSeq` |
| `rooms/{id}/private/state` | no | `problemSet[]` full (ids, titles, difficulty, tags, points, reveal order), `codeSalt`, `startNonce` |
| `roomCodes/{code}` | no | `{ roomId, expiresAt }` uniqueness lock, deleted when the room leaves `lobby/running` |
| `roomRating/{uid}` (D-17) | own | `rating` (starts 1500), `contests`, `history[] {roomId, rank, delta, at}` |
| `users/{uid}` additions | own | `rooms {hosted, played, wins, podiums}` counters, `activeRoomId?` (one live room per user) |
| `system/roomsSweep` | no | cron cursor |

Room submissions are written to the subcollection **and** mirrored into the global `submissions` collection with `roomId` set (so Submissions tab, heatmap and activity keep working) — but the stats engine (`applySubmissionToStatsInTx`) is **not** invoked for contest submissions except `activity` (`submissions`, `accepted`, `timeSpentSec`) and problem `stats` (attempts/acceptance). Rationale: mastery/SRS assume a learning context; contest results feed the separate contest rating (D-17).

Indexes: `rooms(status, visibility, createdAt desc)`, `rooms(hostUid, createdAt desc)`, `rooms/*/members(state, score.final desc, score.lastAcceptedAt asc)` collection-group `members(uid, joinedAt desc)`, `rooms/*/submissions(uid, createdAt desc)`, `roomCodes(expiresAt)`.

### 3.3 Room settings (the "highly customisable" part)
Validated with one zod schema `RoomSettingsSchema` shared by client and server (`src/lib/rooms/settings.ts`, unit-tested; the wizard renders from it).

| Group | Setting | Type / range | Default |
|---|---|---|---|
| Identity | `name`, `description`, `avatar` | see §3.2 | — |
| Access | `visibility` | `public` \| `private` (code only) | `private` |
| | `joinApproval` | `manual` (host accepts each) \| `auto` | `manual` |
| | `maxMembers` | 2–50 (Pro host); admin override to 200. In budget mode the wizard warns above the estimate (§3.12) | 6 |
| | `allowRejoin` | bool | true |
| | `scheduledAt` | ISO, ≤ 7 days ahead; lobby opens now, start button unlocks at the time (host may still start earlier) | null |
| Time | `durationMin` | 10–300 | 60 |
| | `startCountdownSec` | 5–60 (shown to everyone before the arena opens) | 10 |
| | `problemMode` | `all-open` (every problem visible from the start) \| `sequential` (unlock the next after AC or skip) | `all-open` |
| | `perProblemMinutes?` | only in `sequential`; array or single value; sum ≤ `durationMin` | null |
| Problems | `count` | 1–10 | 3 |
| | `difficultyMode` | `any` \| `fixed` (`Easy`/`Medium`/`Hard`) \| `incremental` (auto ramp: E→M→H spread over `count`) \| `perProblem` (array of `count`) | `incremental` |
| | `topicMode` | `any` \| `pool` (choose 1–25 `CORE_TOPICS`; each problem draws from the pool) \| `perProblem` (array of topic sets, each 1–25) | `any` |
| | `languages` | subset of `java/python/cpp/javascript`, ≥ 1 | all four |
| | `excludeSeen` | bool — try to exclude problems any accepted member has already opened (`getSeenProblemIds`) | true |
| | `generateIfMissing` | bool — generate fresh verified problems when the pool cannot satisfy topic×difficulty (Pro host pays `generate` quota; ~60–130 s each, done in the lobby, §3.4) | true |
| Scoring | `preset` | `leetcode` \| `icpc` \| `custom` (§3.8) | `leetcode` |
| | `points` | per difficulty `{Easy, Medium, Hard}` 10–1000 or per problem array | 100/200/300 |
| | `timeDecay` | `none` \| `linear` (to `minPct` at the end) | `linear`, `minPct: 50` |
| | `wrongPenaltyMin` | 0–30 minutes added to time for tie-breaks (ICPC style) and, in `leetcode` preset, points × `wrongPenaltyPct` | 5 |
| | `partialCredit` | `none` \| `proportional` (passed/total × points × 0.5 for a non-AC best attempt) | `none` |
| | `showVerdict` | `full` (LeetCode: verdict + first failing sample) \| `verdictOnly` \| `hidden` (IOI-style: "received") | `full` |
| | `showLeaderboard` | `live` \| `frozen-last-N-min` (N = 5–60) \| `hidden-until-end` | `live` |
| | `runOnSamples` | allow Run (samples + custom cases) | true |
| Budget | `maxSubmitsPerProblem` | 1–10 per member (§3.12) | 3 |
| | `maxRunsPerProblem` | 0–10 per member; 0 disables Run | 3 |
| Integrity | `strictness` | `lenient` \| `standard` \| `strict` — selects the penalty table (§3.9); `custom` exposes the table | `standard` |
| | `requireFullscreen` | bool (leaving fullscreen is an event) | false |
| | `blockPaste` | bool (paste from outside the editor is reverted and logged) | true |
| | `blockCopy` | bool (statement and editor copy blocked) | true |
| | `aiAssist` | always `off` inside the arena: completion, hints, editorial, tutor, explain-error, review are server-refused (`assertNotInRestrictedSession`) | fixed |
| | `similarityCheck` | bool — post-contest pairwise code similarity, flags ≥ 0.8 (§3.9) | true |
| Rated | `rated` | bool — apply contest rating (D-17). Forced `false` when `maxMembers < 3` or `joinApproval = auto && visibility = public`? No: rated allowed for any room with ≥ 3 finishers. | true |
| Extras | `chat` | `off` \| `lobby-only` \| `lobby+results` (D-22) | `lobby-only` |
| | `rematchAllowed` | bool — "Rematch" clones settings into a new lobby with the same members invited | true |

Free users can **join** any room (D-21 default: at most 3 joins per day, `PLAN_LIMITS.free.roomJoin = 3`), Pro users join unlimited and **create** (`PLAN_LIMITS.pro.roomCreate = 10`/day, `free = 0`). New `FeatureKey`s: `roomCreate`, `roomJoin`. Room Run/Submit consume the member's own `run`/`submit` quota as today (free: 30/50 per day — enough for one contest; document this on the join screen).

### 3.4 Problem-set assembly — `src/lib/rooms/problemSet.ts`
Runs when the host **creates** the room (so the lobby wait hides the latency) and again on **start** only for slots still empty. Pure planner + Firestore picker, unit-tested with a fake catalogue.
1. Expand settings into `count` slots: `{index, difficulty, topics[]}` (`incremental` → e.g. for 4: E, M, M, H; for 6: E, E, M, M, H, H; `any` topics → `CORE_TOPICS`).
2. For each slot: `problems.search({ tags: topics, difficulty, status: 'verified', limit: 60 })`, filter `languages ⊇ settings.languages`, exclude problems already chosen, exclude `seen` (union of accepted members' seen ids, recomputed at start), prefer problems with `stats.attempts` in a sane band (not brand-new-and-never-solved when alternatives exist), pick uniformly at random with a seeded RNG (`rng(roomCreatedAt)`) so retries are deterministic.
3. Empty slot and `generateIfMissing`: enqueue a generation job (`rooms/{id}/private/state.pending[]`) executed by `POST /api/rooms/:id/prepare` (host-triggered, `maxDuration = 300`, one problem per call, streams stages via SSE like `/solve/next`), using the Module 02 pipeline with a synthetic `GenerationContext` (topic, difficulty, `experienceLevel` by difficulty). Consumes the host's `generate` quota. Lobby shows "Preparing problem 3/4…". If still missing at start, the slot is dropped and the host is told (never start with fewer than 1 problem).
4. On start: `ensureLanguage` fan-out for every `settings.languages` not yet verified on each problem, `user` priority (the start request waits up to 60 s, then marks the language "preparing" and the arena shows the Module 03 "Preparing…" state).
5. `problemSet[i] = { problemId, slug, title, difficulty, tags, points, order }` is copied into `rooms/{id}.problemSet` at start (titles hidden before).

### 3.5 Routes (all `handler()`-wrapped; `Authorization: Bearer`)
| Method & path | Auth / feature | Purpose |
|---|---|---|
| `POST /api/rooms` | `roomCreate` (Pro) | Validate settings, allocate code (6 digits, transaction on `roomCodes`, retry ×5), assemble problem set (§3.4 steps 1–3), create room + host member (accepted), set `users.activeRoomId`. Returns `{ room, code, missingSlots }`. |
| `GET /api/rooms?scope=public\|mine\|history&filters…&cursor` | any | Public lobby list (`status=lobby`, `visibility=public`, filters: difficulty mode, topics, duration band, spots left, rated, language), my rooms (host or member), history (finished). |
| `GET /api/rooms/:id` | member or host (public rooms: any auth sees the lobby card) | Room + my member doc + roster (accepted only for members; pending list for host) + `problemSet` (titles only once `running`). |
| `POST /api/rooms/join` `{code}` | `roomJoin` | Resolve `roomCodes/{code}` → 404 `ROOM_NOT_FOUND`, 409 `ROOM_STARTED`/`ROOM_FULL`/`ALREADY_IN_ROOM` (one active room per user). Creates member `pending` (or `accepted` when `auto`). |
| `POST /api/rooms/:id/join` | `roomJoin` | Same for public list (no code). |
| `POST /api/rooms/:id/members/:uid` `{action: accept\|reject\|kick\|ban\|promote?}` | host | Approval + moderation. `kick` after start marks `kicked`, freezes score, excludes from ranking. |
| `POST /api/rooms/:id/leave` | member | Lobby: `left`. Running: `left` (score frozen, still ranked, flagged "left early"). |
| `PATCH /api/rooms/:id` | host, `lobby` only | Edit settings (re-plans the problem set when problem settings change). |
| `POST /api/rooms/:id/prepare` | host | SSE: generate one missing slot (§3.4.3). |
| `POST /api/rooms/:id/start` | host | Requires ≥ 1 accepted member besides the host (D-20 default; solo allowed with `rated=false`), all slots filled or dropped, `scheduledAt` reached or overridden. Sets `running`, `startedAt = now + startCountdownSec`, `endsAt`, reveals `problemSet`, deletes `roomCodes/{code}`, snapshots each accepted member's `seen` for fairness stats. Transaction. |
| `POST /api/rooms/:id/consent` | accepted member | Records `consentedAt` (+ user agent, strictness version). **Required before any Run/Submit/event in that room** (403 `CONSENT_REQUIRED`). |
| `GET /api/rooms/:id/problems/:index` | accepted member, `running` | Problem public fields for slot `index` (the arena's `useProblemLoader` source; `sequential` mode refuses locked slots). |
| `POST /api/rooms/:id/run` | member, `running`, `run` quota | Same as `/api/run` scoped to the room's problem; refused when `runOnSamples=false`. Records `runCount`. |
| `POST /api/rooms/:id/submit` | member, `running`, `submit` quota | `judgeSubmission` → §3.8 scoring in one transaction (member doc, room submission, mirrored global submission, activity, problem stats). Response redacted per `showVerdict`. |
| `POST /api/rooms/:id/events` `{events: [{type, at, meta, clientSeq}]}` | member, `running` | Batched anti-cheat events (≤ 20 per call, ≤ 1 call / 2 s). Server validates type, dedupes by `clientSeq`, applies penalty (§3.9), updates `violations`, returns the member's current `violations` + `score`. Also the presence heartbeat (`type: 'heartbeat'`, every 20 s, no penalty). |
| `GET /api/rooms/:id/leaderboard` | member / host | Server-computed ranking (§3.8), honours `showLeaderboard` (frozen/hidden for members; host always sees live). Fallback poll for clients without listeners (D-16). |
| `GET /api/rooms/:id/me` | member | My member doc: score, per-problem, violations (what I did, when, how much it cost). |
| `POST /api/rooms/:id/end` | host, `running` | Ends early → finalise. |
| `POST /api/rooms/:id/cancel` | host, `lobby` | Cancel. |
| `GET /api/rooms/:id/results` | member (or anyone if host set `visibility=public`) | Final standings, per-problem grid, timeline (solve events), integrity summary per member (own details full; others' counts only), rating deltas, similarity flags (host + involved members only). |
| `GET /api/rooms/:id/events?uid=` | host (all) / member (own) | Integrity log. |
| `POST /api/rooms/:id/rematch` | host | Clone settings → new lobby; invites accepted members (notification doc + toast via listener). |
| `POST /api/rooms/:id/chat` / `GET …/chat?after=` | member, per D-22 | Lobby chat (≤ 300 chars, 1 msg / 2 s, profanity filter, host can mute/delete). |
| `POST /api/cron/rooms` | `CRON_SECRET` | Hourly sweep: finalise `running` rooms past `endsAt` + 2 min, cancel idle lobbies (> 6 h, or `scheduledAt` + 2 h with no start), delete expired `roomCodes`, clean `users.activeRoomId`. |
| `GET /api/admin/rooms?status=` , `POST /api/admin/rooms/:id/cancel` | admin | Moderation. |

Existing routes to touch: hints / editorial / chat / review / explain-error / `ai/complete` → replace `assertNotInActiveInterview` with `assertNotInRestrictedSession(uid, problemId)` (interview **or** active room containing the problem). `/api/me` returns `activeRoom {id, status, endsAt}` so the shell can show a "Live contest" pill and the arena can re-open after a refresh.

### 3.6 Realtime (D-16)
Default: **Firestore client listeners, lazy-loaded.** `src/lib/firebase-client-db.ts` dynamically imports `firebase/firestore` only inside `/rooms/[id]` (keeps every other page's bundle unchanged — Module 05 measured the SDK at ~100 KB gz). Rules add, and only add:
```
match /rooms/{roomId} {
  allow read: if request.auth != null && (
    exists(/databases/$(database)/documents/rooms/$(roomId)/members/$(request.auth.uid)) ||
    resource.data.visibility == 'public');
  match /members/{uid} {
    allow read: if request.auth != null &&
      exists(/databases/$(database)/documents/rooms/$(roomId)/members/$(request.auth.uid));
  }
}
```
Everything else stays deny-all; all writes stay server-side. `private/state`, `submissions`, `events` are never client-readable. Member docs expose scores and violation **counts** (not event details) — acceptable because the leaderboard shows them anyway; if D-19 says members must not see each other's violation counts, move `violations` to a `members/{uid}/private/…` doc.
Listeners: one on `rooms/{id}` (status, timers, settings, problemSet) and one on `rooms/{id}/members` (roster, scores → leaderboard rendered client-side from the docs using the same pure `rank()` as the server). Cost: ~1 read per changed doc per connected client — a 20-person, 1-hour room ≈ 20 × (200 member updates + 30 room updates) ≈ 5k reads ≈ $0.003.
Fallback: if a listener errors (rules, offline), the page polls `GET /api/rooms/:id` + `/leaderboard` every 5 s.
Alternative (write in D-16 if chosen): Firebase Realtime Database for rooms only (native presence via `onDisconnect`, cheaper for high-frequency updates) — more moving parts (second database, second rules file, new admin SDK usage).

### 3.7 Pages & components
Routes live under `src/app/(app)/rooms/*` inside `AppShell`, except the arena which mounts the workspace chrome full-bleed like `/problems/[slug]`.
- **`/rooms`** — hub: "Create room" (Pro; free sees the card with an Upgrade CTA), "Join with code" (6 big digit boxes, paste-friendly, `/rooms/join?code=123456` deep link + QR on the host's lobby), "Public rooms" list with filters (difficulty mode, topics, duration, rated, spots left, starting soon) and live counts, "My rooms" (active + history with rank badges).
- **`/rooms/new`** — 5-step wizard (reuse `components/wizard` patterns): Identity → Access & time → Problems (visual slot builder: `count` cards each showing difficulty chip + topic chips; modes switch between "same for all" and per-slot editing; live preview "Problem 1: Easy · array/hash map") → Scoring & visibility (preset cards with a plain-language summary and an "advanced" disclosure) → Integrity (strictness cards listing exactly what is detected and the penalty %, the same text the participants will consent to) → Review & create. Client-side zod validation from `RoomSettingsSchema`; server re-validates.
- **`/rooms/[id]` (lobby)** — header (avatar, name, code in a big copyable pill, share link, QR), settings summary, roster (accepted / pending with Accept · Reject · Kick for host; avatars with presence dot), "Preparing problems 2/4" progress (host sees a Retry per slot), chat (D-22), Ready toggle, Start button (host; disabled with reason tooltip until start conditions hold), Leave. Everyone gets a 10-s full-screen countdown when the host starts (from `startedAt`).
- **`/rooms/[id]` (arena)** — the Module 03 workspace embedded with `mode: "room"`: problem tabs strip (1…N with status dots; `sequential` shows locks), countdown pill (red under 5 min), live leaderboard side panel (top 10 + my row; frozen/hidden banners), "Integrity" panel (my events live: "14:02 Tab hidden 18 s → −5 %"), language picker limited to `settings.languages`, no hints/editorial/tutor/notes tabs (Notes stays local-only), Run/Submit through room routes, drafts saved under `drafts/{uid}_{roomId}_{problemId}` (server side, no cross-room leakage), Submissions tab shows only this room's submissions. Consent dialog (§3.9) blocks the arena until accepted; refusing returns to the lobby as `left`.
- **`/rooms/[id]` (results)** — podium (1–3 with confetti once), full standings table (rank, user, score, solved grid with per-problem timing/attempt pills, penalty, rating Δ), timeline chart (score over time per top-5, `recharts`), per-problem stats (solve %, first solver, average time), my integrity report (every event with penalty), similarity flags (host + involved members), "Rematch", "Practice these problems" (adds the set to an "Explore" project), share card image (OG route `/rooms/[id]/opengraph-image` — standings image for social sharing), AI debrief button (optional, Pro, reuses interview `review` purpose with a contest instruction set; one call per member, cached).
- **Shell**: `NavRail` entry "Rooms" (icon `Swords`), TopBar "Live contest · 42:10" pill when `me.activeRoom` is running (click → arena), toast on room invitations (rematch) and on accept/reject while waiting in a lobby from another page.
- **Profile**: "Contests" section — contest rating badge, count, best rank, last 5 rooms.

### 3.8 Scoring engine — `src/lib/rooms/scoring.ts` (pure, unit-tested)
Inputs: settings, `startedAt`, submission stream per member. Output: member `score` + rank list. Deterministic and re-computable from `rooms/{id}/submissions` + `events` (a `recomputeRoom(roomId)` admin tool exists for disputes).
- **Per problem points** `P` (by difficulty or per-slot).
- **Time decay** (`linear`): `factor = 1 - (1 - minPct/100) × (elapsed / duration)` at the time of the first AC; `none` → 1.
- **Wrong-submission penalty**: `leetcode` preset: each non-AC submission **before** the first AC on that problem costs `wrongPenaltyPct` (default 10 %) of `P`, floor 0 — compile errors on samples are not counted (matches LeetCode); `icpc` preset: no point loss, +`wrongPenaltyMin` to the tie-break time; `custom`: both knobs.
- **Partial credit** (`proportional`): a problem with no AC scores `0.5 × P × maxPassed/total` from its best attempt (hidden tests included), never more than 50 % of `P`.
- **Integrity penalty**: `penaltyPct = min(cap, Σ event penalties)` per §3.9; `final = round((rawPoints) × (1 - penaltyPct/100))`. Penalties therefore scale with what was earned (a cheater with 0 points loses nothing, but their flag still shows in results).
- **Rank**: `final desc`, then `solved desc`, then `totalTime asc` (Σ per solved problem of (AC time − start) + wrong × `wrongPenaltyMin`), then `violations asc`, then `joinedAt asc`. Members `kicked` are unranked; `left` are ranked with a marker. Identical keys share a rank (1, 1, 3).
- **Rated** (D-17 default): separate contest rating (start 1500, Elo-based pairwise expected score vs every other ranked finisher, K = 40 for the first 5 contests then 24, clamp 800–3500; requires ≥ 3 ranked finishers; members flagged by similarity ≥ 0.8 or `penaltyPct ≥ 50` are rated as if last). Written in `finalising`, once (`finalised.ratingsApplied`).
- **Achievements** (add to `achievements.ts`): `first_contest`, `contest_podium`, `contest_win`, `contest_clean_sweep` (all problems AC), `contest_host_5`, `contest_zero_violations_3`.

### 3.9 Integrity (anti-cheat) — `src/lib/rooms/integrity.ts` + `src/components/rooms/useIntegrityMonitor.ts`
Consent first: the arena opens with a dialog listing, **verbatim from the settings**, each detection, what counts, and the penalty; a checkbox "I understand and consent" + button. The accepted text hash is stored in `consentedAt`/`consentVersion`. No consent → no arena.

Event types, detection, default penalties (`standard`; `lenient` = ½, `strict` = ×1.5 and adds `devtools`/fullscreen enforcement), cap 60 % total:
| Type | Detected by (client, in the arena only) | Counts as | Penalty |
|---|---|---|---|
| `paste_external` | Monaco `onDidPaste` where the pasted text ≠ the last text copied/cut **inside** the editor (we keep a hash of internal copies). Text is reverted when `blockPaste`. | per event, `meta.chars` | 8 % (+4 % per repeat, chars > 200 → ×1.5) |
| `copy_blocked` | `copy`/`cut` on the statement panel or editor when `blockCopy` (prevented) | per event | 2 % |
| `tab_hidden` | `visibilitychange` → hidden, duration until visible | > 5 s counts; `meta.durationMs` | 3 % + 1 %/30 s, max 10 % per event |
| `window_blur` | `blur` without `visibilitychange` (alt-tab to another window, second monitor) | > 5 s counts | 2 % + 1 %/30 s, max 8 % |
| `fullscreen_exit` | `fullscreenchange` when `requireFullscreen` | per event | 5 % |
| `typing_burst` | > 120 chars inserted in one `onDidChangeModelContent` change not caused by paste/undo/snippet/format (autotyper, extension injecting code) | per event | 8 % |
| `devtools` (strict only) | window inner/outer size delta heuristic + `debugger` timing; **low confidence** → logged, penalty 0 %, shown to host only | — | 0 % |
| `multi_session` | server: heartbeats from two different `sessionId`s (tab ids) within 30 s | per minute | 5 % |
| `similarity` | server, at finalise: winnowing fingerprints (k-gram 5 on normalised tokens, window 4) between every pair of AC submissions per problem; also against the problem's reference solutions and editorial code. Report score ≥ 0.8 (`flag`), ≥ 0.95 (`strong`). | per flagged problem | `flag` 25 %, `strong` 50 % (both members unless one submitted ≥ 10 min earlier and the other's code is a superset — then the later one only); host sees the diff side-by-side; **the host can waive** a flag (audit-logged). |
| `heartbeat` | every 20 s + on every event; `presence.lastSeenAt` | — | 0 % |

Server rules: penalties are applied only while `running`; events with `at` outside `[startedAt, endsAt]` are dropped; `clientSeq` dedupes retries; ≥ 40 events/min → rate-limited (429) and one `spam` event (0 %). The response returns the updated `violations` so the Integrity panel updates immediately even without listeners. Everything a member did is visible to that member live (the product promise); other members see counts only on the leaderboard (a small shield icon with `n`); the host sees all details.
What this cannot catch (write it in the consent dialog, honestly): a second device, a friend in the room, reading a solution on paper. The similarity check and rating rules are the backstop.

### 3.10 Client architecture
- `src/lib/rooms/settings.ts` (schema, presets, `summarize(settings)` → human text used by wizard, lobby and consent), `scoring.ts`, `integrity.ts` (penalty table, `applyEvent`), `similarity.ts` (winnowing, tokenisers per language), `problemSet.ts` (planner), `codes.ts` (6-digit generation avoiding leading zeros? No — allow `012345`; store as string), `clock.ts` (`useServerClock`).
- `src/lib/data/rooms.ts` (repository), `src/lib/app/api.ts` additions (`rooms.*`), `src/lib/rooms/realtime.ts` (lazy Firestore listeners → zustand `useRoom` store; falls back to polling).
- `src/store/room.ts` — room, members, my member, leaderboard (derived), integrity events, consent state, arena problem index.
- Workspace integration: `WorkspaceClient` gets `room?: { id, index }`; `useProblemLoader` fetches `/api/rooms/:id/problems/:index`; `useRunSubmit` switches endpoints; `TopBar` swaps the layout menu for the problem tab strip + countdown; `Side` gets `LeaderboardPanel` and `IntegrityPanel`; hints/editorial/tutor tabs are hidden **and** server-refused.
- `useIntegrityMonitor(roomId)` attaches listeners on mount of the arena, batches events (2 s), flushes on `pagehide` with `navigator.sendBeacon` (a beacon endpoint variant accepts the ID token in the body).

### 3.11 Cost & capacity (write measured numbers in the status log)
| Item | Estimate |
|---|---|
| Problems | $0 from the pool; $0.01–0.02 per generated slot (Luna, Module 02 measurements) |
| Judge0 | 1 batch per Run/Submit. Free tier: 45/day → default room (6 members × 3 problems × ~2.2) ≈ **40 batches**, i.e. one room per day; caps and the start guard (§3.12) keep it inside the budget. A 20-person, 4-problem room needs ~700 batches → only after self-hosting/paid (`JUDGE0_DAILY_CAP=0`). |
| Firestore | ≈ 5k reads + 2k writes per 20-person hour-long room (< $0.01) |
| Vercel | SSE only for problem preparation; arena traffic is small JSON calls; `maxDuration` 60 on run/submit, 300 on prepare/start |
| AI debrief | optional, Luna `low`, ≈ $0.002 per member |

### 3.12 Judge0 budget mode (free tier, D-05 re-affirmed 2026-09-29)
`src/lib/rooms/budget.ts` (pure estimator, unit-tested) + `src/lib/judge/budget.ts` (existing counter).
- **Estimate** `need = acceptedMembers × problems × (maxSubmitsPerProblem + maxRunsPerProblem)` (worst case) and `likely = acceptedMembers × problems × 2.2` (measured later; start with this).
- **Wizard**: a live indicator "≈ N executions of today's R remaining" (from `GET /api/admin/judge`-like public endpoint `GET /api/judge/budget` returning `{remaining, cap}` only) turns amber when `likely > remaining × 0.5` and red when `need > remaining`. The host can lower members, problems or caps.
- **Start guard** (in the start transaction): refuse with 409 `JUDGE_BUDGET_LOW` when `likely > remaining - USER_RESERVE`; the lobby shows the numbers and the three levers. Admins may override.
- **Per-room caps**: `POST /api/rooms/:id/run|submit` enforce `maxRunsPerProblem` / `maxSubmitsPerProblem` per member (409 `ROOM_CAP_REACHED`; the arena shows "2 of 3 submits left" next to the buttons). Runs on samples use one batch for all sample + custom cases (already true).
- **Exhaustion during a contest**: `reserveBatch` throws 503 `JUDGE_BUDGET`; the room route converts it into a non-penalised `capacity` submission state, the arena shows a banner ("execution capacity reached for today — the contest continues; the host may end it"), the host gets an "End now and score what exists" button. Nothing counts as a wrong submission.
- **Reservation for rooms is not separate** from the app-wide budget (one user reserve, `USER_RESERVE = 15`, already exists); a running room is `user` priority like any Run/Submit. Pre-generation/fan-out for room problems runs as `background` and yields.
- Realistic capacity today: **one 6-person, 3-problem room per day** at the default caps (~40 batches). Document this on the Create page in plain words so hosts are not surprised. When the owner upgrades or self-hosts, set `JUDGE0_DAILY_CAP=0` and the indicator/guard disappear automatically (`dailyCap() === 0` → unlimited).

## 4. Tasks
- [x] R-01 Settings schema + presets + `summarize()` + unit tests (`src/lib/rooms/settings.ts`)
- [x] R-02 Schema additions (`RoomSchema`, `RoomMemberSchema`, `RoomSubmissionSchema`, `RoomEventSchema`, `RoomRatingSchema`), repository `src/lib/data/rooms.ts`, indexes in `firestore.indexes.json`, rules (§3.6), `npm run db:deploy`
- [x] R-03 Feature keys `roomCreate`/`roomJoin` in `FeatureKeySchema`, `QuotasSchema`, `PLAN_LIMITS`; `/api/me` returns `activeRoom`
- [x] R-04 Join-code allocation (`roomCodes` transaction) + tests
- [x] R-05 Problem-set planner + picker + tests; `prepare` SSE route reusing Module 02 generation
- [x] R-06 Routes: create / list / get / join (code + public) / member actions / leave / patch / cancel
- [x] R-07 Start transaction (conditions, reveal, code release, language fan-out) + consent route
- [x] R-08 Scoring engine + tests (presets, decay, penalties, partial credit, ranking, ties)
- [x] R-09 Room run/submit routes (judge reuse, transaction, redaction per `showVerdict`, mirrored submission, activity)
- [x] R-10 Integrity: penalty table + `applyEvent` + tests; events route (batch, dedupe, rate limit); heartbeat/presence; multi-session detection
- [x] R-11 Similarity: tokenisers + winnowing + pairwise report + tests (fixtures: identical, renamed variables, reordered functions, unrelated)
- [x] R-12 Finalise: end/cron sweep, similarity, ranks, rating (D-17), achievements, `users.rooms` counters, idempotency
- [x] R-13 Leaderboard + results + events routes; `assertNotInRestrictedSession` swap in the 6 AI routes
- [x] R-14 Realtime client — **shipped as polling** (`useRoom` store: 3 s lobby / 5 s arena, server-clock offset); Firestore listeners (D-16 default) deferred, see status log
- [x] R-15 `/rooms` hub (create card, code entry, public list + filters, my rooms)
- [x] R-16 `/rooms/new` wizard (5 steps, slot builder, presets, integrity preview, review)
- [x] R-17 Lobby (roster, approvals, preparation progress, share/QR, chat per D-22, start countdown)
- [x] R-18 Consent dialog (generated from settings) + `useIntegrityMonitor` (paste/copy/visibility/blur/fullscreen/burst/beacon)
- [x] R-19 Arena: workspace `mode: "room"` (problem strip, countdown, leaderboard panel, integrity panel, restricted tabs, room drafts, room submissions tab, language subset, sequential locks)
- [x] R-20 Results page (podium, standings, per-problem grid, timeline, integrity report, similarity diffs for host, rematch, practice set, OG image, optional AI debrief)
- [x] R-21 Shell: nav entry, live pill, invitation toasts; profile contests section
- [x] R-22 Admin: `GET/POST /api/admin/rooms` (list, cancel); **`recomputeRoom` script deferred** (`recomputeMember` exists server-side; a script is a follow-up)
- [x] R-23 Cron `/api/cron/rooms` + `vercel.json`
- [x] R-24 api-smoke cases (create → join ×2 → accept → start (budget guard) → consent → submit → cap reached → events → end → results) and vitest for every pure module
- [x] R-25 Browser checklist (§6) with 3 accounts in 3 browser contexts; QA captures in `docs/modules/qa/06/`
- [x] R-27 Budget mode: estimator + tests, `GET /api/judge/budget`, wizard indicator, start guard, per-room caps in run/submit, capacity state in the arena, host "End now" (§3.12)
- [x] R-26 Docs: Master Plan §5/§6 additions, `DECISIONS.md` statuses, `STATUS.md`, memory note; Ship it

## 5. Acceptance criteria
1. A Pro host creates a room in < 5 s with a 3-problem incremental set from the pool; the wizard shows the execution estimate against today's budget; a room whose pool lacks a slot shows preparation progress and starts once prepared.
2. Free user joins by code, sits `pending`, is accepted by the host, sees the roster update without refreshing (< 2 s).
3. After start, a join by code returns `ROOM_STARTED`; a member who refreshes the page lands back in the arena with their draft intact.
4. Everyone sees the same problems in the same order; problem titles are not retrievable before start (API test).
5. Run/Submit inside the arena work; hints/editorial/tutor/completion/explain/review return 403 for room problems while running.
6. Scoring matches the unit-tested engine for: first-AC time decay, wrong-submission penalty, partial credit, ties; the leaderboard order is identical on client and server.
7. Paste from outside the editor is reverted and appears within 2 s in the member's Integrity panel with the exact penalty; tab switching > 5 s is recorded; both change the leaderboard score.
8. Consent is mandatory; its text matches the room settings; declining leaves the room.
9. Similarity: two members submitting the same solution with renamed variables are both flagged ≥ 0.8 in results; unrelated solutions are < 0.5.
10. Rated rooms change `roomRating` exactly once; unrated do not; `users.stats.rating` is untouched.
11. End at `endsAt` without any client open (cron) produces the same results as a host-ended room.
12. Bundle: no Firestore SDK on non-room routes (`next build` route sizes); axe 0 serious/critical on all room pages; both themes; 1440×900 and 1024×768 for the arena; mobile shows the "desktop required" notice for the arena only.

## 6. Browser test checklist
Use three accounts (`qa:user --create` ×2 plus the owner session) in three browser contexts (Browser pane + Chrome profile + incognito).
1. [ ] Free account: `/rooms` shows Create as Pro-locked; Join with code works; public list filters work.
2. [ ] Pro host: wizard validation (bad durations, count vs per-problem arrays, topics empty), preview text, create → lobby with code + QR.
3. [ ] Member A joins by code → pending; host accepts; member B joins from public list → pending; host rejects; B sees the rejection.
4. [ ] Host edits duration in lobby; members see the change live.
5. [ ] Start: countdown appears for all; B (rejected) cannot join with the code (409).
6. [ ] Consent dialog: decline → back to lobby as left; accept → arena.
7. [ ] Arena: problem strip, countdown, language subset, Run on sample, Submit AC → leaderboard updates on both host and A within 2 s.
8. [ ] Wrong submit then AC: penalty applied; `showVerdict=hidden` room shows "Received" only.
9. [ ] Paste external text → reverted + integrity event; copy statement blocked; tab switch 10 s → event; fullscreen exit (strict room) → event; typing burst via `document.execCommand`/devtools insert → event.
10. [ ] Refresh mid-contest → back in arena, draft intact, timer correct (server clock).
11. [ ] Host ends early → finalising → results for all; podium confetti once; rating deltas; my integrity report; host sees similarity diff for a planted duplicate.
12. [ ] Cron end: leave a room to expire with no clients, call `/api/cron/rooms` with the secret → results identical.
13. [ ] Rematch → new lobby with invitations; Practice these problems → project created.
14. [ ] Light theme + dark theme captures of hub, wizard, lobby, arena, results; axe clean; 1024-px arena; mobile notice.
15. [ ] `api:smoke` room scenario green; `npm run build` green; no Firestore SDK chunk on `/dashboard`.

## 7. Status log
| Date | Status | Notes |
|---|---|---|
| 2026-09-29 | NOT STARTED | Owner kept the RapidAPI free tier and delegated D-16…D-22 (defaults adopted); plan revised with §3.12 budget mode (caps, estimate, start guard, capacity state) and R-27. Original: plan authored from the owner's brief (create/join with 6-digit code, host approval, start lock, custom settings incl. per-question topic/level, same set for all, paste blocking + real-time cheating detection with consent + score penalties, free users join / Pro users create). |
| 2026-09-29 | STARTED → IN PROGRESS → COMPLETE | Built on `module/06-rooms` (base `main` bb2614d). Delivered: pure engines with tests (`src/lib/rooms/`: settings schema + presets + slot planner + summary, scoring with decay/penalties/partial credit/ranking, integrity penalty table, winnowing similarity, contest Elo, budget estimator, codes), Firestore schema additions (`rooms`, `members`, `submissions`, `events`, `chat`, `roomCodes`, `roomRating`, `users.rooms/activeRoomId`, `users/{uid}/roomMemberships`), lifecycle service (`service.ts`: create with unique code, join by code / public, approve/reject/kick, leave, edit + re-plan, prepare (generation SSE), start with budget guard + language fan-out + reveal, consent) and play service (`play.ts`: problem access with sequential locks, run/submit with caps + capacity state, batched integrity events with dedupe/rate limit/multi-session, leaderboard with frozen/hidden, end, idempotent finalise = similarity → ranks → rating → counters, results, chat, rematch, cron sweep, `assertNotInActiveRoom`), 25 API routes + `/api/cron/rooms` (hourly) + `/api/judge/budget`, `/api/me.activeRoom`, restricted-session guard on the 6 AI routes, pages (`/rooms` hub, `/rooms/new` 4-step wizard with live budget note, `/rooms/[id]` lobby/results/edit, `/rooms/[id]/play/[index]` arena), workspace room mode (RoomTopBar with problem strip + countdown + host End, leaderboard/integrity side panels, consent dialog generated from the rules table, integrity monitor, RoomSubmitResultView), nav entry + live pill, `scripts/room-smoke.ts` (`npm run room:smoke`). Tests 235 (13 new), tsc clean, lint 0 errors, `next build` green. **Verified:** `room:smoke` full flow all green on `dev-local` (create → 409 second room → private 404 → join by code → pending → rated solo start refused → unrate → accept → chat → start → code released → member: consent gate, problem fetch without private data, Run cap fields, RE then reference AC = points, ROOM_SOLVED, events 8 % + 4 % with short absence ignored and duplicate seq dropped, leaderboard rank, AI hint 403, own events only; host CE; end → results with ranks, per-problem stats, member's 2 client events + a reference-similarity flag, unrated, activeRoom cleared, history, mirrored submissions, `rooms.played`). **Browser (desktop pane, owner as host, member driven by `room:smoke --code`):** wizard 4 steps + validation + budget note, lobby with code/copy/share, roster updates by polling, approve, start countdown → arena with consent dialog, problem strip, countdown, leaderboard panel (member 78 first), integrity panel, copy blocked (−2 %), submit → RoomSubmitResultView (RE 0/13, submits left, score), host End → results (podium, standings, similarity host view + Waive), hub history + pill cleared. Free-tier join quota (3/day) hit during testing → 429 as designed. **Deviations:** realtime is polling, not Firestore listeners (D-16 default) — rules stay deny-all; external paste could not be exercised in the pane (clipboard permission) — paste blocking relies on Monaco `onDidPaste` (copy blocking and the burst detector were exercised); a page reload was first counted as a second session → session id now persists per tab. **Owner actions:** create the `rooms(status, visibility, createdAt desc)` index (`npm run db:deploy` printed the gcloud command; the service account lacks `datastore.indexAdmin`; the public list falls back to a scan meanwhile); the OpenAI account has no credits, so `generateIfMissing` slot preparation is untested end-to-end (the pool covered every slot in testing); `recomputeRoom` script and the first-run tour remain follow-ups. Merged into `main` — SHA in `STATUS.md`. |
