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
): { itemStatus: ItemStatus } {
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
  tx.update(ctx.projectRef, updates);
  return { itemStatus };
}

export async function markPoolUsed(projectId: string, poolDocId: string, problemId: string): Promise<void> {
  await adminDb.collection(COL).doc(projectId).collection("templatePool").doc(poolDocId).update({ status: "used", problemId });
}

export async function nextPoolEntry(projectId: string): Promise<WithId<TemplatePoolEntry> | null> {
  const snap = await adminDb.collection(COL).doc(projectId).collection("templatePool").where("status", "==", "pending").orderBy("order", "asc").limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...TemplatePoolEntrySchema.parse(snap.docs[0].data()) };
}
