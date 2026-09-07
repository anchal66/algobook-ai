"use client";
/**
 * Tiny cache-backed data hook for the app pages (Module 05). No extra dependency: a module-level
 * cache + `useSyncExternalStore`, so components never call setState inside an effect. Entries are
 * keyed by string (usually the request path), deduplicated while in flight and considered fresh
 * for `staleMs` (default 30 s). `invalidate(prefix)` re-fetches every mounted query under a prefix.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface QueryEntry<T = unknown> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  fetchedAt: number;
  promise: Promise<void> | null;
}

const cache = new Map<string, QueryEntry>();
const fetchers = new Map<string, () => Promise<unknown>>();
/** Mounted subscribers per key — `invalidate` only refetches queries something is still showing. */
const refs = new Map<string, number>();
const seq = new Map<string, number>();
const listeners = new Set<() => void>();
const EMPTY: QueryEntry = { data: undefined, error: null, loading: false, fetchedAt: 0, promise: null };

function emit() { for (const l of listeners) l(); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getEntry<T>(key: string | null): QueryEntry<T> {
  return (key ? (cache.get(key) as QueryEntry<T> | undefined) : undefined) ?? (EMPTY as QueryEntry<T>);
}
function getServerEntry<T>(): QueryEntry<T> { return EMPTY as QueryEntry<T>; }

export function load<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<void> {
  const cur = cache.get(key) as QueryEntry<T> | undefined;
  if (cur?.promise && !force) return cur.promise;
  fetchers.set(key, fetcher);
  const id = (seq.get(key) ?? 0) + 1;
  seq.set(key, id);
  const promise = fetcher()
    .then((data) => { if (seq.get(key) !== id) return; cache.set(key, { data, error: null, loading: false, fetchedAt: Date.now(), promise: null }); })
    .catch((e: unknown) => {
      if (seq.get(key) !== id) return;
      const error = e instanceof Error ? e : new Error(String(e));
      // fetchedAt 0: an error is never "fresh" — the next mount retries instead of showing it for staleMs.
      cache.set(key, { data: cur?.data, error, loading: false, fetchedAt: 0, promise: null });
    })
    .finally(emit);
  cache.set(key, { data: cur?.data, error: null, loading: true, fetchedAt: cur?.fetchedAt ?? 0, promise });
  emit();
  return promise;
}

/** Optimistically replace cached data (e.g. after a mutation). */
export function setQueryData<T>(key: string, updater: T | ((prev: T | undefined) => T)) {
  const cur = cache.get(key) as QueryEntry<T> | undefined;
  const data = typeof updater === "function" ? (updater as (p: T | undefined) => T)(cur?.data) : updater;
  cache.set(key, { data, error: null, loading: false, fetchedAt: Date.now(), promise: null });
  emit();
}

/** Re-fetch every cached query whose key starts with `prefix` (or all when omitted). */
export function invalidate(prefix?: string) {
  for (const [key, fetcher] of fetchers) {
    if (prefix && !key.startsWith(prefix)) continue;
    if ((refs.get(key) ?? 0) > 0) void load(key, fetcher, true);
    else cache.delete(key); // nothing mounted: drop it so the next mount fetches fresh (never re-runs a POST-backed query in the background)
  }
}

/** Drop everything (sign-out). */
export function clearQueries() { cache.clear(); fetchers.clear(); emit(); }

export interface UseQueryOptions { staleMs?: number; enabled?: boolean }
export interface UseQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  /** True only while nothing is cached yet. */
  loading: boolean;
  /** True on any in-flight request (including background refresh). */
  fetching: boolean;
  refetch: () => Promise<void>;
  mutate: (updater: T | ((prev: T | undefined) => T)) => void;
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, opts: UseQueryOptions = {}): UseQueryResult<T> {
  const { staleMs = 30_000, enabled = true } = opts;
  const entry = useSyncExternalStore(subscribe, () => getEntry<T>(key), getServerEntry<T>);
  const active = enabled && !!key;

  useEffect(() => {
    if (!active) return;
    refs.set(key!, (refs.get(key!) ?? 0) + 1);
    const cur = cache.get(key!);
    const stale = !cur || (!cur.promise && Date.now() - cur.fetchedAt > staleMs);
    if (stale) void load(key!, fetcher);
    return () => { refs.set(key!, Math.max(0, (refs.get(key!) ?? 1) - 1)); };
    // The fetcher identity is intentionally not a dependency: the key describes the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, staleMs]);

  const refetch = useCallback(() => (key ? load(key, fetcher, true) : Promise.resolve()), [key, fetcher]);
  const mutate = useCallback((u: T | ((prev: T | undefined) => T)) => { if (key) setQueryData<T>(key, u); }, [key]);

  return {
    data: entry.data,
    error: entry.error,
    loading: active && entry.data === undefined && !entry.error,
    fetching: !!entry.promise,
    refetch,
    mutate,
  };
}
