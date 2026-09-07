"use client";
import { auth } from "@/lib/firebase";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/errors";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: ApiErrorCode, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** JSON-serialised automatically. */
  body?: unknown;
  /** Skip attaching the ID token (public endpoints only). */
  anonymous?: boolean;
}

/**
 * fetch() for /api routes: attaches the Firebase ID token, sends JSON, parses
 * the error envelope and throws `ApiError`. Never send `userId` — the server derives it.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, anonymous, headers, ...rest } = init;
  const h = new Headers(headers);
  if (!anonymous) {
    const user = auth.currentUser;
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in required");
    h.set("Authorization", `Bearer ${await user.getIdToken()}`);
  }
  if (body !== undefined) h.set("Content-Type", "application/json");

  const res = await fetch(path, { ...rest, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const env = data as Partial<ApiErrorBody> | null;
    const err = env?.error;
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("algobook:unauthenticated", { detail: err?.message }));
    throw new ApiError(res.status, err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}
