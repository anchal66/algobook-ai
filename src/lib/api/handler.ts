import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { requireUser, optionalUser, type RequireUserOptions } from "@/lib/auth/requireUser";
import type { AuthedUser } from "@/lib/auth/types";

type Params = Record<string, string>;

export interface HandlerContext<B, Q, A extends AuthedUser | null> {
  req: Request;
  user: A;
  body: B;
  query: Q;
  params: Params;
}

export interface HandlerOptions<B, Q> {
  /** Event name for structured logs, e.g. "submit". */
  evt: string;
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  /** "required" (default) | "optional" | "none" */
  auth?: "required" | "optional" | "none";
  feature?: RequireUserOptions["feature"];
  admin?: boolean;
}

type RouteCtx = { params: Promise<Params> } | { params: Params } | undefined;

function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

function queryToObject(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(url).searchParams.forEach((v, k) => { out[k] = v; });
  return out;
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw ApiError.validation("Body must be valid JSON"); }
}

/**
 * Wraps a route handler: parses JSON body/query with zod, authenticates,
 * catches `ApiError`, returns the error envelope and writes one structured log line per request.
 */
export function handler<B = unknown, Q = unknown, A extends AuthedUser | null = AuthedUser>(
  opts: HandlerOptions<B, Q>,
  fn: (ctx: HandlerContext<B, Q, A>) => Promise<Response | object>,
) {
  return async (req: Request, routeCtx?: RouteCtx): Promise<Response> => {
    const started = Date.now();
    let uid: string | undefined;
    let status = 200;
    try {
      const params = routeCtx?.params ? await routeCtx.params : {};
      const authMode = opts.auth ?? "required";
      let user: AuthedUser | null = null;
      if (authMode === "required") user = await requireUser(req, { feature: opts.feature, admin: opts.admin });
      else if (authMode === "optional") user = await optionalUser(req);
      uid = user?.uid;

      const rawBody = opts.body ? await readJson(req) : undefined;
      const body = opts.body ? opts.body.parse(rawBody) : (undefined as B);
      const query = opts.query ? opts.query.parse(queryToObject(req.url)) : (undefined as Q);

      const result = await fn({ req, user: user as A, body, query, params });
      const res = result instanceof Response ? result : NextResponse.json(result);
      status = res.status;
      return res;
    } catch (e) {
      if (e instanceof z.ZodError) {
        status = 400;
        const details = e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid request", details } }, { status });
      }
      if (e instanceof ApiError) {
        status = e.status;
        return NextResponse.json(e.toBody(), { status });
      }
      status = 500;
      console.error(JSON.stringify({ ts: new Date().toISOString(), evt: opts.evt, level: "error", uid, message: (e as Error)?.message, stack: (e as Error)?.stack }));
      return NextResponse.json(ApiError.internal().toBody(), { status });
    } finally {
      log({ evt: opts.evt, uid, status, ms: Date.now() - started, path: new URL(req.url).pathname });
    }
  };
}

/** Route stub for endpoints removed in v2 but still referenced by legacy pages. */
export function gone(evt: string, message: string) {
  const h = handler({ evt, auth: "none" }, async () => { throw ApiError.gone(message); });
  return { GET: h, POST: h, PUT: h, PATCH: h, DELETE: h };
}
