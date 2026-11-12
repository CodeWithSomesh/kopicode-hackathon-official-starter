/**
 * HomeLander data: real Gamuda Land projects in Malaysia.
 *
 * Projects, product names, "from" prices, sizes and floor-plan facts come from gamudaland.com.my
 * (township and product pages, read 12 Nov 2026; prices are the developer's indicative "From"
 * prices on that date and change often). Each unit's `source` says whether its price/size are
 * "official" (from those pages) or "sample" (estimated for the demo, e.g. resale examples).
 * Coordinates: OpenStreetMap Nominatim (see docs/research/jodoh-data-sources.md); Gardens Park is
 * placed by hand. Photos © Gamuda Land (public/homelander/credits.json), used for an internal
 * Gamuda hackathon. "Units left" (availabilityOf) is SAMPLE data.
 *
 * Commute figures are estimates from a simple model (straight-line distance x road factor at
 * rush-hour speed), not routing.
 */

export type LatLng = { lat: number; lng: number };

export type Region = "klang-valley" | "johor" | "sabah";

export type Township = {
  id: string;
  name: string;
  area: string;
  pos: LatLng;
  /** Contract fields (filled with real Gamuda Land data): optional until every project has them. */
  state?: "Selangor" | "Kuala Lumpur" | "Johor" | "Sabah";
  region?: Region;
  /** Selling now, or completed (resale only, greyed on the map). */
  status?: "selling" | "completed";
  acres?: number;
  officialUrl?: string;
  /** Short facts from the official page, e.g. "120-acre wetland park". */
  facilities?: string[];
};

export type HomeType = "Terrace" | "Semi-D" | "Bungalow" | "Condo" | "Serviced apartment";

export type Unit = {
  id: string;
  townshipId: string;
  name: string;
  type: HomeType;
  landed: boolean;
  priceRM: number;
  builtUpSqft: number;
  beds: number;
  baths: number;
  tenure: "Freehold" | "Leasehold";
  completion: number;
  photo: string;
  photoAlt: string;
  highlights: string[];
  /** Contract fields, optional until filled. */
  /** Product line / phase name as Gamuda sells it, e.g. "Mori Pines". */
  product?: string;
  /** Land size for landed homes, e.g. "22' x 75'". */
  landSize?: string;
  /** Monthly maintenance or service charge, RM per sq ft (strata); landed gated homes use a guard fee in serviceRM. */
  maintenancePsfRM?: number;
  /** Flat monthly fee for landed gated-and-guarded homes. */
  serviceRM?: number;
  /** "official" when price/size come from gamudaland.com.my, "sample" when estimated for the demo. */
  source?: "official" | "sample";
};

const GL = "https://www.gamudaland.com.my/developments/";

export const townships: Township[] = [
  /* ---- selling now ---- */
  {
    id: "cove", name: "Gamuda Cove", area: "Kuala Langat, Selangor", pos: { lat: 2.8828, lng: 101.6091 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 1866, officialUrl: `${GL}gamuda-cove`,
    facilities: ["Next to the 1,111-acre Paya Indah Discovery Wetlands", "60-acre Central Park and 90-acre Forest Park", "SplashMania waterpark", "Toll-free Cyberjaya Link access", "Malaysia's first 5-Diamond Low Carbon City"],
  },
  {
    id: "gardens", name: "Gamuda Gardens", area: "Sungai Buloh North, Selangor", pos: { lat: 3.2908, lng: 101.5359 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 810, officialUrl: `${GL}gamuda-gardens`,
    facilities: ["50-acre pet-friendly Central Park and five lakes", "Skyline Luge, FunPark and Big Bucket Splash", "Lexel International School in the township", "Waterfront Village retail", "KTM Komuter Kuang 3 km"],
  },
  {
    // Gardens Park has no OpenStreetMap outline. It sits next to Gamuda Gardens (the official page
    // puts Gamuda Gardens 1 km away and AEON Rawang 3 km away), so we place it by hand at the
    // north-east edge of the Gamuda Gardens outline, towards Rawang. Accuracy about 1-2 km.
    id: "gardens-park", name: "Gardens Park", area: "Sungai Buloh North, Selangor", pos: { lat: 3.3004, lng: 101.5177 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 532, officialUrl: `${GL}gardens-park`,
    facilities: ["Freehold, individual title landed homes", "50-acre ring park", "AEON Rawang and Anggun City 3 km", "Lexel International School 3 km"],
  },
  {
    id: "tf7", name: "twentyfive.7", area: "Kota Kemuning, Selangor", pos: { lat: 2.9577, lng: 101.5567 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 257, officialUrl: `${GL}twentyfive-7`,
    facilities: ["Quayside Mall with MBO cinema in the township", "Central Park 100 m from the homes", "Tenby and Oasis international schools within 5 km", "Connected to 5 major highways"],
  },
  {
    id: "jade", name: "Jade Hills", area: "Kajang, Selangor", pos: { lat: 2.9972, lng: 101.7541 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 338, officialUrl: `${GL}jade-hills`,
    facilities: ["Largest green park in Kajang", "Eaton International School 2 km", "Jade Hills Resort Club", "Pet-friendly Origami Park"],
  },
  {
    id: "kundang", name: "Kundang Estates", area: "Kundang, Selangor", pos: { lat: 3.2882, lng: 101.5083 },
    state: "Selangor", region: "klang-valley", status: "selling", acres: 40, officialUrl: `${GL}kundang-estates`,
    facilities: ["Boutique: 222 double-storey terrace homes", "Interconnected thematic parks", "SJK (C) Kundang 1.5 km", "Gamuda Gardens amenities 5 km"],
  },
  {
    id: "haus15", name: "Haus on 15", area: "Subang Jaya, Selangor", pos: { lat: 3.0756, lng: 101.5919 },
    state: "Selangor", region: "klang-valley", status: "selling", officialUrl: `${GL}haus-on-15`,
    facilities: ["Last freehold residential site in SS15", "Walk to LRT and KTM", "Facilities floor with 30+ facilities", "Subang Jaya Medical Centre 500 m"],
  },
  {
    id: "horizon", name: "Horizon Hills", area: "Iskandar Puteri, Johor", pos: { lat: 1.4576, lng: 103.6456 },
    state: "Johor", region: "johor", status: "selling", acres: 1200, officialUrl: `${GL}horizon-hills`,
    facilities: ["Freehold township with 11 secured precincts", "18-hole par-72 golf course by Ross Watson", "Clubhouse with dining and lifestyle facilities"],
  },
  {
    id: "bantayan", name: "Bukit Bantayan Residences", area: "Inanam, Sabah", pos: { lat: 5.9778, lng: 116.1343 },
    state: "Sabah", region: "sabah", status: "selling", acres: 19, officialUrl: `${GL}bukit-bantayan`,
    facilities: ["Hilltop site overlooking Likas Bay", "Kota Kinabalu city 12 km", "24-hour multi-tiered security", "Curve 25 retail on site"],
  },
  /* ---- completed (resale only, greyed on the map) ---- */
  {
    id: "highpark", name: "HighPark Suites", area: "Petaling Jaya, Selangor", pos: { lat: 3.1028, lng: 101.5989 },
    state: "Selangor", region: "klang-valley", status: "completed", acres: 5, officialUrl: `${GL}township/high-park-suites`,
    facilities: ["Five-acre freehold residential suites", "Kelana Jaya, near 4 major highways"],
  },
  {
    id: "robertson", name: "The Robertson", area: "Bukit Bintang, Kuala Lumpur", pos: { lat: 3.1442, lng: 101.7045 },
    state: "Kuala Lumpur", region: "klang-valley", status: "completed", officialUrl: `${GL}township/the-robertson`,
    facilities: ["Transit-oriented: steps from LRT, MRT and monorail", "Walk to Bukit Bintang", "Freehold"],
  },
  {
    id: "madge", name: "Madge Mansions", area: "Ampang Hilir, Kuala Lumpur", pos: { lat: 3.1579, lng: 101.727 },
    state: "Kuala Lumpur", region: "klang-valley", status: "completed", acres: 2.16, officialUrl: `${GL}madge-mansions`,
    facilities: ["52 residences on Embassy Row", "Dedicated concierge", "Private jacuzzi dip pool or lanai"],
  },
  {
    id: "valencia", name: "Valencia", area: "Sungai Buloh, Selangor", pos: { lat: 3.2133, lng: 101.5874 },
    state: "Selangor", region: "klang-valley", status: "completed", acres: 280, officialUrl: `${GL}valencia`,
    facilities: ["Homes around a 9-hole resident-only golf course", "Next to FRIM forest reserve", "IGB International School 1.1 km"],
  },
  {
    id: "botanic", name: "Bandar Botanic", area: "Klang, Selangor", pos: { lat: 2.9881, lng: 101.4399 },
    state: "Selangor", region: "klang-valley", status: "completed", acres: 1247, officialUrl: `${GL}bandar-botanic`,
    facilities: ["'Home in a Garden' township", "Self-contained with its own commercial centre"],
  },
  {
    id: "kemuning", name: "Kota Kemuning", area: "Shah Alam, Selangor", pos: { lat: 3.0049, lng: 101.536 },
    state: "Selangor", region: "klang-valley", status: "completed", acres: 1854, officialUrl: `${GL}kota-kemuning`,
    facilities: ["Mature township with lakeside park", "Mix of homes, shops and offices"],
  },
];

const P = "/homelander/gamuda/";
const g = (id: string) => `${P}${id}.jpg`;

/**
 * Product lines per project. Prices are the developer's "From" price; size/beds/baths are the
 * floor-plan type that matches that price where the page lists one. "+1" rooms (study/utility)
 * are counted in `beds`.
 */
export const units: Unit[] = [
  /* Gamuda Cove (leasehold per PropertyGuru/iProperty listings; not stated on the official page) */
  {
    id: "cove-north-woods", townshipId: "cove", product: "North Woods Residences", name: "North Woods Residences", type: "Serviced apartment", landed: false,
    // Price official; the page has no floor plans, so size/beds are estimates.
    priceRM: 485_800, builtUpSqft: 850, beds: 3, baths: 2, tenure: "Leasehold", completion: 2029, maintenancePsfRM: 0.32, source: "sample",
    photo: g("cove-north-woods"), photoAlt: "North Woods Residences towers facing the forest reserve",
    highlights: ["Overlooks the 1,326-acre forest reserve", "Next to SplashMania waterpark"],
  },
  {
    id: "cove-mori-pines", townshipId: "cove", product: "Mori Pines", name: "Mori Pines 2-storey terrace", type: "Terrace", landed: true,
    priceRM: 849_800, builtUpSqft: 1_785, beds: 4, baths: 3, tenure: "Leasehold", completion: 2027, serviceRM: 200, source: "official",
    photo: g("cove-mori-pines"), photoAlt: "Mori Pines terrace homes by a lake",
    highlights: ["Next to a 60-acre pet-friendly park", "Solar-ready with EV charging isolator"],
  },
  {
    id: "cove-camellia", townshipId: "cove", product: "The Camellia", name: "The Camellia semi-D", type: "Semi-D", landed: true,
    priceRM: 1_700_000, builtUpSqft: 2_600, beds: 4, baths: 4, tenure: "Leasehold", completion: 2028, serviceRM: 300, source: "official",
    photo: g("cove-camellia"), photoAlt: "Prairie-style semi-detached homes in a wetland setting",
    highlights: ["Next to a 90-acre wetlands arboretum", "Private low-density enclave with clubhouse"],
  },
  /* Gamuda Gardens (leasehold per Gamuda Land blog, Aug 2026) */
  {
    id: "gardens-illaria", townshipId: "gardens", product: "Illaria Hillside Homes", name: "Illaria townhouse", type: "Terrace", landed: true,
    priceRM: 628_800, builtUpSqft: 1_202, beds: 3, baths: 3, tenure: "Leasehold", completion: 2025, serviceRM: 150, source: "official",
    photo: g("gardens-illaria"), photoAlt: "Illaria hillside terrace homes",
    highlights: ["Move-in ready", "Exclusive access to a 9-acre hill park"],
  },
  {
    id: "gardens-valeria", townshipId: "gardens", product: "Valeria Garden Homes", name: "Valeria Garden Homes terrace", type: "Terrace", landed: true,
    priceRM: 1_130_800, builtUpSqft: 2_353, beds: 4, baths: 4, tenure: "Leasehold", completion: 2027, serviceRM: 200, source: "official",
    photo: g("gardens-valeria"), photoAlt: "Valeria garden terrace homes",
    highlights: ["Direct access to the 50-acre Central Park", "Exclusive thematic garden"],
  },
  {
    id: "gardens-heston-hills", townshipId: "gardens", product: "Heston Hills", name: "Heston Hills superlink", type: "Terrace", landed: true,
    priceRM: 1_190_000, builtUpSqft: 2_227, beds: 4, baths: 4, tenure: "Leasehold", completion: 2028, serviceRM: 300, source: "official",
    photo: g("gardens-heston-hills"), photoAlt: "Heston Hills hilltop homes",
    highlights: ["Gated and guarded hilltop enclave", "Pickleball court in its own precinct"],
  },
  /* Gardens Park (freehold, individual title, official) */
  {
    id: "gardens-park-astor", townshipId: "gardens-park", product: "Astor", name: "Astor 2-storey terrace", type: "Terrace", landed: true,
    priceRM: 800_000, builtUpSqft: 1_795, beds: 4, baths: 4, landSize: "20' x 60'", tenure: "Freehold", completion: 2027, serviceRM: 150, source: "official",
    photo: g("gardens-park-astor"), photoAlt: "Astor terrace homes beside a park",
    highlights: ["Doorstep access to the 50-acre ring park", "Solar-ready home"],
  },
  {
    id: "gardens-park-elgar", townshipId: "gardens-park", product: "Elgar", name: "Elgar 2-storey terrace", type: "Terrace", landed: true,
    priceRM: 831_000, builtUpSqft: 2_139, beds: 4, baths: 4, tenure: "Freehold", completion: 2028, serviceRM: 180, source: "official",
    photo: g("gardens-park-elgar"), photoAlt: "Elgar park-side terrace homes",
    highlights: ["Guarded community", "Solar and EV ready, natural skylights"],
  },
  /* twentyfive.7 (tenure not stated on the official page; leasehold per portals, not verified) */
  {
    id: "tf7-quayside-plazas", townshipId: "tf7", product: "Quayside Plazas Serviced Apartments", name: "Quayside Plazas serviced apartment", type: "Serviced apartment", landed: false,
    // "From RM700,000" is official; it is matched to the smallest layout (Type D, 840 sq ft, 2+1 bed).
    priceRM: 700_000, builtUpSqft: 840, beds: 3, baths: 2, tenure: "Leasehold", completion: 2029, maintenancePsfRM: 0.38, source: "official",
    photo: g("tf7-quayside-plazas"), photoAlt: "Quayside Plazas serviced apartment towers",
    highlights: ["Walk to Quayside Mall", "Over 23 facilities and a pet-friendly park"],
  },
  {
    id: "tf7-clove-signature", townshipId: "tf7", product: "The Clove Signature", name: "The Clove Signature park home", type: "Terrace", landed: true,
    priceRM: 1_601_800, builtUpSqft: 1_967, beds: 4, baths: 3, tenure: "Leasehold", completion: 2028, serviceRM: 280, source: "official",
    photo: g("tf7-clove-signature"), photoAlt: "The Clove Signature lakefront homes",
    highlights: ["Final phase of lakefront living", "Up to 124 ft of communal and private garden"],
  },
  /* Jade Hills (Astrid Series is officially freehold; Jade Hills taken as freehold, not verified per product) */
  {
    id: "jade-j-homes", townshipId: "jade", product: "J Homes", name: "J Homes serviced apartment", type: "Serviced apartment", landed: false,
    priceRM: 676_800, builtUpSqft: 1_464, beds: 4, baths: 3, tenure: "Freehold", completion: 2024, maintenancePsfRM: 0.35, source: "official",
    photo: g("jade-j-homes"), photoAlt: "J Homes low-density serviced residence",
    highlights: ["Move-in ready", "Only high-rise community in Jade Hills"],
  },
  {
    id: "jade-summerwoods", townshipId: "jade", product: "Summerwoods", name: "Summerwoods 3-storey bungalow", type: "Bungalow", landed: true,
    priceRM: 3_134_800, builtUpSqft: 5_013, beds: 5, baths: 6, tenure: "Freehold", completion: 2026, serviceRM: 350, source: "official",
    photo: g("jade-summerwoods"), photoAlt: "Summerwoods bungalows with double-volume ceilings",
    highlights: ["Only 19 bungalows", "Multigenerational, elderly-friendly layouts"],
  },
  /* Kundang Estates (tenure not stated; leasehold per portals, not verified) */
  {
    id: "kundang-valerian", townshipId: "kundang", product: "Valerian", name: "Valerian 2-storey terrace", type: "Terrace", landed: true,
    priceRM: 680_800, builtUpSqft: 2_009, beds: 4, baths: 3, tenure: "Leasehold", completion: 2025, serviceRM: 150, source: "official",
    photo: g("kundang-valerian"), photoAlt: "Valerian countryside terrace homes",
    highlights: ["Lowest entry price for a Klang Valley landed home here", "SJK (C) Kundang 1.5 km"],
  },
  {
    id: "kundang-anise", townshipId: "kundang", product: "Anise", name: "Anise 2-storey terrace", type: "Terrace", landed: true,
    // "From RM699,800" (intermediate, now fully sold); corner units from RM925,800.
    priceRM: 699_800, builtUpSqft: 1_733, beds: 4, baths: 3, tenure: "Leasehold", completion: 2025, serviceRM: 150, source: "official",
    photo: g("kundang-anise"), photoAlt: "Anise contemporary terrace homes",
    highlights: ["Intermediates sold out; corners from RM925,800", "Energy-saving design, open living areas"],
  },
  /* Haus on 15 (freehold, official). Price from The Edge, 31 Oct 2026; Type A size from the official microsite. */
  {
    id: "haus15-type-a", townshipId: "haus15", product: "Haus on 15", name: "Haus on 15 Type A", type: "Serviced apartment", landed: false,
    priceRM: 736_800, builtUpSqft: 690, beds: 2, baths: 2, tenure: "Freehold", completion: 2030, maintenancePsfRM: 0.45, source: "official",
    photo: g("haus15-type-a"), photoAlt: "Haus on 15 tower facade in SS15",
    highlights: ["Walk to SS15 LRT and KTM", "Dual-key layouts available"],
  },
  {
    id: "haus15-type-e", townshipId: "haus15", product: "Haus on 15", name: "Haus on 15 large unit", type: "Serviced apartment", landed: false,
    // 980 sq ft is the largest size on the microsite; price and room count are estimates.
    priceRM: 1_030_000, builtUpSqft: 980, beds: 3, baths: 2, tenure: "Freehold", completion: 2030, maintenancePsfRM: 0.45, source: "sample",
    photo: g("haus15-type-e"), photoAlt: "Haus on 15 living room",
    highlights: ["Largest layout in the tower", "Subang Jaya Medical Centre 500 m"],
  },
  /* Horizon Hills, Johor (freehold township, official) */
  {
    id: "horizon-greenville", townshipId: "horizon", product: "GreenVille", name: "GreenVille 2-storey link home", type: "Terrace", landed: true,
    priceRM: 1_000_000, builtUpSqft: 1_540, beds: 4, baths: 4, tenure: "Freehold", completion: 2026, serviceRM: 250, source: "official",
    photo: g("horizon-greenville"), photoAlt: "GreenVille link homes along a winding road",
    highlights: ["Pocket parks and cul-de-sacs", "Gated, low-density precinct"],
  },
  {
    id: "horizon-kingswood", townshipId: "horizon", product: "KingsWood", name: "KingsWood cluster home", type: "Semi-D", landed: true,
    // "From RM1,400,000" is official; the page lists no floor plans, so size/rooms are estimates.
    priceRM: 1_400_000, builtUpSqft: 2_600, beds: 4, baths: 4, tenure: "Freehold", completion: 2026, serviceRM: 300, source: "sample",
    photo: g("horizon-kingswood"), photoAlt: "KingsWood cluster homes",
    highlights: ["Exclusive golf privileges", "Gated and guarded"],
  },
  {
    id: "horizon-the-peak", townshipId: "horizon", product: "The Peak", name: "The Peak 3-storey cluster home", type: "Semi-D", landed: true,
    priceRM: 1_700_000, builtUpSqft: 2_625, beds: 5, baths: 5, tenure: "Freehold", completion: 2027, serviceRM: 350, source: "official",
    photo: g("horizon-the-peak"), photoAlt: "The Peak hillside homes",
    highlights: ["Highland homes on natural hill terrain", "Final phases of Horizon Hills"],
  },
  /* Bukit Bantayan Residences, Sabah (999-year leasehold, official) */
  {
    id: "bantayan-dilenia", townshipId: "bantayan", product: "Dilenia", name: "Dilenia serviced apartment", type: "Serviced apartment", landed: false,
    priceRM: 515_660, builtUpSqft: 1_007, beds: 3, baths: 2, tenure: "Leasehold", completion: 2026, maintenancePsfRM: 0.3, source: "official",
    photo: g("bantayan-dilenia"), photoAlt: "Bukit Bantayan Residences towers on a hill",
    highlights: ["Sea and mountain views over Likas Bay", "5% Bumiputera discount"],
  },
  {
    id: "bantayan-cemara", townshipId: "bantayan", product: "Cemara", name: "Cemara serviced apartment", type: "Serviced apartment", landed: false,
    priceRM: 552_710, builtUpSqft: 1_100, beds: 3, baths: 2, tenure: "Leasehold", completion: 2026, maintenancePsfRM: 0.3, source: "official",
    photo: g("bantayan-cemara"), photoAlt: "Bukit Bantayan Residences overlooking Kota Kinabalu",
    highlights: ["999-year leasehold", "Kota Kinabalu city 12 km"],
  },
  /* Completed projects: one resale example each */
  {
    id: "highpark-suites", townshipId: "highpark", product: "HighPark Suites", name: "HighPark dual-key suite", type: "Serviced apartment", landed: false,
    // Developer still lists remaining units: Dual Key Studio Type B1, 603 sq ft, RM581,000.
    priceRM: 581_000, builtUpSqft: 603, beds: 2, baths: 2, tenure: "Freehold", completion: 2022, maintenancePsfRM: 0.4, source: "official",
    photo: g("highpark-suites"), photoAlt: "HighPark Suites tower in Kelana Jaya",
    highlights: ["Freehold in Kelana Jaya", "Dual-key layout for renting out a room"],
  },
  {
    id: "robertson-residences", townshipId: "robertson", product: "The Robertson Residences", name: "The Robertson 2-bedroom (resale)", type: "Condo", landed: false,
    priceRM: 900_000, builtUpSqft: 1_000, beds: 2, baths: 2, tenure: "Freehold", completion: 2017, maintenancePsfRM: 0.45, source: "sample",
    photo: g("robertson-residences"), photoAlt: "The Robertson towers in Bukit Bintang",
    highlights: ["Steps from LRT, MRT and monorail", "Freehold in the Golden Triangle"],
  },
  {
    id: "madge-mansions", townshipId: "madge", product: "Madge Mansions", name: "Madge Mansions residence", type: "Condo", landed: false,
    // "From RM4,500,000" is official; the page lists no floor plans, so size/rooms are estimates.
    priceRM: 4_500_000, builtUpSqft: 4_400, beds: 4, baths: 5, tenure: "Freehold", completion: 2020, maintenancePsfRM: 0.6, source: "sample",
    photo: g("madge-mansions"), photoAlt: "Madge Mansions on Embassy Row",
    highlights: ["Only 52 residences on Embassy Row", "Concierge and private dip pool"],
  },
  {
    id: "valencia-semi-d", townshipId: "valencia", product: "Valencia", name: "Valencia semi-D (resale)", type: "Semi-D", landed: true,
    priceRM: 2_300_000, builtUpSqft: 3_600, beds: 5, baths: 5, tenure: "Leasehold", completion: 2010, serviceRM: 350, source: "sample",
    photo: g("valencia-semi-d"), photoAlt: "Valencia homes around a golf course",
    highlights: ["Resident-only 9-hole golf course", "Gated, next to FRIM"],
  },
  {
    id: "botanic-terrace", townshipId: "botanic", product: "Bandar Botanic", name: "Bandar Botanic terrace (resale)", type: "Terrace", landed: true,
    priceRM: 780_000, builtUpSqft: 2_000, beds: 4, baths: 3, landSize: "22' x 75'", tenure: "Freehold", completion: 2008, serviceRM: 150, source: "sample",
    photo: g("botanic-terrace"), photoAlt: "Bandar Botanic lake and homes",
    highlights: ["Mature 'Home in a Garden' township", "Own shops, schools and lake park"],
  },
  {
    id: "kemuning-terrace", townshipId: "kemuning", product: "Kota Kemuning", name: "Kota Kemuning terrace (resale)", type: "Terrace", landed: true,
    priceRM: 820_000, builtUpSqft: 1_900, beds: 4, baths: 3, landSize: "22' x 75'", tenure: "Freehold", completion: 2005, source: "sample",
    photo: g("kemuning-terrace"), photoAlt: "Kota Kemuning township",
    highlights: ["Established township next to KESAS", "Lakeside park and shops"],
  },
];

/** Low-res copy of a unit photo for the 8-bit look (render with image-rendering: pixelated). */
export const pixelPhoto = (photo: string) => photo.replace("/homelander/", "/homelander/px/").replace(/\.jpg$/, ".png");

/* ---------------------------------------------------------------- availability (SAMPLE) */

export type Availability = {
  left: number;
  total: number;
  /** Block or phase the remaining units sit in. */
  phase: string;
  status: "Available" | "Few left" | "Last unit" | "Sold out";
};

const stock: Record<string, [left: number, total: number, phase: string]> = {
  "cove-north-woods": [64, 420, "Tower A"],
  "cove-mori-pines": [18, 96, "Phase 2"],
  "cove-camellia": [5, 48, "Wetlands Estates"],
  "gardens-illaria": [3, 210, "Move-in ready"],
  "gardens-valeria": [9, 120, "Phase 2"],
  "gardens-heston-hills": [14, 60, "Gardens Esteem"],
  "gardens-park-astor": [22, 140, "Phase 1"],
  "gardens-park-elgar": [37, 160, "Phase 2"],
  "tf7-quayside-plazas": [51, 330, "Tower B"],
  "tf7-clove-signature": [7, 70, "Final phase"],
  "jade-j-homes": [4, 180, "Move-in ready"],
  "jade-summerwoods": [2, 19, "Summerwoods"],
  "kundang-valerian": [6, 74, "Phase 2A"],
  "kundang-anise": [1, 72, "Corner units"],
  "haus15-type-a": [38, 300, "Block A"],
  "haus15-type-e": [11, 60, "Block A"],
  "horizon-greenville": [8, 90, "The Cove precinct"],
  "horizon-kingswood": [5, 44, "KingsWood"],
  "horizon-the-peak": [12, 56, "P8B"],
  "bantayan-dilenia": [16, 220, "Dilenia tower"],
  "bantayan-cemara": [9, 220, "Cemara tower"],
  "highpark-suites": [3, 600, "Resale"],
  "robertson-residences": [2, 750, "Resale"],
  "madge-mansions": [1, 52, "Resale"],
  "valencia-semi-d": [2, 900, "Resale"],
  "botanic-terrace": [4, 6000, "Resale"],
  "kemuning-terrace": [3, 9000, "Resale"],
};

export function availabilityOf(unitId: string): Availability {
  const [left, total, phase] = stock[unitId] ?? [0, 0, "-"];
  const status = left === 0 ? "Sold out" : left === 1 ? "Last unit" : left <= 7 ? "Few left" : "Available";
  return { left, total, phase, status };
}

export const townshipById = Object.fromEntries(townships.map((t) => [t.id, t])) as Record<string, Township>;
/**
 * Old sample unit ids (before the real Gamuda data) still referenced by saved state and a few
 * sample tables (demand.ts leads, analysis.ts SAMPLE_LINEUP). They resolve to the closest real
 * product so nothing crashes; new code should use the ids in `units`.
 */
const legacyUnitIds: Record<string, string> = {
  "cove-t1": "cove-mori-pines", "cove-sd": "cove-camellia",
  "gardens-t1": "gardens-illaria", "gardens-t2": "gardens-valeria",
  "tf7-t1": "tf7-clove-signature", "tf7-sd": "tf7-quayside-plazas",
  "jade-sd": "jade-summerwoods", "jade-t1": "jade-j-homes",
  "highpark-a": "highpark-suites", "highpark-c": "highpark-suites",
  "robertson-s": "robertson-residences", "robertson-2": "robertson-residences",
  "kundang-t1": "kundang-valerian", "kundang-sd": "kundang-anise",
};
const byId = Object.fromEntries(units.map((u) => [u.id, u])) as Record<string, Unit>;
export const unitById: Record<string, Unit> = {
  ...Object.fromEntries(Object.entries(legacyUnitIds).map(([old, id]) => [old, byId[id]!])),
  ...byId,
};

/* ---------------------------------------------------------------- rail */

export type Station = { name: string; pos: LatLng };
export type RailLine = { id: string; name: string; stations: Station[] };

const s = (name: string, lat: number, lng: number): Station => ({ name, pos: { lat, lng } });

export const railLines: RailLine[] = [
  {
    id: "mrt-kajang", name: "MRT Kajang line",
    stations: [
      s("Sungai Buloh", 3.2066, 101.581), s("Kota Damansara", 3.15, 101.579), s("Bandar Utama", 3.1464, 101.6187),
      s("Semantan", 3.151, 101.6655), s("Muzium Negara", 3.1375, 101.6878), s("Bukit Bintang", 3.146, 101.711),
      s("Maluri", 3.124, 101.727), s("Taman Connaught", 3.079, 101.737), s("Sungai Jernih", 3.0005, 101.7837),
      s("Kajang", 2.983, 101.7905),
    ],
  },
  {
    id: "mrt-putrajaya", name: "MRT Putrajaya line",
    stations: [
      s("Kwasa Damansara", 3.176, 101.572), s("Kepong Baru", 3.211, 101.637), s("Titiwangsa", 3.1735, 101.6955),
      s("Conlay", 3.1515, 101.718), s("Chan Sow Lin", 3.1285, 101.7155), s("Serdang Raya", 3.042, 101.705),
      s("Cyberjaya City Centre", 2.948, 101.666), s("Putrajaya Sentral", 2.932, 101.672),
    ],
  },
  {
    id: "lrt-kj", name: "LRT Kelana Jaya line",
    stations: [
      s("Gombak", 3.2318, 101.724), s("KLCC", 3.159, 101.713), s("KL Sentral", 3.1345, 101.686),
      s("Kerinchi", 3.1155, 101.6685), s("Kelana Jaya", 3.1125, 101.6045), s("Glenmarie", 3.095, 101.591),
      s("Subang Alam", 3.04, 101.58), s("Putra Heights", 2.996, 101.5755),
    ],
  },
  {
    // Added with the real projects: Haus on 15 sits about 500 m from SS15 station.
    id: "lrt-sp", name: "LRT Sri Petaling line",
    stations: [
      s("Putra Heights", 2.996, 101.5755), s("USJ 21", 3.0303, 101.5892), s("Taipan", 3.0478, 101.5904),
      s("SS15", 3.0757, 101.5866), s("Sunway Lagoon", 3.0699, 101.6064), s("IOI Puchong Jaya", 3.0484, 101.6206),
      s("Bukit Jalil", 3.0583, 101.6922), s("Sri Petaling", 3.0613, 101.6873), s("Chan Sow Lin", 3.1279, 101.7158),
      s("Hang Tuah", 3.1403, 101.7058), s("Masjid Jamek", 3.1494, 101.6963),
    ],
  },
  {
    id: "ktm", name: "KTM Komuter",
    stations: [s("Rawang", 3.3205, 101.575), s("Kuang", 3.258, 101.555), s("Sungai Buloh", 3.206, 101.58), s("KL Sentral", 3.134, 101.6865)],
  },
];

/* ---------------------------------------------------------------- anchors */

export type Anchor = { id: string; name: string; pos: LatLng };

export const anchorOptions: Anchor[] = [
  { id: "bangsar-south", name: "Bangsar South", pos: { lat: 3.111, lng: 101.6656 } },
  { id: "kl-sentral", name: "KL Sentral", pos: { lat: 3.134, lng: 101.6865 } },
  { id: "klcc", name: "KLCC", pos: { lat: 3.1579, lng: 101.7123 } },
  { id: "pj", name: "Petaling Jaya (Uptown)", pos: { lat: 3.1355, lng: 101.6237 } },
  { id: "cyberjaya", name: "Cyberjaya", pos: { lat: 2.9213, lng: 101.6559 } },
  { id: "shah-alam", name: "Shah Alam", pos: { lat: 3.0738, lng: 101.5183 } },
  { id: "kajang", name: "Kajang town", pos: { lat: 2.993, lng: 101.787 } },
  { id: "mid-valley", name: "Mid Valley", pos: { lat: 3.1179, lng: 101.6773 } },
  { id: "damansara-heights", name: "Damansara Heights / Bukit Damansara", pos: { lat: 3.1468, lng: 101.6623 } },
  { id: "bukit-bintang", name: "Bukit Bintang / TRX", pos: { lat: 3.1428, lng: 101.7175 } },
  { id: "subang-usj", name: "Subang Jaya / USJ", pos: { lat: 3.0567, lng: 101.5851 } },
  { id: "puchong", name: "Puchong", pos: { lat: 3.0457, lng: 101.618 } },
];

/* ---------------------------------------------------------------- commute model */

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(p: LatLng) {
  let best = { station: railLines[0]!.stations[0]!, line: railLines[0]!, km: Infinity };
  for (const line of railLines) {
    for (const st of line.stations) {
      const km = distanceKm(p, st.pos);
      if (km < best.km) best = { station: st, line, km };
    }
  }
  return best;
}

const ROAD_FACTOR = 1.35;
const RUSH_KMH = 32;
const RAIL_KMH = 38;

/** One-way minutes, rush hour, driving. */
export function driveMinutes(a: LatLng, b: LatLng) {
  return Math.round((distanceKm(a, b) * ROAD_FACTOR * 60) / RUSH_KMH + 8);
}

/** Access leg: walk under 1.2 km, otherwise drive/feeder at 25 km/h plus a 6 min park-and-wait. */
function accessMinutes(km: number) {
  return km <= 1.2 ? Math.round((km / 5) * 60) : Math.round((km * ROAD_FACTOR * 60) / 25 + 6);
}

/** One-way minutes by rail with a simple access/egress and one transfer when lines differ. */
export function transitMinutes(a: LatLng, b: LatLng) {
  const from = nearestStation(a);
  const to = nearestStation(b);
  const ride = Math.round((distanceKm(from.station.pos, to.station.pos) * ROAD_FACTOR * 60) / RAIL_KMH);
  const transfer = from.line.id === to.line.id ? 0 : 8;
  return {
    minutes: accessMinutes(from.km) + 4 + ride + transfer + accessMinutes(to.km),
    station: from.station.name,
    line: from.line.name,
    stationKm: from.km,
  };
}

/* ---------------------------------------------------------------- money (Malaysia, estimates) */

export const LOAN_RATE = 0.042;
export const LOAN_YEARS = 35;
export const MARGIN = 0.9;
export const DSR_LIMIT = 0.6;

export function monthlyInstalment(loan: number, rate = LOAN_RATE, years = LOAN_YEARS) {
  const r = rate / 12;
  const n = years * 12;
  return (loan * r) / (1 - (1 + r) ** -n);
}

export function loanFromInstalment(instalment: number, rate = LOAN_RATE, years = LOAN_YEARS) {
  const r = rate / 12;
  const n = years * 12;
  return (instalment * (1 - (1 + r) ** -n)) / r;
}

/** Memorandum of transfer stamp duty, tiered (1% / 2% / 3% / 4%). */
export function transferStampDuty(price: number) {
  const tiers: [number, number][] = [
    [100_000, 0.01],
    [400_000, 0.02],
    [500_000, 0.03],
    [Infinity, 0.04],
  ];
  let left = price;
  let duty = 0;
  for (const [band, rate] of tiers) {
    const part = Math.min(left, band);
    duty += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  return Math.round(duty);
}

/** SPA legal fees, approximate scale: 1.25% of the first RM500k, 1% after. */
export function legalFees(price: number) {
  return Math.round(Math.min(price, 500_000) * 0.0125 + Math.max(price - 500_000, 0) * 0.01);
}

export type Payslip = {
  employer: string;
  month: string;
  grossRM: number;
  epfRM: number;
  socsoRM: number;
  taxRM: number;
  carLoanRM: number;
  ptptnRM: number;
};

/** The sample payslip the OCR demo "reads". */
export const samplePayslip: Payslip = {
  employer: "Sample Engineering Sdn Bhd",
  month: "October 2026",
  grossRM: 9_800,
  epfRM: 1_078,
  socsoRM: 30,
  taxRM: 742,
  carLoanRM: 920,
  ptptnRM: 250,
};

export function affordability(p: Payslip) {
  const netRM = p.grossRM - p.epfRM - p.socsoRM - p.taxRM;
  const commitmentsRM = p.carLoanRM + p.ptptnRM;
  const maxInstalmentRM = Math.max(netRM * DSR_LIMIT - commitmentsRM, 0);
  const maxLoanRM = loanFromInstalment(maxInstalmentRM);
  const maxPriceRM = Math.floor(maxLoanRM / MARGIN / 10_000) * 10_000;
  return { netRM, commitmentsRM, maxInstalmentRM, maxLoanRM, maxPriceRM };
}

export function costOfUnit(price: number, netRM: number, commitmentsRM: number) {
  const loan = price * MARGIN;
  const instalment = monthlyInstalment(loan);
  const downPayment = price - loan;
  const stampDuty = transferStampDuty(price);
  const loanStamp = Math.round(loan * 0.005);
  const legal = legalFees(price);
  const upfront = downPayment + stampDuty + loanStamp + legal;
  const leftover = netRM - commitmentsRM - instalment;
  return { loan, instalment, downPayment, stampDuty, loanStamp, legal, upfront, leftover };
}

export const rm = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);

export const rmShort = (n: number) =>
  n >= 1_000_000 ? `RM${(n / 1_000_000).toFixed(2)}M` : `RM${Math.round(n / 1000)}k`;

/* ---------------------------------------------------------------- pass reasons */

export const passReasons = ["Too far", "Too pricey", "Too small", "Not my style"] as const;
export type PassReason = (typeof passReasons)[number];
