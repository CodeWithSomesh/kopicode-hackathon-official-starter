# Feng Shui Builder (`/homes/[id]/feng-shui`): teammate B's brief

You own this folder: `src/app/(homelander)/homes/[id]/feng-shui/`. The page is called **Feng Shui Builder**. It was first pitched as **"Tengok Dulu"** (same thing, new name). The original pitch is at https://claude.ai/artifact/5CXz4TaFQJjKjkFUg7scux. Read `docs/homelander-spec.md` for the whole product.

## What to build

A browser-based "try the home before you buy it" visualizer for one Gamuda unit. `[id]` is a unit id from `unitById` in `src/lib/homelander/data.ts`. The placeholder `page.tsx` already looks it up and shows its type, bedrooms and size.

- **Floor plan:** a top-down plan of the unit, with one sample plan per home type (Terrace, Semi-D, Serviced apartment/Condo) drawn as data at real dimensions.
- **Facing direction:** the user sets which way the living room faces: utara, timur, selatan or barat (north, east, south, west).
- **Sun check:** the user sets the time and month. Work out the sun's position for Kuala Lumpur (lat 3.14) with a small solar formula or the `suncalc` package. `panas tak?` reports how much of the living room gets direct sun.
- **Furniture fit:** place furniture at real sizes and report collisions. Commands: `letak` (place), `alih` (move), `pusing` (rotate).
- **Manglish control:**
  - Commands can be typed or spoken. Speech can use the browser's built-in speech recognition.
  - The demo uses a small parser.
  - Stretch goal: send free speech to Claude through the existing `/api/chat` pattern (Vercel AI SDK + AI Gateway) to turn it into the command script.
- **A "For fun, not professional advice" note** must be visible on the page.

## Decisions (grill, 12 Nov)

These override the list above where they differ.

- **No festive modes.** No Raya, CNY, Deepavali or guest seating. It is regular feng shui only.
- **No weather forecast.**
- **Eight facings** (N, NE, E, SE, S, SW, W, NW). The sun uses each township's own latitude and longitude.
- **Three sample plans** (`plans.ts`): Terrace and Semi-D have two floors, Apartment has one. Bungalow uses Semi-D. Every unit is labelled as a sample layout.
- **Feng shui:** rule-based notes and an Ong meter score that update live, plus a bagua overlay. No Kua number.
- **Language:** the command box accepts mixed English, Malay and Manglish, and replies in English or Manglish. Voice input and spoken replies also cover Mandarin and Tamil through an AI route (`src/app/api/feng-shui/route.ts`, approved). The page must still work without AI.
- **3D:** a toggle that renders the same layout state. It is built last and cut first.
- **Saving:** `localStorage` per unit. No Supabase table.
- **Build order:** 1 plans and sun, 2 furniture, 3 feng shui rules, 4 parser, 5 AI and voice, 6 3D.

## AI and voice (phase 5)

- `src/app/api/feng-shui/route.ts` turns free text or speech into the parser's own commands (`commands.ts`). It re-parses every command and drops any it can't read, so the model can never edit the layout directly.
- Same credit guard as `/api/chat`: signed-in users only, unless the app is in demo mode. Locally it needs `AI_GATEWAY_API_KEY` in `.env.local`. `FENG_SHUI_AI_MODEL` overrides `AI_MODEL` for this route only.
- If the AI fails, the page falls back to the quick parser and stops calling the AI for the rest of the session.
- Voice uses the browser's own speech recognition and speech output (`voice.ts`). Tamil speech output depends on the device having a Tamil voice installed.

## How people get here

- **From the landing map:** the home details panel has a **Feng Shui** button. Teammate A builds that.
- **After the bank check:** the winning home has a highlighted **Feng Shui** button. The owner of the main flow builds that.

You don't need to change either entry point. Just make `/homes/<unitId>/feng-shui` work for every unit id.

## Rules

- **Kopitiam theme only.**
  - Use the shared pieces in `src/components/homelander/`: `PixPanel`, `PixButton`, `PixTag`, `PixMeter`, `Sprite`.
  - Use the theme colour classes: `bg-sky`, `bg-cloud`, `text-ink`, `text-ink-soft`, `bg-pandan`, `bg-raya`, `bg-kaya`, `bg-lilac`.
  - Use `font-pixel` for headings and numbers, and the default font for sentences.
  - No new hex colours outside the floor-plan drawing, no gradients, and no emoji as icons.
- **Desktop and phone both matter:**
  - On desktop it's a web layout: the plan large, controls in a side panel.
  - On phones, stack the plan above the controls and leave about 120 px at the bottom for the tab bar.
- **Don't edit shared files** without asking the owner: `src/lib/homelander/*`, `src/components/homelander/*`, `src/app/(homelander)/shell.tsx`, `themes.css`, `layout.tsx`, `src/app/globals.css`. Put your floor plans, furniture and command parser in this folder.
- **Workflow:** work on branch `feat/feng-shui`. Run `npm run check` before every pull request. Open a PR to `main` at least every hour. Test on the Vercel preview URL.
