import "server-only";
/** Firestore repository for competition rooms (Module 06 §3.2). Lifecycle logic lives in `lib/rooms/service.ts`. */
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { FALLBACK_SCAN_LIMIT, isMissingIndexError, onMissingIndex } from "@/lib/data/_firestore";
import {
  RoomChatSchema, RoomEventSchema, RoomMemberSchema, RoomRatingSchema, RoomSchema, RoomSubmissionSchema,
  type Room, type RoomChat, type RoomEvent, type RoomMember, type RoomMemberState, type RoomRating, type RoomSubmission, type WithId,
} from "@/lib/data/schema";

export const ROOMS = "rooms";
export const CODES = "roomCodes";
export const RATINGS = "roomRating";

export const roomRef = (id: string) => adminDb.collection(ROOMS).doc(id);
export const memberRef = (roomId: string, uid: string) => roomRef(roomId).collection("members").doc(uid);
export const membersCol = (roomId: string) => roomRef(roomId).collection("members");
export const submissionsCol = (roomId: string) => roomRef(roomId).collection("submissions");
export const eventsCol = (roomId: string) => roomRef(roomId).collection("events");
export const chatCol = (roomId: string) => roomRef(roomId).collection("chat");
export const codeRef = (code: string) => adminDb.collection(CODES).doc(code);
export const ratingRef = (uid: string) => adminDb.collection(RATINGS).doc(uid);

export function parseRoom(snap: FirebaseFirestore.DocumentSnapshot): WithId<Room> | null {
  return snap.exists ? { id: snap.id, ...RoomSchema.parse(snap.data()) } : null;
}
export function parseMember(snap: FirebaseFirestore.DocumentSnapshot): WithId<RoomMember> | null {
  return snap.exists ? { id: snap.id, ...RoomMemberSchema.parse(snap.data()) } : null;
}
export function parseSubmission(snap: FirebaseFirestore.DocumentSnapshot): WithId<RoomSubmission> | null {
  return snap.exists ? { id: snap.id, ...RoomSubmissionSchema.parse(snap.data()) } : null;
}

export async function getRoom(id: string): Promise<WithId<Room> | null> {
  return parseRoom(await roomRef(id).get());
}

export async function getMember(roomId: string, uid: string): Promise<WithId<RoomMember> | null> {
  return parseMember(await memberRef(roomId, uid).get());
}

export async function listMembers(roomId: string, states?: RoomMemberState[]): Promise<WithId<RoomMember>[]> {
  const snap = await membersCol(roomId).get();
  const all = snap.docs.map((d) => parseMember(d)!).filter(Boolean);
  const list = states ? all.filter((m) => states.includes(m.state)) : all;
  return list.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis());
}

export async function resolveCode(code: string): Promise<string | null> {
  const snap = await codeRef(code).get();
  if (!snap.exists) return null;
  const d = snap.data() as { roomId: string; expiresAt?: Timestamp };
  if (d.expiresAt && d.expiresAt.toMillis() < Date.now()) return null;
  return d.roomId;
}

/** Public lobbies, newest first (composite index: status, visibility, createdAt desc; falls back to a scan). */
export async function listPublicLobbies(limit = 50): Promise<WithId<Room>[]> {
  const base = adminDb.collection(ROOMS).where("status", "==", "lobby").where("visibility", "==", "public");
  try {
    const snap = await base.orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((d) => parseRoom(d)!);
  } catch (e) {
    if (!isMissingIndexError(e)) throw e;
    onMissingIndex("rooms(status, visibility, createdAt desc)");
    const snap = await base.limit(FALLBACK_SCAN_LIMIT).get();
    return snap.docs.map((d) => parseRoom(d)!).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, limit);
  }
}

export const membershipRef = (uid: string, roomId: string) => adminDb.collection("users").doc(uid).collection("roomMemberships").doc(roomId);

/** Rooms the user hosts or joined, via the per-user membership index (no collection-group index needed). */
export async function listForUser(uid: string, limit = 40): Promise<{ room: WithId<Room>; member: WithId<RoomMember> }[]> {
  const snap = await adminDb.collection("users").doc(uid).collection("roomMemberships").limit(300).get();
  const ids = snap.docs.map((d) => d.id).sort((a, b) => ((snap.docs.find((x) => x.id === b)!.data().joinedAt as Timestamp)?.toMillis() ?? 0) - ((snap.docs.find((x) => x.id === a)!.data().joinedAt as Timestamp)?.toMillis() ?? 0)).slice(0, limit);
  if (!ids.length) return [];
  const [roomSnaps, memberSnaps] = await Promise.all([adminDb.getAll(...ids.map(roomRef)), adminDb.getAll(...ids.map((id) => memberRef(id, uid)))]);
  const out: { room: WithId<Room>; member: WithId<RoomMember> }[] = [];
  roomSnaps.forEach((s, i) => { const r = parseRoom(s); const m = parseMember(memberSnaps[i]); if (r && m) out.push({ room: r, member: m }); });
  return out.sort((a, b) => b.room.createdAt.toMillis() - a.room.createdAt.toMillis());
}

/** Rooms in a status whose `endsAt` / `createdAt` passed a threshold (cron sweep; equality + in-memory filter). */
export async function listByStatus(status: Room["status"], limit = 200): Promise<WithId<Room>[]> {
  const snap = await adminDb.collection(ROOMS).where("status", "==", status).limit(limit).get();
  return snap.docs.map((d) => parseRoom(d)!);
}

export async function listSubmissions(roomId: string, uid?: string): Promise<WithId<RoomSubmission>[]> {
  const q = uid ? submissionsCol(roomId).where("uid", "==", uid) : submissionsCol(roomId);
  const snap = await q.limit(2000).get();
  return snap.docs.map((d) => parseSubmission(d)!).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function listEvents(roomId: string, uid?: string, limit = 500): Promise<WithId<RoomEvent>[]> {
  const q = uid ? eventsCol(roomId).where("uid", "==", uid) : eventsCol(roomId);
  const snap = await q.limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...RoomEventSchema.parse(d.data()) })).sort((a, b) => a.at.toMillis() - b.at.toMillis());
}

export async function listChat(roomId: string, afterMs = 0, limit = 100): Promise<WithId<RoomChat>[]> {
  const snap = await chatCol(roomId).limit(300).get();
  return snap.docs.map((d) => ({ id: d.id, ...RoomChatSchema.parse(d.data()) })).filter((m) => m.at.toMillis() > afterMs && !m.deleted).sort((a, b) => a.at.toMillis() - b.at.toMillis()).slice(-limit);
}

export async function getRating(uid: string): Promise<RoomRating | null> {
  const snap = await ratingRef(uid).get();
  return snap.exists ? RoomRatingSchema.parse(snap.data()) : null;
}

export async function getRatings(uids: string[]): Promise<Map<string, RoomRating>> {
  const out = new Map<string, RoomRating>();
  if (!uids.length) return out;
  const snaps = await adminDb.getAll(...uids.map(ratingRef));
  snaps.forEach((s, i) => { if (s.exists) out.set(uids[i], RoomRatingSchema.parse(s.data())); });
  return out;
}
