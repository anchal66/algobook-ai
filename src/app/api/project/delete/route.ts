import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkSubscription } from "@/lib/check-subscription";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");

    if (!projectId || !userId) {
      return NextResponse.json({ error: "projectId and userId are required" }, { status: 400 });
    }

    // Verify the project belongs to this user
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (projectSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const batch = adminDb.batch();

    // Delete subcollections: projectQuestions, attendance, templatePool
    const subcollections = ["projectQuestions", "attendance", "templatePool"];
    for (const sub of subcollections) {
      const snap = await adminDb.collection("projects").doc(projectId).collection(sub).get();
      snap.docs.forEach((d) => batch.delete(d.ref));
    }

    // Delete submissions for this project
    const subsSnap = await adminDb
      .collection("submissions")
      .where("projectId", "==", projectId)
      .get();
    subsSnap.docs.forEach((d) => batch.delete(d.ref));

    // Delete the project document itself
    batch.delete(adminDb.collection("projects").doc(projectId));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
