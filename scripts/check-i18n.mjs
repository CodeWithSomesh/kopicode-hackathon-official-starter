#!/usr/bin/env node
// i18n:check — every t("English") literal in src/ has a Manglish entry; entries are well-formed and not contradictory.
//   npm run i18n:check                      all of src
//   npm run i18n:check -- --area=swipe      only report gaps for source files whose path contains "swipe"
//   npm run i18n:check -- --warn            print everything but exit 0
// Errors (exit 1): missing entry, same key twice with different values, a digit / RM / {var} in the English that the
// Manglish drops, a dict line the parser cannot read. Warnings: with --unused, entries no t() literal uses (dynamic t(variable) keys are invisible
// to this script), duplicate key with equal value, Manglish > 1.6x English length.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");
const dictDir = join(src, "lib/homelander/i18n/dict");
const args = process.argv.slice(2);
const area = args.find((a) => a.startsWith("--area="))?.slice(7);
const warnOnly = args.includes("--warn");

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

// ---- dictionary
const entries = new Map(); // key -> [{file, value}]
const errors = [];
const warns = [];
const line = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"),?\s*$/;
for (const f of readdirSync(dictDir).filter((f) => f.endsWith(".ts") && !["index.ts", "types.ts"].includes(f))) {
  const lines = readFileSync(join(dictDir, f), "utf8").split("\n");
  let inBody = false;
  lines.forEach((l, i) => {
    if (/^export const \w+: Dict = \{/.test(l)) return void (inBody = true);
    if (!inBody) return;
    if (/^\};/.test(l)) return void (inBody = false);
    if (!l.trim() || /^\s*\/\//.test(l)) return;
    const m = l.match(line);
    if (!m) return void errors.push(`${f}:${i + 1} cannot parse (one "English": "Manglish", per line): ${l.trim().slice(0, 80)}`);
    const k = JSON.parse(m[1]);
    const v = JSON.parse(m[2]);
    (entries.get(k) ?? entries.set(k, []).get(k)).push({ file: f, value: v, line: i + 1 });
  });
}
for (const [k, list] of entries) {
  if (list.length > 1) {
    const same = list.every((e) => e.value === list[0].value);
    (same ? warns : errors).push(`duplicate key "${k}" in ${list.map((e) => `${e.file}:${e.line}`).join(", ")}${same ? " (same value; move to shared.ts)" : " WITH DIFFERENT VALUES"}`);
  }
  const v = list[0].value;
  const tokens = (s) => [...(s.match(/\{\w+\}|\d+|RM/g) ?? [])].sort().join("|");
  if (tokens(k) !== tokens(v)) errors.push(`${list[0].file}:${list[0].line} "${k}": placeholders/digits/RM differ (${tokens(k) || "none"} vs ${tokens(v) || "none"})`);
  if (v.length > 12 && v.length > k.length * 1.6) warns.push(`${list[0].file}:${list[0].line} "${k}" -> ${v.length} chars vs ${k.length}: long`);
}

// ---- usages: t("...") (or tr("...") where t is already taken by a loop variable) with a plain string or backtick literal without ${}
const used = new Map(); // key -> [file]
const call = /(?<![\w.$])tr?\(\s*("(?:[^"\\\n]|\\.)*"|`[^`$\n]*`)/g;
for (const f of walk(src)) {
  if (f.includes("/i18n/")) continue;
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(call)) {
    let key;
    try {
      key = m[1][0] === "`" ? m[1].slice(1, -1) : JSON.parse(m[1]);
    } catch {
      continue;
    }
    const rel = relative(root, f);
    (used.get(key) ?? used.set(key, []).get(key)).push(rel);
  }
}
let missing = 0;
for (const [k, files] of used) {
  if (entries.has(k)) continue;
  const hit = files.filter((f) => !area || f.includes(area));
  if (!hit.length) continue;
  missing++;
  errors.push(`missing: "${k}"  (${[...new Set(hit)].join(", ")})`);
}
if (args.includes("--unused")) for (const k of entries.keys()) if (!used.has(k)) warns.push(`unused (or used only via a variable): "${k}" in ${entries.get(k)[0].file}`);

console.log(`i18n:check: ${used.size} distinct t() keys in code, ${entries.size} dictionary entries, ${missing} missing${area ? ` (area "${area}")` : ""}`);
for (const w of warns) console.log("warn  " + w);
for (const e of errors) console.log("ERROR " + e);
process.exit(errors.length && !warnOnly ? 1 : 0);
