import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import {
  UserSchema, UsernameSchema, UserSettingsSchema, type User, type UserPlan, type UserSettings, type WithId,
} from "@/lib/data/schema";

const USERS = "users";
const USERNAMES = "usernames";

// ── Username generation (ported from v1 user-profile.ts) ─────────────────────

const ADJECTIVES = ["algo", "byte", "code", "data", "dev", "fast", "grid", "hash", "loop", "meta", "nano", "node", "pixel", "query", "rust", "stack", "sync", "tech", "turbo", "void", "zen", "cyber", "logic", "flux", "delta", "sigma", "alpha", "omega", "neo", "quantum"];
const NOUNS = ["ninja", "hawk", "wolf", "fox", "coder", "wizard", "knight", "sage", "pilot", "spark", "bolt", "blade", "craft", "drift", "forge", "pulse", "rider", "scout", "tiger", "viper", "archer", "chief", "racer", "storm", "shark", "eagle", "phoenix", "raven", "panther", "falcon"];

export const RESERVED_USERNAMES = new Set([
  "dashboard", "login", "project", "projects", "profile", "privacy", "terms", "contact", "about", "settings", "api", "admin", "app",
  "auth", "signup", "register", "explore", "search", "help", "support", "new", "edit", "delete", "public", "static", "assets", "images",
  "problems", "leaderboard", "dev", "me", "users", "u",
]);

function randomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}_${noun}_${Math.floor(Math.random() * 900) + 100}`;
}

export function isValidUsername(username: string): boolean {
  return UsernameSchema.safeParse(username).success && !RESERVED_USERNAMES.has(username);
}

/** Atomically claims a username for `uid`. Returns false if taken. */
export async function claimUsername(username: string, uid: string): Promise<boolean> {
  const ref = adminDb.collection(USERNAMES).doc(username);
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) throw new Error("taken");
      tx.set(ref, { uid });
    });
    return true;
  } catch {
    return false;
  }
}

async function generateAndClaimUsername(uid: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = randomUsername();
    if (await claimUsername(c, uid)) return c;
  }
  const fallback = `coder_${uid.slice(0, 8).toLowerCase()}`;
  await claimUsername(fallback, uid);
  return fallback;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function parseUser(data: FirebaseFirestore.DocumentData): User {
  return UserSchema.parse(data);
}

export async function getUser(uid: string): Promise<WithId<User> | null> {
  const snap = await adminDb.collection(USERS).doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...parseUser(snap.data()!) };
}

/** Creates users/{uid} on first sight (with a generated username); otherwise returns it, back-filling identity fields. */
export async function ensureUser(uid: string, identity: { email?: string; displayName?: string; photoURL?: string }): Promise<User> {
  const ref = adminDb.collection(USERS).doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data()!;
    const updates: Record<string, unknown> = {};
    if (identity.email && !data.email) updates.email = identity.email;
    if (identity.displayName && !data.displayName) updates.displayName = identity.displayName;
    if (identity.photoURL && !data.photoURL) updates.photoURL = identity.photoURL;
    if (Object.keys(updates).length) {
      updates.updatedAt = Timestamp.now();
      await ref.update(updates);
      Object.assign(data, updates);
    }
    return parseUser(data);
  }

  const username = await generateAndClaimUsername(uid);
  const now = Timestamp.now();
  const doc = UserSchema.parse({
    username,
    displayName: identity.displayName ?? "",
    email: identity.email ?? "",
    photoURL: identity.photoURL ?? "",
    createdAt: now,
    updatedAt: now,
  });
  // create() fails if a concurrent request already created the doc → re-read.
  try {
    await ref.create(doc);
    return doc;
  } catch {
    await adminDb.collection(USERNAMES).doc(username).delete().catch(() => undefined);
    const again = await ref.get();
    return parseUser(again.data()!);
  }
}

const PROFILE_FIELDS = ["displayName", "bio", "company", "college", "location", "githubUrl", "linkedinUrl", "skills", "experienceLevel", "goalType"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export async function updateProfileFields(uid: string, fields: Partial<Pick<User, ProfileField>>): Promise<void> {
  const sanitized: Record<string, unknown> = {};
  for (const k of PROFILE_FIELDS) if (fields[k] !== undefined) sanitized[k] = fields[k];
  if (!Object.keys(sanitized).length) return;
  sanitized.updatedAt = Timestamp.now();
  await adminDb.collection(USERS).doc(uid).update(sanitized);
}

export interface SettingsPatch {
  editor?: Partial<UserSettings["editor"]>;
  layout?: Record<string, unknown>;
  timer?: Partial<UserSettings["timer"]>;
  shortcuts?: Record<string, string>;
  notifications?: Partial<UserSettings["notifications"]>;
}

export async function updateSettings(uid: string, patch: SettingsPatch): Promise<UserSettings> {
  const ref = adminDb.collection(USERS).doc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw ApiError.notFound("User not found");
    const current = UserSettingsSchema.parse(snap.data()?.settings ?? {});
    const merged = UserSettingsSchema.parse({
      ...current,
      ...patch,
      editor: { ...current.editor, ...(patch.editor ?? {}) },
      timer: { ...current.timer, ...(patch.timer ?? {}) },
      notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
      layout: { ...current.layout, ...(patch.layout ?? {}) },
      shortcuts: { ...current.shortcuts, ...(patch.shortcuts ?? {}) },
    });
    tx.update(ref, { settings: merged, updatedAt: Timestamp.now() });
    return merged;
  });
}

export async function setPlanCache(uid: string, plan: UserPlan): Promise<void> {
  await adminDb.collection(USERS).doc(uid).update({ plan, updatedAt: Timestamp.now() });
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!isValidUsername(username)) return false;
  const snap = await adminDb.collection(USERNAMES).doc(username).get();
  return !snap.exists;
}

export async function updateUsername(uid: string, newUsername: string): Promise<{ username: string; changesLeft: number }> {
  if (!isValidUsername(newUsername)) throw ApiError.validation("Invalid or reserved username");
  const userRef = adminDb.collection(USERS).doc(uid);
  const newRef = adminDb.collection(USERNAMES).doc(newUsername);
  return adminDb.runTransaction(async (tx) => {
    const [userSnap, newSnap] = await Promise.all([tx.get(userRef), tx.get(newRef)]);
    if (!userSnap.exists) throw ApiError.notFound("User not found");
    const data = userSnap.data()!;
    const changesLeft = (data.usernameChangesLeft as number) ?? 0;
    if (data.username === newUsername) throw ApiError.validation("Same as current username");
    if (changesLeft <= 0) throw ApiError.forbidden("No username changes remaining");
    if (newSnap.exists) throw ApiError.conflict("Username already taken");
    tx.delete(adminDb.collection(USERNAMES).doc(data.username as string));
    tx.set(newRef, { uid });
    tx.update(userRef, { username: newUsername, usernameChangesLeft: FieldValue.increment(-1), updatedAt: Timestamp.now() });
    return { username: newUsername, changesLeft: changesLeft - 1 };
  });
}

export async function getByUsername(username: string): Promise<WithId<User> | null> {
  const lock = await adminDb.collection(USERNAMES).doc(username.toLowerCase()).get();
  if (!lock.exists) return null;
  return getUser(lock.data()!.uid as string);
}

/** Fields safe to show on a public profile page. */
export function publicProfile(u: WithId<User>) {
  const { id, username, displayName, photoURL, bio, company, college, location, githubUrl, linkedinUrl, skills, stats, createdAt } = u;
  return { id, username, displayName, photoURL, bio, company, college, location, githubUrl, linkedinUrl, skills, stats, createdAt };
}

/** Fields the owner sees via /api/me (never quotas internals other than counts, never plan cache raw). */
export function ownProfile(u: User) {
  const { plan: _plan, quotas: _quotas, ...rest } = u;
  return rest;
}
