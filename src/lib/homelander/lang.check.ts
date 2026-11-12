// Run with `npm run check:grounding`: which language Mochi should answer in.
import assert from "node:assert/strict";
import { clearLang, detectLang } from "./lang.ts";
assert.equal(detectLang("நான் என் மனைவியுடன் வசிக்கிறேன்"), "ta");
assert.equal(detectLang("naan en manaivi kooda irukken"), "ta");
assert.equal(detectLang("我在Kuala Lumpur工作，my salary is 8000"), "zh");
assert.equal(detectLang("Saya kerja kat KL, gaji saya 5000"), "ms");
assert.equal(detectLang("I live with my wife in Kajang"), "en");
assert.equal(clearLang("I live"), null);
assert.equal(detectLang("and I am at home in the end"), "en");
console.log("lang: all checks passed");
