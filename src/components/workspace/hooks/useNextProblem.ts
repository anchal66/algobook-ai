"use client";
/**
 * Prev / next / shuffle navigation inside a project and the "Next" generation flow when
 * nothing is queued (Module 03 W-04/W-17/W-18). Explore problems (no project) have no navigation.
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getProject, nextProblemStream } from "@/lib/workspace/api";
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
    // Read the project id from the store at call time: the first-render closure can still be null.
    const pid = useWorkspace.getState().projectId ?? projectId;
    if (!pid || useWorkspace.getState().generation.active) return;
    controller?.abort();
    controller = new AbortController();
    const ws = useWorkspace.getState();
    ws.setGeneration({ active: true, stages: [], error: null, prompt: userPrompt ?? null, startedAt: Date.now() });
    const language: Language = useSettings.getState().editor.language;
    try {
      const result = await nextProblemStream(pid, { userPrompt, language }, (s) => {
        const { stage, ...info } = s;
        useWorkspace.getState().pushStage({ stage, at: Date.now(), info });
      }, controller.signal);
      invalidateProjectCache();
      useMe.getState().bumpQuota("generate");
      track("next_problem", { source: result.source, latencyMs: result.latencyMs });
      useWorkspace.getState().setContext({ items: [...useWorkspace.getState().items.filter((i) => i.problemId !== result.item.problemId), result.item] });
      useWorkspace.getState().setGeneration({ active: false });
      if (!controller?.signal.aborted && useWorkspace.getState().projectId === pid) router.replace(`/project/${pid}/solve/${result.problem.id}`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") { useWorkspace.getState().setGeneration({ active: false }); return; }
      if (e instanceof ApiError && e.code === "CONFLICT") {
        // Another request (a second tab, a remount) already holds this project's generation lease: wait for its
        // problem to be linked instead of failing, then open it.
        const known = new Set(useWorkspace.getState().items.map((i) => i.problemId));
        useWorkspace.getState().pushStage({ stage: "verifying", at: Date.now(), info: { waiting: true } });
        const deadline = Date.now() + 5 * 60_000;
        while (Date.now() < deadline && !controller?.signal.aborted) {
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const res = await getProject(pid);
            const fresh = res.items.find((i) => !known.has(i.problemId));
            if (fresh) {
              invalidateProjectCache();
              useWorkspace.getState().setContext({ items: res.items });
              useWorkspace.getState().setGeneration({ active: false });
              if (!controller?.signal.aborted) router.replace(`/project/${pid}/solve/${fresh.problemId}`);
              return;
            }
          } catch { /* keep waiting */ }
        }
        useWorkspace.getState().setGeneration({ active: false, error: controller?.signal.aborted ? null : "The problem is taking longer than expected. Open the problem list — it appears there as soon as it is ready." });
        return;
      }
      const msg = e instanceof ApiError
        ? e.code === "QUOTA_EXCEEDED" ? "You have used today's AI generations. Pick a problem from the list or come back tomorrow."
          : e.code === "PAYMENT_REQUIRED" ? "AI generation needs a Pro plan."
          : e.code === "CONFLICT" ? e.message
          : e.code === "UPSTREAM" ? "We couldn't produce a verified problem right now. Nothing was charged — please try again in a moment." : e.message
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
