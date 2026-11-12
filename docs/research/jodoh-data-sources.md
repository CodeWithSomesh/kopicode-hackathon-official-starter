# Jodoh data sources: research notes

Research date: 12 Nov 2026. All prices and statuses are as shown on the cited page on that date and change often. "Not verified" means I could not confirm it from a primary source.

---

## 1. Gamuda Land residential projects in Malaysia

### How the data was gathered
- Primary: gamudaland.com.my `/developments`, each township page, and project pages (fetched 12 Nov 2026). The full project list comes from `https://www.gamudaland.com.my/sitemap-0.xml` (about 120 project pages under `/developments/` and `/developments/township/`, which also covers sold-out and older phases).
- Coordinates: OpenStreetMap Nominatim (`nominatim.openstreetmap.org/search?q=...&format=json`, ODbL). Accuracy is noted per row:
  - **polygon centroid**: centre of the OSM township or site outline. Large townships span 2 to 4 km, so a point inside may be 1 to 2 km from a given phase.
  - **building**: the OSM outline of the actual building, within about 50 m.
  - **street**: the centroid of the street the project is on, within about 200 m.
- Cross-checks: PropertyGuru, iProperty and EdgeProp listings, plus The Edge and The Star news.

### Current Malaysian projects listed on gamudaland.com.my

| Township / project | State, area | Lat, Lng (accuracy) | Type | Indicative "From" price (source, date) | Tenure | Status | Official URL |
|---|---|---|---|---|---|---|---|
| **Gamuda Cove** (1,866 ac) | Selangor, Kuala Langat / Dengkil | 2.8828, 101.6091 (polygon centroid; bbox 2.867–2.899, 101.585–101.633) | Mixed: landed + serviced apartments | North Woods Residences serviced apt from RM485,800; The Camellia 2-sty semi-D from RM1,700,000; Mori Pines 2-sty terrace / cluster semi-D from RM849,800 (gamudaland.com.my, 12 Nov 2026) | Leasehold per PropertyGuru and iProperty Mori Pines listings (Nov 2026); not stated on the official page | Active. Mori Pines completion 2027 (PropertyGuru); Enso Woods fully sold; Maya Bay Residences topped off | gamudaland.com.my/developments/gamuda-cove ; microsite gamudacove.com.my |
| **Gamuda Gardens** (810 ac) | Selangor, Sungai Buloh North / Kuang | 3.2908, 101.5359 (polygon centroid; bbox 3.271–3.300, 101.525–101.554) | Landed: terrace, superlink, semi-D, bungalow, villa | Heston Hills from RM1,190,000; Monarc bungalow / semi-D from RM1,949,800; Valeria Garden Homes 2 and 3-sty terrace from RM1,130,800; Illaria Hillside Homes from RM628,800 (move-in ready) | Leasehold (Gamuda Land blog "Gated and Guarded Living Guide", 3 Aug 2026) | Active | gamudaland.com.my/developments/gamuda-gardens ; gamudagardens.com.my |
| **Gardens Park** (532 ac, next to Gamuda Gardens) | Selangor, Sungai Buloh North / Rawang | **Not in OSM.** Use the Gamuda Gardens gallery or digitise from the brochure map. It lies next to Gamuda Gardens on land bought in Jan 2023 (gamuda.com) | Landed: 2-sty terrace | Astor from RM800,000 (floor-plan types from RM1,000,000, 2,372 sq ft); Elgar from RM831,000 | **Freehold, individual title** (official page) | Newly launched | gamudaland.com.my/developments/gardens-park |
| **twentyfive.7** (257 ac) | Selangor, south of Kota Kemuning (Telok Panglima Garang) | 2.9577, 101.5567 (polygon centroid); gallery 2.95505, 101.55178 (from the official Google Maps link) | Mixed: landed + serviced apartments | The Clove Signature park, cluster and semi-D homes from RM1,601,800; Quayside Plazas serviced apartments and sky villas from RM700,000 | Not stated | Active (The Clove Signature "in progress") | gamudaland.com.my/developments/twentyfive-7 |
| **Jade Hills** (338 ac) | Selangor, Kajang | 2.9972, 101.7541 (OSM quarter centroid) | Landed bungalows + serviced apartments | Summerwoods 2 and 3-sty bungalow from RM3,134,800; J Homes serviced apt from RM676,800; Astrid Series bungalow land from RM1,903,800 | Astrid Series: Freehold (official page). Others not stated | Mature. "Limited units", J Homes move-in ready | gamudaland.com.my/developments/jade-hills |
| **Horizon Hills** (1,200 ac; JV with UEM Sunrise per The Edge, Mar 2026) | Johor, Iskandar Puteri | 1.4576, 103.6456 (OSM suburb centroid); sales gallery 1.448758, 103.638432 (official Waze link) | Landed: link, cluster, semi-D, link bungalow | The Peak from RM1,700,000; KingsWood from RM1,400,000; GreenVille from RM1,000,000. The Edge (Mar 2026) says the final phase is semi-Ds and bungalows at RM2m–3m | Freehold ("1,200-acre Freehold Township", official) | Final phases; Horizon Mall due Q2 2026 | gamudaland.com.my/developments/horizon-hills |
| **Kundang Estates** (40 ac) | Selangor, Kundang / Rawang | 3.2882, 101.5083 (OSM neighbourhood polygon) | Landed: 2-sty terrace / link | Anise from RM699,800; Valerian from RM680,800; Citron from RM784,800 | Not stated | Limited units | gamudaland.com.my/developments/kundang-estates |
| **Bukit Bantayan Residences** (19 ac) | Sabah, Inanam, Kota Kinabalu | about 5.973, 116.136 (street centroid of Lorong Bukit Bantayan; site not mapped in OSM) | High-rise serviced apartments | Cemara from RM552,710; Dilenia from RM515,660; Ebena from RM550,810 | 999-year leasehold (official) | Limited units | gamudaland.com.my/developments/bukit-bantayan |
| **Haus on 15** (JV with Taylor's Assets) | Selangor, SS15 Subang Jaya (former Taylor's College site) | about 3.0756, 101.5919 (street centroid of Jalan SS 15/7, the gallery address; the site is on Jalan SS 15/8 per saratan.my) | High-rise: 614 serviced apartments, PBSA block, 18 retail units | Apartments 690–980 sq ft from RM736,800 (The Edge, 31 Oct 2026). A third-party portal (myrproperty.com, Oct 2026) quotes from RM663,120 nett, so the figures differ | Freehold (official) | Launched Oct 2026. Block B sold out; Block A now on sale | gamudaland.com.my/developments/haus-on-15 |

### Older or completed projects (still have pages; useful for "recent" context)

| Project | Location | Lat, Lng (accuracy) | Type | Price note | Tenure | Notes |
|---|---|---|---|---|---|---|
| **HighPark Suites** | Kelana Jaya SS6, Petaling Jaya | 3.1028, 101.5989 (OSM site polygon) | High-rise studio and apartments | From RM436,000 (official page; date unknown) | Freehold (official) | Completed (not verified). Next to a Kelana Jaya LRT-area bus stop |
| **The Robertson** | Jalan Robertson, Bukit Bintang, KL | 3.1442, 101.7045 (OSM building) | High-rise residences + retail | Official page shows only shoplots from RM1,050,000 | Not stated | Completed (not verified); now mostly resale |
| **Madge Mansions** | Jalan Madge, Taman U-Thant, KL | 3.1579, 101.7270 (OSM site polygon) | Luxury low-density apartments | From RM4,500,000 (official page) | Not stated (freehold per portals, not verified) | Completed (not verified) |
| **Valencia** | Sungai Buloh | 3.2133, 101.5874 (OSM quarter) | Landed, gated | No current listing | Not verified | Completed |
| **Bandar Botanic** | Klang | 2.9881, 101.4399 (OSM suburb) | Landed township | No current listing | Not verified | Completed (older Gamuda Land township) |
| **Kota Kemuning** | Shah Alam | 3.0049, 101.5360 (OSM suburb) | Township | No current listing | Not verified | Completed (older township) |
| **Enso Woods** | Gamuda Cove | use Gamuda Cove | 2-sty terrace | From RM670,800 | Not stated | Fully sold |
| **The Mews**, **The Clove**, **The Twist** | Product lines across the Klang Valley townships (Gamuda Gardens, Gamuda Cove, twentyfive.7) | n/a | The Mews: "Link+" terrace homes, 10 homes around a shared garden. The Clove Type A: 20'x97' lot, 1,971–2,143 sq ft | Not stated | Not stated | These are product types, not separate sites. Don't plot them as their own markers |
| **Penang South Island / Silicon Island** | Penang, off the south of the island (2,300 ac reclaimed) | n/a | Mixed-use reclamation JV with the Penang state government | No residential product yet | n/a | First reclamation phase done. Opens for sale "next year" (The Edge, Mar 2026). **Exclude from the app for now** |

Not found or uncertain:
- No current Gamuda Land residential project in **Penang** or elsewhere in **Johor** besides Horizon Hills turned up. The Edge cover story (Mar 2026) lists only Gamuda Gardens, Gamuda Cove, twentyfive.7, Horizon Hills, PSI and SS15 for Malaysia.
- "Jadite Suites" (Jade Hills, freehold) shows up only on Instagram. It is **not verified** on the official site.
- Price conflicts: Mori Pines shows "From RM849,800" in the header but "Price From RM1,200,000" in the floor-plan block. Portals show resale or listing prices from RM735k. Label prices as "indicative, from developer site, dd mmm yyyy".

### Unit-level data and scraping terms
- **Unit-level data is partial.** Project pages have floor-plan types (e.g. Astor Types A–D with lot size, bedrooms, bathrooms and built-up sq ft, but often only one price for the whole block), brochure PDFs on S3 (e.g. `gamudaland.s3.ap-southeast-1.amazonaws.com/website%2FAstor_Simplified_Brochure_...pdf`), virtual tours (momento360) and links to the microsites (gamudacove.com.my, gamudagardens.com.my), which also list per-product size ranges. **There is no public live unit availability or e-booking data.** The Register button opens a lead form.
- **robots.txt** (`www.gamudaland.com.my/robots.txt`): `Disallow: /cgi-bin/, /thankyou, /thankyou-*, /api/`. Everything else is allowed, and a sitemap is published.
- **Terms** (`www.gamudaland.com.my/disclaimer`): the site is "intended for personal use, quick reference, illustration and information purposes only and may not be copied, redistributed or published in any manner without the prior written permission of the Company", and commercial use is prohibited without written consent. Crawling isn't banned by robots.txt, but **republishing the content (images, brochures, prices) in an app needs Gamuda's written permission.** For the hackathon:
  - Hand-curate a small seed JSON of facts (name, coordinates, type, price-from, URL) with attribution.
  - Link out to the official pages rather than copying images or brochures.
  - Get sign-off from Gamuda Land marketing. The team appears to be inside Gamuda, so this should be quick.

---

## 2. Routing, travel time and tolls (Malaysia)

| Option | Travel time / traffic | Toll *cost* for Malaysia? | Free tier / cost | Key |
|---|---|---|---|---|
| **Google Routes API** (computeRoutes / computeRouteMatrix) | Yes. `TRAFFIC_AWARE` and `TRAFFIC_AWARE_OPTIMAL` put the request on the **Pro** SKU | **No, not documented.** Toll info (`extraComputations: ["TOLLS"]`, field mask `routes.travelAdvisory.tollInfo`) covers AR, AU (3 cities), BR, ID, IN, JP, MX and US states ([routes_preferred toll page](https://developers.google.com/maps/documentation/routes_preferred/calculate_toll_fees)). The TollPass enum has no `MY_` values ([RouteModifiers](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteModifiers)). The current page only says "select cities", so one test call is worth making, but don't count on it | Per month: Essentials 10k free, then $5/1k. Pro 5k free, then $10/1k. Enterprise 1k free, then $15/1k ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | API key + billing account |
| **Mapbox Directions / Matrix** | Yes (`driving-traffic` profile) | **No prices.** It does mark toll roads: `intersections.classes` includes `toll`, `intersections.toll_collection` gives `toll_booth` / `toll_gantry` points, and `exclude=toll` avoids them ([docs](https://docs.mapbox.com/api/navigation/directions/)) | Directions 100k requests/month free, then $2/1k. Matrix 100k elements/month free. GL JS 50k map loads/month free. 300 req/min ([pricing](https://www.mapbox.com/pricing)). Mapbox says a Commercial Application License is needed for *production* real-estate use. A hackathon demo is fine, but note it for later | Public token |
| **openrouteservice** (hosted) | Yes, but no live traffic | No prices. `extra_info=["tollways"]` flags toll segments (0/1) ([docs](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/)); `avoid_features: tollways` | Free Standard plan: Directions 2,000/day (40/min), Matrix 500/day (40/min) ([plans](https://account.heigit.org/info/plans)) | Free key |
| **OSRM** (public demo / self-host) | Free-flow only | No prices. Toll ways come back as a `classes: ["toll"]` annotation. The public demo server is not for production | Free | None |
| **HERE Routing v8** | Yes | `return=tolls` returns tolls per section with local-currency prices ([docs](https://docs.here.com/routing/docs/routing-v8-tolls-for-route)). **Malaysia coverage not verified.** I couldn't find a per-country toll coverage table, so a test call is needed | Free base plan exists. Exact quota not verified | API key |
| **TomTom Routing** | Yes | No toll-cost output found. TomTom points to TollGuru for that | Free daily tier (not verified) | API key |
| **TollGuru Toll API** | Uses a polyline from any router | **Says it covers Malaysia** ([Asia calculator](https://tollguru.com/toll-calculator-asia)). Per-route API accuracy for MY not verified | 14-day trial at 150 transactions/day. Then from $80/month for 5k ([pricing](https://tollguru.com/toll-api-pricing-plans), [trial](https://tollguru.com/blog/get-api-key)) | Sign-up |

### Public Malaysian toll-rate data
- **"Senarai Kadar Tol Semasa Mengikut Lebuhraya"**: published by KKR, sourced from LLM, XLSX, **CC-BY**, last updated **23 Aug 2021**, so it is **stale** (rates and abolished plazas have changed since). Download: `https://archive.data.gov.my/data/dataset/6ab4bd6d-ff87-452b-b3aa-391387f2bfa3/resource/1b88f96c-e60b-49a5-9c7d-ff3ed94b4313/download/senarai-kadar-tol-semasa.xlsx`, plus a vehicle-class XLSX. I didn't open the files, so the columns and whether closed-system PLUS origin-destination pairs are included are not verified.
- **LLM** (llm.gov.my) has an interactive Kalkulator Tol (highway → entry plaza → exit plaza → rate) but no downloadable rate table. Its Data Terbuka page lists only "Panjang Lebuh Raya Bertol" and KPI datasets.
- **Toll plaza locations:** OSM `barrier=toll_booth` nodes, fetched via Overpass (ODbL). Mapbox `toll_collection` points can also be used.

### Recommended setup for 24 hours
1. **Map:** Mapbox GL JS for the 3D map (terrain and buildings; 50k free loads).
2. **Travel time:** Mapbox Directions `driving-traffic` for the selected home to workplace route, and the Matrix API for the "rank all homes by commute" view (100k free elements/month). Use openrouteservice as a free fallback with no traffic data.
3. **Toll estimate:** take the route's `toll_collection` points or OSM toll-booth nodes near the route geometry, and match them to a **hand-built rate table** covering the 10–15 Klang Valley plazas that matter for the 6–7 townships (e.g. ELITE, NKVE, LDP, KESAS, SKVE, SPRINT, LATAR, GCE, Guthrie, DUKE, PLUS Rawang / Sg Buloh). Seed it from the 2021 data.gov.my XLSX, refresh it by checking the LLM calculator, and label it "estimated". Open-system plazas are a flat fee per pass. Closed-system PLUS segments need an entry/exit pair lookup.
4. **Optional:** use the TollGuru 14-day trial to sanity-check two or three demo routes.
5. **Google Routes:** add it only if you want Google ETAs. It won't give Malaysian toll prices (as far as the docs show), and traffic-aware requests use the Pro SKU (5k free/month). It needs a billing account.

---

## 3. Public transit (Klang Valley GTFS)
- **GTFS Static** ([docs](https://developer.data.gov.my/realtime-api/gtfs-static)), base `https://api.data.gov.my/gtfs-static/`:
  - `prasarana?category=rapid-rail-kl`: LRT Kelana Jaya / Ampang / Sri Petaling, MRT Kajang / Putrajaya, Monorail, BRT
  - `prasarana?category=rapid-bus-kl`, `rapid-bus-mrtfeeder`, `rapid-bus-penang`
  - `ktmb`: KTM Komuter and intercity
  - `mybas-johor` and other BAS.MY cities

  Each returns a GTFS ZIP. Prasarana updates "as required" and KTMB daily; the docs suggest refreshing daily. **Licence: CC BY 4.0.**
- **GTFS Realtime** ([docs](https://developer.data.gov.my/realtime-api/gtfs-realtime)): **vehicle positions only**, refreshed every 30 s. Trip updates and alerts are "in our pipeline for 2026". `rapid-rail-kl` has **no stable realtime feed**; KTMB and the RapidKL bus feeds work. CC BY 4.0.
- **Rate limit:** 4 requests/minute on all data.gov.my APIs ([rate limit](https://developer.data.gov.my/rate-limit)). Download the ZIPs once at build time and commit a processed GeoJSON.
- **Station coordinates and lines:** `stops.txt` (stop_lat, stop_lon), `routes.txt` (route_short_name / long_name such as KJ, AG, SP, MR, PY), and `trips.txt` + `stop_times.txt` to link stops to routes. Draw line geometry from `shapes.txt` if the feed has it (not verified for rapid-rail-kl); otherwise connect stops in stop_sequence order.
- **Not covered:** ERL (KLIA Ekspres / Transit) is not in these feeds (not verified elsewhere). Use OSM `railway=station` for it.
- **Relevance:** Haus on 15 is about 500 m from SS15 LRT (saratan.my) and HighPark Suites is near Kelana Jaya. The outer townships (Gamuda Cove, Gardens Park / Gamuda Gardens, twentyfive.7) are car-dependent, so for those compute "nearest station + drive time".

---

## 4. Schools data
- **OpenStreetMap (recommended):** query Overpass for `amenity=school`, `amenity=kindergarten` and `amenity=university` in Malaysia. Names usually carry the type (SK, SJK(C), SJK(T), SMK, International School). **ODbL**: attribute it and share-alike any derived database. Coverage is good in the Klang Valley but not complete.
- **MOE "Senarai Sekolah Rendah dan Menengah" (XLSX):** historically published on moe.gov.my and cited on ms.wikipedia (Jun 2020 edition). Older editions had a school code, type (SK/SJKC/SJKT/SMK), address, and coordinate columns (KOORDINATXX/YY). **I couldn't find a current download link** on moe.gov.my/JPN/PPD/SEKOLAH (the page only links to https://direktori.moe.gov.my/), so the coordinates and licence are not verified. Treat it as an optional source.
- **data.gov.my / OpenDOSM `schools_district`:** only **counts** per district, stage and type (CSV/Parquet, CC BY 4.0, data as of 2025). No names or coordinates. Useful for a "school density" layer, not for pins.
- **International / private schools:** there is no official open dataset with coordinates. Directories such as schooladvisor.my (around 240 schools) and international-schools-database.com (199) are copyrighted listings. Use OSM, or hand-geocode the 10–20 schools near each township. The official project pages already list nearby schools with distances (e.g. Astor: Lexel International 3.0 km, SJK(C) Kundang 5.0 km).

---

## 5. Agora Conversational AI: language support
**ASR**
- **ARES** (Agora's default ASR, [docs](https://docs.agora.io/en/ai/models/asr/ares)) uses the [real-time transcription language list](https://docs.agora.io/en/realtime-media/speech-to-text/reference/supported-languages#real-time-transcription):
  - Listed: **ms-MY** (Malay), **zh-CN** (Mandarin, Simplified), **ta-IN** (Tamil, India), en-IN
  - **Not listed:** ta-MY, en-MY

  One `language` per agent. **No code-switching or auto-detect option is documented.**
- **Microsoft Azure ASR via Agora** ([docs](https://docs.agora.io/en/ai/models/asr/microsoft)): one required `language` plus an optional `phrase_list`. Extra parameters are passed through to Azure without validation, so Azure language ID *might* work, but it isn't documented by Agora. Azure STT supports **ms-MY, zh-CN, ta-IN** in real time; ta-MY and en-MY are **not** supported ([Azure language support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt)). Azure language ID works on a candidate list, one locale per language.
- **Speechmatics via Agora** ([Agora page](https://docs.agora.io/en/ai/models/asr/speechmatics)) is **the best fit for code-switching.** Speechmatics has a real-time **`cmn_en_ms_ta`** pack: one model for any mix of English, Mandarin, Malay and Tamil, including switches mid-sentence. There are also bilingual packs `en_ms`, `en_ta` and `cmn_en` ([Speechmatics page](https://www.speechmatics.com/speech-to-text/english-mandarin-malay-tamil), [languages](https://docs.speechmatics.com/speech-to-text/languages)). Agora's page only shows `language: "en"`, but it passes unlisted parameters through, so `language: "cmn_en_ms_ta"` should work. **Test this early.**
- Other ASR vendors in Agora: Amazon Transcribe, AssemblyAI, Deepgram, Gemini, Google, OpenAI, Sarvam (Indic, Tamil), Smallest AI, xAI.

**TTS** (Agora `tts.vendor: "microsoft"`, params `key`, `region`, `voice_name`, `sample_rate`; [docs](https://docs.agora.io/en/ai/models/tts/microsoft)). Azure neural voices:
- **ms-MY:** `ms-MY-YasminNeural` (F), `ms-MY-OsmanNeural` (M), plus HD variants
- **ta-MY:** `ta-MY-KaniNeural` (F), `ta-MY-SuryaNeural` (M). Tamil (Malaysia) **is** available for TTS even though it isn't for STT
- **ta-IN:** `ta-IN-PallaviNeural` (F), `ta-IN-ValluvarNeural` (M)
- **zh-CN:** `zh-CN-XiaoxiaoNeural` (F) and many more, including HD voices
- **en-MY:** none. Use en-SG / en-IN, or a multilingual voice such as `en-US-AndrewMultilingualNeural`

Other TTS vendors in Agora include ElevenLabs, MiniMax, Google, Amazon Polly, OpenAI, Cartesia, Hume, Fish Audio and Mistral.

**Practical setup:** Speechmatics `cmn_en_ms_ta` for ASR. For TTS, have the LLM tag the reply language and switch the Azure voice per session (ms-MY-Yasmin / zh-CN-Xiaoxiao / ta-MY-Kani / an English voice). Agora's TTS config is per agent, so switching mid-conversation may mean restarting the agent or updating it through the API (not verified). Fallback: ARES with one language chosen by the user at the start.

---

## Not verified (summary)
- Whether Google Routes or HERE return toll prices for Malaysia. Needs one test call each.
- Columns of the 2021 data.gov.my toll XLSX, and how current it is.
- A current MOE school list download and its coordinates.
- Gardens Park coordinates, plus tenure for most Klang Valley phases (Gamuda Cove looks leasehold per portals; Gamuda Gardens is leasehold per Gamuda Land's blog).
- Completion status of HighPark Suites, The Robertson and Madge Mansions.
- Whether Speechmatics `cmn_en_ms_ta` works through Agora's passthrough, and whether Agora can switch TTS voice mid-session.
