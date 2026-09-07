import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "@/lib/api/errors";
import {
  ProjectSchema, ProjectItemSchema, TemplatePoolEntrySchema, todayKey,
  type ItemStatus, type Project, type ProjectItem, type TemplatePoolEntry, type WithId,
} from "@/lib/data/schema";
import { getTemplateItems } from "@/lib/data/templates";

const COL = "projects";

function parse(snap: FirebaseFirestore.DocumentSnapshot): WithId<Project> | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...ProjectSchema.parse(snap.data()) };
}

export interface CreateProjectInput {
  uid: string;
  title: string;
  description?: string;
  purpose?: string;
  durationDays?: number;
  experienceLevel?: Project["experienceLevel"];
  goalType?: Project["goalType"];
  selectedTopics?: string[];
  templateId?: string | null;
}

/** Creates the project; for template projects also copies the company list into `templatePool` (batches of 500). */
export async function create(input: CreateProjectInput): Promise<WithId<Project>> {
  const ref = adminDb.collection(COL).doc();
  const doc = ProjectSchema.parse({ ...input, templateId: input.templateId ?? null, createdAt: Timestamp.now() });
  await ref.set(doc);

  if (input.templateId) {
    const items = await getTemplateItems(input.templateId);
    if (!items.length) {
      await ref.delete();
      throw ApiError.notFound(`Template "${input.templateId}" not found or empty`);
    }
    for (let i = 0; i < items.length; i += 500) {
      const batch = adminDb.batch();
      for (const it of items.slice(i, i + 500)) {
        batch.set(ref.collection("templatePool").doc(), TemplatePoolEntrySchema.parse({
          title: it.title, number: it.number, difficulty: it.difficulty, order: it.order, status: "pending", problemId: null,
        }));
      }
      await batch.commit();
    }
  }
  return { id: ref.id, ...doc };
}

export async function get(id: string): Promise<WithId<Project> | null> {
  return parse(await adminDb.collection(COL).doc(id).get());
}

/** 404 (not 403) when the project belongs to someone else, to avoid enumeration. */
export async function getOwned(id: string, uid: string): Promise<WithId<Project>> {
  const p = await get(id);
  if (!p || p.uid !== uid) throw ApiError.notFound("Project not found");
  return p;
}

/** Progress is denormalised on the project doc, so the dashboard list is a single query (sorted in memory: no composite index). */
export async function listForUser(uid: string, limit = 50): Promise<WithId<Project>[]> {
  const snap = await adminDb.collection(COL).where("uid", "==", uid).get();
  return snap.docs.map((d) => parse(d)!).filter(Boolean)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, limit);
}

/** Recursive delete: items, templatePool, then the project's submissions and drafts, then the doc. */
export async function remove(id: string, uid: string): Promise<void> {
  const project = await getOwned(id, uid);
  const ref = adminDb.collection(COL).doc(project.id);
  const subs = await adminDb.collection("submissions").where("projectId", "==", project.id).where("uid", "==", uid).get();
  for (let i = 0; i < subs.docs.length; i += 500) {
    const batch = adminDb.batch();
    subs.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await adminDb.recursiveDelete(ref);
}

export async function addItem(projectId: string, item: Omit<ProjectItem, "addedAt" | "solvedAt" | "status" | "order"> & { order?: number }): Promise<ProjectItem> {
  const ref = adminDb.collection(COL).doc(projectId);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw ApiError.notFound("Project not found");
    const items = (snap.data()?.progress?.items as number) ?? 0;
    const doc = ProjectItemSchema.parse({ ...item, order: item.order ?? items, status: "todo", addedAt: Timestamp.now(), solvedAt: null });
    tx.set(ref.collection("items").doc(item.problemId), doc);
    tx.update(ref, { "progress.items": FieldValue.increment(1), lastActivityAt: Timestamp.now() });
    return doc;
  });
}

export async function getItems(projectId: string): Promise<WithId<ProjectItem>[]> {
  const snap = await adminDb.collection(COL).doc(projectId).collection("items").orderBy("order", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...ProjectItemSchema.parse(d.data()) }));
}

export async function getItem(projectId: string, problemId: string): Promise<WithId<ProjectItem> | null> {
  const snap = await adminDb.collection(COL).doc(projectId).collection("items").doc(problemId).get();
  return snap.exists ? { id: snap.id, ...ProjectItemSchema.parse(snap.data()) } : null;
}

/**
 * Applies a submission outcome to the project item and the denormalised progress
 * counters, inside the caller's transaction. Reads must have been done via `readForSubmit`.
 */
export function applySubmitInTx(
  tx: FirebaseFirestore.Transaction,
  ctx: { projectRef: FirebaseFirestore.DocumentReference; project: FirebaseFirestore.DocumentData; item: FirebaseFirestore.DocumentData | null },
  outcome: { problemId: string; accepted: boolean; difficulty: ProjectItem["difficulty"]; title: string; tags: string[] },
): { itemStatus: ItemStatus; solved: number; items: number } {
  const now = Timestamp.now();
  const today = todayKey();
  const updates: Record<string, unknown> = { lastActivityAt: now };
  if (ctx.project.lastActivityDate !== today) {
    updates.lastActivityDate = today;
    updates["progress.activeDays"] = FieldValue.increment(1);
  }
  const itemRef = ctx.projectRef.collection("items").doc(outcome.problemId);
  const prevStatus: ItemStatus = (ctx.item?.status as ItemStatus) ?? "todo";
  let itemStatus: ItemStatus = prevStatus;

  if (!ctx.item) {
    // Solving a problem that was never linked (e.g. from Explore): link it now.
    const items = (ctx.project.progress?.items as number) ?? 0;
    tx.set(itemRef, ProjectItemSchema.parse({
      order: items, problemId: outcome.problemId, title: outcome.title, difficulty: outcome.difficulty, tags: outcome.tags,
      reason: null, source: "curated", status: "todo", addedAt: now, solvedAt: null,
    }));
    updates["progress.items"] = FieldValue.increment(1);
  }

  if (outcome.accepted && prevStatus !== "solved") {
    itemStatus = "solved";
    tx.update(itemRef, { status: "solved", solvedAt: now });
    updates["progress.solved"] = FieldValue.increment(1);
    updates[`progress.${outcome.difficulty.toLowerCase()}`] = FieldValue.increment(1);
    if (prevStatus === "attempting") updates["progress.attempting"] = FieldValue.increment(-1);
  } else if (!outcome.accepted && prevStatus === "todo") {
    itemStatus = "attempting";
    tx.update(itemRef, { status: "attempting" });
    updates["progress.attempting"] = FieldValue.increment(1);
  }

  // Module 04 §3.13: pace against the project's duration.
  const progress = (ctx.project.progress ?? {}) as Partial<Project["progress"]>;
  const items = (progress.items ?? 0) + (ctx.item ? 0 : 1);
  const solved = (progress.solved ?? 0) + (itemStatus === "solved" && prevStatus !== "solved" ? 1 : 0);
  const createdAt = ctx.project.createdAt instanceof Timestamp ? ctx.project.createdAt : now;
  const pace = paceFor({ durationDays: (ctx.project.durationDays as number) ?? 30, createdAt, progress: { items, solved } });
  updates["progress.onTrack"] = pace.onTrack;
  updates["progress.expectedSolved"] = pace.expectedSolved;

  tx.update(ctx.projectRef, updates);
  return { itemStatus, solved, items };
}

export async function markPoolUsed(projectId: string, poolDocId: string, problemId: string): Promise<void> {
  await adminDb.collection(COL).doc(projectId).collection("templatePool").doc(poolDocId).update({ status: "used", problemId });
}

export async function nextPoolEntry(projectId: string): Promise<WithId<TemplatePoolEntry> | null> {
  const snap = await adminDb.collection(COL).doc(projectId).collection("templatePool").where("status", "==", "pending").orderBy("order", "asc").limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...TemplatePoolEntrySchema.parse(snap.docs[0].data()) };
}

/** Number of problems on a company template (`templates/{company}.count`); 0 when unknown. */
export async function templateItemCount(templateId: string): Promise<number> {
  const snap = await adminDb.collection("templates").doc(templateId).get();
  return snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
}

/**
 * Finds or creates the user's system project (`purpose` = "daily" | "interview"): the daily challenge
 * and mock interviews solve through the normal workspace, which needs a project to submit into.
 */
export async function ensureSystemProject(uid: string, purpose: "daily" | "interview", title: string, description: string, existingId?: string | null): Promise<WithId<Project>> {
  if (existingId) {
    const p = await get(existingId);
    if (p && p.uid === uid) return p;
  }
  const snap = await adminDb.collection(COL).where("uid", "==", uid).where("purpose", "==", purpose).limit(1).get();
  if (!snap.empty) return parse(snap.docs[0])!;
  return create({ uid, title, description, purpose, durationDays: 365, selectedTopics: [], templateId: null });
}

/** Pending company-list entries in list order (Module 04 `recommendFromTemplate`). */
export async function listPendingPool(projectId: string, limit = 40): Promise<WithId<TemplatePoolEntry>[]> {
  const snap = await adminDb.collection(COL).doc(projectId).collection("templatePool").where("status", "==", "pending").orderBy("order", "asc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...TemplatePoolEntrySchema.parse(d.data()) }));
}

/** Projects of every user for a company template (leaderboard cohorts). Single-field query, no composite index. */
export async function listByTemplate(templateId: string, limit = 2000): Promise<WithId<Project>[]> {
  const snap = await adminDb.collection(COL).where("templateId", "==", templateId).limit(limit).get();
  return snap.docs.map((d) => parse(d)!).filter(Boolean);
}

/**
 * Recomputes `progress.onTrack` / `expectedSolved` (Module 04 §3.13): expected pace is `items`
 * spread evenly over `durationDays` since creation; on track when solved ≥ expected − 1.
 */
export function paceFor(project: Pick<Project, "durationDays" | "createdAt"> & { progress: Pick<Project["progress"], "items" | "solved"> }, now: Date = new Date()): { expectedSolved: number; onTrack: boolean } {
  const items = project.progress.items;
  const elapsedDays = Math.max(0, (now.getTime() - project.createdAt.toMillis()) / 86_400_000);
  const frac = Math.min(1, elapsedDays / Math.max(1, project.durationDays));
  const expectedSolved = Math.floor(items * frac);
  return { expectedSolved, onTrack: project.progress.solved >= Math.max(0, expectedSolved - 1) };
}

/** Problem ids linked to any of the user's projects (Module 02 reuse exclusion). */
export async function itemProblemIdsForUser(uid: string, maxProjects = 50): Promise<string[]> {
  const projectsSnap = await adminDb.collection(COL).where("uid", "==", uid).select().limit(maxProjects).get();
  const ids = new Set<string>();
  await Promise.all(projectsSnap.docs.map(async (p) => {
    const items = await p.ref.collection("items").select().get();
    items.docs.forEach((d) => ids.add(d.id));
  }));
  return [...ids];
}

export async function setInsights(projectId: string, insights: Record<string, unknown>): Promise<void> {
  await adminDb.collection(COL).doc(projectId).update({ insights: { ...insights, generatedAt: Timestamp.now() } });
}
