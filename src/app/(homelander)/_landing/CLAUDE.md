# Landing page (`/`): teammate A's brief

You own the HomeLander landing page: `src/app/(homelander)/page.tsx` and everything in `src/app/(homelander)/_landing/`. Read `docs/homelander-spec.md` for the whole product.

## What to build

A full-screen 3D map in the style of **PayGap City** (https://paygap.asia/paygap-city), but it shows **only Gamuda Land properties across Malaysia** (Klang Valley, Johor, Sabah).

- **Pins:** each project is a floating pill like PayGap's company pills: a small house sprite, the project name, "From RM…", and units left. Current projects are full colour; completed projects (HighPark Suites, The Robertson, Madge Mansions and others) are greyed out as "Completed, resale only".
- **Click a pin:** a details panel opens (side panel on desktop, bottom sheet on phones) with:
  - photos, price range, home types, tenure, completion, and units left (sample);
  - nearby rail stations and the nearest school of each type (national, Chinese, Tamil, international) with distance;
  - a link to the official Gamuda Land page;
  - two buttons: **Start with Uncle**, which goes to `/login` (later `/onboarding`), and **Feng Shui**, which goes to `/homes/<unitId>/feng-shui`.
- **Copy PayGap's controls:**
  - a search box for projects and places;
  - filters for price, home type and state;
  - a list of states down the left side (Kuala Lumpur, Selangor, Johor, Sabah) that flies the map there;
  - zoom, compass and 2D/3D buttons;
  - a "Check your commute cost" call to action, which goes to `/login`.
- **A small floating pitch card** saying "Find the Gamuda home that fits your life. Uncle will help.", with **Start with Uncle** as the primary button.
- **Login sits at the top right.** The shared header already has it, so don't add a second one.

## The map now (one landing map: the First Key engine)

- `/` renders `FindClient` (`src/app/find/find-client.tsx`) around `NeighbourhoodMap` (`src/components/first-key/map/neighbourhood-map.tsx`): Klang Valley overview, township fly-in, 3D block, then the three.js burst. `/find` only redirects to `/` (keeps `?building=&unit=&dev=`). Somesh's old MapLibre `map-view.tsx` is gone.
- The files here are the overlays: `town-pill.tsx` (pills), `township-list.tsx` (left list, chips, rail legend), `town-panel.tsx` (details panel / bottom sheet), `map-controls.tsx` (zoom, compass, 2D/3D), `map-data.ts` (rail, pill leans; `pillLeanPhone` for phones). Edit these freely; the map and burst files belong to the First Key work.
- Basemap: our PMTiles file when `NEXT_PUBLIC_PMTILES_URL` is set (Liberty's flat layers paint underneath, so a wide screen never shows blank past the file's edge); otherwise OpenFreeMap Liberty with our layers on top. The map is tilted by default (pitch 52, bearing -12). Night follows the app theme (`data-jtheme="night"` on `.homelander-world`), not the OS; both basemaps are recoloured dark with lit windows, and the map ignores the Night Market CSS canvas invert.
- The map worker is the static `public/homelander/maplibre/maplibre-gl-worker.mjs` (`setWorkerUrl`); MapLibre is pinned to 6.16.0, re-copy the file if you change it.
- Not built yet: search box, filters, "Check your commute cost" CTA, floating pitch card.
- Township positions in `src/lib/homelander/data.ts` come from OpenStreetMap (cove, gardens, jade, kundang); `twentyfive.7` is unverified.

## Data

- **Project data is shared.** The project and unit list lives in `src/lib/homelander/data.ts` (`townships`, `units`, `availabilityOf`, commute helpers). The owner of the shared code is replacing the sample data with real Gamuda Land projects from `docs/research/jodoh-data-sources.md`. Read projects from there; don't hard-code your own list. If you need a field that isn't there (state, status, official URL, photos), ask for it, or add it in a small separate commit.
- **Schools:** come from OpenStreetMap; see the research doc.

## Rules

- **Kopitiam theme only.**
  - Use the shared pieces in `src/components/homelander/`: `PixPanel`, `PixButton`, `PixTag`, `PixMeter`, `Sprite`, `UnitPhoto`.
  - Use the theme colour classes: `bg-sky`, `bg-cloud`, `text-ink`, `text-ink-soft`, `bg-pandan`, `bg-raya`, `bg-kaya`, `bg-lilac`.
  - Use `font-pixel` for headings and big numbers, `font-pixel-label` for tiny tags, and the default font for sentences.
  - No new hex colours, no gradients, and no emoji as icons.
- **Desktop and phone both matter:**
  - On desktop (≥1024 px) this is a web layout: the shared header with nav at the top.
  - On phones there's a bottom tab bar about 100 px tall, so keep panels above it and keep clear of the ~72 px header.
  - `/` is full-bleed, so the header floats over your map.
- **Don't edit shared files** without asking the owner: `src/lib/homelander/*`, `src/components/homelander/*`, `src/app/(homelander)/shell.tsx`, `themes.css`, `layout.tsx`, `src/app/globals.css`.
- **Workflow:** work on branch `feat/landing`. Run `npm run check` before every pull request. Open a PR to `main` at least every hour. Test on the Vercel preview URL.
