"use client";
/** `/api/me` cache for the workspace: plan, quotas, stats, settings hydration (Module 03). */
import { create } from "zustand";
import type { FeatureKey } from "@/types";
import type { MeResponse } from "@/lib/workspace/types";
import { getMe } from "@/lib/workspace/api";
import { useSettings } from "@/store/settings";

interface MeState {
  me: MeResponse | null;
  loading: boolean;
  loadedFor: string | null;
  load: (uid: string, force?: boolean) => Promise<MeResponse | null>;
  bumpQuota: (feature: FeatureKey) => void;
  patchStats: (patch: Partial<MeResponse["user"]["stats"]>) => void;
}

let inflight: Promise<MeResponse | null> | null = null;

export const useMe = create<MeState>()((set, get) => ({
  me: null,
  loading: false,
  loadedFor: null,
  load: async (uid, force) => {
    if (!force && get().loadedFor === uid && get().me) return get().me;
    if (inflight) return inflight;
    set({ loading: true });
    inflight = getMe()
      .then((me) => {
        set({ me, loading: false, loadedFor: uid });
        useSettings.getState().hydrateFromServer(me.user.settings);
        return me;
      })
      .catch(() => { set({ loading: false }); return null; })
      .finally(() => { inflight = null; });
    return inflight;
  },
  bumpQuota: (feature) => set((s) => {
    if (!s.me) return s;
    const used = { ...s.me.quotas.used, [feature]: (s.me.quotas.used[feature] ?? 0) + 1 };
    return { me: { ...s.me, quotas: { ...s.me.quotas, used } } };
  }),
  patchStats: (patch) => set((s) => (s.me ? { me: { ...s.me, user: { ...s.me.user, stats: { ...s.me.user.stats, ...patch } } } } : s)),
}));

/** Remaining calls for a feature today; `Infinity` when unlimited, 0 when not in the plan. */
export function quotaLeft(me: MeResponse | null, feature: FeatureKey): number {
  if (!me) return 0;
  const limit = me.quotas.limits[feature];
  if (limit === -1) return Infinity;
  return Math.max(0, limit - (me.quotas.used[feature] ?? 0));
}

export function isPro(me: MeResponse | null): boolean {
  return me?.plan.tier === "pro";
}
