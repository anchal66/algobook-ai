"use client";
/**
 * Workspace state (Module 03 W-02): the loaded problem/project, per-language code, test cases,
 * run/submit results, tabs, side panels, timer and generation stream. Orchestration
 * (autosave, run, submit, next) lives in `components/workspace/hooks/*`.
 */
import { create } from "zustand";
import type { CaseResult, Language } from "@/types";
import type {
  ChatTurn, GenerationStage, HintResponse, LanguageInfo, ProblemDTO, ProjectDTO, ProjectItemDTO, SubmitResponse,
} from "@/lib/workspace/types";

export type LeftTab = "description" | "editorial" | "solutions" | "submissions";
export type ConsoleTab = "testcase" | "result";
export type SidePanel = "notes" | "tutor" | null;
export type SaveStatus = "saved" | "saving" | "unsaved";
export type AsyncState = "idle" | "running" | "done" | "error";

export interface CaseDraft { id: string; values: string[]; custom: boolean; expected?: string }
export interface StageRecord { stage: GenerationStage; at: number; info?: Record<string, unknown> }
export interface GenerationState { active: boolean; stages: StageRecord[]; error: string | null; prompt: string | null; startedAt: number | null }
export interface TimerState { running: boolean; startedAt: number | null; accumulatedMs: number; countdownMs: number | null }

export interface WorkspaceState {
  // context
  projectId: string | null;
  project: ProjectDTO | null;
  items: ProjectItemDTO[];
  problem: ProblemDTO | null;
  languages: LanguageInfo[];
  loading: boolean;
  error: string | null;
  // editor
  language: Language;
  code: Partial<Record<Language, string>>;
  saveStatus: SaveStatus;
  cursor: { line: number; col: number };
  preparingLanguage: Language | null;
  // cases
  cases: CaseDraft[];
  activeCase: number;
  // results
  runState: AsyncState;
  runResult: CaseResult[] | null;
  runError: string | null;
  activeResultCase: number;
  submitState: AsyncState;
  submitResult: SubmitResponse | null;
  submitError: string | null;
  submittedAt: number | null;
  // ui
  leftTab: LeftTab;
  consoleTab: ConsoleTab;
  sidePanel: SidePanel;
  drawerOpen: boolean;
  settingsOpen: boolean;
  fullscreen: boolean;
  maximized: string | null;
  // meta for /api/submit
  hintsRevealed: number;
  hints: Partial<Record<1 | 2 | 3, HintResponse>>;
  editorialViewed: boolean;
  runCount: number;
  openedAt: number;
  timer: TimerState;
  chat: ChatTurn[];
  generation: GenerationState;
  // actions
  setContext: (p: Partial<Pick<WorkspaceState, "projectId" | "project" | "items" | "problem" | "languages" | "loading" | "error">>) => void;
  setLanguage: (l: Language) => void;
  setCode: (l: Language, code: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setCursor: (c: { line: number; col: number }) => void;
  setPreparingLanguage: (l: Language | null) => void;
  setLanguageReady: (l: Language, starter: string | null) => void;
  setCases: (c: CaseDraft[]) => void;
  setActiveCase: (i: number) => void;
  setRun: (p: Partial<Pick<WorkspaceState, "runState" | "runResult" | "runError" | "activeResultCase">>) => void;
  setSubmit: (p: Partial<Pick<WorkspaceState, "submitState" | "submitResult" | "submitError" | "submittedAt">>) => void;
  setUi: (p: Partial<Pick<WorkspaceState, "leftTab" | "consoleTab" | "sidePanel" | "drawerOpen" | "settingsOpen" | "fullscreen" | "maximized">>) => void;
  setHint: (level: 1 | 2 | 3, hint: HintResponse) => void;
  setEditorialViewed: (v: boolean) => void;
  incrementRuns: () => void;
  setTimer: (t: Partial<TimerState>) => void;
  setChat: (c: ChatTurn[]) => void;
  setGeneration: (g: Partial<GenerationState>) => void;
  pushStage: (s: StageRecord) => void;
  markItemSolved: (problemId: string) => void;
  resetForProblem: () => void;
}

const initialTimer: TimerState = { running: false, startedAt: null, accumulatedMs: 0, countdownMs: null };
const initialGeneration: GenerationState = { active: false, stages: [], error: null, prompt: null, startedAt: null };

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  projectId: null, project: null, items: [], problem: null, languages: [], loading: true, error: null,
  language: "java", code: {}, saveStatus: "saved", cursor: { line: 1, col: 1 }, preparingLanguage: null,
  cases: [], activeCase: 0,
  runState: "idle", runResult: null, runError: null, activeResultCase: 0,
  submitState: "idle", submitResult: null, submitError: null, submittedAt: null,
  leftTab: "description", consoleTab: "testcase", sidePanel: null, drawerOpen: false, settingsOpen: false, fullscreen: false, maximized: null,
  hintsRevealed: 0, hints: {}, editorialViewed: false, runCount: 0, openedAt: Date.now(),
  timer: initialTimer, chat: [], generation: initialGeneration,

  setContext: (p) => set(p),
  setLanguage: (language) => set({ language }),
  setCode: (l, code) => set((s) => ({ code: { ...s.code, [l]: code } })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setCursor: (cursor) => set({ cursor }),
  setPreparingLanguage: (preparingLanguage) => set({ preparingLanguage }),
  setLanguageReady: (l, starter) => set((s) => ({
    languages: s.languages.map((x) => (x.key === l ? { ...x, ready: true } : x)),
    problem: s.problem ? { ...s.problem, languages: s.problem.languages.includes(l) ? s.problem.languages : [...s.problem.languages, l], starter: { ...s.problem.starter, [l]: starter ?? s.problem.starter[l] ?? "" } } : s.problem,
  })),
  setCases: (cases) => set({ cases }),
  setActiveCase: (activeCase) => set({ activeCase }),
  setRun: (p) => set(p),
  setSubmit: (p) => set(p),
  setUi: (p) => set(p),
  setHint: (level, hint) => set((s) => ({ hints: { ...s.hints, [level]: hint }, hintsRevealed: Math.max(s.hintsRevealed, level) })),
  setEditorialViewed: (editorialViewed) => set({ editorialViewed }),
  incrementRuns: () => set((s) => ({ runCount: s.runCount + 1 })),
  setTimer: (t) => set((s) => ({ timer: { ...s.timer, ...t } })),
  setChat: (chat) => set({ chat }),
  setGeneration: (g) => set((s) => ({ generation: { ...s.generation, ...g } })),
  pushStage: (st) => set((s) => ({ generation: { ...s.generation, stages: [...s.generation.stages, st] } })),
  markItemSolved: (problemId) => set((s) => ({ items: s.items.map((i) => (i.problemId === problemId ? { ...i, status: "solved" } : i)) })),
  resetForProblem: () => {
    const keepTimer = get().timer;
    set({
      problem: null, languages: [], loading: true, error: null, code: {}, saveStatus: "saved", cursor: { line: 1, col: 1 }, preparingLanguage: null,
      cases: [], activeCase: 0, runState: "idle", runResult: null, runError: null, activeResultCase: 0,
      submitState: "idle", submitResult: null, submitError: null, submittedAt: null,
      leftTab: "description", consoleTab: "testcase", maximized: null,
      hintsRevealed: 0, hints: {}, editorialViewed: false, runCount: 0, openedAt: Date.now(),
      timer: { ...initialTimer, countdownMs: keepTimer.countdownMs }, chat: [], generation: initialGeneration,
    });
  },
}));

/** Elapsed ms for the timer at `now` (stopwatch semantics; countdown callers subtract). */
export function timerElapsedMs(t: TimerState, now = Date.now()): number {
  return t.accumulatedMs + (t.running && t.startedAt ? now - t.startedAt : 0);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
