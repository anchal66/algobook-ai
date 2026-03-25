import { NextResponse } from "next/server";
import { updateUsername } from "@/lib/user-profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, newUsername } = body;

    if (!userId || !newUsername) {
      return NextResponse.json(
        { error: "userId and newUsername are required" },
        { status: 400 }
      );
    }

    const result = await updateUsername(userId, newUsername.toLowerCase());

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Username update error:", error);
    return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
  }
}
