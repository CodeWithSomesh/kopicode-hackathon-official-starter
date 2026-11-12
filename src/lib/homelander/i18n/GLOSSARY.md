# Manglish glossary and style guide

Read this before you convert any string. The switch is "EN | Manglish" in the header; the language is a cookie (`homelander-lang`), read on the server.

## How to convert a string

```tsx
// client component
import { useT } from "@/lib/homelander/i18n/client";
const t = useT();                       // call inside the component, never at module scope
<button>{t("Start with Uncle")}</button>
<span>{t("{n} units left", { n: units })}</span>
<input aria-label={t("Search projects")} />

// server component / generateMetadata / route handler
import { getT } from "@/lib/homelander/i18n/server";
const t = await getT();

// plain module (no hooks)
import { translate } from "@/lib/homelander/i18n/translate";   // translate(lang, "English", vars)
```

Then add the line to YOUR area's file in `src/lib/homelander/i18n/dict/` (one entry per line, double-quoted):

```ts
"{n} units left": "{n} units left only",
```

English text is the key. No entry = the English shows (safe). Verify: `npm run i18n:check -- --area=<path fragment>` and `npm run i18n:sweep`.

## Rules every lane follows (the script enforces most)
1. Wrap at render: `{t("Swipe right to like")}`. Attributes too: `aria-label={t("Zoom in")}`. Accessibility labels are converted too.
2. The English inside `t()` is a **string literal** (or a template with no expressions); the script greps it. Dynamic parts go in `{vars}`.
3. Never translate: project, township, school, station and people names, RM amounts, areas (sqft), distances, percentages, dates, "HOMELANDER", "Gamuda", "Feng Shui", "Uncle", "Kopi O", "Teh Susu".
4. Do not change layout or class names while wrapping. Manglish runs longer: keep each string within about 1.3x the English length; tab-bar labels at most 8 characters, buttons at most 22.
5. A key used in two areas has one translation: put it in `dict/shared.ts` (the script flags the same key in two files with different values).

## Voice and fixed terms

**Voice.** A friendly Malaysian friend at the kopitiam: mostly English, light Bahasa Melayu words, a few particles (lah, mah, leh, kan). Warm and a bit funny. **Never mocking** the buyer, Uncle or any community or accent; no jokes about price or money trouble; no slang only one community uses; no ALL-CAPS shouting. At most one particle per sentence, and not on every string: buttons are short imperatives, particles go on helper text and toasts. Errors are calm and clear first ("Alamak, cannot save. Try again?"), joke second.

**Stays English:** names/places/prices/numbers/units (rule 3), money and legal terms Malaysians say in English anyway (loan, instalment, DSR, down payment, tenure, freehold, leasehold), button verbs already normal (Login, Save, Share).

| English | Manglish (fixed) | Note |
|---|---|---|
| Start with Uncle | Jom chat with Uncle | primary CTA, same everywhere |
| Ask Uncle | Tanya Uncle | |
| Map / Swipe / Battle / Bank | Map / Swipe / Lawan / Bank | tab labels, max 8 chars |
| Profile | Profile | |
| Login / Sign up | Login / Daftar | |
| Gamuda view | Gamuda view | |
| Like / Liked | Suka / Suka | |
| Close / Back / Next | Tutup / Back / Next | |
| Search | Cari | |
| Filter | Tapis | |
| Loading… | Tunggu sat… | |
| Something went wrong | Alamak, something wrong | |
| Try again | Cuba lagi | |
| No results | Alamak, tak jumpa | empty states |
| From RM{n} | From RM{n} | numbers fixed |
| {n} units left | {n} units left only | |
| Last unit | Last unit, hurry lah | |
| Available | Boleh beli | |
| Completed, resale only | Dah siap, resale only | greyed pins |
| Sold out | Habis | |
| Can I afford it? | Mampu ke? | bank |
| Monthly payment | Bayaran sebulan | |
| Commute | Perjalanan ke office | |
| Nearby schools | Sekolah dekat sini | |
| Nearby stations | Stesen dekat sini | |
| Winner | Menang | battle |
| It's a draw | Seri lah | |
| Your top picks | Pilihan steady kau | |
| Floor {n} | Floor {n} | slider label |
| Day / Dusk / Night | Siang / Senja / Malam | map button: keep English if it overflows the 40 px button |
| Yes / No / Maybe | Ya / Tak / Maybe lah | matches Uncle's existing labels |

Addressing the buyer in UI = "you" (not "kau": too casual for some). Uncle may say "kau" in his own lines, which already exist.

