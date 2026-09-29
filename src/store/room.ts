"use client";
/**
 * Room state for the lobby, arena and results (Module 06 §3.10). Transport: polling `GET /api/rooms/:id`
 * (3 s in the lobby, 5 s while running, stops when finished). Firestore listeners (D-16) are a follow-up;
 * the polling interval is already short enough for a handful of participants.
 */
import { create } from "zustand";
import { rooms, type RoomDetail } from "@/lib/app/api";

export interface RoomState {
  id: string | null;
  detail: RoomDetail | null;
  error: string | null;
  loading: boolean;
  /** server − client clock offset in ms (from the `now` field). */
  clockOffset: number;
  /** last known server time for the countdown. */
  load: (id: string, force?: boolean) => Promise<RoomDetail | null>;
  patchMe: (p: Partial<NonNullable<RoomDetail["me"]>>) => void;
  stop: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<RoomDetail | null> | null = null;

function intervalFor(status: string | undefined): number | null {
  if (status === "lobby") return 3000;
  if (status === "running" || status === "finalising") return 5000;
  return null;
}

export const useRoom = create<RoomState>()((set, get) => ({
  id: null, detail: null, error: null, loading: false, clockOffset: 0,
  load: async (id, force) => {
    if (inflight && get().id === id && !force) return inflight;
    if (get().id !== id) set({ id, detail: null, error: null });
    set({ loading: true });
    inflight = rooms.get(id)
      .then((d) => {
        if (get().id !== id) return null;
        set({ detail: d, loading: false, error: null, clockOffset: Date.parse(d.now) - Date.now() });
        schedule(id, d.room.status);
        return d;
      })
      .catch((e: unknown) => { set({ loading: false, error: (e as Error)?.message ?? "Could not load the room" }); schedule(id, get().detail?.room.status ?? "lobby"); return null; })
      .finally(() => { inflight = null; });
    return inflight;
  },
  patchMe: (p) => set((s) => (s.detail && s.detail.me ? { detail: { ...s.detail, me: { ...s.detail.me, ...p } } } : s)),
  stop: () => { if (timer) clearTimeout(timer); timer = null; set({ id: null, detail: null }); },
}));

function schedule(id: string, status: string): void {
  if (timer) clearTimeout(timer);
  const ms = intervalFor(status);
  if (!ms) return;
  timer = setTimeout(() => { if (useRoom.getState().id === id && typeof document !== "undefined" && document.visibilityState !== "hidden") void useRoom.getState().load(id, true); else if (useRoom.getState().id === id) schedule(id, status); }, ms);
}

/** Server-corrected "now". */
export function serverNow(): number {
  return Date.now() + useRoom.getState().clockOffset;
}
