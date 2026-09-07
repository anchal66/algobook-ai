/**
 * QA fixture account (Module 05 U-27): creates a throwaway Firebase Auth user for the "fresh account" walkthrough,
 * or deletes one. The app creates the Firestore user document on first `/api/me`.
 *   npm run qa:user -- --create [--email qa-fresh@algobook.test]      → prints { uid, email }
 *   npm run qa:user -- --delete --uid <uid>                            → removes Auth user + users/{uid} + username lock
 */
import { args } from "./_bootstrap";
import { getAdminAuth } from "../src/lib/firebase-admin";
import { adminDb } from "../src/lib/firebase-admin";

async function main() {
  const a = args();
  const auth = getAdminAuth();
  if (a.create) {
    const email = String(a.email ?? `qa-fresh-${Date.now()}@algobook.test`);
    const u = await auth.createUser({ email, displayName: "QA Fresh", emailVerified: true });
    console.log(JSON.stringify({ uid: u.uid, email }, null, 2));
    return;
  }
  if (a.delete) {
    const uid = String(a.uid ?? "");
    if (!uid) throw new Error("--uid required");
    const snap = await adminDb.collection("users").doc(uid).get();
    const username = snap.data()?.username as string | undefined;
    if (username) await adminDb.collection("usernames").doc(username).delete().catch(() => undefined);
    await adminDb.collection("users").doc(uid).delete().catch(() => undefined);
    await auth.deleteUser(uid).catch(() => undefined);
    console.log(JSON.stringify({ deleted: uid, username: username ?? null }));
    return;
  }
  throw new Error("pass --create or --delete --uid <uid>");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
