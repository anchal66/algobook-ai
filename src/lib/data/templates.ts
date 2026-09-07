import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { TemplateSchema, TemplateItemSchema, type Difficulty, type Template, type TemplateItem, type WithId } from "@/lib/data/schema";

const COL = "templates";

export const TEMPLATE_META: Record<string, { company: string; title: string; description: string; purpose: string }> = {
  amazon: { company: "Amazon", title: "Amazon Interview Prep", description: "Curated problems frequently asked in Amazon technical interviews. Covers arrays, trees, dynamic programming, system design patterns, and more.", purpose: "Prepare for Amazon" },
  apple: { company: "Apple", title: "Apple Interview Prep", description: "Curated problems frequently asked in Apple technical interviews. Emphasizes clean code, recursion, string manipulation, and graph algorithms.", purpose: "Prepare for Apple" },
  google: { company: "Google", title: "Google Interview Prep", description: "Curated problems frequently asked in Google technical interviews. Heavy focus on dynamic programming, graphs, advanced data structures, and optimization.", purpose: "Prepare for Google" },
  meta: { company: "Meta", title: "Meta Interview Prep", description: "Curated problems frequently asked in Meta (Facebook) technical interviews. Focus on arrays, strings, trees, and graph traversal patterns.", purpose: "Prepare for Meta" },
  microsoft: { company: "Microsoft", title: "Microsoft Interview Prep", description: "Curated problems frequently asked in Microsoft technical interviews. Broad coverage of arrays, linked lists, trees, DP, and design patterns.", purpose: "Prepare for Microsoft" },
  uber: { company: "Uber", title: "Uber Interview Prep", description: "Curated problems frequently asked in Uber technical interviews. Focus on graphs, intervals, sliding window, and real-time system patterns.", purpose: "Prepare for Uber" },
};

export function parseDifficulty(raw: string): Difficulty {
  const d = raw.trim().toLowerCase().replace(/\.$/, "");
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

/** Parses `templates/<id>.md` lines like `1922. Count Good Numbers - Med.` */
export function parseTemplateMarkdown(content: string): TemplateItem[] {
  const out: TemplateItem[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^(\d+)\.\s+(.+?)\s+-\s+(.+)$/);
    if (!m) continue;
    out.push({ number: parseInt(m[1], 10), title: m[2].trim(), difficulty: parseDifficulty(m[3]), order: out.length });
  }
  return out;
}

export async function list(): Promise<WithId<Template>[]> {
  const snap = await adminDb.collection(COL).orderBy("company").get();
  return snap.docs.map((d) => ({ id: d.id, ...TemplateSchema.parse(d.data()) }));
}

export async function getTemplateItems(id: string): Promise<TemplateItem[]> {
  const snap = await adminDb.collection(COL).doc(id).collection("items").orderBy("order", "asc").get();
  return snap.docs.map((d) => TemplateItemSchema.parse(d.data()));
}

/** Seeds `templates/{company}` + `items` from the markdown files (batches of 500). Idempotent. */
export async function seed(templatesDir = path.join(process.cwd(), "templates")): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [id, meta] of Object.entries(TEMPLATE_META)) {
    const file = path.join(templatesDir, `${id}.md`);
    if (!fs.existsSync(file)) continue;
    const items = parseTemplateMarkdown(fs.readFileSync(file, "utf8"));
    const ref = adminDb.collection(COL).doc(id);
    const difficulties = { easy: 0, medium: 0, hard: 0 };
    for (const it of items) difficulties[it.difficulty.toLowerCase() as keyof typeof difficulties]++;
    await ref.set(TemplateSchema.parse({ ...meta, count: items.length, difficulties, updatedAt: Timestamp.now() }));
    for (let i = 0; i < items.length; i += 500) {
      const batch = adminDb.batch();
      for (const it of items.slice(i, i + 500)) batch.set(ref.collection("items").doc(String(it.order)), it);
      await batch.commit();
    }
    counts[id] = items.length;
  }
  return counts;
}
