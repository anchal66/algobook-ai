/** Lists live rooms and each user's activeRoomId (debugging). `npm run rooms:inspect` */
import "./_bootstrap";
import { getAdminDb } from "../src/lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  for (const status of ["lobby", "running", "finalising"]) {
    const snap = await db.collection("rooms").where("status", "==", status).get();
    for (const d of snap.docs) {
      const r = d.data();
      console.log(`${status.padEnd(10)} ${d.id} "${r.name}" host=${r.hostUid} endsAt=${r.endsAt?.toDate?.().toISOString() ?? "-"} created=${r.createdAt.toDate().toISOString()}`);
    }
  }
  const users = await db.collection("users").where("activeRoomId", "!=", null).get();
  for (const u of users.docs) {
    const id = u.data().activeRoomId as string;
    const room = await db.collection("rooms").doc(id).get();
    console.log(`user ${u.id} (@${u.data().username}) activeRoomId=${id} → ${room.exists ? room.data()!.status + ' "' + room.data()!.name + '"' : "missing"}`);
  }
}
main().then(() => process.exit(0));
