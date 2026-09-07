# Module 01 — QA evidence (2026-09-07)

Environment: `npm run dev` (Next 16.3.4, Turbopack), Firestore project `algobook-c9caa`,
Judge0 CE via RapidAPI, dark theme, desktop Browser pane at 1440×900.

## Automated
- `npm test` — 18 vitest tests (checkers, quotas, stdin encoding, assembler, template parser): green.
- `npm run typecheck` (TypeScript 7.0.2), `npm run lint` (0 errors), `npm run build`: green.
- `npm run db:seed:sample` — Two Sum reference solutions verified on Judge0: Java 13/13, Python 13/13, C++ 13/13, JavaScript 13/13 (one batch per language).
- `npm run api:smoke -- --uidA … --uidB …` — 34/37 checks pass. The 3 failures require the owner to deploy
  `firestore.rules` + `firestore.indexes.json` (blocked for the assistant): `GET /api/submissions`,
  `GET /api/problems` (composite indexes) and client read of the public problem doc (rules v2).

## Browser checklist (module §6)
| # | Check | Result |
|---|---|---|
| 1 | Sign in → `users/{uid}` with username; `/api/me` plan | ✓ `rust_sage_636`, plan `free` (signed in with a custom token; Google popup cannot be automated) |
| 2 | `/dev/api-smoke` Run 3 samples + 1 custom in Java, Python, C++, JS | ✓ 4/4 AC each, custom output `[1,2]` |
| 3 | Submit correct / wrong / TLE / CE | ✓ "Accepted 13/13 · beats %", "Wrong Answer" with failed case #0 expected/actual, "Time Limit Exceeded", "Compile Error" with javac text |
| 4 | Network: every `/api` request has `Authorization: Bearer`, no `userId` in bodies | ✓ verified with an in-page fetch recorder (`/api/me`, `/api/run`) |
| 5 | Second account → `GET /api/projects/<other user's id>` → 404 | ✓ (api-smoke) |
| 6 | `problems/two-sum/private/tests` client read denied | ✓ 403 via Firestore REST with a real ID token |
| 7 | `/dashboard`, `/profile` load without runtime exceptions | ✓ (profile's submission history is empty until the `submissions(uid, createdAt)` index is deployed) |

Screenshots in this folder were captured with headless Chrome for the public pages
(`landing-*`, `login-*`) at 1440×900 and 390×844. Authenticated pages were verified live in the
Browser pane; capture them after signing in with Google once the rules/indexes are deployed.
