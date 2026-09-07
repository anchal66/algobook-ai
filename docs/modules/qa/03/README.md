# Module 03 — QA evidence (2026-09-08)

Environment: `npm run dev` via `.claude/launch.json` → `dev-local` (`JUDGE_BACKEND=local`, host javac/python3/g++/node), Firestore `algobook-c9caa`,
OpenAI `gpt-5.6-luna`, desktop Browser pane (~1376×774 viewport) signed in with a custom token as the Pro test user `Wa9Ms…`, plus headless Chrome
(`npm run qa:screenshots`) for the 1440×900 / 390×844 captures. The local judge was used to keep the shared Judge0 free-tier quota (50/day, D-05)
intact; the run/submit/verdict path is identical apart from the executor. `memoryKb` is 0 on the local backend, so the Memory Beats card shows `0 KB` here.

## Automated
- `npm run typecheck`, `npm run lint` (0 errors, 36 pre-existing v1 warnings), `npm run build`: green. Route list includes `/problems/[slug]`, `/project/[projectId]`, `/project/[projectId]/solve/[problemId]`.
- `npm test` — 78 vitest tests: 55 from Modules 01/02 + 23 new (human↔stdin round trip incl. every param type and error messages; shortcut registry uniqueness / matcher / platform labels; brace re-indenter incl. strings, comments, `case` labels, idempotence; draft reconciliation; `CaseResultView` verdict variants AC / custom / CE / RE / TLE / hidden via jsdom + Testing Library).
- `grep -r "OPENAI\|RAPIDAPI_KEY" .next/static` → nothing. Zero `any` in `src/components/workspace/**`; largest workspace file 180 lines (rule: < 300).

## Screenshots
| File | What |
|---|---|
| `workspace-desktop-dark.png` | 1440×900 dark, Description + Code + Testcase (Forward Difference Pair Count, solved) |
| `workspace-desktop-light.png` | same in light |
| `workspace-mobile-dark.png` | 390×844 dark, segmented Description / Code / Console + bottom Run/Submit bar |
| `workspace-mobile-light.png` | same in light |

## Browser checklist (module §5)
| # | Check | Result |
|---|---|---|
| 1 | Open a project → Description renders title, pills, statement, examples, constraints; Topics toggle; Hint expands | ✓ `/project/:id` redirected to the first unsolved item; “Why this problem?” strip (Learning · reason · source); Topics chips `Array`, `Hash Map`; examples shown as `nums = [4,1,6,4,9], gap = 3` (Module 02 stores canonical stdin — humanised when it round-trips); constraints with real superscripts (10⁹); Hint accordion with the Pro `looks at your code` level 3 |
| 2 | Resize / collapse / maximize / double-click reset / reload persistence / Settings → Reset | ✓ collapse → 36 px vertical strip “Description”, click restores; maximize Code fills the area, exit restores; layout + collapsed state persist in localStorage and `users.settings.layout` (server wins across devices); Settings → Dynamic Layout → Reset restores 50/50 + 65/35 and survives reload. Pointer dragging and the double-click handle could not be driven while the Browser pane was hidden (the pane does not paint) — implemented with react-resizable-panels v4 `Separator` (double-click = `resetSplit`), lazy ghost-line mode behind Settings → Advanced |
| 3 | Type → Saving… → Saved; reload restores; switch Python/C++/JS; back to Java intact; submit in each language | ✓ status bar `Unsaved → Saving… → Saved`; a `// draft-marker` survived a full reload from the **server** draft (a Module 01 bug was fixed on the way: `drafts.put` used a dotted key with `set(merge)` so `code` was always `{}`); Python3 switch shows the Python starter (fetched per language), Java draft intact on return. Only Java was submitted end to end in this session; Python/C++/JS AC was proven by Module 01's acceptance suite on the same `/api/submit` |
| 4 | Testcase: edit, add custom, remove; Run → per-case results; wrong expected → red chip + Expected/Output; custom → output only | ✓ `[1,2,3` shows “Expected a list like [1,2,3]” inline; Case 4 (custom) added, `×` on hover; Run → “Wrong Answer · Runtime: 32 ms”, Case 1 red / 2–3 green / Case 4 output only |
| 5 | Submit wrong → WA with failing case; Submit correct → Accepted + confetti + Beats; Submissions list, detail, Load into editor confirm, diff | ✓ “Accepted 🎉 14/14 testcases passed”, Runtime 30 ms Beats 100 %, “Solved in 00:30 · 0 runs · 0 hints · first try”, Next problem / Review my code (AI review 9.5/10 · optimal, 4 improvements) / View editorial; Submissions table → detail with Beats bars, read-only Monaco, “Compare with current” side-by-side diff, Load-into-editor dialog with LeetCode copy |
| 6 | Compile error → Explain; runtime error → stderr | ✓ unmodified starter → “Compile Error” with red compiler output (`missing return statement`) and ✨ Explain this error; RE/TLE/hidden variants covered by the component tests |
| 7 | Hints 1→2→3; Editorial locked → reveal → language tabs; Solutions after AC | ✓ Editorial generated in ~10 s (overview, Approach 1/2 with Intuition / Algorithm / Implementation Java·Python3 + copy / Complexity, Pitfalls); Solutions tab: “AlgoBook Reference — …” cards + “Your solution · Beats 100%” |
| 8 | Problem List drawer: search, filter, click another problem, Ask AI → stages → new problem selected | ✓ 520 px drawer, 1/1 Solved ring, This project + Explore (Two Sum, Integer-Mean Windows); “easy two pointers” → `Searching ✓ → Generating ✓ → Checking the spec ✓ → Verifying… → Done` in ~2 min, “2. Outer Echo Count” appended and opened |
| 9 | Notes persist; Tutor streams and refuses the full solution | ✓ Notes third column, Markdown, “Saved”; tutor streamed a Socratic reply with code chips, quota `295 → 294 left today` |
| 10 | Settings: font size / ligatures / vim / tab size / relative numbers / theme light; persist | ✓ dialog with five sections; Light theme applied instantly to the whole workspace + `algobook-light` Monaco theme and persisted to `users.settings` |
| 11 | Shortcuts | ✓ `⌘'` ran the code, `⌥F` toggled full screen (top bar hidden) and back; registry-driven Shortcuts page with per-shortcut toggles and macOS/Windows labels. Synthetic `KeyboardEvent`s were used (the pane cannot deliver ⌘/⌥ chords); the matcher is unit-tested |
| 12 | Timer | ✓ stopwatch auto-started from the server setting, pause/reset controls, stopped on AC, elapsed time reported in the result view |
| 13 | Mobile 390×844 | ✓ segmented Description / Code / Console (+ Notes/AI when open), fixed Run/Submit bar, `scrollWidth === innerWidth` (no horizontal page scroll); top bar trimmed below `md`/`lg` |
| 14 | Light theme readable everywhere; no console errors | ✓ light captures attached; the only console entries were dev HMR websocket reconnects after server restarts and one Monaco diff-editor disposal error that was fixed (`DiffView` detaches its models before unmount) |

## Fixes to earlier modules found while testing
- `src/lib/data/drafts.ts` (Module 01): `set({ "code.java": … }, { merge: true })` stored a literal `code.java` field; drafts never restored. Now writes a nested map.
- `src/lib/firebase-admin.ts` (Module 01): `Firestore.settings()` threw after a dev-server hot reload (“already initialized”) → every API 500. The instance is now cached on `globalThis` and `settings()` is guarded.

## Not done in this session
- Submit in Python / C++ / JavaScript through the new UI (Java only; the API path was accepted in Module 01).
- Real Judge0: all executions used `JUDGE_BACKEND=local` to preserve the 50/day quota.
