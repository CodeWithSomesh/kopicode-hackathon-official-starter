import { centroid } from "./geo";
import type { Building, Compass, LngLat, Place, Room, Township, Unit } from "./types";

// ILLUSTRATIVE ONLY. "Seri Kopi Heights" is an invented township; all prices, plans and places are made up.
// Sited on open ground near Dengkil, Selangor (about 2.86 N, 101.68 E) so the made-up footprints do not
// sit on real buildings in the basemap. (Site choice not checked against the live basemap.)

export const PROJECT = "Seri Kopi Heights";
const CENTER: LngLat = [101.71, 2.8209];

/**
 * Monthly instalment in RM. Assumptions: 90% loan, 35 years, 4.2% a year, monthly compounding,
 * standard annuity formula. Illustrative; not a bank quote.
 */
export function monthlyInstalment(price: number, loanShare = 0.9, years = 35, ratePerYear = 0.042): number {
  const r = ratePerYear / 12;
  const n = years * 12;
  const loan = price * loanShare;
  return Math.round((loan * r) / (1 - (1 + r) ** -n));
}

// ---- geometry helpers (local metres to lng/lat) ----
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER[1] * Math.PI) / 180);
const at = (eastM: number, northM: number): LngLat => [CENTER[0] + eastM / M_PER_DEG_LNG, CENTER[1] + northM / M_PER_DEG_LAT];
/** A w x d rectangle with every corner chamfered (cut ~8% of the shorter side, at most 2.5 m), as a closed ring. */
const rect = (e: number, n: number, w: number, d: number): LngLat[] => {
  const c = Math.min(0.08 * Math.min(w, d), 2.5);
  const [x0, x1, y0, y1] = [e - w / 2, e + w / 2, n - d / 2, n + d / 2];
  const p = [
    at(x0 + c, y0), at(x1 - c, y0), at(x1, y0 + c), at(x1, y1 - c),
    at(x1 - c, y1), at(x0 + c, y1), at(x0, y1 - c), at(x0, y0 + c),
  ];
  return [...p, p[0]];
};

// ---- unit generation (deterministic) ----
const TEMPLATES = {
  "2R1B": { sqft: 650, w: 6.0, d: 9.0 },
  "3R2B": { sqft: 861, w: 7.2, d: 11.1 },
  "4R3B": { sqft: 1100, w: 8.4, d: 12.2 },
} as const;
type UnitType = keyof typeof TEMPLATES;

const box = (x: number, y: number, w: number, h: number): Room["polygon"] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Rooms in unit-local metres: living/dining at the front (y small), bedrooms behind. */
function roomsFor(type: UnitType, facing: Compass): Room[] {
  const { w, d } = TEMPLATES[type];
  const beds = type === "2R1B" ? 1 : type === "3R2B" ? 2 : 3;
  const front = d * 0.45;
  const rooms: Room[] = [
    { id: "ruang_tamu", name: "Living", polygon: box(0, 0, w, front * 0.6), windows: [facing] },
    { id: "makan", name: "Dining", polygon: box(0, front * 0.6, w, front * 0.4), windows: [] },
    { id: "dapur", name: "Kitchen", polygon: box(w * 0.55, front, w * 0.45, 2.6), windows: [] },
  ];
  const bw = w / (beds + 1);
  for (let i = 0; i < beds; i++) {
    rooms.push({
      id: i === 0 ? "bilik_utama" : `bilik_${i + 1}`,
      name: i === 0 ? "Master bedroom" : `Bedroom ${i + 1}`,
      polygon: box(i * bw, front + 2.6, bw, d - front - 2.6),
      windows: [facing],
    });
  }
  return rooms;
}

const OPPOSITE: Record<Compass, Compass> = { N: "S", NE: "SW", E: "W", SE: "NW", S: "N", SW: "NE", W: "E", NW: "SE" };

function makeUnits(buildingId: string, block: string, floors: number, perFloor: number, centre: LngLat, seed: number): Unit[] {
  const types: UnitType[] = ["3R2B", "2R1B", "3R2B", "4R3B", "2R1B", "3R2B", "4R3B", "3R2B"];
  const facings: Compass[] = ["E", "W", "N", "S"];
  const units: Unit[] = [];
  for (let f = 1; f <= floors; f++) {
    for (let u = 0; u < perFloor; u++) {
      const type = types[(u + seed) % types.length];
      const facing = facings[(u + seed) % facings.length];
      const { sqft } = TEMPLATES[type];
      // RM/sqft rises ~6 per floor, plus a small deterministic wobble per unit; clamped to RM350k-RM900k.
      const rate = 520 + f * 6 + ((f * 7 + u * 13 + seed * 5) % 40);
      const price = Math.min(900_000, Math.max(350_000, Math.round((sqft * rate) / 5000) * 5000));
      units.push({
        project: PROJECT,
        block,
        buildingId,
        floor: f,
        unit: `${f}-${String(u + 1).padStart(2, "0")}`,
        type,
        sizeSqft: sqft,
        price,
        monthly: monthlyInstalment(price),
        facing,
        lat: centre[1],
        lng: centre[0],
        rooms: roomsFor(type, facing),
        door: { room: "ruang_tamu", faces: OPPOSITE[facing], at: [0, 1.9] },
      });
    }
  }
  return units;
}

// id, block, east m, north m, width m, depth m, floors, units per floor
const SPECS: [string, string, number, number, number, number, number, number][] = [
  ["a", "A", -180, 120, 34, 22, 28, 8],
  ["b", "B", -110, 150, 30, 20, 24, 6],
  ["c", "C", -40, 130, 30, 20, 30, 8],
  ["d", "D", 30, 160, 28, 18, 20, 6],
  ["e", "E", 100, 120, 28, 18, 18, 6],
  ["f", "F", 170, 150, 26, 18, 15, 6],
  ["g", "G", -150, -20, 40, 14, 5, 4],
  ["h", "H", -80, -40, 40, 14, 6, 4],
  ["j", "J", -10, -20, 36, 14, 5, 4],
  ["k", "K", 60, -50, 36, 14, 4, 4],
  ["l", "L", 130, -20, 30, 14, 6, 4],
  ["m", "M", 190, -60, 24, 14, 4, 4],
];

const buildings: Building[] = SPECS.map(([id, block, e, n, w, d, floors, per], i) => {
  const footprint = rect(e, n, w, d);
  return { id, block, footprint, floors, heightM: floors * 3.1, units: makeUnits(id, block, floors, per, centroid(footprint), i) };
});

const stations = [
  { id: "st1", name: "Stesen Kopi Utara", ...pt(at(-260, 60)) },
  { id: "st2", name: "Stesen Seri Kopi", ...pt(at(250, 60)) },
];
function pt(p: LngLat) {
  return { lng: p[0], lat: p[1] };
}

const places: Place[] = [
  ["p1", "SK Seri Kopi", "school", -120, 60],
  ["p2", "Klinik Kesihatan Kopi", "clinic", 70, 70],
  ["p3", "Kedai Runcit Pak Ali", "grocery", -20, 70],
  ["p4", "Mydin Seri Kopi", "grocery", 220, 20],
  ["p5", "Kopitiam Ah Hock", "kopitiam", 20, 55],
  ["p6", "Kopitiam Sin Kee", "kopitiam", -170, 55],
  ["p7", "Masjid Al-Kopi", "worship", 140, 50],
  ["p8", "Tokong Seri Kopi", "worship", -220, -10],
  ["p9", "Taman Rekreasi Kopi", "park", 0, -120],
  ["p10", "Taman Tasik Mini", "park", -200, -100],
].map(([id, name, kind, e, n]) => ({ id, name, kind, ...pt(at(e as number, n as number)) }) as Place);

export const township: Township = {
  name: PROJECT,
  center: CENTER,
  buildings,
  rail: {
    id: "line1",
    name: "Laluan Kopi",
    colour: "#c2410c",
    path: [at(-320, 60), at(-260, 60), at(0, 70), at(250, 60), at(330, 60)],
    stations,
  },
  places,
};
