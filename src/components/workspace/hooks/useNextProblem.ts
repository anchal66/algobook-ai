"use client";
/**
 * Prev / next / shuffle navigation inside a project and the "Next" generation flow when
 * nothing is queued (Module 03 W-04/W-17/W-18). Explore problems (no project) have no navigation.
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError, nextProblemStream } from "@/lib/workspace/api";
import { track } from "@/lib/analytics";
import { useWorkspace } from "@/store/workspace";
import { useSettings } from "@/store/settings";
import { useMe } from "@/store/me";
import { invalidateProjectCache } from "@/components/workspace/hooks/useProblemLoader";
import type { Language } from "@/types";

export interface NextProblemApi {
  hasProject: boolean;
  index: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  shuffle: () => void;
  goTo: (problemId: string) => void;
  /** Generates (or reuses) the next problem via the SSE stream and navigates to it. */
  generate: (userPrompt?: string) => Promise<void>;
  cancelGeneration: () => void;
}

let controller: AbortController | null = null;

export function useNextProblem(): NextProblemApi {
  const router = useRouter();
  const projectId = useWorkspace((s) => s.projectId);
  const items = useWorkspace((s) => s.items);
  const problem = useWorkspace((s) => s.problem);
  const generation = useWorkspace((s) => s.generation);

  const index = problem ? items.findIndex((i) => i.problemId === problem.id) : -1;
  const total = items.length;
  const hasProject = !!projectId;

  const goTo = useCallback((problemId: string) => {
    if (!projectId) { router.push(`/problems/${problemId}`); return; }
    router.push(`/project/${projectId}/solve/${problemId}`);
  }, [projectId, router]);

  const generate = useCallback(async (userPrompt?: string) => {
    if (!projectId || useWorkspace.getState().generation.active) return;
    controller?.abort();
    controller = new AbortController();
    const ws = useWorkspace.getState();
    ws.setGeneration({ active: true, stages: [], error: null, prompt: userPrompt ?? null, startedAt: Date.now() });
    const language: Language = useSettings.getState().editor.language;
    try {
      const result = await nextProblemStream(projectId, { userPrompt, language }, (s) => {
        const { stage, ...info } = s;
        useWorkspace.getState().pushStage({ stage, at: Date.now(), info });
      }, controller.signal);
      invalidateProjectCache();
      useMe.getState().bumpQuota("generate");
      track("next_problem", { source: result.source, latencyMs: result.latencyMs });
      useWorkspace.getState().setContext({ items: [...useWorkspace.getState().items.filter((i) => i.problemId !== result.item.problemId), result.item] });
      useWorkspace.getState().setGeneration({ active: false });
      router.replace(`/project/${projectId}/solve/${result.problem.id}`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") { useWorkspace.getState().setGeneration({ active: false }); return; }
      const msg = e instanceof ApiError
        ? e.code === "QUOTA_EXCEEDED" ? "You have used today's AI generations. Pick a problem from the list or come back tomorrow."
          : e.code === "PAYMENT_REQUIRED" ? "AI generation needs a Pro plan." : e.message
        : "Generation failed. Please try again.";
      useWorkspace.getState().setGeneration({ active: false, error: msg });
    }
  }, [projectId, router]);

  const goNext = useCallback(() => {
    if (!projectId) return;
    const cur = useWorkspace.getState();
    const i = cur.problem ? cur.items.findIndex((x) => x.problemId === cur.problem!.id) : -1;
    const next = cur.items.slice(i + 1).find((x) => x.status !== "solved") ?? cur.items[i + 1];
    if (next) goTo(next.problemId);
    else router.push(`/project/${projectId}/solve/next`);
  }, [projectId, goTo, router]);

  const goPrev = useCallback(() => {
    const cur = useWorkspace.getState();
    const i = cur.problem ? cur.items.findIndex((x) => x.problemId === cur.problem!.id) : cur.items.length;
    if (i > 0) goTo(cur.items[i - 1].problemId);
  }, [goTo]);

  const shuffle = useCallback(() => {
    const cur = useWorkspace.getState();
    const pool = cur.items.filter((x) => x.status !== "solved" && x.problemId !== cur.problem?.id);
    const pick = (pool.length ? pool : cur.items.filter((x) => x.problemId !== cur.problem?.id))[Math.floor(Math.random() * Math.max(1, pool.length || cur.items.length - 1))];
    if (pick) goTo(pick.problemId);
  }, [goTo]);

  const cancelGeneration = useCallback(() => { controller?.abort(); }, []);

  return {
    hasProject, index, total,
    canPrev: hasProject && index > 0,
    canNext: hasProject && !generation.active,
    goPrev, goNext, shuffle, goTo, generate, cancelGeneration,
  };
}
