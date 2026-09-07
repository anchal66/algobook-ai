/** Prints the RapidAPI rate-limit headers for the Judge0 endpoint (costs one request). */
import "./_bootstrap";
async function main() {
  const base = (process.env.JUDGE0_BASE_URL ?? "https://judge0-ce.p.rapidapi.com").replace(/\/$/, "");
  const host = process.env.JUDGE0_HOST_HEADER ?? "judge0-ce.p.rapidapi.com";
  const res = await fetch(`${base}/languages`, { headers: host ? { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY ?? "", "X-RapidAPI-Host": host } : { "X-Auth-Token": process.env.JUDGE0_AUTH_TOKEN ?? "" } });
  console.log("status", res.status);
  for (const [k, v] of res.headers) if (/ratelimit|quota/i.test(k)) console.log(k, v);
}
main();
