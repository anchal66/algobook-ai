# Module 05 — QA evidence (2026-09-08)

Environment: `npm run dev` via `.claude/launch.json` → `dev-local` (`JUDGE_BACKEND=local`), Firestore `algobook-c9caa`, OpenAI `gpt-5.6-luna`.
Desktop Browser pane (owner account, Pro) for interactive checks; headless Chrome through `npm run qa:screenshots` (puppeteer-core + axe-core 4)
signed in with custom tokens for the captures: `biu416…` (admin, Free plan — `@delta_craft_168`), a throwaway fresh account created with
`npm run qa:user -- --create` (`qa-fresh-…@algobook.test`, deleted again through the Settings → Danger zone flow), and logged-out for the marketing pages.

## Automated
- `npm run typecheck` clean · `npm run lint` **0 errors** (42 warnings, all pre-existing `set-state-in-effect`/unused-var warnings in Modules 01–04 code) · `npm test` **180 tests** (175 from Modules 01–04 + 5 new for the Explore filter model).
- `npm run build` — see "Build & performance" below.
- axe-core (WCAG 2.0/2.1 A+AA + best-practice) on every captured page — see "Accessibility".

## Screenshots (1440×900 and 390×844, dark and light)
| Set | Files |
|---|---|
| Signed-in app (`biu416`) | `dashboard-*`, `explore-*`, `profile-*`, `leaderboard-*`, `daily-*`, `interview-*`, `settings-*`, `admin-*`, `projects-new-*`, `problems-two-sum-*` (workspace regression) |
| Fresh account | `fresh/dashboard-*` (onboarding checklist), `fresh/explore-*`, `fresh/projects-new-*` |
| Logged out (full page) | `public/home-*` (landing incl. live demo, bento, how it works, comparison, pricing, FAQ), `public/login-*`, `public/about-*`, `public/contact-*`, `public/privacy-*` |
| Product shots used by the landing bento | `public/screens/workspace.webp`, `public/screens/profile.webp` (captured the same way, `--format webp`) |

None of the mobile captures reported a horizontal page scroll (the script prints `⚠ horizontal page scroll` when `scrollWidth > innerWidth`).

## Browser checklist (module §6)
| # | Check | Result |
|---|---|---|
| 1 | Landing: hero scene animates; reduced-motion disables it; demo Run returns output; pricing CTAs → login; footer links resolve | ✓ `HeroSceneLazy` renders the SVG fallback first and swaps in the R3F scene when WebGL/device gates pass (`data-hero-3d="on"`); `useReducedMotion` keeps the fallback. Live demo: starter → **Wrong Answer**, "Load the O(n) solution" → **Accepted** (JavaScript executed in a Web Worker against the 3 sample cases). Pricing CTAs go to `/login` / `/login?next=/settings#plan`; footer links are real routes (v1 `#` links fixed). JSON-LD `SoftwareApplication` + `FAQPage` emitted. |
| 2 | Login → dashboard: onboarding for a new account; wizard (template + custom) → project overview Plan tab shows insights | ✓ Fresh account sees the 3-step onboarding (`fresh/dashboard-*`). Custom project created through the 4-step wizard → redirected to `/project/:id?tab=plan` → "AlgoBook AI is building your plan…" → milestones (14/29/45), 5-week plan, difficulty mix 14/23/8, key topics, tip. Template cards show real counts and difficulty split (Amazon 651, Apple 336, …). |
| 3 | Dashboard cards update after solving | ✓ Cards read `/api/me/continue`, `/api/daily`, `/api/me` stats and `/api/activity`; the owner's account shows Daily "Solved ✓", streak 1, rating 1,246 → 1,420 across the two accounts, heatmap cell for today and 3 recommendations with reasons (`/api/problems/recommended`). Continue card fills after the first autosave (`users.lastOpened` written by `PUT /api/drafts/:id`). |
| 4 | Explore: filters, "Pick one for me", back navigation keeps filters | ✓ Catalog (8 verified problems in this project) filtered client-side; unit tests cover difficulty/status/topics/company/rating/search/sort and the URL round-trip; filters are written to the URL with `router.replace`, so Back returns with them intact. "Pick one for me" opens a random unsolved problem. |
| 5 | Profile: stat ring matches `/api/me`; badges; public URL without private data | ✓ Ring 7 / 16 solved matches `stats`; "Beats 50.0 %" from the leaderboard percentile; 3/45 and 5/45 badges; `/@username` renders the same view via the server-fetched public projection (no email, quotas, settings) and `?username=` variants of activity/skills/achievements; private profiles 404. Per-user OG image at `/[username]/opengraph-image`. |
| 6 | Leaderboard tabs; my rank card; pagination | ✓ Global (2 ranked: 129 / 87), Weekly, Cohorts (company select); podium; "Your rank 2nd of 2 · Top 50 %"; "Load more" appears when `nextCursor` is set. |
| 7 | Settings: theme/editor defaults reflected in the workspace; username availability; plan; delete account | ✓ Theme Light in Settings → `/problems/two-sum` opens light (flushed immediately to `users.settings.editor.theme`, then Dark restored). Editor defaults write the same store the workspace dialog uses. Username field: debounce + availability + remaining changes. Plan section shows "Pro · valid until 7 Sept 2027" for the Pro account and Free + upgrade cards for the admin account; invoices listed. **Delete account** on the fresh account: confirmation typed, `DELETE /api/me` removed the user doc, username lock and Auth user (verified: `db:find-uid` → "no user record"), signed out. |
| 8 | Admin: usage chart; pool coverage; retire a flagged problem → disappears from Explore | ✓ Usage $0.479 / 146 calls by purpose/model/day; coverage table (434 needed vs `PREGEN_POOL_MIN` 6); flagged queue empty in this project, so retire/restore was exercised through `PATCH /api/admin/problems/:id` — catalog total 8 → 7 → 8 (cache busted). Triggers wired to the snapshot/daily jobs. |
| 9 | ⌘K palette; keyboard navigation | ✓ ⌘K opens with focus in the input; "two" lists `#1 Two Sum`; Enter/arrow navigation; Escape closes. Tab order: skip link → rail (lg) → top bar → page; segmented controls use roving tabindex + arrow keys; Explore headers are sortable buttons. |
| 10 | Mobile 390×844 | ✓ Drawer nav, dashboard stacks, Explore table scrolls inside its container, workspace responsive mode intact (`problems-two-sum-mobile-*`). |
| 11 | Light theme every page; no console errors | ✓ Light captures for every page. Console: after the fixes (PageHeader `<p>` nesting, FAQ data module, screenshot probe) the only entries are dev HMR/Fast Refresh logs; remaining errors seen during the session were from stale bundles before the corresponding fix. |

## Accessibility (axe-core, dark theme, desktop + mobile)
Fixed during the pass: kbd/label contrast, locked-badge contrast, podium medal pills (dark text on gold/silver/bronze), Select triggers without names, Radix Tabs used without panels (`aria-controls` pointing nowhere → replaced by a `Segmented` radiogroup), `<h1>` per page, workspace tab lists (presentation wrappers, `extra` slot moved out of the tablist, add-case button outside the list), workspace icon-only buttons (Problem List / Notes / AI tutor names), workspace `<main>` landmark, `--ws-chip` alpha 0.10 → 0.08 for chip text contrast, focusable scroll regions and list markup on the landing/login.
Final result: **0 serious / 0 critical** on every captured page (dashboard, explore, profile, leaderboard, daily, interview, settings, admin, wizard, workspace, landing, login, about, contact, privacy — desktop + mobile). Remaining moderate items are `region`/`landmark` notes on the workspace page (Module 03 layout) — raw data in `axe.json` and `public/axe.json`.

## Build & performance
- `npm run build` green (Turbopack); `grep -r "OPENAI\|RAPIDAPI_KEY" .next/static` → nothing.
- 3D chunk (three.js + react-three-fiber, loaded only when the hero mounts and the device passes the gates): **234 KB gz** (budget 250). drei was removed entirely.
- Lighthouse 12 (`npm run qa:lighthouse`, Chrome headless, local `next start`, desktop preset + default mobile throttling — 4× CPU, slow 4G):

| Page | Desktop perf / a11y / bp / seo | Mobile perf / a11y / bp / seo | Desktop LCP | Mobile LCP |
|---|---|---|---|---|
| `/` landing | **97** / 100 / 100 / 100 | 74 / 100 / 100 / 100 | 1.3 s | 7.4 s |
| `/login` | 99 / 100 / 100 / 100 | **83** / 100 / 100 / 100 | 0.9 s | 4.4 s |
| `/dashboard` | **94** / 100 / 100 / 100 | 60 / 100 / 100 / 100 | 1.5 s | 8.2 s |
| `/explore` | 96 / 100 / 100 / 100 | 60 / 99 / 100 / 100 | 1.3 s | 7.4 s |
| `/profile` | 93 / 100 / 100 / 100 | 63 / 100 / 100 / 100 | 1.4 s | 7.4 s |

Targets (module §3): desktop ≥ 90 perf / ≥ 95 a11y / 100 bp / 100 SEO on landing and dashboard — **met**. Mobile ≥ 80 perf — **met on login only**; the landing (74) and the signed-in pages (60–63) miss it. Why: under 4× CPU throttling the ~950 KB of first-load JS (Firebase Auth + React + the shell) hydrates late, and the app pages render their content only after the Firebase auth handshake and the first `/api/*` responses, so LCP lands at 7–8 s. Done in this pass: client Firestore SDK removed from the bundle, hero text entrance moved from framer-motion to CSS so it paints before hydration, preconnects to the auth origins, per-page canonical/heading fixes (SEO 92 → 100). Next levers (owner follow-up): lazy-load the Firebase Auth SDK behind the auth gate, server-render the marketing hero without client components, split recharts/framer out of the dashboard's first load, and measure on the real host (Vercel edge caching, D-14) rather than a local `next start`. Per-page weak audits: `lighthouse-<page>-<form>.json`.

## Deviations / notes for the owner
- Rating history (`users.ratingHistory`) is recorded from this release onwards; profiles of users whose rated solves predate it show the "recorded from now on" empty state until their next rated solve.
- Notification preferences are stored (`users.settings.notifications`) but no email is sent yet — there is no notification service in v2.
- `POST /api/contact` stores messages in `contactMessages` (admin-readable in the Firestore console; no admin UI yet).
- The landing's live demo runs JavaScript in a Web Worker (no account, no judge quota); Java/Python/C++ need sign-in.
- Lighthouse numbers are from a local `next start` on this machine; production hosting (Vercel, D-14) with CDN caching will differ.
