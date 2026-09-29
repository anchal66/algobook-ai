import "server-only";
/** No AI help inside a mock interview or a live contest room (Module 04 §3.12, Module 06 §3.5). */
import { assertNotInActiveInterview } from "@/lib/practice/interview";
import { assertNotInActiveRoom } from "@/lib/rooms/play";

export async function assertNotInRestrictedSession(uid: string, problemId: string): Promise<void> {
  await assertNotInActiveInterview(uid, problemId);
  await assertNotInActiveRoom(uid, problemId);
}
