import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get total count (approximation — Firestore doesn't have a cheap count)
    // We'll fetch limit+1 to detect if there's a next page
    const offset = (page - 1) * limit;

    const snap = await adminDb
      .collection("submissions")
      .where("userId", "==", userId)
      .orderBy("submittedAt", "desc")
      .offset(offset)
      .limit(limit + 1)
      .get();

    const hasMore = snap.docs.length > limit;
    const docs = snap.docs.slice(0, limit);

    // Gather question IDs and project IDs
    const questionIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const doc of docs) {
      const d = doc.data();
      if (d.questionId) questionIds.add(d.questionId);
      if (d.projectId) projectIds.add(d.projectId);
    }

    // Batch fetch question titles
    const questionTitles: Record<string, string> = {};
    const qIds = [...questionIds];
    for (let i = 0; i < qIds.length; i += 30) {
      const batch = qIds.slice(i, i + 30);
      const promises = batch.map((id) => adminDb.collection("questions").doc(id).get());
      const snaps = await Promise.all(promises);
      for (const s of snaps) {
        if (s.exists) questionTitles[s.id] = s.data()?.title || "Untitled";
      }
    }

    // Batch fetch project titles
    const projectTitles: Record<string, string> = {};
    const pIds = [...projectIds];
    for (let i = 0; i < pIds.length; i += 30) {
      const batch = pIds.slice(i, i + 30);
      const promises = batch.map((id) => adminDb.collection("projects").doc(id).get());
      const snaps = await Promise.all(promises);
      for (const s of snaps) {
        if (s.exists) projectTitles[s.id] = s.data()?.title || "Untitled";
      }
    }

    const submissions = docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        questionId: d.questionId,
        projectId: d.projectId,
        questionTitle: questionTitles[d.questionId] || "Unknown",
        projectTitle: projectTitles[d.projectId] || "Unknown",
        status: d.status,
        difficulty: d.difficulty || null,
        attemptNumber: d.attemptNumber,
        hintsUsed: d.hintsUsed,
        timeSpentSeconds: d.timeSpentSeconds,
        submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({
      submissions,
      page,
      hasMore,
    });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
