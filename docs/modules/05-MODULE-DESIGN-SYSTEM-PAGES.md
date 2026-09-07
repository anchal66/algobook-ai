# Module 05 — Design System, Motion/3D, App Pages & Final QA

| Field | Value |
|---|---|
| **Status** | STARTED |
| Branch | `module/05-design-pages` |
| Depends on | 01–04 (APIs), 03 (workspace look must be consistent with the shell) |
| Unblocks | Launch |
| Decisions used | D-06, D-08, D-09, D-12, D-13 |
| Estimated size | ~7,000 LOC |

## 0. Context for a fresh assistant
1. Read `00-MASTER-PLAN.md` §2, §8 (tokens — you own them now), §6 (routes), §10.
2. Read v1 pages to understand current content and copy: `src/app/page.tsx` (landing), `login/page.tsx`, `dashboard/page.tsx`, `projects/new/page.tsx`, `project/[projectId]/insights/page.tsx`, `profile/page.tsx`, `profile/edit/page.tsx`, `[username]/_client.tsx`, `leaderboard/page.tsx`, `settings/page.tsx`, `about/contact/privacy/terms`, `components/SubmissionHeatmap.tsx`, `components/UserMenu.tsx`, `components/TopicSelector.tsx`, `components/ActivitySheet.tsx`.
3. Load the `artifact-design`/`dataviz` skills if available for palette validation; charts use the difficulty/brand colors from §8 and must pass contrast in both themes.
4. The brief from the owner: *"currently it's totally looking like AI generated UI… full of animations, 3D high quality designs and graphics wherever required to attract maximum users… website should look very beautiful… more advanced than LeetCode."* Concretely that means: a distinctive brand (not default shadcn indigo-on-zinc), purposeful motion (staggered reveals, magnetic buttons, animated numbers, page transitions), one hero 3D scene, real product screenshots/embedded live demo instead of icon cards, dense information design on data pages (LeetCode's profile/problemset density), and zero placeholder content.

## 1. Design system — `src/components/design/*`, `src/app/globals.css`, `tailwind` theme
- **Tokens** (Master Plan §8) as CSS variables with `@theme` mapping; semantic aliases `--surface-0..3`, `--text-1..3`, `--brand`, `--brand-2`, `--diff-easy/medium/hard`, `--ok`, `--err`, `--warn`. Dark is default; `.light` class switches (keep `next-themes`, `attribute="class"`).
- **Typography**: Inter (variable) + JetBrains Mono via `next/font`; heading scale with tight tracking; numbers `tabular-nums`.
- **Primitives** (shadcn, restyled): Button (variants: brand gradient, secondary, ghost, outline, destructive; sizes; loading state; icon), Card (flat + "glow" variant with gradient border on hover), Badge/Chip (difficulty, topic, status), Tabs (LeetCode underline style), Dialog/Sheet/Drawer, Select/Combobox, Switch, Tooltip, Skeleton, Progress, Avatar, DataTable (sortable, sticky header, virtualized when > 200 rows), EmptyState, Toast (sonner), CommandPalette (`cmdk`, `⌘K`: go to problem/project/page, run actions).
- **Motion kit** (`framer-motion`): `<Reveal>` (in-view fade/slide with stagger), `<AnimatedNumber>`, `<Magnetic>` (buttons), `<TiltCard>` (subtle 3D tilt on hover), `<PageTransition>` (route-level, 200 ms), `<Shimmer>`; global `prefers-reduced-motion` guard; no animation longer than 600 ms in-app.
- **3D** (`@react-three/fiber`, `@react-three/drei`, D-09): `HeroScene` — a slowly rotating wireframe "knowledge graph" of glowing nodes (topics) with orbiting code glyphs, brand-colored, reacting subtly to pointer; lazy-loaded, `<Suspense>` fallback to a static WebP; disabled on low-power/mobile (renders the WebP). Second use: login left panel (same scene, smaller). Bundle budget for 3D chunk ≤ 250 KB gz.
- **Charts** (`recharts`): StatRing (Easy/Med/Hard solved ring like LeetCode profile), SkillRadar (topic mastery), RatingLine, ActivityHeatmap (port + polish: month labels aligned, tooltips, streak highlight), DifficultyBars, BeatsHistogram.
- **Iconography**: lucide; brand logo mark (new SVG: a bracket-shaped "A" with a gradient node), favicon set, OG image generator (`app/opengraph-image.tsx`).
- **Layout shell** for `(app)`: left nav rail (icons + labels on hover; Dashboard, Explore, Daily, Projects, Leaderboard, Interview, Profile, Settings; Admin when `isAdmin`), top bar (search/⌘K, streak flame, XP/level pill, plan pill, avatar menu), content container max 1280. Marketing pages use a transparent top nav + footer.

## 2. Pages (routes, content, behaviors)

### 2.1 Landing `/` (marketing)
Sections: (1) Hero: headline "Practice like it's the real interview." sub-copy, CTA "Start free", secondary "See a problem", `HeroScene` on the right, trust row (stack logos of companies from templates), live stat counters (problems verified, solves today — from `leaderboard/meta`). (2) **Live demo**: an embedded read-only mini-workspace (real `Workspace` components in demo mode with a bundled sample problem; Run works against `/api/run` with a public demo token or is simulated) — this is the strongest "not AI-generated" signal. (3) Feature bento grid with real screenshots: AI-verified problems, LeetCode-parity editor, hints/editorial/tutor, mastery + SRS, company templates, rating & leaderboard, daily challenge, mock interview. (4) How it works (3 steps with animated illustrations). (5) Comparison table vs LeetCode (columns: personalized generation, verified harness, AI tutor, spaced repetition, price). (6) Pricing (Free / Pro monthly ₹499 / Pro yearly ₹4,999, manual renewal copy, feature matrix from `PLAN_LIMITS`). (7) FAQ accordion. (8) Footer with legal links (fix v1 `#` links). SEO metadata, structured data (`SoftwareApplication`), OG image.

### 2.2 Login `/login`
Split layout; left: small `HeroScene` + 3 value props; right: Google button (+ GitHub if enabled later), legal links; post-login redirect to `next` param; error states (popup blocked → redirect flow).

### 2.3 Dashboard `/dashboard`
Grid: top row — **Continue** card (last open problem with resume button and timer), **Daily challenge** card (difficulty, solved state, countdown to reset), **Streak & XP** card (flame, freezes, level progress ring), **Rating** card (sparkline). Second row — Projects (cards with StatRing progress vs `insights`, on-track indicator, template badge, menu: open/insights/delete) + "New project" tile. Third row — Activity heatmap (year) and "Recommended next" (3 problems from `recommend()` with reasons). Empty states for new users with a 3-step onboarding checklist (create project → solve first → set goal). All data from `/api/me`, `/api/projects`, `/api/daily`, `/api/activity`, `/api/problems/recommended`.

### 2.4 Explore `/explore` (D-06)
LeetCode problemset parity: filter bar (difficulty, status Solved/Attempting/Todo, topics multi-select, companies, rating range, search), sort, table (Status ✓ / Title `#num` / Difficulty / Acceptance % / Rating / Topics), pagination cursor, "Pick one for me" (random unsolved), topic chips row with counts. Clicking opens `/problems/[slug]`.

### 2.5 New project `/projects/new`
Multi-step wizard with progress: (1) Template or custom (company cards with counts and difficulty split, "Custom"), (2) Goal & experience (cards), (3) Focus topics + duration slider + weekly hours, (4) Review → creates project, seeds template pool, requests insights (streamed), redirects to `/project/[id]`. Keep validations from v1.

### 2.6 Project overview `/project/[id]`
Header (title, purpose, duration progress, on-track pill), tabs: **Solve** (redirects to next unsolved in the workspace), **Plan** (insights: totals, milestones timeline, weekly plan, key topics), **Problems** (table of items with status/attempts/best time/hints), **Activity** (day-wise timesheet from `activity` — port of `ActivitySheet`), **Settings** (rename, topics, delete with confirm). Replaces v1 `insights/page.tsx` and `history/page.tsx`.

### 2.7 Profile `/profile` and public `/[username]`
LeetCode profile parity: left column (avatar, name, @username, rank, bio, company/college/location, links, skills chips, Edit button); right column: StatRing (solved by difficulty with "Beats" vs users), Badges grid (achievements with locked/unlocked states and dates), Rating chart, Skill radar + "Skills" list by mastery (Advanced/Intermediate/Fundamental groups like LeetCode), Activity heatmap with year selector, Recent AC list with links. Public page hides email/quotas; share button copies URL; OG image per user.

### 2.8 Profile edit `/profile/edit`
Port v1 form (bio, company, college, location, GitHub/LinkedIn, skills combobox, username change with availability check and remaining changes), styled.

### 2.9 Leaderboard `/leaderboard`
Tabs: Global · Weekly · Template cohorts (select company). Podium (top 3 with avatars), my rank card (rank, percentile, score breakdown tooltip), table (rank, user, score, solved, streak, rating, mastery), pagination. Free users see the page (D-04) but blurred beyond top 10 with upgrade prompt if the owner wants — default: visible to all.

### 2.10 Daily `/daily`, Interview `/interview`
Daily: today's problem card + past 30 days calendar with solved marks + "Solve" opens workspace. Interview: start card (duration, difficulty), history of past sessions with scores; session runs in the workspace's interview mode (Module 03/04).

### 2.11 Settings `/settings`
Sections: Account (name, email, username link), Plan & billing (status, valid until, renew buttons, invoice list from `subscriptions`), Appearance (theme), Editor defaults (mirror of workspace settings), Notifications (daily reminder email toggle — store preference only), Privacy (public profile toggle), Danger zone (delete account: deletes user docs via admin route, keeps subscriptions ledger).

### 2.12 Admin `/admin` (D-12)
AI usage (cost by day/purpose/model, charts), pool coverage heat table (topic × difficulty counts vs `POOL_MIN`), flagged problems queue (view, retire/restore, regenerate), pre-generation trigger with live status, leaderboard snapshot trigger. Guarded by `isAdmin`.

### 2.13 Marketing/legal
About, Contact (form → `mailto`/simple API that stores in `contactMessages`), Privacy, Terms — restyled; correct links from footer and user menu.

### 2.14 System pages
`not-found.tsx`, `error.tsx` (with retry), `loading.tsx` skeletons per route group, offline toast, maintenance flag (`MAINTENANCE=1` env shows a page).

## 3. Cross-cutting
- **Performance**: route-level code splitting; Monaco/3D dynamic; images via `next/image`; Lighthouse ≥ 90 perf/95 a11y/100 best-practices/100 SEO on landing and dashboard (desktop), ≥ 80 perf mobile.
- **Accessibility**: WCAG AA contrast in both themes (verify tokens), focus-visible rings, skip link, ARIA for nav/tabs/dialogs, keyboard navigation for tables and command palette.
- **Analytics**: GA4 events for signup, project_create, first_solve, upgrade_click, checkout_start.
- **PWA-lite**: manifest + icons so "Add to home screen" works (no offline caching of API).
- **Copy**: no "GPT-4" anywhere; model names not exposed to users ("AlgoBook AI").

## 4. Tasks
- [ ] U-01 Tokens + `globals.css` + Tailwind theme + light/dark verification page `/dev/tokens` (admin).
- [ ] U-02 Fonts, logo mark, favicon set, OG image route.
- [ ] U-03 Restyled primitives (Button, Card, Chip, Tabs, Dialog, Sheet, Select, Switch, Tooltip, Skeleton, Progress, Avatar, EmptyState, Toast).
- [ ] U-04 DataTable (sortable, sticky, virtualized) + pagination pattern.
- [ ] U-05 Motion kit components + reduced-motion guard + page transitions.
- [ ] U-06 `HeroScene` (R3F) with WebP fallback and device gating; bundle budget check.
- [ ] U-07 Charts: StatRing, SkillRadar, RatingLine, ActivityHeatmap (port + polish), DifficultyBars, BeatsHistogram.
- [ ] U-08 App shell: nav rail, top bar (⌘K, streak, XP, plan, avatar menu), responsive drawer nav.
- [ ] U-09 Command palette (`cmdk`) with problem/project/page search and actions.
- [ ] U-10 Landing page (all 8 sections) incl. live demo embed and comparison table; SEO/structured data.
- [ ] U-11 Login page.
- [ ] U-12 Dashboard (all cards, empty states, onboarding checklist) + `GET /api/problems/recommended` (3 picks via Module 04 `recommend()`).
- [ ] U-13 Explore page (filters, table, random pick) on `GET /api/problems`.
- [ ] U-14 New project wizard.
- [ ] U-15 Project overview (Plan/Problems/Activity/Settings tabs); delete v1 insights/history pages.
- [ ] U-16 Profile + public profile + edit; per-user OG image.
- [ ] U-17 Leaderboard page (global/weekly/cohort).
- [ ] U-18 Daily page; Interview page (start/history) — interview page only if Module 04 P-18 shipped.
- [ ] U-19 Settings page (all sections; delete account route `DELETE /api/me` in this module).
- [ ] U-20 Admin console (usage, pool coverage, flagged queue, triggers).
- [ ] U-21 Marketing/legal pages restyle + contact form.
- [ ] U-22 System pages (404/error/loading/offline/maintenance).
- [ ] U-23 GA4 events; manifest/PWA-lite.
- [ ] U-24 Accessibility pass (axe DevTools clean on every page) and keyboard navigation pass.
- [ ] U-25 Performance pass (Lighthouse numbers recorded in status log; fix regressions).
- [ ] U-26 Remove every v1 page/component that is no longer referenced (`dashboard/page.tsx`, `ActivitySheet`, `TopicSelector` if replaced, etc.); `grep` for dead imports; `npm run build` clean.
- [ ] U-27 **Final regression**: run every module's browser checklist (01–05) end to end on a fresh account and a pro account, both themes, desktop + mobile; screenshots to `docs/modules/qa/05/`.
- [ ] U-28 Update README (features, screenshots), `STATUS.md` all COMPLETE, tag `v2.0.0`.
- [ ] U-29 **Ship it.** All tasks ticked, Lighthouse and axe targets met, `npm run build` green, the full regression (U-27) passed on a fresh account and a Pro account in both themes on desktop and mobile → commit, merge `module/05-design-pages` into `main`, rebuild, `git push origin main`, push the `v2.0.0` tag, and record the commit SHA (Master Plan §10 step 7).

## 5. Acceptance criteria
- A first-time visitor sees the 3D hero within 1.5 s (fallback image instantly) and can run the demo problem without signing in.
- Dashboard for a new user renders onboarding; for an active user renders continue/daily/streak/rating/projects/heatmap/recommendations from real APIs with no client-side Firestore aggregation.
- Explore lists ≥ 1,000 problems without jank (virtualized) and filters respond < 150 ms.
- Profile matches LeetCode's density (stat ring, badges, skills groups, heatmap) and public profile hides private data.
- Both themes pass AA contrast on all pages; axe reports 0 critical issues; Lighthouse targets in §3 met.
- Zero dead v1 files; `npm run build` clean; `STATUS.md` fully COMPLETE.

## 6. Browser test checklist
1. Landing: hero scene animates; reduced-motion disables it; demo Run returns output; pricing CTAs go to login/checkout; all footer links resolve.
2. Login → dashboard: onboarding checklist for a new account; create a project via the wizard (template + custom) → project overview Plan tab shows insights streaming in.
3. Dashboard cards update after solving a problem (continue, daily, streak, heatmap, recommendations).
4. Explore: filter Hard + topic "graph" + status Todo → table updates; "Pick one for me" opens the workspace; back navigation keeps filters (URL params).
5. Profile: stat ring numbers match `/api/me`; badges show newly unlocked; public URL works in an incognito window without private data.
6. Leaderboard tabs; my rank card; pagination.
7. Settings: change theme/editor defaults → reflected in the workspace; username change with availability; plan section shows correct status; delete account flow (test account) works.
8. Admin: usage chart shows today's spend; pool coverage table; retire a flagged problem → it disappears from Explore.
9. `⌘K` palette: jump to a problem/project/page; keyboard-only navigation across the nav rail and tables.
10. Mobile 390×844: nav drawer, dashboard stacks, explore table scrolls horizontally inside its container, workspace responsive mode from Module 03 still works.
11. Light theme walkthrough of every page; no console errors anywhere; Lighthouse run recorded.

## 7. Status log
- 2026-09-07 — Module specified. NOT STARTED.
- 2026-09-08 — NOT STARTED → STARTED on `module/05-design-pages` (Claude Fable 5.1), branched from `main` 3882407 with Modules 01–04 merged. Context read: Master Plan §2/§6/§8/§10, DECISIONS (D-06/D-08/D-09/D-12/D-13 defaults apply), Module 03/04 status logs and their open items (attendance UI remnants, bookmarks/👍 server field, `/api/submit` response fields).
