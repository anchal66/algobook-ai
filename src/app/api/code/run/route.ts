import { NextResponse } from "next/server";

const JUDGE0_API_URL = `https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/submissions?base64_encoded=false&wait=true`;

export async function POST(request: Request) {
  try {
    // --- MODIFICATION START ---
    // Update destructured props. 'sourceCode' is now 'userCode'
    const { userCode, driverCode, stdin } = await request.json();

    // Update the validation check
    if (!userCode || !driverCode) {
      return NextResponse.json({ error: "Missing user code or driver code" }, { status: 400 });
    }

    // Combine the user's solution with the question's driver code
    const fullSourceCode = `
// User's Solution Code
${userCode}

// Driver Code
${driverCode}
    `;
    // --- MODIFICATION END ---

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST!,
      },
      body: JSON.stringify({
        // --- MODIFICATION START ---
        // Send the combined code
        source_code: fullSourceCode,
        // --- MODIFICATION END ---
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

  } catch (error: any) { // Added 'any' type to error
    console.error("Error in run code API:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}