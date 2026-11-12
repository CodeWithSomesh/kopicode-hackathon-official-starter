import type { Compass, LngLat, Room, XY } from "./types";
import { PROJECT, monthlyInstalment, township } from "./township";
import { parseVariant, siteIndexOf, siteKind, siteLayout } from "./site-layout";
import { townshipById, units as products } from "../homelander/data";

// ILLUSTRATIVE ONLY. A made-up gated landed enclave inside Gamuda Cove, "Seri Kopi Heights". Every plan, lot, price
// and street below is invented; only the two anchors are real Gamuda Cove products (src/lib/homelander/data.ts):
//   Mori Pines 2-storey terrace  RM849,800, 1,785 sqft, 4 bed 3 bath
//   The Camellia semi-D (prairie) RM1.7M,   2,600 sqft, 4 bed 4 bath
//
// The enclave sits on its own ground, far from the tower row: see ZONE. Frames used below:
//   zone    x east, y north, metres from the zone centre (layout of lots and streets)
//   house   x east, y south, metres from the lot's north-west corner, front facade at the large-y side
//           (the same y-towards-the-facade rule the burst's furnish() already uses). A lot with heading 180 is that frame
//           turned half a circle on the ground (front faces north). Room.windows are true compass points.

export const STOREY_H = 3.1; // = FLOOR_H in burst/layout.ts
export type LandedType = "terrace" | "superlink" | "link" | "townhouse" | "cluster" | "semid" | "bungalow" | "clubhouse";
/** Units in a row when the variant key has no count; car porch depth (front of the footprint); deepest body a type builds (the rest is rear garden). Shared with tower/landed-model.ts. */
export const DEFAULT_N: Record<LandedType, number> = { terrace: 6, superlink: 4, link: 4, townhouse: 6, cluster: 4, semid: 2, bungalow: 1, clubhouse: 1 };
export const PORCH_OF: Record<LandedType, number> = { terrace: 6, superlink: 6, link: 6, townhouse: 0, cluster: 0, semid: 6, bungalow: 6, clubhouse: 0 };
export const MAX_BODY: Record<LandedType, number> = { terrace: 13.5, superlink: 15, link: 13.5, townhouse: 15, cluster: 20, semid: 14, bungalow: 14, clubhouse: 16 };
export type RoofStyle = "gable" | "hip" | "prairie" | "flat";
/** Roof geometry shared by the plans (height) and the model: pitch in degrees, eave overhang in metres. */
export const ROOF: Record<RoofStyle, { pitch: number; ov: number }> = {
  gable: { pitch: 25, ov: 0.6 },
  hip: { pitch: 22, ov: 0.7 },
  prairie: { pitch: 12, ov: 1.1 },
  flat: { pitch: 0, ov: 0.3 },
};
const tan = (deg: number) => Math.tan((deg * Math.PI) / 180);
/** Height of the roof above the top storey for a roof over a w x d body. */
export function roofRise(style: RoofStyle, w: number, d: number): number {
  const r = ROOF[style];
  if (style === "flat") return 0.5; // parapet
  if (style === "gable") return (d / 2 + r.ov) * tan(r.pitch); // ridge along the row
  return (Math.min(w, d) / 2 + r.ov) * tan(r.pitch);
}

// ---- where the enclave is ----
const CENTER = township.center;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER[1] * Math.PI) / 180);
const at = (eastM: number, northM: number): LngLat => [CENTER[0] + eastM / M_PER_DEG_LNG, CENTER[1] + northM / M_PER_DEG_LAT];

/**
 * 580 m west and 50 m north of the township centre (the tower row sits at north +120..+160, east -195..+215, so the
 * nearest tower is 255 m from the zone's east edge). Land: oil-palm estate south of the Cove's phase road, no OSM
 * building, road, water or landuse polygon inside the zone or within 40 m of it (Overpass, 2026-11-13; satellite
 * checked by eye). 260 x 180 m = 11.6 ha (about 29 acres) with a 15 m park buffer round the edge.
 */
const ZC = { e: -580, n: 50 };
export const ZONE = { name: "Seri Kopi Enclave", w: 260, d: 180, centre: at(ZC.e, ZC.n), distanceToTowersM: 255 };
const zone = (x: number, y: number): LngLat => at(ZC.e + x, ZC.n + y);
const ring = (pts: [number, number][]): LngLat[] => [...pts.map(([x, y]) => zone(x, y)), zone(...pts[0])];
const box = (x0: number, y0: number, x1: number, y1: number) => ring([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

// ---- rooms ----
const R = (id: string, name: string, x0: number, y0: number, x1: number, y1: number): Room => ({
  id,
  name,
  polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as XY[],
  windows: [],
});
/** Rooms that are open to the sky (no roof, walls or built-up area). */
export const OPEN_AIR = new Set(["porch", "yard", "garden", "pool", "terrace", "terrace_2"]); // balconies are drawn as rooms (tiled floor), they just have no roof of their own
export const isOpenAir = (r: Room) => OPEN_AIR.has(r.id);
const NO_WINDOW = new Set(["tangga", "stor", "walk_in", "balkoni"]);
const isBed = (r: Room) => /^bilik_(utama|\d+|tetamu)$/.test(r.id);
const isBath = (r: Room) => /^tandas/.test(r.id);

export type Rect = { x: number; y: number; w: number; d: number };
export type Storey = { level: number; label: string; body: Rect; rooms: Room[] };
export type Typology = "terrace" | "semid" | "bungalow";
export type House = {
  id: string;
  lotNo: string; // "T7", "S3", "B1"
  project: string;
  typology: Typology;
  kind: "intermediate" | "end lot" | "semi-d" | "detached";
  label: string; // "2-storey terrace, end lot"
  group: string; // the building group it belongs to (row, pair or bungalow), see `groups`
  unit: number; // index inside the group, west to east in the group's own frame
  heading: 0 | 180; // 0 = front faces south, 180 = front faces north
  facing: Compass;
  storeys: Storey[]; // house frame, ground first
  lotSize: { w: number; d: number }; // metres
  footprint: LngLat[]; // ground-floor body, closed ring
  plot: LngLat[]; // the whole lot, closed ring
  centre: LngLat; // centre of the ground-floor body
  heightM: number; // to the ridge
  builtUpSqft: number;
  landSqft: number;
  beds: number;
  baths: number;
  price: number; // RM
  monthly: number; // RM, see monthlyInstalment()
  parking: number;
  roof: RoofStyle;
};
/** One building as the map draws it: a terrace row, a semi-D pair, a bungalow. Variant keys follow site-layout.ts. */
export type Group = {
  id: string;
  variant: string;
  houses: string[];
  lng: number;
  lat: number;
  rot: number; // heading, degrees clockwise: 0 = front faces south, 180 = front faces north (enclave: 0 or 180; a site building: any)
  /** Houses are listed east to west in the model's frame (the enclave's heading-180 groups, listed west to east on the ground). */
  reversed?: boolean;
  w: number; // along the row
  d: number; // body depth + the 6 m car porch in front, as landedParts takes it; lng/lat is the centre of that w x d rectangle
  h: number;
};

const SQFT = 10.7639;
const SIDE = 3.0; // side garden of an end lot
const PORCH = 6.0;

// ---- the three plans, in body metres (x east, y south, front at y = d) ----
/** Mori Pines style 2-storey terrace, 6.5 x 12.8 m a floor: 83 m2 x 2 = 1,791 sqft. */
function terrace(): Storey[] {
  const w = 6.5, d = 12.8;
  const body = { x: 0, y: 0, w, d };
  return [
    {
      level: 1, label: "Ground floor", body,
      rooms: [
        R("dapur_basah", "Wet kitchen", 0, 0, 2.4, 2.8), R("dapur", "Dry kitchen", 2.4, 0, w, 2.8),
        R("tandas", "Bath", 0, 2.8, 2.4, 4.6), R("tangga", "Stairs", 0, 4.6, 2.4, 8.0), R("makan", "Dining", 2.4, 2.8, w, 8.0),
        R("bilik_tetamu", "Guest room / study", 0, 8.0, 2.6, d), R("ruang_tamu", "Living", 2.6, 8.0, w, d),
      ],
    },
    {
      level: 2, label: "First floor", body,
      rooms: [
        R("bilik_2", "Bedroom 2", 0, 0, 3.3, 4.0), R("bilik_3", "Bedroom 3", 3.3, 0, w, 4.0),
        R("tangga", "Stairs", 0, 4.0, 2.4, 6.0), R("tandas_2", "Bath", 0, 6.0, 2.4, 8.0), R("keluarga", "Family hall", 2.4, 4.0, w, 8.0),
        R("bilik_utama", "Master bedroom", 0, 8.0, 4.3, d), R("walk_in", "Walk-in", 4.3, 8.0, w, 9.8), R("tandas_utama", "Ensuite", 4.3, 9.8, w, d),
      ],
    },
  ];
}

/** The Camellia style semi-D, 9.0 x 13.4 m a floor (party wall on the east): 121 m2 x 2 = 2,596 sqft. */
function semid(): Storey[] {
  const w = 9.0, d = 13.4;
  const body = { x: 0, y: 0, w, d };
  return [
    {
      level: 1, label: "Ground floor", body,
      rooms: [
        R("dapur_basah", "Wet kitchen", 0, 0, 3.2, 3.6), R("dapur", "Dry kitchen", 3.2, 0, w, 3.6),
        R("bilik_tetamu", "Guest room", 0, 3.6, 3.4, 6.4), R("tandas", "Bath", 0, 6.4, 3.4, 8.0), R("makan", "Dining", 3.4, 3.6, w, 8.0),
        R("tangga", "Stairs", 0, 8.0, 2.8, 11.0), R("foyer", "Foyer", 0, 11.0, 2.8, d), R("ruang_tamu", "Living", 2.8, 8.0, w, d),
      ],
    },
    {
      level: 2, label: "First floor", body,
      rooms: [
        R("bilik_2", "Bedroom 2", 0, 0, 3.8, 4.6), R("tandas_2", "Ensuite 2", 3.8, 0, 5.8, 4.6), R("bilik_3", "Bedroom 3", 5.8, 0, w, 4.6),
        R("tandas_3", "Bath", 0, 4.6, 3.0, 8.0), R("keluarga", "Family hall", 3.0, 4.6, w, 8.0),
        R("tangga", "Stairs", 0, 8.0, 2.8, 11.0), R("walk_in", "Walk-in", 0, 11.0, 2.8, d),
        R("bilik_utama", "Master bedroom", 2.8, 8.0, 6.6, d), R("tandas_utama", "Ensuite", 6.6, 8.0, w, d),
      ],
    },
  ];
}

/** 3-level bungalow, 15 x 12 m body: ground and first floor in full, a lounge pavilion with roof terraces on top. */
function bungalow(): Storey[] {
  const w = 15, d = 12;
  const body = { x: 0, y: 0, w, d };
  return [
    {
      level: 1, label: "Ground floor", body,
      rooms: [
        R("dapur_basah", "Wet kitchen", 0, 0, 3.5, 4.5), R("dapur", "Dry kitchen", 3.5, 0, 8.5, 4.5), R("tandas", "Bath", 8.5, 0, 10.5, 4.5), R("kajian", "Study", 10.5, 0, w, 4.5),
        R("tangga", "Stairs", 0, 4.5, 3.0, 8.0), R("makan", "Dining", 3.0, 4.5, 10.0, 8.0), R("bilik_tetamu", "Guest room", 10.0, 4.5, w, 8.0),
        R("ruang_tamu", "Living", 0, 8.0, 9.0, d), R("foyer", "Foyer", 9.0, 8.0, 12.0, d), R("tandas_2", "Powder room", 12.0, 8.0, w, 10.0), R("stor", "Store", 12.0, 10.0, w, d),
      ],
    },
    {
      level: 2, label: "First floor", body,
      rooms: [
        R("bilik_2", "Bedroom 2", 0, 0, 5.2, 4.5), R("tandas_3", "Ensuite 2", 5.2, 0, 7.5, 4.5), R("tandas_4", "Ensuite 3", 7.5, 0, 9.8, 4.5), R("bilik_3", "Bedroom 3", 9.8, 0, w, 4.5),
        R("tangga", "Stairs", 0, 4.5, 3.0, 8.0), R("keluarga", "Family hall", 3.0, 4.5, w, 8.0),
        R("bilik_utama", "Master bedroom", 0, 8.0, 8.5, d), R("walk_in", "Walk-in", 8.5, 8.0, 11.5, d), R("tandas_utama", "Ensuite", 11.5, 8.0, w, d),
      ],
    },
    {
      level: 3, label: "Roof level: family lounge and terraces", body: { x: 0, y: 3, w, d: 6 },
      rooms: [
        R("tangga", "Stairs", 0, 3, 3, 9), R("keluarga", "Family lounge", 3, 3, 12, 9), R("tandas_5", "Bath", 12, 3, w, 6), R("stor", "Store", 12, 6, w, 9),
        R("terrace", "Roof terrace (rear)", 0, 0, w, 3), R("terrace_2", "Roof terrace (front)", 0, 9, w, d),
      ],
    },
  ];
}

/** A 3-storey terrace or semi-D: the first floor's master moves to Bedroom 4 and a master-suite floor goes on top (stairs where the lower ones are). */
function withTop(raw: Storey[], w: number, d: number, stairs: [number, number, number, number]): Storey[] {
  const [g, f] = raw;
  const f2: Storey = { ...f, rooms: f.rooms.map((r) => (r.id === "bilik_utama" ? { ...r, id: "bilik_4", name: "Bedroom 4" } : r.id === "tandas_utama" ? { ...r, id: "tandas_4", name: "Bath" } : r)) };
  const [sx0, sy0, sx1, sy1] = stairs;
  const rooms =
    d < 13
      ? [R("bilik_utama", "Master bedroom", 0, 0, w, 4.0), R("tangga", "Stairs", sx0, sy0, sx1, sy1), R("keluarga", "Family lounge", sx1, 4.0, w, 8.0), R("tandas_utama", "Ensuite", 0, 6.0, sx1, 8.0), R("walk_in", "Walk-in", 0, 8.0, 3.0, d), R("kajian", "Study", 3.0, 8.0, w, d)]
      : [R("bilik_utama", "Master bedroom", 0, 0, w, 5.0), R("walk_in", "Walk-in", 0, 5.0, 3.0, 8.0), R("tandas_utama", "Ensuite", 3.0, 5.0, w, 8.0), R("tangga", "Stairs", sx0, sy0, sx1, sy1), R("kajian", "Study", 0, 11.0, sx1, d), R("keluarga", "Family lounge", sx1, 8.0, w, d)];
  return [g, f2, { level: 3, label: "Second floor: master suite", body: f.body, rooms }];
}

/** The plans the layout uses for one typology and storey count, stretched to the body (bw x bd) the model draws; the enclave's own sizes stretch by 1. */
const BASE: Record<Typology, { w: number; d: number }> = { terrace: { w: 6.5, d: 12.8 }, semid: { w: 9.0, d: 13.4 }, bungalow: { w: 15, d: 12 } };
function recipe(typology: Typology, storeys: number, bw: number, bd: number): Storey[] {
  const raw = typology === "terrace" ? terrace() : typology === "semid" ? semid() : bungalow();
  const { w, d } = BASE[typology];
  const plans = storeys >= 3 && typology !== "bungalow" ? withTop(raw, w, d, typology === "terrace" ? [0, 4.0, 2.4, 6.0] : [0, 8.0, 2.8, 11.0]) : typology === "bungalow" && storeys < 3 ? raw.slice(0, 2) : raw;
  const [fx, fy] = [bw / w, bd / d];
  if (fx === 1 && fy === 1) return plans;
  const sc = (r: Room): Room => ({ ...r, polygon: r.polygon.map(([x, y]) => [x * fx, y * fy] as XY) });
  return plans.map((s) => ({ ...s, body: { x: s.body.x * fx, y: s.body.y * fy, w: s.body.w * fx, d: s.body.d * fy }, rooms: s.rooms.map(sc) }));
}

const flipX = (rooms: Room[], w: number): Room[] =>
  rooms.map((r) => ({ ...r, polygon: r.polygon.map(([x, y]) => [w - x, y] as XY) }));
const shift = (rooms: Room[], dx: number, dy: number): Room[] =>
  rooms.map((r) => ({ ...r, polygon: r.polygon.map(([x, y]) => [x + dx, y + dy] as XY) }));

const OPP: Record<Compass, Compass> = { N: "S", NE: "SW", E: "W", SE: "NW", S: "N", SW: "NE", W: "E", NW: "SE" };
const bb = (r: Room) => {
  const xs = r.polygon.map((p) => p[0]);
  const ys = r.polygon.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const area = (r: Room) => {
  const b = bb(r);
  return (b.x1 - b.x0) * (b.y1 - b.y0);
};

/** Windows from which walls of the storey's body a room touches, minus its party walls; true compass for the heading. */
function glaze(storey: Storey, party: ("E" | "W")[], heading: 0 | 180): Storey {
  const { x, y, w, d } = storey.body;
  const [bx0, by0, bx1, by1] = [x, y, x + w, y + d];
  const rooms = storey.rooms.map((r) => {
    const b = bb(r);
    const win: Compass[] = [];
    if (!NO_WINDOW.has(r.id) && !isOpenAir(r)) {
      if (Math.abs(b.y0 - by0) < 1e-6) win.push("N");
      if (Math.abs(b.y1 - by1) < 1e-6) win.push("S");
      if (Math.abs(b.x0 - bx0) < 1e-6 && !party.includes("W")) win.push("W");
      if (Math.abs(b.x1 - bx1) < 1e-6 && !party.includes("E")) win.push("E");
    }
    return { ...r, windows: heading === 180 ? win.map((c) => OPP[c]) : win };
  });
  return { ...storey, rooms };
}

// ---- placing houses ----
type Spec = {
  typology: Typology; roof: RoofStyle; bodyW: number; bodyD: number; lotW: number; lotD: number; porchEnd: number;
  priceOf: (kind: House["kind"], i: number, builtUpSqft: number) => number;
  /** Beyond the enclave's: storeys (default 2, a bungalow 3), car porch depth (default 6), the group's variant key, the house label. */
  storeys?: number; porch?: number; variant?: string; label?: (kind: House["kind"], storeys: number) => string;
};

const SPEC: Record<Typology, Spec> = {
  // Mori Pines anchor: RM849,800 for the intermediate; an end lot has 3 m more land and side windows: +RM80,000.
  terrace: { typology: "terrace", roof: "gable", bodyW: 6.5, bodyD: 12.8, lotW: 6.5, lotD: 21, porchEnd: 21, priceOf: (k) => (k === "end lot" ? 929_800 : 849_800) },
  // The Camellia anchor: RM1,700,000; the second lot of each pair is RM20,000 more.
  semid: { typology: "semid", roof: "prairie", bodyW: 9.0, bodyD: 13.4, lotW: 12.2, lotD: 25, porchEnd: 25, priceOf: (_k, i) => 1_700_000 + (i % 2) * 20_000 },
  // No Cove bungalow is on sale in data.ts: invented, about RM650 a built-up sqft.
  bungalow: { typology: "bungalow", roof: "hip", bodyW: 15, bodyD: 12, lotW: 24, lotD: 34, porchEnd: 29, priceOf: () => 3_180_000 },
};

const houses: House[] = [];
const groups: Group[] = [];
const pools: { house: string; ring: LngLat[] }[] = [];
/** Where layBuilding puts its output and how it turns zone metres into coordinates: the enclave by default, a site building's own sink when it spawns one. */
type Ctx = { zone: (x: number, y: number) => LngLat; project: string; houses: House[]; groups: Group[]; pools: { house: string; ring: LngLat[] }[] };
const ENCLAVE: Ctx = { zone, project: PROJECT, houses, groups, pools };

/**
 * Lay one building (a terrace row, a semi-D pair or one bungalow) of `n` lots side by side from zone x `x0`, lots spanning zone
 * y `y0`..`y1`. Heading 0 puts the street on the lots' south side (house frame turned 0 degrees, y1 is the street edge's
 * opposite... the lot's north edge), heading 180 puts it on the north side.
 */
function layBuilding(spec: Spec, gid: string, n: number, heading: 0 | 180, x0: number, y0: number, y1: number, prefix: string, first: number, ctx: Ctx = ENCLAVE) {
  const zone = ctx.zone;
  const porch = spec.porch ?? PORCH;
  const storeyN = spec.storeys ?? (spec.typology === "bungalow" ? 3 : 2);
  const row = spec.typology === "terrace";
  const widths = Array.from({ length: n }, (_, i) => spec.lotW + (row && (i === 0 || i === n - 1) ? SIDE : 0));
  const flip = (s: "E" | "W") => (heading === 0 ? s : s === "E" ? "W" : "E"); // zone side -> house-frame side
  const ids: string[] = [];
  const centres: LngLat[] = []; // centre of body + porch, per house
  let x = x0;
  for (let i = 0; i < n; i++) {
    const wLot = widths[i];
    const [lx0, lx1] = [x, x + wLot];
    x = lx1;
    // house frame -> zone: heading 0 has its origin at the lot's north-west corner, heading 180 at the south-east one
    const toZone = ([hx, hy]: [number, number]): LngLat => (heading === 0 ? zone(lx0 + hx, y1 - hy) : zone(lx1 - hx, y0 + hy));
    // the side garden is on the outer zone side of a row's end lot and of a pair's outer lot
    const gardenZone: "E" | "W" | undefined = spec.typology === "bungalow" ? undefined : i === 0 ? "W" : i === n - 1 ? "E" : undefined;
    const gardenLocal = gardenZone && flip(gardenZone);
    const sideW = wLot - spec.bodyW;
    const party: ("E" | "W")[] =
      spec.typology === "bungalow" ? [] : row ? [...(i > 0 ? [flip("W")] : []), ...(i < n - 1 ? [flip("E")] : [])] : [flip(i === 0 ? "E" : "W")];
    const ox = spec.typology === "bungalow" ? 2 : gardenLocal === "W" ? sideW : 0;
    const oy = spec.typology === "bungalow" ? 10 : spec.lotD - porch - spec.bodyD;
    // Plans are drawn with the party wall on the east: the semi-D whose party wall is on the west is the mirror image.
    const mirror = spec.typology === "semid" && party[0] === "W";
    const raw = recipe(spec.typology, storeyN, spec.bodyW, spec.bodyD);
    const storeys = raw.map((s) => {
      const placed: Storey = {
        ...s,
        body: { ...s.body, x: s.body.x + ox, y: s.body.y + oy },
        rooms: shift(mirror ? flipX(s.rooms, spec.bodyW) : s.rooms, ox, oy),
      };
      return glaze(placed, party, heading);
    });
    // open ground of the lot: back yard, car porch, side garden, and a balcony over the porch
    const [px0, px1] = [ox, ox + (spec.typology === "bungalow" ? 8 : spec.bodyW)];
    const fy1 = oy + spec.bodyD;
    storeys[0].rooms.push(R("yard", "Back yard", 0, 0, wLot, oy), R("porch", "Car porch (2 cars)", px0, fy1, px1, spec.porchEnd));
    if (spec.typology === "bungalow") storeys[0].rooms.push(R("garden", "Side garden and pool", ox + spec.bodyW, oy, wLot, spec.porchEnd));
    else if (gardenLocal) storeys[0].rooms.push(gardenLocal === "W" ? R("garden", "Side garden", 0, oy, sideW, fy1) : R("garden", "Side garden", ox + spec.bodyW, oy, wLot, fy1));
    const fx = spec.bodyW / BASE[spec.typology].w;
    const [b0, b1] = (spec.typology === "terrace" ? [0, 4.3] : spec.typology === "semid" ? [2.8, 6.6] : [0, 8.5]).map((v) => v * fx);
    const [m0, m1] = mirror ? [spec.bodyW - b1, spec.bodyW - b0] : [b0, b1];
    storeys[1].rooms.push(R("balkoni", "Balcony", ox + m0, fy1, ox + m1, fy1 + 1.5));
    if (spec.typology === "bungalow") ctx.pools.push({ house: `${prefix}${first + i}`, ring: ([[18, 13], [23, 13], [23, 23], [18, 23]] as [number, number][]).map(toZone) });

    const all = storeys.flatMap((s) => s.rooms);
    const builtUp = Math.round((all.filter((r) => !isOpenAir(r) && r.id !== "balkoni").reduce((t, r) => t + area(r), 0) * SQFT) / 5) * 5;
    const kind: House["kind"] = spec.typology === "semid" ? "semi-d" : spec.typology === "bungalow" ? "detached" : gardenLocal ? "end lot" : "intermediate";
    const price = spec.priceOf(kind, i, builtUp);
    const corners = ([[ox, oy], [ox + spec.bodyW, oy], [ox + spec.bodyW, fy1], [ox, fy1]] as [number, number][]).map(toZone);
    const plot = ([[0, 0], [wLot, 0], [wLot, spec.lotD], [0, spec.lotD]] as [number, number][]).map(toZone);
    const topBody = storeys[storeys.length - 1].body;
    const id = `${prefix}${first + i}`;
    ids.push(id);
    centres.push(toZone([ox + spec.bodyW / 2, oy + (spec.bodyD + porch) / 2]));
    ctx.houses.push({
      id,
      lotNo: id.toUpperCase(),
      project: ctx.project,
      typology: spec.typology,
      kind,
      label: spec.label ? spec.label(kind, storeyN) : spec.typology === "terrace" ? `2-storey terrace, ${kind}` : spec.typology === "semid" ? "2-storey semi-D, prairie style" : "3-level bungalow with roof terrace",
      group: gid,
      unit: i,
      heading,
      facing: heading === 0 ? "S" : "N",
      storeys,
      lotSize: { w: wLot, d: spec.lotD },
      footprint: [...corners, corners[0]],
      plot: [...plot, plot[0]],
      centre: toZone([ox + spec.bodyW / 2, oy + spec.bodyD / 2]),
      heightM: Math.round((storeys.length * STOREY_H + roofRise(spec.roof, topBody.w, topBody.d)) * 10) / 10,
      builtUpSqft: builtUp,
      landSqft: Math.round(wLot * spec.lotD * SQFT),
      beds: all.filter(isBed).length,
      baths: all.filter(isBath).length,
      price,
      monthly: monthlyInstalment(price),
      parking: 2,
      roof: spec.roof,
    });
  }
  const mine = ctx.houses.filter((h) => ids.includes(h.id));
  const group: Group = {
    id: gid,
    variant: spec.variant ?? (spec.typology === "terrace" ? `terrace-2-gable-${n}` : spec.typology === "semid" ? "semid-2-prairie" : "bungalow-3-hip"),
    houses: ids,
    lng: centres.reduce((t, c) => t + c[0], 0) / n,
    lat: centres.reduce((t, c) => t + c[1], 0) / n,
    rot: heading,
    ...(heading === 180 ? { reversed: true } : {}),
    w: spec.bodyW * n,
    d: spec.bodyD + porch,
    h: mine[0].heightM,
  };
  ctx.groups.push(group);
  return group;
}

// ---- the layout (zone metres, x east, y north) ----
// Jalan Utama runs south from the gate; Jalan 1 (y 30) and Jalan 2 (y -20) cross it.
const J1 = 30;
const J2 = -20;
const HALF = 3.5; // half a carriageway, with verges

// Terrace rows back to back between the cross streets, west of the spine: row1 faces north onto Jalan 1, row2 faces south onto Jalan 2.
layBuilding(SPEC.terrace, "row1", 7, 180, -62, J1 - HALF - 21, J1 - HALF, "t", 1);
layBuilding(SPEC.terrace, "row2", 7, 0, -62, J2 + HALF, J2 + HALF + 21, "t", 8);
// Three semi-D pairs east of the spine, fronts on Jalan 1.
for (let p = 0; p < 3; p++) layBuilding(SPEC.semid, `pair${p + 1}`, 2, 180, 10 + p * 24.4, J1 - HALF - 25, J1 - HALF, "s", 1 + p * 2);
// Two bungalows north of Jalan 1, west of the spine, fronts on Jalan 1.
for (let b = 0; b < 2; b++) layBuilding(SPEC.bungalow, `bungalow${b + 1}`, 1, 0, -62 + b * 24, J1 + HALF, J1 + HALF + 34, "b", 1 + b);

// ---- the rest of the enclave ----
const street = (name: string, width: number, pts: [number, number][]) => ({ name, width, path: pts.map(([x, y]) => zone(x, y)) });
const lake: [number, number][] = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  return [-20 + 60 * Math.cos(a), -55 + 16 * Math.sin(a)];
});

export const enclave = {
  ...ZONE,
  /** Everything inside is park ground first; lots, streets and water are drawn over it. */
  ring: box(-130, -90, 130, 90),
  /** Gate and guardhouse on the north edge, and the made-up access road that runs about 90 m north to the real tertiary road (OSM, north +232 m of the township centre; it crosses an unpaved MTB trail at +203 m). */
  gate: { name: "Enclave gate (guarded)", lng: zone(0, 86)[0], lat: zone(0, 86)[1], guardhouses: [box(-9, 80, -4, 85), box(4, 80, 9, 85)], boom: [zone(-4, 86), zone(4, 86)] },
  streets: [
    street("Access road", 7, [[0, 182], [0, 90]]),
    street("Jalan Utama", 8, [[0, 90], [0, J2]]),
    street("Jalan 1", 7, [[-110, J1], [110, J1]]),
    street("Jalan 2", 7, [[-110, J2], [110, J2]]),
  ],
  clubhouse: {
    name: "Clubhouse and pool",
    footprint: box(14, 53.9, 36, 66), // 22 x 12.1 m body, two storeys, front, deck and pool facing south
    deck: box(12, 44, 38, 53.9), // landedParts draws the deck and pool itself; the rings are for the plain-extrusion fallback
    pool: box(17.1, 46.8, 32.9, 51.7),
    centre: zone(25, 55), // centre of the 22 x 22 m footprint (body + deck): where the model goes
    rot: 0,
    variant: "clubhouse-2-flat",
    w: 22,
    d: 22,
    h: 9.4,
  },
  parks: [
    { name: "Playground", ring: box(-115, -16, -70, 26) },
    { name: "East green", ring: box(10, -16, 115, -1) },
    { name: "Tasik Seri Kopi (lake)", ring: [...lake.map(([x, y]) => zone(x, y)), zone(...lake[0])], water: true },
  ],
  pools,
};

export const landed = { houses, groups, enclave };
export { houses, groups };
// ---- the other sites' landed buildings: the same recipes, built on demand and cached ----
// Ids are "sb<n>" (n = index in site-layout.json); a house is "sb<n>-<k>". ILLUSTRATIVE: made-up plans and prices.
const SITE_TYPOLOGY: Record<string, Typology> = { terrace: "terrace", link: "terrace", superlink: "terrace", townhouse: "terrace", cluster: "terrace", semid: "semid", bungalow: "bungalow" };
const SITE_NAME: Record<string, string> = { terrace: "terrace", link: "link home", superlink: "superlink", townhouse: "townhouse", cluster: "cluster home", semid: "semi-D", bungalow: "bungalow" };
const HOME_TYPE = { terrace: "Terrace", semid: "Semi-D", bungalow: "Bungalow" } as const;
const FALLBACK_PSF = { terrace: 476, semid: 654, bungalow: 650 }; // RM per built-up sqft: the Mori Pines, Camellia and bungalow anchors above
/** RM per built-up sqft for a typology at a site: its own product's "From" price over its size (data.ts), else the site's landed average, else the enclave's anchor. */
function sitePsf(site: string, typology: Typology): number {
  const landed = products.filter((u) => u.townshipId === site && u.landed);
  const mean = (us: typeof landed) => us.reduce((t, u) => t + u.priceRM / u.builtUpSqft, 0) / us.length;
  const own = landed.filter((u) => u.type === HOME_TYPE[typology]);
  if (own.length) return mean(own);
  if (landed.length) return mean(landed) * ({ terrace: 1, semid: 1.12, bungalow: 1.2 }[typology]);
  return FALLBACK_PSF[typology];
}

const siteGroups = new Map<string, Group>();
const siteHouses = new Map<string, House>();
/** The landed building spawned at `sb<n>`, with its houses; undefined for anything else. */
export function siteGroup(id: string): Group | undefined {
  const idx = siteIndexOf(id);
  if (idx === undefined || siteKind(siteLayout.buildings[idx]) !== "landed") return undefined;
  const hit = siteGroups.get(id);
  if (hit) return hit;
  const b = siteLayout.buildings[idx];
  const v = parseVariant(b.variant);
  const type = v.type as LandedType;
  const typology = SITE_TYPOLOGY[type];
  const n = v.n ?? DEFAULT_N[type];
  const porch = Math.min(PORCH_OF[type], 0.4 * b.d);
  const bodyD = Math.min(b.d - porch, MAX_BODY[type]);
  const bungalow = typology === "bungalow";
  const lotD = bodyD + porch + (bungalow ? 16 : 2.2);
  const psf = sitePsf(b.site, typology);
  const spec: Spec = {
    typology,
    roof: v.style && v.style in ROOF ? (v.style as RoofStyle) : "gable",
    bodyW: b.w / n, bodyD, lotW: b.w / n + (typology === "semid" ? 3.2 : bungalow ? 9 : 0), lotD, porchEnd: bungalow ? bodyD + porch + 11 : lotD,
    storeys: v.storeys, porch, variant: b.variant,
    label: (kind, st) => `${st}-storey ${SITE_NAME[type]}${typology === "terrace" ? `, ${kind}` : ""}`,
    priceOf: (kind, i, built) => Math.round((psf * built * (1 + (kind === "end lot" ? 0.04 : 0) + (((i * 7 + idx * 13) % 5) - 2) * 0.004)) / 5000) * 5000,
  };
  const kx = 111_320 * Math.cos((b.lat * Math.PI) / 180);
  const ctx: Ctx = { zone: (x, y) => [b.lng + x / kx, b.lat + y / M_PER_DEG_LAT], project: townshipById[b.site]?.name ?? b.site, houses: [], groups: [], pools: [] };
  const group = layBuilding(spec, id, n, 0, 0, 0, lotD, `${id}-`, 1, ctx);
  // Where the map put it: the footprint centre and turn (the model turns by rot - 90, clockwise, front facing south at 0), its whole w x d.
  Object.assign(group, { lng: b.lng, lat: b.lat, rot: b.rot - 90, w: b.w, d: b.d });
  const no = siteLayout.buildings.slice(0, idx).filter((o) => o.site === b.site && siteKind(o) === "landed").length + 1; // this building's number among the site's landed ones
  const COMPASS: Compass[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const facing = COMPASS[Math.round((((180 + b.rot - 90) % 360) + 360) % 360 / 45) % 8]; // the front's compass bearing: south turned by the model's rotation
  ctx.houses.forEach((h, k) => {
    h.lotNo = `${no}.${k + 1}`;
    h.facing = facing;
    siteHouses.set(h.id, h);
  });
  siteGroups.set(id, group);
  return group;
}

export const houseById = (id: string) => houses.find((h) => h.id === id) ?? (siteGroup(id.replace(/-\d+$/, "")) ? siteHouses.get(id) : undefined);
export const groupById = (id: string) => groups.find((g) => g.id === id) ?? siteGroup(id);
export const groupOfHouse = (id: string) => groups.find((g) => g.houses.includes(id)) ?? (/^sb\d+-\d+$/.test(id) ? siteGroup(id.replace(/-\d+$/, "")) : undefined);

/** Numbers for the report: per typology, count and ranges. */
export function summary() {
  const stat = (t: Typology) => {
    const hs = houses.filter((h) => h.typology === t);
    const rg = (f: (h: House) => number) => [Math.min(...hs.map(f)), Math.max(...hs.map(f))];
    return { n: hs.length, builtUpSqft: rg((h) => h.builtUpSqft), landSqft: rg((h) => h.landSqft), price: rg((h) => h.price), beds: rg((h) => h.beds), baths: rg((h) => h.baths), heightM: rg((h) => h.heightM) };
  };
  return { terrace: stat("terrace"), semid: stat("semid"), bungalow: stat("bungalow") };
}
