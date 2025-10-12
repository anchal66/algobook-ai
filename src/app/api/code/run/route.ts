import { NextResponse } from "next/server";

const JUDGE0_API_URL = `https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/submissions?base64_encoded=false&wait=true`;

export async function POST(request: Request) {
  try {
    const { sourceCode, languageId, stdin } = await request.json();

    if (!sourceCode || !languageId) {
      return NextResponse.json({ error: "Missing source code or language ID" }, { status: 400 });
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST!,
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: 62, // 62 is the ID for Java on Judge0
        stdin: stdin || "",
      }),
    };

    const response = await fetch(JUDGE0_API_URL, options);
    const result = await response.json();
    
    if (!response.ok) {
        console.error("Judge0 API Error:", result);
        throw new Error(result.error || "Failed to execute code");
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error in run code API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}