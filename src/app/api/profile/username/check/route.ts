import { NextResponse } from "next/server";
import { checkUsernameAvailability } from "@/lib/user-profile";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const available = await checkUsernameAvailability(username.toLowerCase());
    return NextResponse.json({ available });
  } catch (error) {
    console.error("Username check error:", error);
    return NextResponse.json({ error: "Failed to check username" }, { status: 500 });
  }
}
