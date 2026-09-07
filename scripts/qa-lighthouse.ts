/**
 * Lighthouse runs for the Module 05 performance pass (U-25). Launches Chrome through puppeteer (so a signed-in
 * session can be measured), then audits each URL with the desktop preset and the default mobile preset.
 *   npm run qa:lighthouse -- --urls "/?home=1,/login" [--uid <uid> --authUrls "/dashboard,/explore"] [--base http://localhost:3000] [--out docs/modules/qa/05]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

async function main() {
  const a = args();
  const base = String(a.base ?? "http://localhost:3000");
  const out = path.resolve(String(a.out ?? "docs/modules/qa/05"));
  const urls = a.urls ? String(a.urls).split(",").map((u) => base + u) : [];
  const authUrls = a.authUrls ? String(a.authUrls).split(",").map((u) => base + u) : [];
  const uid = a.uid ? String(a.uid) : "";
  fs.mkdirSync(out, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT}`] });
  const rows: Record<string, unknown>[] = [];
  try {
    if (uid && authUrls.length) {
      const { customToken, webConfig } = await mintIdToken({ uid });
      const page = await browser.newPage();
      await page.goto(`${base}/login`, { waitUntil: "networkidle2" });
      await page.evaluate(new Function(`return (async () => {
        const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
        const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
        const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(${JSON.stringify(webConfig)});
        const auth = authMod.getAuth(app);
        await authMod.setPersistence(auth, authMod.indexedDBLocalPersistence);
        await authMod.signInWithCustomToken(auth, ${JSON.stringify(customToken)});
      })()`) as () => Promise<void>);
      await page.close();
    }
    for (const [label, list] of [["public", urls], ["auth", authUrls]] as const) {
      for (const url of list) {
        for (const form of ["desktop", "mobile"] as const) {
          const res = await lighthouse(url, { port: PORT, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] }, form === "desktop" ? desktopConfig : undefined);
          if (!res) throw new Error("lighthouse returned nothing");
          const lhr = res.lhr;
          const c = (k: string) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
          const audit = (k: string) => lhr.audits[k]?.displayValue ?? "";
          const row = { label, url: url.replace(base, ""), form, performance: c("performance"), accessibility: c("accessibility"), bestPractices: c("best-practices"), seo: c("seo"), lcp: audit("largest-contentful-paint"), tbt: audit("total-blocking-time"), cls: audit("cumulative-layout-shift"), transfer: audit("total-byte-weight") };
          rows.push(row);
          console.log(`${row.url} [${form}] perf ${row.performance} · a11y ${row.accessibility} · bp ${row.bestPractices} · seo ${row.seo} · LCP ${row.lcp} · TBT ${row.tbt} · CLS ${row.cls} · ${row.transfer}`);
          fs.writeFileSync(path.join(out, `lighthouse-${row.url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}-${form}.json`), JSON.stringify({ categories: lhr.categories, audits: Object.fromEntries(Object.entries(lhr.audits).filter(([, v]) => (v as { score: number | null }).score !== null && (v as { score: number }).score < 0.9).map(([k, v]) => [k, { score: (v as { score: number }).score, title: (v as { title: string }).title, displayValue: (v as { displayValue?: string }).displayValue }])) }, null, 2));
        }
      }
    }
    fs.writeFileSync(path.join(out, "lighthouse.json"), JSON.stringify(rows, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
