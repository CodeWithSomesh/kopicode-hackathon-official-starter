# First Key: team brief (Gamuda hackathon, Thu 12 to Fri 13 Nov 2026)

Use this as the input to a grilling session. Grill the plan, not the idea: the idea is decided. Time-box the session to 25 minutes.

## The constraints

- Three builders, working in the team starter repo: https://github.com/CodeWithSomesh/kopicode-hackathon-official-starter (Next.js 16, React 19, Tailwind v4, next-themes, Supabase, Vercel AI SDK, demo mode, CI).
- The starter's own timeline: **code freeze at 12 AM**, test the live URL together until 1:30 AM, demo video, slides and rehearsal until 6:30 AM, submit by 8:30 AM. `main` must always deploy.
- Pitch: 5 minutes strict, then 2 minutes of questions.
- Made-up or public data only. Nothing internal on screen.
- Judging: Problem, value and feasibility 30 · Working demo and UI/UX 30 · Creativity and innovation 20 · Presentation 15 · 5pm challenge 5.
- The 5pm challenge (must ship): (1) two themes across the whole app, Kopi O = dark and Teh Susu = light; (2) a hidden coffee Easter egg revealed on stage; (3) a Manglish toggle that switches all app text.

## The product in one paragraph

A first-time buyer enters income, savings and workplace, then swipes through home cards (price, monthly instalment, upfront cash, travel time to work). The map flies into a tilted 3D neighbourhood. Tapping the building bursts it open isometrically: floors pull apart, the front is cut away, units glow by price. Tapping a unit opens Tengok Dulu, the floor plan of that unit: sun across the rooms, furniture at real size, feng shui notes, "can 12 people fit for Raya?". The app explains in plain words what the buyer keeps choosing and shortlists three homes they can afford.

## Why it matters to Gamuda (public facts only)

- Property sales fell 22% to RM3.2b last financial year; this year's target is RM7b. Gamuda says Malaysia "remained affected by affordability constraints" (results briefing, Sep 2026; Gamuda puts the fall mainly down to Hanoi launches moving into this year).
- The median Malaysian home costs 4.2 times median household income (Khazanah Research Institute, 2026). 33,094 finished homes were unsold in 1H2026 (NST quoting NAPIC, Sep 2026).
- Honest about what is not new: swipe-style home search has existed since 2014. The new part is opening the exact unit and checking the train, the sun, the monthly cost and the layout before visiting.

## The demo flow (what judges see)

1. A judge scans a QR code and enters a salary, or taps a ready-made buyer.
2. Swipe home cards.
3. The map flies in, 3D buildings, train lines and places with distance and direction lines.
4. Tap the building: floors burst apart (scroll or drag drives the burst), units coloured by price.
5. Tap a unit: Tengok Dulu floor plan, sun, furniture, feng shui notes, Raya and CNY layouts, Manglish commands.
6. The app explains the shortlist. Then the 5pm challenge in 40 seconds: Kopi O, Manglish, kopi egg.

## Stack

| Part | Tool | Notes |
|---|---|---|
| App | The starter: Next.js 16, React 19, Tailwind v4 tokens, shadcn/Radix UI | Follow the starter's CLAUDE.md: tokens not raw hex, one accent colour, dark mode respected, features under `src/app/dashboard/<feature>/` |
| Themes | next-themes (already in the starter) | `themes={['teh-susu','kopi-o']}`, attribute `data-theme`; every colour from tokens, so the whole app and the map switch together |
| Map | MapLibre GL JS with a React wrapper | Same approach as PAYGAP City: tilt about 52° in 3D, buildings extruded from zoom 14, opening camera at tilt 36° rotating slowly over 20 s |
| Map data | Protomaps basemap, own PMTiles file or a free key | OpenStreetMap data. Protomaps ships light and dark styles: these are Teh Susu and Kopi O for the map. Credit OpenStreetMap on screen. Never reuse PAYGAP's own map file or code |
| Pins | Supercluster for grouping, custom pin icons | |
| Building view | three.js via React Three Fiber, orthographic camera | Building made by code from floors and units, not a model file |
| Burst and cutaway | @react-spring/three for floors springing apart; three.js clipping planes for the cut-away front | Scroll or drag progress 0 to 1 drives it (idea from Scroll Craft) |
| Labels and glow | @react-three/drei (Html, Edges, ContactShadows); @react-three/postprocessing (Outline, Bloom) | |
| Map-to-building hand-over | GSAP timeline | Fast at the edges, calm in the middle |
| UI motion and swipe | Motion (Framer Motion) | |
| Floor plan (Tengok Dulu) | 2D canvas | Keep 2D; faster and clearer than a second 3D scene |
| Sun | SunCalc | One shared module for the building view and the floor plan |
| Places | Overpass API (OpenStreetMap), fetched once and saved to a file | Schools, clinics, groceries, stations, places of worship, parks |
| Explanation | Vercel AI SDK through the AI Gateway (already in the starter) | One call with swipes and shortlist; a saved answer as backup; English or Manglish |
| Easter egg | Lottie or CSS keyframes | An iced kopi in a tied bag swings down from a kopitiam pin |
| Optional polish | One ThreeUI animated background (copy one HTML template, do not install the package); Meshy-generated props (GLB) | Meshy free plan: limited credits and 10 downloads a month; company-use licence unchecked. Not for the building itself |

Exact versions are in the install line below. Use the wrapper's MapLibre entry, `react-map-gl/maplibre`.

## Frontend first: map and motion set-up (these win over the starter's rules)

1. **Give the experience its own full-screen route.** Put it at src/app/find/, outside the dashboard and its sidebar. The map and the building need the whole screen. Overrides the starter’s “features go under /dashboard”.
2. **Load the map and the 3D scene in the browser only.** Each lives in a "use client" component loaded with next/dynamic and ssr: false. Both need the browser’s WebGL and break during server rendering. Import maplibre-gl/dist/maplibre-gl.css once.
3. **Map tiles outside the repo.** Use a Protomaps key, or put the PMTiles file on Supabase Storage or another host. Never commit it: it is large and Vercel serves it badly. Register the pmtiles:// protocol once in a useEffect, the way PAYGAP City does.
4. **Colours bridge from tokens into WebGL.** The map style and the three.js materials need real colour values. Read them from the CSS tokens at runtime and re-read when the theme changes, so Teh Susu and Kopi O still switch everything. Switch the map between Protomaps’ light and dark styles at the same moment. Overrides the starter’s “never raw hex” for the map style and 3D scene only.
5. **One progress value drives the burst.** A single number from 0 to 1, set by scroll (GSAP ScrollTrigger) or drag, moves the floors and the cut-away plane. Springs smooth it. One source, so scroll and drag never fight.
6. **Only one heavy scene runs at a time.** When the building opens, pause the map and hide it; when the building closes, stop rendering the 3D scene (frameloop="demand"). Cap the pixel ratio at 2. Both keep an ordinary laptop smooth on stage.
7. **Motion off means still, not broken.** With reduced motion on, skip scroll scrubbing and show the building half open, with the slider still working.
8. **Test on the demo laptop by 21:00.** Run the map, the burst and the theme switch on the laptop that will present, through the venue projector if possible. Record a backup video once it works.

Install, versions pinned (each at least two weeks old):

```
npm i maplibre-gl@6.16.0 react-map-gl@8.1.3 pmtiles@4.5.0 @protomaps/basemaps@5.7.2 three@0.186.1 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 @react-three/postprocessing@3.2.2 postprocessing@6.39.5 @react-spring/three@10.1.2 motion@14.8.0 gsap@3.15.0 @gsap/react@2.1.2 suncalc@2.1.1 supercluster@9.1.0 lottie-react@3.1.2
npm i -D @types/three @types/suncalc
```

React Three Fiber 9.8 needs React 19.0 to 19.3; the starter is on 19.3.0, so do not upgrade React tonight.

## The unit record (agree this in the first hour)

```json
{
  "project": "Synthetic Township",
  "block": "B",
  "floor": 12,
  "unit": "12-03",
  "type": "3R2B",
  "sizeSqft": 861,
  "price": 520000,
  "monthly": 1850,
  "facing": "E",
  "lat": 3.0,
  "lng": 101.6,
  "rooms": [
    { "id": "ruang_tamu", "name": "Living", "polygon": [[0,0],[5.2,0],[5.2,3.8],[0,3.8]], "windows": ["E"] }
  ],
  "door": { "room": "ruang_tamu", "faces": "W", "at": [0,1.9] }
}
```

The building view sends it; Tengok Dulu draws from it; the card and the explanation read it. All values made up.

## Checks a buyer can make

Real data tonight: places (OpenStreetMap), distance and direction, sun path and facing, elevation.
Made up and labelled: price, instalment, rent, maintenance fee, facilities, seasons and wind, traffic, who lives nearby.
Extra badges if time allows: flood history, freehold or leasehold, completion date, noise, power lines or cemeteries nearby, future stations, fibre, parking, pets, security, resale.

## Feng shui notes (gentle notes "for buyers who care", never a verdict)

- Main door facing, and whether it opens straight onto a lift, staircase or another door.
- Main door in a straight line with a window or balcony door.
- Bed under a beam; toilet door facing the bed or the dining table.
- Stove facing the sink, or right beside the fridge.
- Outside: a T-junction or a sharp building corner pointing at the window (from the map view).

## Who does what

- Builder 1, the map: MapLibre, 3D buildings, synthetic township, places, train lines, light and dark map styles.
- Builder 2, the building and Tengok Dulu: the burst-apart building, cutaway, unit colours, the 2D floor plan, sun, furniture, feng shui notes.
- Builder 3, the app: swipe cards, side card, theme switch, Manglish file, kopi egg, the AI explanation.

## Order of work

- Must by midnight: swipe flies the map; building bursts apart with units coloured; tap a unit opens a floor plan with sun; side card with six checks; Kopi O and Teh Susu, Manglish, kopi egg.
- Should: AI explanation and shortlist; furniture drag; feng shui notes; scroll-driven burst; season and wind; traffic slider.
- Could: Raya and CNY layouts; Manglish commands in the floor plan; ThreeUI background; Meshy props; demographic shading; flood and noise badges.
- Gates (to the starter's midnight freeze): plain versions working by 20:30; joined up and merged to `main` by 22:00 with a backup video; Must done by 23:30; **freeze 00:00**; test the live URL until 01:30; demo video, slides, rehearsal until 06:30; submit by 08:30.

## How to run the grilling

Open Claude in the starter repo and run `/grill-with-docs` (or `/grill-me`) with `docs/PLAN.md` open and this brief pasted in. Answers go straight into `docs/PLAN.md`: problem statement, the three must-haves with owners and routes, the shared contract (the unit record above becomes the shared type), and the timeline. Commit it so every teammate's Claude reads the same plan. Time-box to 25 minutes.

## Decisions the grilling should settle

1. The unit record's exact fields, and who owns the file.
2. Routes: for example `/dashboard/find` (swipe), `/dashboard/find/[block]` (map and building), `/dashboard/unit/[id]` (Tengok Dulu).
3. Map tiles: own PMTiles file or a Protomaps key.
4. How many buildings and units in the synthetic township, and where it sits on the map.
5. Which six checks go on the side card, in what order.
6. What the AI explanation sees, which model, and the fallback when it fails.
7. Where the kopi egg hides, and how it is triggered on stage.
8. What gets cut first if midnight arrives and Must is not done.
9. The final product name (not close to "Hidup Malaysia"); "Tengok Dulu" as the floor-plan feature name.
10. Who presents, and who drives the demo laptop.

## Questions judges will ask

- Isn't swiping for homes old? Yes. The swipe only teaches the app what you care about; the new part is opening the exact unit.
- Is the interior real? No, it is drawn by code from the unit record. A real version would use Gamuda Land's own unit plans.
- How does it help sales? Buyers arrive at the gallery with a shortlist they can afford. A 30-day trial at one launch would compare shortlists to bookings.
- Where does the data come from? Places, sun, distance and elevation are real public data; prices, rents, fees, traffic and demographics are made up and say so.
- Buyers' salaries and privacy? Income stays on the phone in the demo; a real version asks for a range and passes the company's data review.
