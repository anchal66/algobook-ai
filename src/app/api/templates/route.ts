import { NextResponse } from "next/server";
import { getTemplateList } from "@/lib/templates";

export async function GET() {
  try {
    const templates = getTemplateList();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Templates API error:", error);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}
