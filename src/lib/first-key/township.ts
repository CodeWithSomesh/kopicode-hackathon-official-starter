import { centroid } from "./geo";
import type { Building, Compass, LngLat, Place, Township, Unit } from "./types";
import { SPECS as TYPE_SPECS, doorX, roomsFor, widthOf, type UnitType } from "./unit-plans";

// ILLUSTRATIVE ONLY. "Seri Kopi Heights" is an invented township; all prices, plans and places are made up.
// Sited on open ground near Dengkil, Selangor (about 2.86 N, 101.68 E) so the made-up footprints do not
// sit on real buildings in the basemap. (Site choice not checked against the live basemap.)

export const PROJECT = "Seri Kopi Heights";
const CENTER: LngLat = [101.6097, 2.8806];

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
/** A w x d rectangle with every corner chamfered (cut 18% of the shorter side, at most 4.5 m), as a closed ring. */
const rect = (e: number, n: number, w: number, d: number): LngLat[] => {
  const c = Math.min(0.18 * Math.min(w, d), 4.5);
  const [x0, x1, y0, y1] = [e - w / 2, e + w / 2, n - d / 2, n + d / 2];
  const p = [
    at(x0 + c, y0), at(x1 - c, y0), at(x1, y0 + c), at(x1, y1 - c),
    at(x1 - c, y1), at(x0 + c, y1), at(x0, y1 - c), at(x0, y0 + c),
  ];
  return [...p, p[0]];
};

// ---- unit generation (deterministic) ----
/** Towers of 15+ floors stand on a 2-storey podium: lobby, then car park. Keep in step with podiumFloors in tower/tower-model.ts. */
const podiumFloors = (floors: number) => (floors >= 15 ? 2 : 0);
export type FloorKind = "lobby" | "carpark" | "deck" | "units";
/** Floor 1 is the lobby (shops too on a serviced tower), floor 2 the car park, deck floors the pool and gym; none hold flats. */
export const floorKind = (b: Pick<Building, "floors" | "decks">, floor: number): FloorKind =>
  floor === 1 ? "lobby" : floor <= podiumFloors(b.floors) ? "carpark" : b.decks.includes(floor) ? "deck" : "units";
export const floorLabel = (b: Pick<Building, "floors" | "decks" | "style">, floor: number) =>
  ({ lobby: b.style === "serviced" ? "Lobby and shops" : "Lobby", carpark: "Car park", deck: "Facilities deck", units: "" })[floorKind(b, floor)];

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Mix of unit types by height share t (0 = lowest flat floor, 1 = top): small flats low, bigger ones high. */
const MIX: [number, [UnitType, number][]][] = [
  [0.25, [["Studio", 4], ["1R1B", 4], ["2R2B", 2]]],
  [0.55, [["1R1B", 2], ["2R2B", 5], ["3R2B", 2], ["Dual-key", 1]]],
  [0.85, [["2R2B", 2], ["3R2B", 5], ["Dual-key", 2]]],
  [1.01, [["3R2B", 4], ["Dual-key", 3]]],
];

/** Serviced towers sell 550-977 sqft (Maya Bay: 550-968): no studios, and the corner suites are dual-key. */
const pickType = (r: () => number, t: number, serviced: boolean): UnitType => {
  const opts = MIX.find(([max]) => t < max)![1];
  let x = r() * opts.reduce((s, [, w]) => s + w, 0);
  let pick = opts[0][0];
  for (const [ty, w] of opts) if ((x -= w) < 0) { pick = ty; break; }
  return serviced && pick === "Studio" ? "1R1B" : pick;
};

const OPPOSITE: Record<Compass, Compass> = { N: "S", NE: "SW", E: "W", SE: "NW", S: "N", SW: "NE", W: "E", NW: "SE" };

/** One row of flats for a floor: corner types at both ends, the rest drawn by height, until the row's width is used up. */
function fillRow(r: () => number, t: number, top: boolean, target: number, pentCount: number, serviced: boolean): UnitType[] {
  if (top) return Array<UnitType>(pentCount).fill("Penthouse");
  // Upper floors: the row ends are L-shaped 3+1 corners about half the time, so floors differ rather than repeat.
  const end = (): UnitType => (t >= 0.4 && r() < 0.55 ? (serviced ? "Dual-key" : "3+1 Corner") : pickType(r, t, serviced));
  const seq: UnitType[] = [end()];
  let acc = widthOf(seq[0]);
  const endW = widthOf(serviced ? "Dual-key" : "3+1 Corner");
  for (;;) {
    const ty = pickType(r, t, serviced);
    if (acc + endW + widthOf(ty) / 2 > target) break;
    seq.push(ty);
    acc += widthOf(ty);
  }
  seq.push(end());
  return seq;
}

const rowsOf = (w: number, d: number): 1 | 2 => (w / d > 2.3 ? 1 : 2);

function makeUnits(buildingId: string, block: string, floors: number, perFloor: number, rows: 1 | 2, serviced: boolean, decks: number[], centre: LngLat, seed: number): Unit[] {
  const units: Unit[] = [];
  const first = podiumFloors(floors) + (podiumFloors(floors) ? 1 : 2); // floors 1-2 podium (or floor 1 alone) hold no flats
  const tower = podiumFloors(floors) > 0;
  const view: Compass = seed % 2 ? "N" : "S"; // the side of the block with the better outlook (park or lake)
  const target = (perFloor / rows) * 8;
  const pentPerRow = Math.ceil(perFloor / rows / 3);
  for (let f = first; f <= floors; f++) {
    if (decks.includes(f)) continue;
    const r = rng(seed * 1009 + f * 31 + 7);
    const t = floors === first ? 1 : (f - first) / (floors - first);
    const top = f === floors;
    let n = 0;
    for (let row = 0; row < rows; row++) {
      const seq = fillRow(r, t, top, target, pentPerRow, serviced);
      seq.forEach((type, i) => {
        const end = i === 0 || i === seq.length - 1;
        const left = i === 0;
        const facing: Compass = end ? (row === 0 ? (left ? "SW" : "SE") : left ? "NW" : "NE") : row === 0 ? "S" : "N";
        const sp = TYPE_SPECS[type];
        // RM per sqft: base plus a rise per floor, times the type factor; corners +4%, the outlook side +3%.
        const base = tower ? 600 + f * 7 : 480 + f * 6;
        const premium = 1 + (end ? 0.04 : 0) + (facing.includes(view) ? 0.03 : 0) + (((f * 7 + n * 13 + seed * 5) % 5) - 2) * 0.004;
        const raw = sp.sqft * base * sp.psf * premium;
        const price = Math.min(type === "Penthouse" ? 1_500_000 : 1_200_000, Math.max(350_000, Math.round(raw / 5000) * 5000));
        n++;
        const mirror = left;
        units.push({
          project: PROJECT,
          block,
          buildingId,
          floor: f,
          unit: `${f}-${String(n).padStart(2, "0")}`,
          type,
          sizeSqft: sp.sqft,
          price,
          monthly: monthlyInstalment(price),
          facing,
          lat: centre[1],
          lng: centre[0],
          rooms: roomsFor(type, facing, mirror),
          door: { room: sp.door, faces: OPPOSITE[facing], at: [doorX(type, mirror), 0] },
        });
      });
    }
  }
  return units;
}

// Gamuda Cove has five real towers (3 Maya Bay serviced-apartment towers, 2 North Woods blocks, A1 and A2); the landed
// homes get their own zone elsewhere. These five stand in the north row. Block names and plans are made up.
// id, block, east m, north m, width m, depth m, floors, flats per floor (target), style, deck floors
const SPECS: [string, string, number, number, number, number, number, number, Building["style"], number[]][] = [
  ["a", "A", -190, 130, 46, 24, 28, 10.5, "serviced", [6]],
  ["b", "B", -115, 150, 44, 24, 26, 11.5, "serviced", [6]],
  ["c", "C", -35, 130, 46, 24, 30, 10, "serviced", [6]],
  ["d", "D", 50, 155, 46, 24, 32, 10, "residence", [6, 30]],
  ["e", "E", 125, 125, 34, 22, 32, 5, "residence", [6, 30]],
];

const buildings: Building[] = SPECS.map(([id, block, e, n, w, d, floors, per, style, decks], i) => {
  const footprint = rect(e, n, w, d);
  const rows = rowsOf(w, d);
  return { id, block, footprint, floors, heightM: floors * 3.1, rows, style, decks, units: makeUnits(id, block, floors, per, rows, style === "serviced", decks, centroid(footprint), i) };
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
