/**
 * HomeLander mock data. Township names are real Gamuda Land projects; every unit,
 * price, size and photo here is SAMPLE data for the demo. Replace with the
 * crawled + OCR'd project data before showing this as real.
 *
 * Coordinates are approximate (to ~1 km). Commute figures are estimates from a
 * simple model (straight-line distance x road factor at rush-hour speed), not routing.
 */

export type LatLng = { lat: number; lng: number };

export type Township = {
  id: string;
  name: string;
  area: string;
  pos: LatLng;
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
};

export const townships: Township[] = [
  { id: "cove", name: "Gamuda Cove", area: "Kuala Langat, Selangor", pos: { lat: 2.8827801, lng: 101.6091032 } },
  { id: "gardens", name: "Gamuda Gardens", area: "Kuang, Selangor", pos: { lat: 3.2907584, lng: 101.5359344 } },
  { id: "tf7", name: "twentyfive.7", area: "Kota Kemuning, Selangor", pos: { lat: 2.9785, lng: 101.5385 } },
  { id: "jade", name: "Jade Hills", area: "Kajang, Selangor", pos: { lat: 2.9972172, lng: 101.7541106 } },
  { id: "highpark", name: "Highpark Suites", area: "Kelana Jaya, Selangor", pos: { lat: 3.105, lng: 101.602 } },
  { id: "robertson", name: "The Robertson", area: "Bukit Bintang, Kuala Lumpur", pos: { lat: 3.142, lng: 101.705 } },
  { id: "kundang", name: "Kundang Estates", area: "Kuang, Selangor", pos: { lat: 3.288243, lng: 101.5082516 } },
];

const P = "/homelander/";
export const units: Unit[] = [
  {
    id: "cove-t1", townshipId: "cove", name: "Cove Terrace 22x75", type: "Terrace", landed: true,
    priceRM: 768_000, builtUpSqft: 2_150, beds: 4, baths: 3, tenure: "Freehold", completion: 2028,
    photo: `${P}terraced-house-bandar-sri-sendayan-seremban.jpg`, photoAlt: "Two-storey terrace house with a gated porch",
    highlights: ["Next to the 120-acre wetland park", "Guarded and gated precinct"],
  },
  {
    id: "cove-sd", townshipId: "cove", name: "Cove Semi-D 40x80", type: "Semi-D", landed: true,
    priceRM: 1_380_000, builtUpSqft: 3_200, beds: 5, baths: 5, tenure: "Freehold", completion: 2028,
    photo: `${P}taman-samudera-13.jpg`, photoAlt: "Double-storey houses on a quiet street",
    highlights: ["Corner lots with side garden", "Lakefront clubhouse"],
  },
  {
    id: "gardens-t1", townshipId: "gardens", name: "Gardens Terrace 20x70", type: "Terrace", landed: true,
    priceRM: 648_000, builtUpSqft: 1_850, beds: 4, baths: 3, tenure: "Freehold", completion: 2027,
    photo: `${P}taman-sri-rembau.jpg`, photoAlt: "Row of new terrace houses along a quiet street",
    highlights: ["Walk to KTM Kuang station", "50-acre central park"],
  },
  {
    id: "gardens-t2", townshipId: "gardens", name: "Gardens Garden Home 22x75", type: "Terrace", landed: true,
    priceRM: 738_000, builtUpSqft: 2_280, beds: 4, baths: 4, tenure: "Freehold", completion: 2027,
    photo: `${P}taman-sri-fajar-johor-20250205-161611.jpg`, photoAlt: "Terrace houses with front gardens",
    highlights: ["Dual-key ready layout", "Facing the park"],
  },
  {
    id: "tf7-t1", townshipId: "tf7", name: "25.7 Link Home 22x80", type: "Terrace", landed: true,
    priceRM: 918_000, builtUpSqft: 2_460, beds: 4, baths: 4, tenure: "Freehold", completion: 2027,
    photo: `${P}taman-samudera-13.jpg`, photoAlt: "Double-storey link homes",
    highlights: ["Quayside mall in the township", "Lake promenade"],
  },
  {
    id: "tf7-sd", townshipId: "tf7", name: "25.7 Cluster Semi-D", type: "Semi-D", landed: true,
    priceRM: 1_250_000, builtUpSqft: 2_950, beds: 5, baths: 5, tenure: "Freehold", completion: 2028,
    photo: `${P}taman-sri-fajar-johor-20250205-161611.jpg`, photoAlt: "Houses with front gardens",
    highlights: ["Cluster with private lane", "Near SKVE"],
  },
  {
    id: "jade-sd", townshipId: "jade", name: "Jade Hills Semi-D", type: "Semi-D", landed: true,
    priceRM: 1_620_000, builtUpSqft: 3_450, beds: 5, baths: 5, tenure: "Freehold", completion: 2027,
    photo: `${P}terraced-house-bandar-sri-sendayan-seremban.jpg`, photoAlt: "Two-storey house with a gated porch",
    highlights: ["Hillside, 3 km to MRT Kajang", "Mature landscaping"],
  },
  {
    id: "jade-t1", townshipId: "jade", name: "Jade Hills Terrace 24x80", type: "Terrace", landed: true,
    priceRM: 1_080_000, builtUpSqft: 2_680, beds: 4, baths: 4, tenure: "Freehold", completion: 2026,
    photo: `${P}terraced-house-bandar-sri-sendayan-seremban.jpg`, photoAlt: "Two-storey terrace house with a gated porch",
    highlights: ["Ready to move in 2026", "Feeder bus to MRT Kajang"],
  },
  {
    id: "highpark-a", townshipId: "highpark", name: "Highpark Suites A", type: "Serviced apartment", landed: false,
    priceRM: 548_000, builtUpSqft: 850, beds: 2, baths: 2, tenure: "Leasehold", completion: 2026,
    photo: `${P}taman-miharja-apartment-20241130-144810.jpg`, photoAlt: "Apartment towers with balconies",
    highlights: ["4 min walk to LRT Kelana Jaya", "Sky pool on level 41"],
  },
  {
    id: "highpark-c", townshipId: "highpark", name: "Highpark Suites C", type: "Serviced apartment", landed: false,
    priceRM: 712_000, builtUpSqft: 1_120, beds: 3, baths: 2, tenure: "Leasehold", completion: 2026,
    photo: `${P}bistari-condominium-kuala-lumpur-20240212-134920.jpg`, photoAlt: "Condominium tower against the sky",
    highlights: ["Corner unit, two car parks", "LRT and Federal Highway"],
  },
  {
    id: "robertson-s", townshipId: "robertson", name: "The Robertson Studio", type: "Condo", landed: false,
    priceRM: 528_000, builtUpSqft: 620, beds: 1, baths: 1, tenure: "Freehold", completion: 2026,
    photo: `${P}vortex-suites-klcc-kuala-lumpur-4to3.jpg`, photoAlt: "High-rise residence in central Kuala Lumpur",
    highlights: ["5 min walk to MRT Bukit Bintang", "Strong rental demand"],
  },
  {
    id: "robertson-2", townshipId: "robertson", name: "The Robertson 2-Bedroom", type: "Condo", landed: false,
    priceRM: 868_000, builtUpSqft: 1_050, beds: 2, baths: 2, tenure: "Freehold", completion: 2026,
    photo: `${P}kuala-lumpur-skyline-late-afternoon-from-29.jpg`, photoAlt: "Kuala Lumpur skyline seen from a 29th-floor window",
    highlights: ["KLCC skyline view", "Freehold in the city centre"],
  },
  {
    id: "kundang-t1", townshipId: "kundang", name: "Kundang Terrace 20x70", type: "Terrace", landed: true,
    priceRM: 598_000, builtUpSqft: 1_780, beds: 4, baths: 3, tenure: "Freehold", completion: 2028,
    photo: `${P}taman-sri-fajar-johor-20250205-161611.jpg`, photoAlt: "Terrace houses with front gardens",
    highlights: ["Lowest entry price in the list", "Lake and orchard park"],
  },
  {
    id: "kundang-sd", townshipId: "kundang", name: "Kundang Semi-D 40x80", type: "Semi-D", landed: true,
    priceRM: 1_150_000, builtUpSqft: 3_050, beds: 5, baths: 4, tenure: "Freehold", completion: 2028,
    photo: `${P}taman-samudera-13.jpg`, photoAlt: "Double-storey link homes",
    highlights: ["Large land, 40x80 ft", "Gated with 3-tier security"],
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
  "cove-t1": [18, 96, "Phase 3B"],
  "cove-sd": [4, 40, "Phase 3A"],
  "gardens-t1": [3, 120, "Phase 5"],
  "gardens-t2": [27, 88, "Phase 6"],
  "tf7-t1": [11, 64, "Precinct 9"],
  "tf7-sd": [1, 24, "Precinct 8"],
  "jade-sd": [6, 32, "Ohana"],
  "jade-t1": [9, 58, "Ohana"],
  "highpark-a": [42, 380, "Tower A"],
  "highpark-c": [7, 210, "Tower C"],
  "robertson-s": [23, 160, "Residence 2"],
  "robertson-2": [5, 90, "Residence 2"],
  "kundang-t1": [36, 140, "Phase 1"],
  "kundang-sd": [0, 30, "Phase 1"],
};

export function availabilityOf(unitId: string): Availability {
  const [left, total, phase] = stock[unitId] ?? [0, 0, "-"];
  const status = left === 0 ? "Sold out" : left === 1 ? "Last unit" : left <= 7 ? "Few left" : "Available";
  return { left, total, phase, status };
}

export const townshipById = Object.fromEntries(townships.map((t) => [t.id, t])) as Record<string, Township>;
export const unitById = Object.fromEntries(units.map((u) => [u.id, u])) as Record<string, Unit>;

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
