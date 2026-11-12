# Lane: map and motion (Tim)

Preliminary. Written Thu 12 Nov, before the grilling session. The grilling session can change any of this; `docs/PLAN.md` wins once it is filled in.

## What I am building

The part of First Key between the swipe and the floor plan:

1. **The neighbourhood map** (`/find`): a tilted 3D map (about 52°) of a made-up township. Buildings stand up in 3D, the train line and stations show, and nearby places (school, clinic, grocery, kopitiam, places of worship, parks) appear as pins with distance and direction. A slow rotating opening shot. Clicking a building flies the camera to it.
2. **The building burst**: the selected building opens isometrically. Floors pull apart, the front is cut away, units are coloured by price, and the chosen unit is highlighted. A slider and dragging on the building control how far it opens.
3. **The hand-over** between the two: a short animated move from map to building and back.
4. **The shared contract** the other lanes build on: the unit and township types, the made-up township data, and the distance and walking-time helpers.

## My decisions, and why

| # | Decision | Why |
|---|---|---|
| 1 | **Build the first-home finder, with the map and an opened-up building at its heart** | Gamuda's own results briefing says Malaysia "remained affected by affordability constraints"; property sales fell 22% to RM3.2b and this year's target is RM7b. Homes cost 4.2 times median household income. Swiping alone has existed since 2014, so the swipe can't be what's new. What's new is opening the exact building and unit and checking train, sun, cost and layout before a visit. The map and the burst are what judges remember, so they get priority |
| 2 | **MapLibre with a Protomaps basemap** | Free and open: no paid map account, no usage bill, OpenStreetMap data. It is the same approach PAYGAP City uses, so we know it holds up in a real product. Protomaps ships a light and a dark map style, which become our Teh Susu and Kopi O map looks for the 5pm challenge |
| 3 | **Tilted 3D map at about 52°, buildings standing up, slow rotating opening shot** | Taken from PAYGAP City, where it reads as "a city you can explore" in the first seconds. Judges form a view in the first 30 seconds |
| 4 | **The building is drawn by code (React Three Fiber, orthographic camera), not loaded as a 3D model** | There is no real interior data, and a code-built building is what lets floors separate, the front be cut away and each unit be coloured by price. AI-generated models (Meshy) come as one solid piece and can't do that, so they are only for props such as furniture |
| 5 | **Orthographic camera for the building** | It gives the true isometric "dollhouse" look, with no perspective distortion, which is what makes the floors easy to read when they are pulled apart |
| 6 | **One progress value from 0 to 1 drives the burst, from scroll or drag** | Idea taken from Scroll Craft: when one number drives everything, scroll and drag can never fight, and a judge can drag the building open themselves on stage |
| 7 | **A full-screen route, `/find`, outside the dashboard** | The map needs the whole screen; the dashboard sidebar would squeeze it. This breaks the starter's "features go under /dashboard" rule on purpose: the team agreed the map and motion take priority |
| 8 | **Map and 3D load in the browser only** (`next/dynamic`, `ssr: false`) | Both need the browser's WebGL and crash during server rendering in Next.js |
| 9 | **Only one heavy scene renders at a time** | The map and the 3D building each use the graphics card. Pausing one while the other shows keeps an ordinary laptop smooth on the venue projector |
| 10 | **Colours come from the CSS tokens and are re-read when the theme changes** | Kopi O and Teh Susu must change the whole app, including the map and the building. The map style and 3D materials need real colour values, so they read the tokens at runtime instead of hard-coding colours. This bends the starter's "never raw hex" rule only inside the map style and the 3D scene |
| 11 | **Exact pinned versions, each at least two weeks old; React stays on 19.3** | Brand-new releases break at the worst moment. MapLibre, Motion and GSAP all shipped new versions this week, so we stay one step back. React Three Fiber 9.8 only supports React 19.0 to 19.3 |
| 12 | **Our own map file, hosted outside the repo, no Protomaps key** (changed 12 Nov, 21:00) | Same approach as PAYGAP City: a 3 MB cut-out of the free Protomaps/OpenStreetMap build for our area, read with `pmtiles://`, its address in `NEXT_PUBLIC_PMTILES_URL`, the file in a public Supabase Storage bucket. The hosted Protomaps key was dropped: it is free only for non-commercial use and makes the demo depend on their server. Without the variable the map still shows our township on a plain background |
| 13 | **A made-up township on open ground, every number labelled illustrative** | The rules allow made-up or public data only. Putting the made-up buildings on open ground stops them overlapping real buildings on the basemap |
| 14 | **The shared contract goes in its own small branch, merged first** | Three people are building three pieces that must join up. Agreeing the `Unit` and township types first means the swipe, the map and Tengok Dulu all read the same data, and merges don't clash at 2am |
| 15 | **I stay out of the themes, `PLAN.md`, the swipe and Tengok Dulu** | Clear ownership: each of us can work without waiting for or overwriting the others |
| 16 | **Motion: one tool per job** (Motion for UI and swipe, GSAP for timelines and scroll, react-spring for the floors, clipping planes for the cutaway) | Nobody learns two libraries for the same thing tonight. ThreeUI is not installed (it is raw three.js, not React Three Fiber); at most one of its backgrounds is copied as a template |
| 17 | **Reduced motion keeps everything visible, just still** | Some judges' devices have motion turned off; the demo must still work and read clearly for them |

## What I own (please don't edit without asking)

| Path | What |
|---|---|
| `src/app/find/**` | The full-screen route. It sits outside the dashboard on purpose: the map needs the whole screen |
| `src/components/first-key/map/**` | `NeighbourhoodMap` and its layers |
| `src/components/first-key/burst/**` | `BuildingBurst` (React Three Fiber) |
| `src/lib/first-key/**` | Shared contract: `types.ts`, `township.ts`, `geo.ts`. **Everyone reads these; change them by asking me or by a small PR** |
| `docs/FIRST-KEY.md` | The full plan and stack |

Shared files I will touch, in small separate commits:

- `package.json` and `package-lock.json`: adding the map and 3D packages, at exact pinned versions (listed in `docs/FIRST-KEY.md`). Please don't bump React: React Three Fiber 9.8 needs React 19.0 to 19.3.
- `.env.example`: `NEXT_PUBLIC_PMTILES_URL` (empty; replaced `NEXT_PUBLIC_PROTOMAPS_KEY`). Not a secret: it is the public address of the map file. Without it, the map still shows the township on a plain background.

## What I am NOT touching

- `docs/PLAN.md` (the grilling session fills it).
- The Kopi O and Teh Susu themes and the theme toggle. My map and 3D colours read whatever theme is active, so they follow automatically.
- The swipe cards, the side card, Manglish mode, the kopi Easter egg.
- Tengok Dulu, the floor plan.
- `src/components/app/nav.ts`, `globals.css`, Supabase migrations.

## How the other lanes plug into mine

- **The swipe sends buyers to the map:** link to `/find?building=<buildingId>` (and optionally `&unit=<unitId>`). The map opens on that building.
- **Tengok Dulu receives a unit:** when a unit is tapped in the building burst, I call `onSelectUnit(unit: Unit)`. The `Unit` type is in `src/lib/first-key/types.ts`, and it carries the rooms, windows, door and facing that the floor plan needs. Tell me which you prefer: a prop callback, a URL like `/find/unit/<unitId>`, or opening your component in a panel.
- **The side card reads the same data:** price, monthly instalment, nearest station and walking minutes come from `src/lib/first-key/township.ts` and `geo.ts`.
- **Themes:** set the theme on `<html>` (next-themes). Don't hard-code colours in my components; I read the CSS tokens at runtime.

## Branches

- `chore/shared-contract`: types, township data, helpers, `docs/FIRST-KEY.md`. **Small. Please merge it early**, so every lane builds on the same types.
- `feat/find-foundation`: the map, the burst and the hand-over. Built from `chore/shared-contract`. Pull request around 22:30.

## Stack in my lane

MapLibre GL (via `react-map-gl/maplibre`), Protomaps basemap, three.js via React Three Fiber v9 with an orthographic camera, `@react-spring/three` for the floors springing apart, three.js clipping planes for the cutaway, drei for labels and outlines, GSAP and Motion for the hand-over. The map and 3D scene load in the browser only (`next/dynamic` with `ssr: false`), and only one of the two heavy scenes renders at a time.

## Timeline for this lane

- 20:30: plain map with standing buildings, plain stacked-box building.
- 22:00: joined up with the swipe and Tengok Dulu, merged to `main`.
- 23:30: burst animation, cutaway, colours following the theme.
- 00:00: code freeze.
