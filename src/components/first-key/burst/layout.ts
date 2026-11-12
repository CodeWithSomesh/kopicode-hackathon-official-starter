import type { Building, Unit } from "@/lib/first-key/types";

// Plan of one floor in "plate metres": x east, z south, origin at the plate centre.
// Units come from their room polygons (unit-local x east, y towards the facade here); rows sit on the long facades
// with a corridor between them. Every floor of a block shares one layout, so it is built once per building.

export const FLOOR_H = 3.1;
export const WALL_H = 2.75;
export const LOW_H = 1.0; // the dollhouse cut: about a third of the storey
export const WALL_T = 0.12;
const CORRIDOR = 1.8;
const DOOR_W = 0.95;

export type Rect = { x0: number; z0: number; x1: number; z1: number };
export type Wall = { x0: number; z0: number; x1: number; z1: number; nx: number; nz: number; outer: boolean; unit: number };
export type Piece = { x: number; z: number; y: number; sx: number; sy: number; sz: number; color: PaletteKey; r?: number };
export type PlacedRoom = { id: string; rect: Rect };
export type PlacedUnit = { index: number; rect: Rect; rooms: PlacedRoom[]; furniture: Piece[] };
export type FloorPlan = { w: number; d: number; units: PlacedUnit[]; walls: Wall[] };

/** Material roles of the interior; colours come from theme tokens at runtime (`paletteFrom` in dollhouse.tsx). */
export type PaletteKey =
  | "wall"
  | "wood"
  | "tile"
  | "carpet"
  | "corridor"
  | "sofa"
  | "cushion"
  | "darkWood"
  | "table"
  | "chair"
  | "counter"
  | "counterTop"
  | "fridge"
  | "bed"
  | "blanket"
  | "blanket2"
  | "rug"
  | "lamp"
  | "water";

const ROOM_FLOOR: Record<string, PaletteKey> = { ruang_tamu: "wood", makan: "wood", keluarga: "wood", dewan: "wood", kedai: "wood", lobi: "tile", dek: "tile", parkir: "corridor" };
/** Floor finish by room: wet rooms and balconies tiled, living areas wood, bedrooms carpet, the car park concrete. */
export const roomFloor = (id: string): PaletteKey =>
  ROOM_FLOOR[id] ?? (/^(dapur|tandas|balkoni|utiliti)/.test(id) ? "tile" : "carpet");

const bbox = (u: Unit) => {
  const pts = u.rooms.flatMap((r) => r.polygon);
  return { w: Math.max(...pts.map((p) => p[0])), d: Math.max(...pts.map((p) => p[1])) };
};

/** Furniture in unit-local metres (x east, y towards the facade). */
type LocalPiece = Omit<Piece, "x" | "z"> & { lx: number; ly: number };
export function furnish(id: string, rx: number, ry: number, rw: number, rh: number): LocalPiece[] {
  const out: LocalPiece[] = [];
  const add = (lx: number, ly: number, y: number, sx: number, sy: number, sz: number, color: PaletteKey, r = 0.06) =>
    out.push({ lx, ly, y, sx, sy, sz, color, r });
  const cx = rx + rw / 2;
  if (id === "ruang_tamu") {
    const x = rx + rw * 0.62;
    add(x, ry + rh * 0.5, 0, Math.min(2.8, rw * 0.5), 0.02, rh * 0.55, "rug", 0.01);
    add(x, ry + rh - 0.5, 0, 2.2, 0.42, 0.8, "sofa"); // seat
    add(x, ry + rh - 0.16, 0, 2.2, 0.85, 0.24, "sofa"); // back
    add(x - 1.0, ry + rh - 0.5, 0, 0.22, 0.6, 0.8, "sofa"); // arms
    add(x + 1.0, ry + rh - 0.5, 0, 0.22, 0.6, 0.8, "sofa");
    add(x - 0.5, ry + rh - 0.45, 0.42, 0.5, 0.14, 0.5, "cushion");
    add(x + 0.5, ry + rh - 0.45, 0.42, 0.5, 0.14, 0.5, "cushion");
    add(x, ry + rh * 0.45, 0, 1.0, 0.38, 0.55, "darkWood");
    add(x, ry + 0.22, 0, 1.7, 0.48, 0.38, "darkWood"); // TV console
  } else if (id === "makan") {
    const x = rx + rw * 0.28;
    const y = ry + rh / 2;
    const tw = 1.4;
    const td = Math.min(0.8, rh - 0.9);
    add(x, y, 0, tw, 0.75, td, "table");
    for (const sx of [-0.35, 0.35])
      for (const sy of [-1, 1]) add(x + sx, y + sy * (td / 2 + 0.2), 0, 0.42, 0.46, 0.4, "chair");
  } else if (id.startsWith("tandas")) {
    add(rx + 0.3, ry + rh - 0.35, 0, 0.4, 0.4, 0.55, "fridge"); // toilet
    add(rx + rw - 0.35, ry + 0.35, 0, 0.5, 0.85, 0.45, "counter"); // basin
    add(rx + rw / 2, ry + rh / 2, 0, Math.min(0.9, rw - 0.5), 0.05, 0.9, "counterTop", 0.02); // shower tray
  } else if (id === "balkoni") {
    const n = Math.max(1, Math.min(3, Math.floor(rw / 2.6)));
    for (let i = 0; i < n; i++) add(rx + (rw * (i + 0.5)) / n, ry + rh / 2, 0, 0.45, 0.45, 0.45, "chair");
    if (rw > 4) add(rx + rw / 2, ry + rh / 2, 0, 0.6, 0.5, 0.6, "table");
  } else if (id === "utiliti") {
    add(rx + rw / 2, ry + rh - 0.6, 0, Math.min(0.9, rw - 0.3), 0.4, 1.6, "bed");
    add(rx + 0.35, ry + 0.4, 0, 0.55, 0.85, 0.6, "fridge"); // washer
  } else if (id === "kajian") {
    add(rx + rw / 2, ry + 0.35, 0, Math.min(1.6, rw - 0.4), 0.74, 0.6, "darkWood"); // desk
    add(rx + rw / 2, ry + 0.95, 0, 0.45, 0.45, 0.45, "chair");
  } else if (id.startsWith("dapur")) {
    add(rx + rw - 0.32, ry + rh / 2, 0, 0.6, 0.9, rh - 0.1, "counter");
    add(rx + rw - 0.32, ry + rh / 2, 0.9, 0.64, 0.05, rh - 0.06, "counterTop", 0.02);
    add(rx + rw / 2 - 0.3, ry + rh - 0.32, 0, rw - 0.7, 0.9, 0.6, "counter");
    add(rx + rw / 2 - 0.3, ry + rh - 0.32, 0.9, rw - 0.66, 0.05, 0.64, "counterTop", 0.02);
    add(rx + 0.45, ry + rh - 0.4, 0, 0.7, 1.8, 0.68, "fridge");
  } else if (id.startsWith("bilik")) {
    const master = id === "bilik_utama";
    if (rh < 2.8) return out;
    const bw = Math.min(master ? 1.6 : 1.1, rw - 0.5);
    add(cx, ry + 0.06, 0, bw + 0.12, 1.0, 0.12, "darkWood"); // headboard on the inner wall
    add(cx, ry + 1.12, 0, bw, 0.45, 2.0, "bed");
    add(cx, ry + 1.45, 0.45, bw + 0.04, 0.08, 1.35, master ? "blanket" : "blanket2", 0.03);
    add(cx, ry + 0.4, 0.45, bw * 0.8, 0.12, 0.35, "cushion");
    if (rw - bw >= 1.0) {
      add(cx - bw / 2 - 0.3, ry + 0.3, 0, 0.42, 0.5, 0.4, "darkWood");
      add(cx + bw / 2 + 0.3, ry + 0.3, 0, 0.42, 0.5, 0.4, "darkWood");
      add(cx - bw / 2 - 0.3, ry + 0.3, 0.5, 0.14, 0.22, 0.14, "lamp", 0.05);
    }
    if (!master && rh >= 3.3) add(rx + rw / 2, ry + rh - 0.32, 0, Math.min(1.2, rw - 0.3), 2.0, 0.55, "darkWood");
  }
  return out;
}

/**
 * Lay one floor of flats out as rooms, walls and furniture: `rows` rows round the corridor (the second split off by
 * width). Each row is stretched to the full width and depth, so a floor of studios is a row of slim flats and a floor
 * of 3-beds has fewer, wider ones.
 */
export function planFloor(units: Unit[], rows: 1 | 2): FloorPlan {
  const dims = units.map(bbox);
  const idx = dims.map((_, i) => i);
  let cut = idx.length;
  if (rows === 2) {
    const half = dims.reduce((s, d) => s + d.w, 0) / 2;
    let acc = 0;
    cut = idx.findIndex((i) => (acc += dims[i].w) >= half - dims[i].w / 2);
    cut = Math.min(idx.length - 1, Math.max(1, cut + 1));
  }
  const split = rows === 2 && idx.length > 1 ? [idx.slice(0, cut), idx.slice(cut)] : [idx];
  const rowW = split.map((r) => r.reduce((s, i) => s + dims[i].w, 0));
  const rowD = split.map((r) => Math.max(0, ...r.map((i) => dims[i].d)));
  const W = Math.max(...rowW);
  const D = rowD.reduce((s, v) => s + v, 0) + CORRIDOR;

  const placed: PlacedUnit[] = [];
  const walls: Wall[] = [];
  split.forEach((row, ri) => {
    const kx = W / rowW[ri];
    let x = -W / 2;
    // Row 0 has its facade on the south side (+z), row 1 on the north (-z). y = 0 is the corridor side of the unit.
    const dir = ri === 0 ? 1 : -1;
    for (const [n, i] of row.entries()) {
      const u = units[i];
      const { w, d } = dims[i];
      const ky = rowD[ri] / d;
      const zOrigin = dir * (D / 2 - rowD[ri]); // z of the unit's corridor edge
      const toPlate = (lx: number, ly: number) => ({ x: x + lx * kx, z: zOrigin + dir * ly * ky });
      const rectOf = (lx0: number, ly0: number, lx1: number, ly1: number): Rect => {
        const a = toPlate(lx0, ly0);
        const b = toPlate(lx1, ly1);
        return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
      };
      const rooms: PlacedRoom[] = [];
      const furniture: Piece[] = [];
      for (const r of u.rooms) {
        const xs = r.polygon.map((p) => p[0]);
        const ys = r.polygon.map((p) => p[1]);
        const [rx, ry, rx1, ry1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        const rect = rectOf(rx, ry, rx1, ry1);
        rooms.push({ id: r.id, rect });
        for (const f of furnish(r.id, rx, ry, rx1 - rx, ry1 - ry)) {
          const p = toPlate(f.lx, f.ly);
          furniture.push({ x: p.x, z: p.z, y: f.y, sx: f.sx, sy: f.sy, sz: f.sz, color: f.color, r: f.r });
        }
        // Walls on each room edge, inset half a wall so neighbours make a double-thickness party wall.
        const firstInRow = n === 0;
        const lastInRow = n === row.length - 1;
        const edges: [number, number, number, number, number, number, boolean][] = [
          // lx0, ly0, lx1, ly1, outward normal (local x, y), outer?
          [rx, ry, rx1, ry, 0, -1, false],
          [rx, ry1, rx1, ry1, 0, 1, ry1 >= d - 1e-6],
          [rx, ry, rx, ry1, -1, 0, firstInRow && rx <= 1e-6],
          [rx1, ry, rx1, ry1, 1, 0, lastInRow && rx1 >= w - 1e-6],
        ];
        for (const [ax, ay, bx, by, nx, ny, outer] of edges) {
          const inset = WALL_T / 2;
          const a = toPlate(ax - nx * inset, ay - ny * inset);
          const b = toPlate(bx - nx * inset, by - ny * inset);
          const wall = { nx, nz: dir * ny, outer, unit: placed.length };
          // The flat's front door: a gap in the living room's corridor wall.
          const doorAt = r.id === u.door.room ? u.door.at[0] : r.id === "dapur_2" ? rx + 0.4 : undefined;
          if (doorAt !== undefined && ny === -1 && ry <= 1e-6) {
            const g0 = toPlate(doorAt, ay - ny * inset);
            const g1 = toPlate(doorAt + DOOR_W, ay - ny * inset);
            walls.push({ x0: a.x, z0: a.z, x1: g0.x, z1: g0.z, ...wall }, { x0: g1.x, z0: g1.z, x1: b.x, z1: b.z, ...wall });
          } else walls.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, ...wall });
        }
      }
      placed.push({ index: i, rect: rectOf(0, 0, w, d), rooms, furniture });
      x += w * kx;
    }
  });
  // The corridor's two dead ends.
  for (const sx of [-1, 1]) walls.push({ x0: (sx * W) / 2, z0: -CORRIDOR / 2, x1: (sx * W) / 2, z1: CORRIDOR / 2, nx: sx, nz: 0, outer: true, unit: -1 });
  return { w: W, d: D, units: placed, walls };
}

/** The flats on one floor, in the order planFloor indexes them. */
export const unitsOnFloor = (b: Building, floor: number) => b.units.filter((u) => u.floor === floor);
