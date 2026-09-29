import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";

const QuerySchema = z.object({ language: z.enum(["python", "javascript"]) });

/**
 * Harness code for the in-browser visualizer (Module 07 V-02). Only the two languages traced client-side;
 * drivers parse stdin and print the result — they never contain hidden tests or reference solutions.
 */
export const GET = handler({ evt: "problems.driver", query: QuerySchema }, async ({ query, params }) => {
  const p = await problems.resolve(params.id);
  if (!p || p.status === "draft") throw ApiError.notFound("Problem not found");
  if (!p.languages.includes(query.language)) throw new ApiError(409, "LANGUAGE_NOT_READY", `${query.language} is not available for this problem yet`);
  const drivers = await problems.getDrivers(p.id);
  const driver = drivers?.drivers[query.language];
  if (!driver) throw new ApiError(409, "LANGUAGE_NOT_READY", `${query.language} is not available for this problem yet`);
  return { language: query.language, driver };
});
