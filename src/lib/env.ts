import "server-only";
import { z } from "zod";

/**
 * Server-side environment validation (Module 01 §3.2).
 * Imported by every server module that needs configuration; fails fast with a
 * readable message if a variable is missing or malformed.
 */
const serverSchema = z.object({
  OPENAI_API_KEY: z.string().startsWith("sk-", "OPENAI_API_KEY must start with sk-"),
  RAPIDAPI_KEY: z.string().min(10).optional().or(z.literal("")),
  JUDGE0_BASE_URL: z.url().default("https://judge0-ce.p.rapidapi.com"),
  JUDGE0_HOST_HEADER: z.string().default("judge0-ce.p.rapidapi.com"),
  JUDGE0_AUTH_TOKEN: z.string().optional().or(z.literal("")),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional().or(z.literal("")),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().or(z.literal("")),
  CQ_PAYMENT_GATEWAY_URL: z.url(),
  CQ_PAYMENT_GATEWAY_KEY: z.string().default(""),
  ADMIN_UIDS: z.string().default(""),
  CRON_SECRET: z.string().min(16).optional().or(z.literal("")),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
});

function fail(scope: string, error: z.ZodError): never {
  const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  throw new Error(
    `[env] Invalid ${scope} environment. Fix .env.local (see .env.example):\n${lines.join("\n")}`,
  );
}

function load() {
  const server = serverSchema.safeParse(process.env);
  if (!server.success) fail("server", server.error);
  const client = clientSchema.safeParse(process.env);
  if (!client.success) fail("client", client.error);

  const s = server.data;
  if (!s.FIREBASE_SERVICE_ACCOUNT_KEY && !s.FIREBASE_SERVICE_ACCOUNT_PATH) {
    throw new Error("[env] Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY.");
  }
  if (s.JUDGE0_HOST_HEADER && !s.RAPIDAPI_KEY) {
    throw new Error("[env] RAPIDAPI_KEY is required when JUDGE0_HOST_HEADER is set (RapidAPI mode).");
  }
  if (!s.JUDGE0_HOST_HEADER && !s.JUDGE0_AUTH_TOKEN) {
    console.warn("[env] Judge0 self-host mode without JUDGE0_AUTH_TOKEN — requests will be unauthenticated.");
  }

  const adminUids = s.ADMIN_UIDS.split(",").map((x) => x.trim()).filter(Boolean);
  return { ...s, ...client.data, adminUids, isProd: s.NODE_ENV === "production" };
}

export type Env = ReturnType<typeof load>;

let cached: Env | null = null;

/** Validated environment. Validation runs once, on first access. */
export const env: Env = new Proxy({} as Env, {
  get(_t, prop) {
    if (!cached) cached = load();
    return cached[prop as keyof Env];
  },
});
