/**
 * Mints a Firebase custom token for a uid/email and exchanges it for an ID token
 * (Identity Toolkit REST), so the API can be exercised with curl or the smoke script.
 *   npm run dev:token -- --uid <uid>      |  --email you@example.com
 * Output is JSON: { uid, customToken, idToken, expiresIn }. Tokens expire in 1 h.
 */
import { args } from "./_bootstrap";
import { getAdminAuth } from "../src/lib/firebase-admin";

export async function mintIdToken(uidOrEmail: { uid?: string; email?: string }) {
  const auth = getAdminAuth();
  const uid = uidOrEmail.uid ?? (await auth.getUserByEmail(uidOrEmail.email!)).uid;
  const customToken = await auth.createCustomToken(uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signInWithCustomToken failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { idToken: string; expiresIn: string };
  const webConfig = {
    apiKey, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  return { uid, customToken, idToken: data.idToken, expiresIn: data.expiresIn, webConfig };
}

if (process.argv[1]?.endsWith("dev-token.ts")) {
  const a = args();
  mintIdToken({ uid: a.uid ? String(a.uid) : undefined, email: a.email ? String(a.email) : undefined })
    .then((t) => console.log(JSON.stringify(t, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
