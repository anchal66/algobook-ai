import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getTemplateQuestions } from "@/lib/templates";
import { checkSubscription } from "@/lib/check-subscription";

export async function POST(request: Request) {
  try {
    const { projectId, templateId, userId } = await request.json();

    if (!projectId || !templateId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sub = await checkSubscription(userId);
    if (!sub.active) {
      return NextResponse.json(
        { error: "Active subscription required", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      );
    }

    const questions = getTemplateQuestions(templateId);
    if (questions.length === 0) {
      return NextResponse.json({ error: "Template not found or empty" }, { status: 404 });
    }

    // Verify the project belongs to the user
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists || projectSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Batch-write template pool entries (Firestore batch limit: 500)
    const poolRef = adminDb.collection("projects").doc(projectId).collection("templatePool");

    for (let i = 0; i < questions.length; i += 500) {
      const batch = adminDb.batch();
      const slice = questions.slice(i, i + 500);
      for (let j = 0; j < slice.length; j++) {
        const q = slice[j];
        const docRef = poolRef.doc();
        batch.set(docRef, {
          title: q.title,
          difficulty: q.difficulty,
          status: "pending",
          order: i + j,
        });
      }
      await batch.commit();
    }

    return NextResponse.json({ seeded: questions.length });
  } catch (error) {
    console.error("Template seed error:", error);
    return NextResponse.json({ error: "Failed to seed template" }, { status: 500 });
  }
}
