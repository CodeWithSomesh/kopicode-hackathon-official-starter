# Feng Shui (`/homes/[id]/feng-shui`): teammate B's brief

You own this folder: `src/app/(homelander)/homes/[id]/feng-shui/`. Feng Shui is the feature first pitched as **"Tengok Dulu"** (same thing, new name). The original pitch is at https://claude.ai/artifact/5CXz4TaFQJjKjkFUg7scux. Read `docs/homelander-spec.md` for the whole product.

## What to build

A browser-based "try the home before you buy it" visualizer for one Gamuda unit. `[id]` is a unit id from `unitById` in `src/lib/homelander/data.ts`. The placeholder `page.tsx` already looks it up and shows its type, bedrooms and size.

- **Floor plan:** a top-down plan of the unit, with one sample plan per home type (Terrace, Semi-D, Serviced apartment/Condo) drawn as data at real dimensions.
- **Facing direction:** the user sets which way the living room faces: utara, timur, selatan or barat (north, east, south, west).
- **Sun check:** the user sets the time and month. Work out the sun's position for Kuala Lumpur (lat 3.14) with a small solar formula or the `suncalc` package. `panas tak?` reports how much of the living room gets direct sun.
- **Furniture fit:** place furniture at real sizes and report collisions. Commands: `letak` (place), `alih` (move), `pusing` (rotate).
- **Occasion modes:** `mode biasa|raya|cny`.
  - Raya checks guest seating.
  - CNY tests a 10-seat round table.
- **Manglish control:**
  - Commands can be typed or spoken. Speech can use the browser's built-in speech recognition.
  - The demo uses a small parser.
  - Stretch goal: send free speech to Claude through the existing `/api/chat` pattern (Vercel AI SDK + AI Gateway) to turn it into the command script.
- **A "For fun, not professional advice" note** must be visible on the page.

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
