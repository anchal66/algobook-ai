"use client";
/**
 * Loads the problem (+ project context), picks the language, reconciles drafts and seeds
 * the test cases (Module 03 W-07/W-10). Re-runs when the problem id changes.
 */
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, getProblem, getProject } from "@/lib/workspace/api";
import { readLocalDraft, resolveInitialCode } from "@/lib/workspace/drafts";
import { toHuman } from "@/lib/judge/human";
import { useWorkspace, type CaseDraft } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { useMe } from "@/store/me";
import type { Language } from "@/types";
import type { ProblemDTO, ProjectResponse } from "@/lib/workspace/types";

let projectCache: { id: string; data: ProjectResponse } | null = null;

export function invalidateProjectCache(): void { projectCache = null; }

export function seedCases(problem: ProblemDTO): CaseDraft[] {
  return problem.sampleTests.map((t, i) => ({ id: `s${i}`, values: toHuman(problem.params, t.input), custom: false, expected: t.expectedOutput }));
}

export function useProblemLoader(problemId: string | null, projectId: string | null): void {
  const { user, loading: authLoading } = useAuth();
  const setContext = useWorkspace((s) => s.setContext);
  const reset = useWorkspace((s) => s.resetForProblem);
  const loadMe = useMe((s) => s.load);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setContext({ loading: false, error: "Sign in to open the workspace." }); return; }
    let cancelled = false;
    const uid = user.uid;
    reset();
    setContext({ projectId });

    (async () => {
      try {
        const [me, projectRes] = await Promise.all([
          loadMe(uid),
          projectId ? (projectCache?.id === projectId ? Promise.resolve(projectCache.data) : getProject(projectId)) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (projectRes && projectId) {
          projectCache = { id: projectId, data: projectRes };
          setContext({ project: projectRes.project, items: projectRes.items });
        }
        if (!problemId) { setContext({ loading: false }); return; }

        const preferred: Language = useSettings.getState().editor.language ?? me?.user.settings.editor.language ?? "java";
        const res = await getProblem(problemId, preferred);
        if (cancelled) return;
        const problem = res.problem;
        const ready = res.languages.filter((l) => l.ready).map((l) => l.key);
        const language: Language = ready.includes(preferred) ? preferred : (ready[0] ?? "java");

        const serverDraft = res.draft?.code?.[language] ? { code: res.draft.code[language]!, updatedAt: res.draft.updatedAt } : null;
        const code = resolveInitialCode({ local: readLocalDraft(uid, problem.id, language), server: serverDraft, starter: problem.starter[language] ?? "" });

        const ws = useWorkspace.getState();
        ws.setLanguage(language);
        ws.setCode(language, code);
        ws.setCases(seedCases(problem));
        setContext({ problem, languages: res.languages, loading: false, error: null });
        if (useSettings.getState().timer.autoStart) ws.setTimer({ running: true, startedAt: Date.now(), accumulatedMs: 0 });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? (e.status === 404 ? "This problem does not exist or is not available yet." : e.message) : "Could not load the problem.";
        setContext({ loading: false, error: msg });
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, problemId, projectId, setContext, reset, loadMe]);
}
