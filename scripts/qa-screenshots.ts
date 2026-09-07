/**
 * QA screenshots + axe (Definition of Done §10.3, Module 05 U-24/U-27): drives local Chrome through puppeteer-core,
 * optionally signs in with a custom token, and captures each URL at 1440×900 and 390×844 in dark and light.
 *
 *   npm run qa:screenshots -- --uid <uid> --urls /dashboard,/explore --out docs/modules/qa/05 [--themes dark,light]
 *        [--viewports desktop,mobile] [--format png|webp] [--noauth] [--axe] [--base http://localhost:3000] [--wait 1500]
 *   Legacy: --url <one url> --prefix <name>
 * Names are derived from the path (/project/abc/solve/x → project-abc-solve-x). With --axe, violations go to <out>/axe.json
 * and the summary is printed; the process exits 1 when any serious/critical violation is found.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import puppeteer, { type Page } from "puppeteer-core";
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";

const require = createRequire(import.meta.url);
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIGN_IN = (cfg: Record<string, string | undefined>, token: string) => `
  const appMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(${JSON.stringify(cfg)});
  const auth = authMod.getAuth(app);
  await authMod.setPersistence(auth, authMod.indexedDBLocalPersistence);
  const cred = await authMod.signInWithCustomToken(auth, ${JSON.stringify(token)});
  return cred.user.uid;
`;

const VIEWPORTS = { desktop: { width: 1440, height: 900, mobile: false }, mobile: { width: 390, height: 844, mobile: true } } as const;

function nameFor(url: string): string {
  const u = new URL(url);
  const p = u.pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "home";
  return p.slice(0, 60);
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((t) => { localStorage.setItem("theme", t); document.documentElement.classList.remove("dark", "light"); document.documentElement.classList.add(t); }, theme);
}

async function main() {
  const a = args();
  const base = String(a.base ?? "http://localhost:3000");
  const urls = (a.urls ? String(a.urls).split(",") : a.url ? [String(a.url)] : []).map((u) => (u.startsWith("http") ? u : base + u));
  if (!urls.length) throw new Error("--urls or --url is required");
  const out = path.resolve(String(a.out ?? "docs/modules/qa/05"));
  const themes = String(a.themes ?? "dark,light").split(",") as ("dark" | "light")[];
  const viewports = String(a.viewports ?? "desktop,mobile").split(",") as (keyof typeof VIEWPORTS)[];
  const format = (String(a.format ?? "png") as "png" | "webp");
  const noauth = !!a.noauth;
  const runAxe = !!a.axe;
  const wait = Number(a.wait ?? 1500);
  const prefix = a.prefix ? String(a.prefix) : null;
  const uid = a.uid ? String(a.uid) : "";
  if (!noauth && !uid) throw new Error("--uid is required unless --noauth");
  fs.mkdirSync(out, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none", "--use-gl=swiftshader"] });
  const axeSource = runAxe ? fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8") : null;
  const axeReport: Record<string, unknown>[] = [];
  let seriousCount = 0;
  try {
    const page = await browser.newPage();
    if (!noauth) {
      const { customToken, webConfig } = await mintIdToken({ uid });
      await page.goto(`${base}/login`, { waitUntil: "networkidle2" });
      const signedIn = await page.evaluate(new Function(`return (async () => { ${SIGN_IN(webConfig, customToken)} })()`) as () => Promise<string>);
      if (signedIn !== uid) throw new Error(`Signed in as ${signedIn}, expected ${uid}`);
    }
    for (const url of urls) {
      const name = prefix ?? nameFor(url);
      for (const vpKey of viewports) {
        const vp = VIEWPORTS[vpKey];
        for (const theme of themes) {
          await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile });
          await page.goto(url, { waitUntil: "networkidle2" });
          await setTheme(page, theme);
          await page.reload({ waitUntil: "networkidle2" });
          await new Promise((r) => setTimeout(r, wait));
          // Trigger in-view reveals by scrolling through the page, then return to the top.
          await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); } window.scrollTo(0, 0); });
          await new Promise((r) => setTimeout(r, 900));
          const file = path.join(out, `${name}-${vpKey}-${theme}.${format}`);
          await page.screenshot({ path: file as `${string}.png` | `${string}.webp`, type: format, fullPage: !!a.full, ...(format === "webp" ? { quality: 82 } : {}) });
          const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          console.log(`${path.relative(process.cwd(), file)}${hasHScroll ? "  ⚠ horizontal page scroll" : ""}`);
          if (axeSource && theme === themes[0]) {
            await page.evaluate(axeSource);
            const res = await page.evaluate(async () => {
              const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
              const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
              return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
            });
            const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
            seriousCount += serious.length;
            axeReport.push({ url, viewport: vpKey, violations: res });
            console.log(`  axe: ${res.length} violation type(s), ${serious.length} serious/critical${serious.length ? " → " + serious.map((v) => v.id).join(", ") : ""}`);
          }
        }
      }
    }
    if (axeSource) fs.writeFileSync(path.join(out, "axe.json"), JSON.stringify(axeReport, null, 2));
  } finally {
    await browser.close();
  }
  if (seriousCount) { console.error(`axe: ${seriousCount} serious/critical violation(s)`); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
