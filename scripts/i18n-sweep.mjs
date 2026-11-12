#!/usr/bin/env node
// i18n:sweep — loads routes in EN and in Manglish and lists the visible text that is IDENTICAL in both (still English,
// or a name / number that is meant to stay). The residue is the "not converted yet" list.
//   npm run i18n:sweep -- --base=http://localhost:3000 [--routes=/,/swipe,/battle] [--phone] [--wait=2500]
// Needs playwright-core: set PW_CORE=/path/to/node_modules/playwright-core if it is not installed in this repo.
import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "1"]));
const base = args.base ?? "http://localhost:3000";
const routes = (args.routes ?? "/,/onboarding,/swipe,/battle,/bank,/profile,/feng-shui,/admin,/about,/login,/signup").split(",");
const wait = Number(args.wait ?? 2500);
const size = args.phone ? { width: 400, height: 860 } : { width: 1280, height: 800 };

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PW_CORE, "playwright-core", join(homedir(), "office-brain/node_modules/playwright-core")].filter(Boolean)) {
  try {
    pw = require(p);
    break;
  } catch {}
}
if (!pw) throw new Error("playwright-core not found: set PW_CORE=/path/to/node_modules/playwright-core");
const cache = join(homedir(), "Library/Caches/ms-playwright");
const exe = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().map((d) => join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")).filter(existsSync).pop() : undefined;
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {}).catch(() => pw.chromium.launch());

const collect = () => {
  const out = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) {
    const el = n.parentElement;
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (!t || !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
    out.add(t);
  }
  for (const el of document.querySelectorAll("[aria-label],[placeholder],[title]"))
    for (const a of ["aria-label", "placeholder", "title"]) if (el.getAttribute(a)) out.add(`[${a}] ${el.getAttribute(a)}`);
  return [...out];
};

const visit = async (lang, route) => {
  const ctx = await browser.newContext({ viewport: size });
  await ctx.addCookies([{ name: "homelander-lang", value: lang, url: base }]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base + route, { waitUntil: "domcontentloaded" }).catch((e) => errs.push("goto: " + e.message));
  await page.waitForTimeout(wait);
  const texts = await page.evaluate(collect).catch(() => []);
  await ctx.close();
  return { texts, errs };
};

const noise = (t) => !/[A-Za-z]{3}/.test(t.replace(/^\[[\w-]+\] /, "")) || /^[\d\sRM.,:%/+×x–—·-]+$/.test(t);
let total = 0;
for (const route of routes) {
  const en = await visit("en", route);
  const mg = await visit("mglish", route);
  const a = new Set(en.texts);
  const same = mg.texts.filter((t) => a.has(t) && !noise(t));
  const changed = mg.texts.filter((t) => !a.has(t)).length;
  total += same.length;
  console.log(`\n${route}  ${size.width}px  translated:${changed}  still-identical:${same.length}  page errors: en ${en.errs.length} / mglish ${mg.errs.length}`);
  for (const t of same) console.log("   =", t.length > 110 ? t.slice(0, 107) + "..." : t);
  for (const e of [...en.errs, ...mg.errs].slice(0, 3)) console.log("   !", e.slice(0, 160));
}
console.log(`\nTOTAL still-identical strings (names and numbers included, judge by eye): ${total}`);
await browser.close();
