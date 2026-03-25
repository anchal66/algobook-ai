import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const snap = await adminDb
      .collection("submissions")
      .where("userId", "==", userId)
      .where("submittedAt", ">=", Timestamp.fromDate(startDate))
      .where("submittedAt", "<", Timestamp.fromDate(endDate))
      .orderBy("submittedAt", "asc")
      .get();

    const heatmap: Record<string, number> = {};
    let totalSubmissions = 0;
    let activeDays = 0;
    let maxStreak = 0;
    let currentStreak = 0;
    let lastDate = "";

    for (const doc of snap.docs) {
      const submittedAt = doc.data().submittedAt?.toDate?.();
      if (!submittedAt) continue;

      const dateStr = submittedAt.toISOString().slice(0, 10);
      if (!heatmap[dateStr]) {
        heatmap[dateStr] = 0;
        activeDays++;

        // Streak calculation
        if (lastDate) {
          const last = new Date(lastDate);
          const curr = new Date(dateStr);
          const diffDays = Math.round((curr.getTime() - last.getTime()) / (86400000));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        maxStreak = Math.max(maxStreak, currentStreak);
        lastDate = dateStr;
      }
      heatmap[dateStr]++;
      totalSubmissions++;
    }

    return NextResponse.json({
      heatmap,
      totalSubmissions,
      activeDays,
      maxStreak,
      year,
    });
  } catch (error) {
    console.error("Heatmap fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch heatmap" }, { status: 500 });
  }
}
