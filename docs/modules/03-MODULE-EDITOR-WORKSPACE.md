# Module 03 — Editor Workspace: LeetCode-Parity Problem Page (+ AI Extras)

| Field | Value |
|---|---|
| **Status** | NOT STARTED |
| Branch | `module/03-workspace` |
| Depends on | 01 (auth, `/api/run`, `/api/submit`, drafts, notes, submissions), 02 (next-problem stream, hints, editorial, review, explain-error, chat, completion) |
| Unblocks | 05 (final QA), 04 UI hooks (rating/streak badges) |
| Decisions used | D-01, D-04, D-07, D-10, D-15 |
| Estimated size | ~6,000 LOC (replaces the 2,094-line `editor/page.tsx`) |

## 0. Context for a fresh assistant
1. Read `00-MASTER-PLAN.md` §2 (target), §3.2 (C3, C4, C6, C15), §6 (routes), §8 (design tokens — implement them in `globals.css` if Module 05 has not yet).
2. The v1 page to replace: `src/app/project/[projectId]/editor/page.tsx`. Port from it: the Monaco theme `algobook-dark` (rename `algobook-dark`/add `algobook-light`), the Java keyword/type/snippet completion lists, the keyboard shortcut registration approach, the report-issue modal reasons.
3. Reference for the look: LeetCode's problem page (`https://leetcode.com/problems/two-sum/`). The survey below was taken on 2026-09-07 at 1556×784 in dark mode. **Open the real page in the browser while building; match spacing, colors and behaviors, not just structure.**
4. Libraries already present: `@monaco-editor/react`, `react-resizable-panels` v4, `framer-motion`, `react-markdown` + `remark-gfm`, `lucide-react`, shadcn `tabs/tooltip/dropdown/dialog/sheet`. Add: `zustand`, `canvas-confetti`, `monaco-vim`, `monaco-emacs`, `react-hotkeys-hook`, `@radix-ui/react-select`, `@radix-ui/react-switch`, `@radix-ui/react-popover`, `remark-math` + `rehype-katex` (constraints like `10^4` render as superscripts), `sonner` (toasts).

## 1. LeetCode reference survey (what "exactly like LeetCode" means)

### 1.1 Top bar (48 px, `bg-1`, border-bottom)
Left: logo mark · `☰ Problem List` (opens left drawer) · `‹` prev · `›` next · `⤮` shuffle/random.
Center (floating pill group): `🐞 Debug` · `▶ Run` · `☁ Submit` (green text) · `📝 Notes` (opens right notes panel) · `✨ AI` (opens AI tutor panel).
Right: `⊞ Layout` (reset/choose layout) · `⚙ Settings` (modal) · `⏱ Timer` (stopwatch pill; click to start; shows elapsed) · streak flame + count · avatar · `Premium/Upgrade` pill.

### 1.2 Panels (dynamic layout)
- Two columns by default: **left group** (tabs `📄 Description | 📖 Editorial | 🧪 Solutions | 🕘 Submissions`) and **right column** split vertically into **Code** (top) and **Testcase | Test Result** (bottom).
- Every panel has a header row (36 px): tab strip on the left, and on hover the right side shows `⛶ Maximize` and `⌄/‹ Collapse` icons. Collapsed panels shrink to a 36 px strip (vertical text/icon for horizontal collapse, header row only for vertical collapse). Clicking the strip or the header restores.
- Drag handles: 8 px hit area, 2 px visible line, turns accent-blue on hover/drag; **double-click resets that split**. Resizing is real-time (content reflows) — matches LeetCode "Real-time resizing" (Advanced setting can disable it, then show a ghost line and apply on release).
- Layout (sizes + collapsed state + which tab is active) persists in `localStorage` and in `users.settings.layout` (debounced). Settings → Dynamic Layout → **Reset** restores default 50/50 and 65/35.
- Full screen (`⌥F`) hides the app chrome and uses the whole viewport; `Esc` exits. Maximize panel (`⌥+`) toggles the focused panel to 100%.
- Panels themselves are 8 px-radius cards with 1 px border on a `bg-0` page background, 8 px gutter (LeetCode look).

### 1.3 Description tab
- `1. Two Sum` (number = `problems.number`), then pill row: difficulty pill (Easy teal / Medium amber / Hard red, `bg-2`), `🏷 Topics` (toggles tag chips), `🏢 Companies` (chips from `companies[]`, hidden when empty), `💡 Hint` (expands the hint accordion inline). 
- Statement markdown: inline code chips (`bg-2`, mono 13 px), bold/italic as in LeetCode, `10^4` superscript.
- Examples: heading `Example 1:` then a block with 4 px left border and `bg-2` background containing monospace `Input: nums = [2,7,11,15], target = 9` / `Output: [0,1]` / `Explanation: …`.
- `Constraints:` bullet list with code chips. `Follow-up:` paragraph when present.
- Footer bar (sticky bottom of the panel): 👍 count · 👎 · 💬 · ⭐ (bookmark) · ↗ share · ❓ feedback → ours: like/dislike (stored per user, feeds problem quality), bookmark (`users.bookmarks[]`), share link, **Report issue** (v1 modal).
- Our additions above the title (collapsible "Why this problem?" strip): practice-state badge, recommendation reason, template progress — port of v1 `PracticeStateBadge`, `ReasonBadge`, `TemplateProgressBadge`, restyled as one compact row.

### 1.4 Editorial tab (ours = AI editorial)
Header row: `📖 Editorial` title, "AlgoBook AI · generated <date>" byline. Sections per approach: `Approach N: <title>` → **Intuition** → **Algorithm** (numbered steps) → **Implementation** (code block with language tabs Java/Python, copy button) → **Complexity Analysis** (Time/Space). Then **Pitfalls**. Locked state (free plan or not yet unlocked): blurred preview + "Reveal editorial (affects mastery)" / "Upgrade to Pro" CTA per D-10.

### 1.5 Solutions tab (ours)
Search box + chip filters (language, topic) + sort. Cards: "AlgoBook Reference — Java", "AlgoBook Reference — Python" (visible after AC or reveal), and the user's own accepted submissions ("Your solution · Beats 92%"). Clicking opens the code in a read-only Monaco with "Load into editor" (confirm dialog: *"Your code will be discarded and replaced with this code!"* Cancel/Confirm — exact LeetCode copy).

### 1.6 Submissions tab
Table: Status (Accepted green / Wrong Answer red / Runtime Error / Compile Error / Time Limit Exceeded) + relative time under it · Language · Runtime (`12 ms`) · Memory (`44.3 MB`) · Notes icon. Row click → detail view inside the tab: verdict header with runtime **Beats X%** and memory **Beats Y%** distribution bars, first failed case (Input / Output / Expected / Stderr), full code (read-only Monaco), "Load into editor" and "Compare with current" (diff view using Monaco diff editor).

### 1.7 Code panel
Header: `</> Code` label · language dropdown (`Java ▾` listing Java, Python3, C++, JavaScript per D-01; languages not yet in `problems.languages` show a spinner "Preparing…" and call `/api/problems/:id/languages`, which awaits the in-flight driver generation) · `• Auto` (autosave indicator; grey dot = saved, amber = saving) · right icons: `🔖 bookmark`, `{}` format, `↺` reset (confirm dialog "Your current code will be discarded and reset to the default code!"), `⤢` fullscreen.
Monaco options: font family/size/ligatures/tab size/word wrap/relative line numbers/key binding (Standard/Vim/Emacs) from settings; theme `algobook-dark`/`algobook-light`; bracket colorization; `formatOnPaste`; Java/Python snippets provider (port list); word-based suggestions; **AI inline completion** provider (ghost text) when `settings.editor.aiCompletion` is on (600 ms debounce, cancels on keystroke, `Tab` accepts) — the "advanced code completion".
Status bar: `Saved` / `Saving…` / `Unsaved` on the left, `Ln 1, Col 1` on the right (exactly LeetCode).
Autosave: draft in `localStorage` immediately, `PUT /api/drafts/:problemId` debounced 2 s; on load, prefer the newer of local/server; starter used when neither exists; language switch keeps per-language drafts.

### 1.8 Testcase / Test Result panel
- Tabs: `✅ Testcase` · `▶ Test Result`. Header hover shows maximize/collapse.
- Testcase: chip row `Case 1` `Case 2` `Case 3` `+` (max 6 custom; custom chips show `×` on hover; LeetCode copy). Body: for each `params[i]`, a label `nums =` then an editable textarea-style box (`bg-2`, mono) with the **human value** (`[2,7,11,15]`); we convert human ↔ canonical stdin via `lib/judge/encoding.ts` (`toHuman(params, stdin)` / `fromHuman(params, values)`); invalid input shows inline red text. Cases are pre-filled from `sampleTests`.
- Test Result (after Run): while running → skeleton with "Running…" shimmer. Then verdict line `Accepted` (green, 18 px, semibold) + `Runtime: 3 ms` — or `Wrong Answer` (red) / `Runtime Error` / `Compile Error` / `Time Limit Exceeded`. Chip row per case with a green/red dot. Body: `Input` (per param), `Output`, `Expected` (omitted for custom cases), `Stdout` (only if non-empty and different), `Stderr` block red for RE, compiler output for CE with **"✨ Explain this error"** button (AI). Custom cases show output only.
- After **Submit**: the Test Result panel switches to a **Submission result** view: `Accepted 🎉` with confetti (canvas-confetti, 1.2 s, reduced-motion safe), `Runtime 3 ms · Beats 91.2%` and `Memory 44.1 MB · Beats 63.0%` cards with distribution bars, "Solved in 12:34 · 2 runs · 1 hint" line, buttons **Next problem** (accent, triggers `/api/projects/:id/next`) · **Review my code (AI)** · **View editorial**. Wrong answer view shows `passed 7/13`, the failing case, and "Ask AI tutor" shortcut. Everything comes from `/api/submit` response.
- Bottom action bar (below the panel, LeetCode places Run/Submit in the top bar; **Settings → Dynamic Layout → "Show Run / Submit buttons in: Toolbar | Code Editor"** switches between the two placements — implement both).

### 1.9 Settings modal (⚙) — sidebar `Dynamic Layout | Code Editor | Shortcuts | Advanced | Timer`
- Dynamic Layout: `Default layout [Reset]`; `Show Run / Submit / Debug buttons in` (Toolbar / Code Editor picker with thumbnails).
- Code Editor: Font (Default/JetBrains Mono/Fira Code/Source Code Pro), Font size (12–20 px), Font ligatures toggle, Key binding (Standard/Vim/Emacs), Tab size (2/4 spaces), Word wrap toggle, Relative line number toggle. **Ours:** Theme (Dark/Light/System), AI inline completion toggle, Minimap toggle.
- Shortcuts: General — Run code `⌘'` (toggle), Submit `⌘↵` (toggle), Close tab `⌥W`, Maximize/Exit Maximize Panel `⌥+`, Enter/Exit Full Screen `⌥F`; Debug — Start Debugging `⌘⌥'`, Stop `Esc`, Step over `F10`, Step into `F11`, Continue `F8`. **Ours:** Format `⇧⌥F`, Next problem `⌥N`, Previous `⌥P`, Toggle description `⌥1`, Toggle console `⌥2`, Focus editor `⌥3`, Command palette `⌘K`. Windows/Linux equivalents shown by platform.
- Advanced: Real-time resizing toggle; Open multiple instances in new tab (Lab) toggle; Save custom layout (cloud) — ours: always on for pro, local-only for free.
- Timer: default mode (Stopwatch / Countdown 25 min), auto-start on problem open, show in toolbar.
- All settings persist to `users.settings` via `PATCH /api/me/settings` (debounced) and hydrate on load; guests/free use localStorage.

### 1.10 Problem List drawer (☰)
Slide-in from the left (width 520 px), header `Problem List ›` with `○ 3/12 Solved` ring, close ×. Search box, sort (`⇅`), filter (`⚗`: difficulty, status, topic). Rows: `12. Title` left, difficulty text right in difficulty color; solved rows show ✓; current row highlighted; alternating row background. Sections: **This project** (project items in order) and **Explore** (verified pool, paginated, D-06). Footer: "✨ Ask AI for a specific problem" input (this is where v1's prompt box moves) → calls `/api/projects/:id/next` with `userPrompt` and shows the stage stream inline.

### 1.11 Notes panel (📝) and AI tutor panel (✨)
Both open as a third column on the right (resizable, closable). Notes: markdown editor (textarea + preview toggle) saved to `notes/{uid}_{problemId}`. AI tutor: chat with streaming replies, quick actions (`Give me a hint`, `Explain my error`, `Is my approach right?`, `Review my code`), quota indicator, and a "scoped to this problem" note.

### 1.12 Generation experience ("Next" when the project has no next item)
Full-panel state in the Description panel: animated orb + stage list (`Searching curated pool…` → `Generating with AI…` → `Verifying test cases on the judge…` → `Repairing…` (if it happens) → `Done`), each with a check mark when passed, driven by the SSE stream from Module 02. Estimated time line ("usually 15–40 s"). On failure: friendly card with retry.

### 1.13 Responsive
< 1024 px: single column with a top segmented control `Description | Code | Console`; Run/Submit fixed at the bottom; panels not resizable; drawer becomes full-screen sheet. Must be usable on a 390 px phone (code editor scrolls horizontally).

## 2. Architecture

```
src/app/(app)/problems/[slug]/page.tsx            ← server: fetch problem public doc; render <Workspace/>
src/app/(app)/project/[projectId]/solve/[problemId]/page.tsx → same Workspace with project context
src/components/workspace/
  Workspace.tsx                 layout root; providers; hotkeys; SSE hooks
  TopBar/ (TopBar, RunSubmitCluster, TimerPill, StreakPill, LayoutMenu)
  Layout/ (PanelGroupRoot, Panel, PanelHeader, PanelTabs, CollapsedStrip, ResizeHandle, useLayoutPersistence)
  Description/ (DescriptionTab, ProblemHeader, StatementMarkdown, ExampleBlock, ConstraintsList, TopicsRow, HintsAccordion, WhyThisProblem, DescriptionFooter, ReportIssueDialog)
  Editorial/ (EditorialTab, ApproachSection, LockedEditorial)
  Solutions/ (SolutionsTab, SolutionCard, LoadIntoEditorDialog)
  Submissions/ (SubmissionsTab, SubmissionRow, SubmissionDetail, BeatsBar, DiffView)
  Code/ (CodePanel, CodeHeader, LanguageSelect, MonacoEditor, editorThemes.ts, javaSnippets.ts, pythonSnippets.ts, useInlineCompletion.ts, useVimEmacs.ts, StatusBar)
  Console/ (ConsolePanel, TestcaseTab, CaseChips, ParamInput, TestResultTab, CaseResultView, SubmissionResultView, ExplainErrorButton)
  Drawer/ (ProblemListDrawer, ProblemRow, AskAiForm, GenerationStages)
  Side/ (NotesPanel, TutorChatPanel, QuickActions)
  Settings/ (SettingsDialog, DynamicLayoutSettings, CodeEditorSettings, ShortcutsSettings, AdvancedSettings, TimerSettings)
  Overlays/ (AcceptedConfetti, GeneratingOverlay, ConfirmDialog)
src/store/workspace.ts   zustand: problem, language, code (per lang), drafts status, cases, runResult, submitResult, activeTabs, panelState, timer, hints, editorialUnlocked, chat
src/store/settings.ts    zustand + persistence (localStorage + /api/me/settings)
src/lib/editor/           monaco setup, themes, keymaps, shortcuts registry (single source for the Shortcuts settings page)
src/lib/judge/encoding.ts (shared with server: human ↔ stdin)
```
Rules: no component > 300 lines; all Monaco types imported from `monaco-editor` (no `any`); all server calls via `apiFetch`; every async action has loading/error/empty state; keyboard shortcuts registered in one registry and rendered from it in Settings.

## 3. Tasks
- [ ] W-01 Design tokens in `globals.css` (Master Plan §8) if absent; Monaco themes dark/light; fonts (Inter, JetBrains Mono via `next/font`).
- [ ] W-02 `store/workspace.ts`, `store/settings.ts` (+ persistence & hydration from `/api/me`).
- [ ] W-03 Layout system: PanelGroupRoot with persisted sizes, collapse strips, maximize, double-click reset, real-time toggle, fullscreen.
- [ ] W-04 TopBar with prev/next/shuffle (project order; shuffle = random unsolved), Run/Submit cluster (both placements), timer pill (stopwatch/countdown), streak pill, layout menu, settings trigger.
- [ ] W-05 Description tab (all of §1.3) incl. markdown pipeline (remark-gfm, remark-math/rehype-katex, code chips), examples, constraints, topics/companies/hint toggles, footer actions, report dialog.
- [ ] W-06 "Why this problem?" strip (practice state, reason, template progress).
- [ ] W-07 Code panel: Monaco + options from settings, language select with "Add language (AI)", format/reset/fullscreen/bookmark, status bar, autosave (local + server), per-language drafts.
- [ ] W-08 Snippets/completions for Java + Python; Vim/Emacs key bindings.
- [ ] W-09 AI inline completion provider (ghost text, debounce, cancel, Tab accept, setting-gated, quota errors silent).
- [ ] W-10 Testcase tab: sample cases, add/remove custom cases, per-param human inputs with validation, encoding round-trip.
- [ ] W-11 Run flow → `/api/run` → Test Result tab (all verdict variants, per-case chips, stdout/stderr, Explain-error button).
- [ ] W-12 Submit flow → `/api/submit` → Submission result view (Accepted with confetti + Beats bars, WA/RE/CE/TLE variants, meta: time, runs, hints, editorialViewed) + Next problem CTA.
- [ ] W-13 Submissions tab: list, detail, Beats bars, load into editor (confirm dialog), diff vs current.
- [ ] W-14 Editorial tab with lock/unlock states and language tabs; records `editorialViewed`.
- [ ] W-15 Solutions tab (reference solutions + own accepted) with load-into-editor.
- [ ] W-16 Hints accordion (levels 1–3; level 3 sends code; plan gating UI) and `hintsUsed` tracking.
- [ ] W-17 Problem List drawer: project items + Explore (paginated), search/sort/filter, solved ring, Ask-AI form with stage stream.
- [ ] W-18 Generation overlay/stages in the Description panel for "Next" with no queued item; retry; error states.
- [ ] W-19 Notes side panel (markdown, autosave).
- [ ] W-20 AI tutor side panel (SSE streaming, quick actions, quota display, scope note).
- [ ] W-21 Settings dialog: all five sections in §1.9, persisted server-side.
- [ ] W-22 Shortcut registry + `react-hotkeys-hook` bindings + platform-aware labels; toggles for Run/Submit shortcuts.
- [ ] W-23 Timer: stopwatch/countdown, auto-start option, persists per problem session, contributes `timeSpentSec` on submit.
- [ ] W-24 Session health (port `lib/session-tracker.ts`) as a subtle indicator in the top bar with tooltip and break suggestion toast.
- [ ] W-25 Confirm dialogs (reset code, load solution) with exact LeetCode copy; toasts via sonner.
- [ ] W-26 Responsive layout (< 1024 px segmented control; mobile bottom action bar).
- [ ] W-27 Light theme pass for every component; `prefers-reduced-motion` pass.
- [ ] W-28 Accessibility: focus rings, ARIA roles for tabs/dialogs, keyboard-only navigation of the panel tabs and drawer.
- [ ] W-29 Route wiring: `/problems/[slug]` (Explore) and `/project/[id]/solve/[problemId]`; `/project/[id]` redirects to the first unsolved item; delete v1 `editor/page.tsx`, `history/page.tsx` (history now lives in Submissions tab + profile), `AttendanceModal.tsx` (D-07).
- [ ] W-30 Loading skeletons for every panel; error boundaries per panel (one broken panel must not blank the page).
- [ ] W-31 Performance: Monaco loaded via dynamic import with a skeleton; problem page LCP < 2.5 s on a warm cache; no layout shift when panels hydrate (read persisted sizes before first paint).
- [ ] W-32 Analytics events (GA4): run, submit(verdict), hint(level), editorial_view, chat_msg, completion_accept.
- [ ] W-33 Unit tests: encoding round-trip, layout reducer, shortcut registry; component tests for CaseResultView verdict variants.
- [ ] W-34 QA screenshots in `docs/modules/qa/03/` (dark/light, desktop/mobile, every verdict state).
- [ ] W-35 **Ship it.** All tasks ticked, `npm run build` green, the full 14-step browser checklist (§5) passed in dark and light on desktop and mobile with zero console errors, `STATUS.md` and status log updated → commit, merge `module/03-workspace` into `main`, rebuild, `git push origin main`, record the commit SHA (Master Plan §10 step 7).

## 4. Acceptance criteria
- Side-by-side with `leetcode.com/problems/two-sum` at 1440×900: same panel arrangement, header heights (36/48 px), tab strip style, difficulty colors, example block style, testcase chips, result typography; a reviewer unfamiliar with the code cannot tell which is which at a glance (except branding).
- Dragging, collapsing, maximizing, double-click reset and fullscreen all work with no jank; layout survives reload.
- Run with 3 sample + 1 custom case returns and renders in < 4 s (Judge0 latency aside); Submit shows the Accepted view with Beats % and confetti; Next problem loads the next queued item or streams generation stages.
- Autosave: type, reload → code restored; switch language → separate drafts kept.
- Settings changes apply live (font size, vim mode, relative line numbers) and persist across devices (server settings).
- All shortcuts in the Shortcuts page work and can be toggled; `⌘'` runs, `⌘↵` submits.
- Zero `any` in `src/components/workspace/**`; each file < 300 lines; `npm run build` clean.

## 5. Browser test checklist
1. Open a project with 3 items → Description renders title/number, pills, statement, examples, constraints; Topics toggle shows chips; Hint expands hint 1.
2. Resize left/right split, collapse Description (strip appears with vertical label), restore; maximize Code; double-click handle resets; reload → layout persisted; Settings → Reset restores default.
3. Type code → status bar `Saving…` → `Saved`; reload → code restored; switch to Python, C++ and JavaScript → each verified starter appears (or "Preparing…" then appears); switch back → Java draft intact; submit a correct solution in each language → AC.
4. Testcase: edit `nums` to `[1,2,3]`, add custom case, remove it; Run → Test Result shows per-case results; wrong expected shows red chip + Expected/Output diff; custom case shows output only.
5. Submit wrong → "Wrong Answer · 7/13" with failing case; Submit correct → "Accepted" + confetti + Beats bars; Submissions tab lists both; open detail; "Load into editor" confirm dialog; diff view.
6. Compile error → Explain-error returns text; Runtime error → stderr block.
7. Hints 1→2→3; Editorial locked → Reveal → content with language tabs; Solutions tab shows reference after AC.
8. Problem List drawer: search, filter Medium, click another problem, Ask AI "hard graph" → stages stream → new problem appears and is selected.
9. Notes: write, reload, persists. Tutor: streams reply; refuses full solution before AC.
10. Settings: change font size/ligatures/vim/tab size/relative numbers/theme light; each visible immediately; reload persists.
11. Shortcuts: `⌘'`, `⌘↵`, `⌥F`, `⌥+`, `⌥W`, `⇧⌥F`, `⌥N/⌥P`, `⌘K`; toggling Run shortcut off disables it.
12. Timer: start/stop/countdown; submit shows the elapsed time in the result view.
13. Mobile 390×844: segmented control switches panels; Run/Submit reachable; no horizontal page scroll.
14. Light theme: every panel readable, no white-on-white; console has no errors in any step.

## 6. Status log
- 2026-09-07 — Module specified. NOT STARTED.
