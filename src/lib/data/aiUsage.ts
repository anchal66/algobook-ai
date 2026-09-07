import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { AiUsageSchema, type AiUsage } from "@/lib/data/schema";

/** Append-only cost telemetry (used by Module 02). Never throws — telemetry must not break requests. */
export async function log(entry: Omit<AiUsage, "createdAt">): Promise<void> {
  try {
    await adminDb.collection("aiUsage").add(AiUsageSchema.parse({ ...entry, createdAt: Timestamp.now() }));
  } catch (e) {
    console.warn(JSON.stringify({ evt: "aiUsage.log_failed", message: (e as Error).message }));
  }
}
