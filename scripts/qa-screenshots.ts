/**
 * Module 03 QA screenshots (Definition of Done §10.3): drives the local Chrome through
 * puppeteer-core, signs in with a custom token, and captures the workspace at 1440×900 and
 * 390×844 in dark and light. Output: docs/modules/qa/03/*.png
 *
 *   npm run qa:screenshots -- --uid <uid> --url http://localhost:3000/project/<id>/solve/<problemId> [--out docs/modules/qa/03] [--prefix workspace]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { args } from "./_bootstrap";
import { mintIdToken } from "./dev-token";

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

async function main() {
  const a = args();
  const uid = String(a.uid ?? "");
  const url = String(a.url ?? "");
  const out = path.resolve(String(a.out ?? "docs/modules/qa/03"));
  const prefix = String(a.prefix ?? "workspace");
  if (!uid || !url) throw new Error("--uid and --url are required");
  fs.mkdirSync(out, { recursive: true });

  const origin = new URL(url).origin;
  const { customToken, webConfig } = await mintIdToken({ uid });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"] });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/login`, { waitUntil: "networkidle2" });
    const signedIn = await page.evaluate(new Function(`return (async () => { ${SIGN_IN(webConfig, customToken)} })()`) as () => Promise<string>);
    if (signedIn !== uid) throw new Error(`Signed in as ${signedIn}, expected ${uid}`);

    const shots: { name: string; width: number; height: number; theme: "dark" | "light"; mobile: boolean }[] = [
      { name: "desktop-dark", width: 1440, height: 900, theme: "dark", mobile: false },
      { name: "desktop-light", width: 1440, height: 900, theme: "light", mobile: false },
      { name: "mobile-dark", width: 390, height: 844, theme: "dark", mobile: true },
      { name: "mobile-light", width: 390, height: 844, theme: "light", mobile: true },
    ];
    for (const s of shots) {
      await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 2, isMobile: s.mobile, hasTouch: s.mobile });
      // The workspace theme lives in users.settings.editor.theme (server wins on hydration), mirrored by next-themes.
      await page.evaluate(new Function(`return (async () => {
        localStorage.setItem("theme", ${JSON.stringify(s.theme)});
        localStorage.removeItem("algobook:workspace-settings");
        const appMod = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js");
        const authMod = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js");
        const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(${JSON.stringify(webConfig)});
        const auth = authMod.getAuth(app);
        await new Promise((resolve) => { const off = authMod.onAuthStateChanged(auth, (u) => { if (u) { off(); resolve(); } }); });
        const token = await auth.currentUser.getIdToken();
        await fetch("/api/me/settings", {
          method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ editor: { theme: ${JSON.stringify(s.theme === "dark" ? "algobook-dark" : "algobook-light")} } }),
        });
      })()`) as () => Promise<void>);
      await page.goto(url, { waitUntil: "networkidle2" });
      await page.waitForSelector(".monaco-editor .view-line", { timeout: 60_000 }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 1500));
      const file = path.join(out, `${prefix}-${s.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log("saved", path.relative(process.cwd(), file));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
