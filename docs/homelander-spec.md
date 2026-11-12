# HomeLander: the agreed plan

HomeLander helps Malaysian home buyers find the Gamuda Land home that fits their life, wallet and commute. Gamuda learns what buyers want from how they swipe. Only Gamuda Land properties appear in the app. These decisions were agreed in the planning grill on 12 Nov 2026.

## Team and timeline

6 hours, 3 people.

| Route | Feature | Owner |
|---|---|---|
| `/` | Landing: PayGap City-style 3D map of every Gamuda Land property in Malaysia | Teammate A (brief: `src/app/(homelander)/_landing/CLAUDE.md`) |
| `/homes/[id]/feng-shui` | Feng Shui (formerly "Tengok Dulu") | Teammate B (brief: `src/app/(homelander)/homes/[id]/feng-shui/CLAUDE.md`) |
| `/onboarding` | Uncle, the voice onboarding agent | Somesh |
| `/swipe` | Swipe deck of recommended homes | Somesh |
| `/battle` | Compare up to 5 liked homes | Somesh |
| `/bank` | Bank eligibility | Somesh |
| `/profile` | Saved answers, bank estimate, shortlist | Somesh |
| `/admin` | Gamuda's demand dashboard | Somesh |
| Shared code | `src/lib/homelander`, `src/components/homelander`, shell, themes, Supabase schema | Somesh |

## Design

- **Kopitiam theme only until every feature works.** The other themes (Ledger, Quest, Brutal, Bubblegum, Night Market, Arcade) are kept in `themes.css` but locked off with `LOCKED_THEME` in `src/lib/homelander/theme-config.ts`, and the switcher is hidden. Light/dark mode and the other themes come at the very end.
- **Every screen needs both layouts:** a web layout on desktop (top nav) and an app layout on phones (bottom tab bar).

## Flow

1. **Landing (`/`):**
   - A full-screen 3D map like PayGap City.
   - Every Gamuda Land project in Malaysia. Current projects are full colour; completed ones are greyed as "resale only".
   - Click a pin for details.
   - Logged-out visitors can browse freely.
   - **Login** sits at the top right.
2. **Login:**
   - Supabase Auth with Google sign-in.
   - A new user (no profile) goes to `/onboarding`; a returning user goes to `/swipe`.
   - `/swipe`, `/battle`, `/bank`, `/onboarding` and `/profile` require login.
3. **Uncle (`/onboarding`):**
   - **Voice stack:** an Agora voice agent. Agora calls an adapter route in our app, which forwards to Claude through Vercel AI Gateway. The adapter also saves each answer to Supabase as Uncle hears it, using tool calls.
   - **Mixed languages:** first try Speechmatics `cmn_en_ms_ta` (mixed English, Mandarin, Malay and Tamil). If that isn't smooth, fall back to one language per turn: the user speaks Malay and Uncle answers in Malay; they switch to Chinese and he switches.
   - **Live side panel:** fills in as Uncle hears answers, and the user can type into it. Money fields offer "type instead".
   - **Testing:** voice can only be tested on Vercel preview deployments (or an ngrok tunnel), because Agora's cloud can't reach `localhost`.
   - **What Uncle collects** (about 10 turns, skipping anything already answered):
     - **Household:** who they live with; kids now or planned; parents moving in; pets.
     - **Schools:** does distance to the kids' school matter? If yes, how far is OK, and how will they get there (drop-off, school bus, walking)? Never which school.
     - **Places:** work location and office days; partner's work; preferred areas; must be near (LRT/MRT, family).
     - **Home:** landed or high-rise; minimum bedrooms; must-haves; deal-breakers.
     - **Money:** gross and net income; joint applicant's income; commitments (car, PTPTN, personal loan, cards, other home loans); savings for the down payment; first home or not.
     - **Timing and age:** when they want to buy; whether a home under construction is OK; age, which sets the maximum loan tenure.
4. **Recommendations:**
   - **Scoring:** rule-based. Budget fit from the bank estimate, distance to preferred areas and work, bedrooms vs household, school distance when it matters, and the landed/high-rise preference.
   - **Reason line:** Claude writes one line on why each home was picked, cached per user and home.
   - **Over-budget homes:** the bank limit is worked out right after onboarding. Homes over budget appear tagged "stretch" and ranked lower, not hidden.
5. **Swipe (`/swipe`):**
   - Like or pass, with a reason for passes.
   - Every card shows units left (sample data, labelled).
   - Battle unlocks at 3 likes; the deck ends at 10 likes.
6. **Battle (`/battle`):**
   - Up to 5 homes. If more are liked, the top 5 by match score are preselected and can be swapped.
   - Rows: price, monthly instalment, cash upfront, money left, drive time with traffic, train time, toll cost (estimated), weekly commute hours, school distance per type, size vs need, tenure, completion, units left.
7. **Bank (`/bank`):**
   - Uses the income and commitments from onboarding.
   - Shows the debt service ratio, the maximum loan, a sample table of 5 banks, and which homes are in range.
   - Then a "get pre-qualified" step that creates a lead for Gamuda.
   - The winning home gets a highlighted **Feng Shui** button.
8. **Feng Shui (`/homes/[id]/feng-shui`):** the Tengok Dulu visualizer (sun check, furniture fit, Raya and CNY modes, Manglish commands), labelled "for fun, not advice". It opens from any home's details and from the bank step.
9. **Admin (`/admin`):**
   - Only the three of us can get in, via an email allowlist.
   - Live data plus about 400 seeded sample sessions, with a toggle to hide the samples.
   - It must answer: **where should Gamuda build next** (where buyers want to live vs where we have supply), **which price bands are missing** (what buyers can borrow vs our prices), **why buyers pass** on each township, and **which leads are pre-qualified**.

## Data sources

Full research with links: `docs/research/jodoh-data-sources.md`.

- **Projects:** real Gamuda Land facts, media and links are allowed (internal hackathon). Gardens Park has no map coordinates, so place it by hand.
- **Availability:** "units left" stays sample data, labelled.
- **Drive times:** Mapbox Directions with live traffic. Precompute home-to-workplace times for about 15 common workplaces when seeding the data; call live only for a custom work address.
- **Tolls:** a hand-built table of 10–15 Klang Valley toll plazas, matched to each route, labelled "estimated". No API gives Malaysian toll prices.
- **Rail:** data.gov.my GTFS static (`api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl`), downloaded once at build time.
- **Schools:** OpenStreetMap.
- **Map:** MapLibre with OpenFreeMap tiles (no key) for drawing. Mapbox is used only on the server, for travel times.

## Storage

- **Database:** Supabase, Singapore region. Tables for profiles, onboarding answers, swipes, shortlists, bank checks, leads and events, each protected so users see only their own rows; admins read everything.
- **Keys:** the URL and publishable key go in `.env.local` and Vercel only, never in git.

## Keys Somesh will set up

Agora (App ID, certificate, REST credentials), Speechmatics, Azure Speech (Uncle's voices), Mapbox, Vercel AI Gateway, Supabase, Google OAuth.

## Git workflow

- One branch per person: `feat/landing`, `feat/feng-shui`, and Somesh's own branches.
- Run `npm run check` before every pull request, and merge to `main` at least every hour. `main` deploys to Vercel.
- Shared files change only through their owner.
- No commits or deploys after 9:00 AM Friday.
