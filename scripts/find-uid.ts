import { args } from "./_bootstrap";
import { getAdminAuth } from "../src/lib/firebase-admin";

/** npm run db:find-uid -- --email you@example.com */
async function main() {
  const a = args();
  const email = String(a.email ?? "");
  if (!email) throw new Error("usage: --email <address>");
  const u = await getAdminAuth().getUserByEmail(email);
  console.log(JSON.stringify({ uid: u.uid, email: u.email, displayName: u.displayName, created: u.metadata.creationTime }, null, 2));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
