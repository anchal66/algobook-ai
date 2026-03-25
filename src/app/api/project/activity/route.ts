import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "projectId and userId are required" },
        { status: 400 }
      );
    }

    // Verify project belongs to user
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists || projectSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch attendance records ordered by date desc
    const attendanceSnap = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("attendance")
      .orderBy("markedAt", "desc")
      .get();

    const attendance = attendanceSnap.docs.map((doc) => ({
      date: doc.id,
      ...doc.data(),
      markedAt: doc.data().markedAt?.toDate?.()?.toISOString() || null,
    }));

    // Fetch submissions for this project to get question details per day
    const submissionsSnap = await adminDb
      .collection("submissions")
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .orderBy("submittedAt", "desc")
      .get();

    const submissions = submissionsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        questionId: d.questionId,
        status: d.status,
        attemptNumber: d.attemptNumber,
        timeSpentSeconds: d.timeSpentSeconds,
        submittedAt: d.submittedAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Fetch question titles for the submissions
    const questionIds = [...new Set(submissions.map((s) => s.questionId))];
    const questionTitles: Record<string, string> = {};
    // Batch fetch question titles (max 30 at a time for Firestore)
    for (let i = 0; i < questionIds.length; i += 30) {
      const batch = questionIds.slice(i, i + 30);
      const promises = batch.map((id) =>
        adminDb.collection("questions").doc(id).get()
      );
      const snaps = await Promise.all(promises);
      for (const snap of snaps) {
        if (snap.exists) {
          questionTitles[snap.id] = snap.data()?.title || "Untitled";
        }
      }
    }

    return NextResponse.json({
      attendance,
      submissions,
      questionTitles,
    });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
