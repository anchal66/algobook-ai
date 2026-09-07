/**
 * Shared bootstrap for `npx tsx scripts/<name>.ts`:
 *  - loads .env.local exactly like Next.js does
 *  - exposes the admin Firestore + a tiny arg parser
 * Import this file FIRST in every script.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export function args(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=");
    if (inline !== undefined) out[k] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

export function projectIdFromCredential(): string {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY).project_id;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8")).project_id;
  }
  return "";
}

export const EXPECTED_PROJECT = "algobook-c9caa";
