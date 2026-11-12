/**
 * Keeps the form honest: a profile field is only filled when the buyer's own words say it.
 *
 * Mochi's model returns, next to each field, the exact words it took the value from. A field
 * survives only when that quote really is in what the buyer said (not in what Mochi said), and a
 * number only when the quote holds a number. Anything else is dropped, so a misheard line or a
 * model's guess never turns into a fake salary on screen.
 */

export type Evidence = { field: string; quote: string }[];

/** Fields whose value is a number the buyer has to say. */
const NUMBER_FIELDS = new Set([
  "grossRM",
  "takeHomeRM",
  "otherIncomeRM",
  "jointGrossRM",
  "carRM",
  "ptptnRM",
  "personalRM",
  "cardBalanceRM",
  "housingRM",
  "savingsRM",
  "age",
  "minBedrooms",
  "officeDays",
]);

/** Fields that follow from another one the buyer stated (householdSize from livingWith). */
const FOLLOWS: Record<string, string> = { householdSize: "livingWith" };

/** Lowercase, no spaces or punctuation, so "RM 8,000." matches "rm8000" and Chinese matches as is. */
export function norm(s: string) {
  return s.toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");
}

const NUMBER_WORD =
  /\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|k|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan|sepuluh|sebelas|belas|puluh|ratus|ribu|seratus|seribu|kosong)\b|[零一二两三四五六七八九十百千万]|ஒன்று|இரண்டு|மூன்று|நான்கு|ஐந்து|ஆறு|ஏழு|எட்டு|ஒன்பது|பத்து|ஆயிரம்|லட்சம்/i;
/** "No car loan", "takde", "没有", "இல்லை": a 0 needs one of these. */
const NONE_WORD = /\b(no|none|nothing|zero|nil|don'?t|do not|never|tiada|takde|tak ada|tidak|bukan|kosong)\b|没有|没|无|不|இல்லை/i;

const DAYS_WORD =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekdays?|every ?day|daily|hybrid|remote|wfh|work from home|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|hari-hari|setiap hari)\b|星期|周[一二三四五六日]|每天|天天|在家|திங்கள்|வெள்ளி|தினமும்/i;

export function hasNumber(s: string) {
  return NUMBER_WORD.test(s);
}

/** The patch with every field the buyer didn't actually say removed. */
export function groundPatch<T extends Record<string, unknown>>(patch: T, evidence: Evidence, buyerText: string): Partial<T> {
  const said = norm(buyerText);
  const quotes = new Map<string, string[]>();
  for (const e of evidence) {
    const q = norm(e.quote ?? "");
    // One letter or one Chinese character is too little to prove anything.
    if (q.length < 2 || !said.includes(q)) continue;
    quotes.set(e.field, [...(quotes.get(e.field) ?? []), e.quote]);
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue;
    const own = quotes.get(k) ?? [];
    const proof = own.length ? own : FOLLOWS[k] ? (quotes.get(FOLLOWS[k]) ?? []) : [];
    if (!proof.length) continue;
    // Office days are often said as days, not numbers: "Monday to Friday", "every day", "hybrid".
    if (k === "officeDays" && proof.some((q) => DAYS_WORD.test(q))) {
      out[k] = v;
      continue;
    }
    if (NUMBER_FIELDS.has(k)) {
      const ok = v === 0 ? proof.some((q) => NONE_WORD.test(q) || hasNumber(q)) : proof.some(hasNumber);
      if (!ok) continue;
    }
    out[k] = v;
  }
  return out as Partial<T>;
}

/** Tells the model what to put in "evidence"; shared by the chat brain and the call note-taker. */
export const EVIDENCE_RULE = `- "evidence": for EVERY non-null field in "patch", one entry with the field name and the buyer's exact words that state it, copied character for character from a user message (same language, no translation, no paraphrase, never from Mochi's lines). A field with no such words must be null in "patch". Never guess, never fill an example value, and never assume a typical salary, age or loan. If a line looks garbled or misheard, treat it as saying nothing.`;
