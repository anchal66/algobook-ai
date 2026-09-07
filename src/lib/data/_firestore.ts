import "server-only";

/**
 * True when Firestore rejected a query because a composite index is missing or
 * still building (gRPC code 9 / FAILED_PRECONDITION).
 *
 * The indexes this app needs are declared in `firebase/firestore.indexes.json`
 * and deployed with `npm run db:deploy` (or `firebase deploy --only
 * firestore:indexes`). Until that runs against a project, the repositories fall
 * back to an equality-only query plus in-memory ordering so the app degrades in
 * performance instead of failing — see `onMissingIndex()`.
 */
export function isMissingIndexError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: number | string; message?: string };
  const msg = String(err.message ?? "").toLowerCase();
  return (err.code === 9 || err.code === "failed-precondition") && (msg.includes("index") || msg.includes("requires an index"));
}

/** Logs once per query shape so the operator knows an index is missing. */
const warned = new Set<string>();
export function onMissingIndex(query: string): void {
  if (warned.has(query)) return;
  warned.add(query);
  console.warn(JSON.stringify({
    evt: "firestore.missing_index",
    query,
    action: "served from an in-memory fallback; run `npm run db:deploy` to create the index",
  }));
}

/** Caps how many documents a fallback scan will read before giving up on completeness. */
export const FALLBACK_SCAN_LIMIT = 500;
