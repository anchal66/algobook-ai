"use client";
/** Render-safe clock (Module 05): `Date.now()` is impure in render under the React Compiler rules, so read it from a store that ticks once a second. */
import { useSyncExternalStore } from "react";

let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) timer = setInterval(() => { now = Date.now(); subs.forEach((s) => s()); }, 1000);
  return () => { subs.delete(cb); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
}
const get = () => now;

/** Current epoch ms, updated every second while mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, get, get);
}
