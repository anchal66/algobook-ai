import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as problems from "@/lib/data/problems";
import * as drafts from "@/lib/data/drafts";
import { LanguageSchema, serialize } from "@/lib/data/schema";
import { LANGUAGES } from "@/lib/judge/languages";

const QuerySchema = z.object({ lang: LanguageSchema.optional() });

/** Public problem fields + starter for the requested language + sample tests. Never private/*. */
export const GET = handler({ evt: "problems.get", query: QuerySchema }, async ({ user, params, query }) => {
  const p = await problems.resolve(params.id);
  if (!p || (p.status === "draft" && !user.isAdmin)) throw ApiError.notFound("Problem not found");
  const lang = query.lang;
  const starter = lang ? { [lang]: p.starter[lang] ?? "" } : p.starter;
  const draft = lang ? await drafts.get(user.uid, p.id) : null;
  return {
    problem: serialize({ ...p, starter }),
    languages: Object.entries(LANGUAGES).map(([key, cfg]) => ({ key, label: cfg.label, version: cfg.version, monaco: cfg.monaco, ready: p.languages.includes(key as never) })),
    draft: draft ? serialize(draft) : null,
  };
});
