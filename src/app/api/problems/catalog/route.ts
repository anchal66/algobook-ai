import { handler } from "@/lib/api/handler";
import * as problems from "@/lib/data/problems";

/**
 * `GET /api/problems/catalog` (Module 05 U-13, D-06): the whole verified catalog as compact rows so Explore can
 * filter/sort/virtualise client-side (< 150 ms) without a composite index per sort. Cached in memory for 60 s.
 */
export const GET = handler({ evt: "problems.catalog" }, async () => {
  const { items, total, cachedAt } = await problems.catalog();
  return { items, total, cachedAt };
});
