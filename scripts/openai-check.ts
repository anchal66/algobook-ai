/** Checks the OpenAI key: model access and whether the account can bill a 1-token request. `npm run openai:check` */
import "./_bootstrap";
import OpenAI from "openai";

async function main() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  try { const m = await client.models.retrieve("gpt-5.6-luna"); console.log(`models: ok (${m.id})`); } catch (e) { console.log(`models: FAIL ${(e as Error).message}`); }
  try {
    const r = await client.responses.create({ model: "gpt-5.6-luna", input: "Reply with OK.", max_output_tokens: 16, reasoning: { effort: "none" }, store: false });
    console.log(`billing: ok — reply "${r.output_text.trim()}"`);
  } catch (e) {
    const err = e as { status?: number; code?: string; message?: string };
    console.log(`billing: FAIL status=${err.status} code=${err.code} message=${err.message?.slice(0, 160)}`);
  }
}
main();
