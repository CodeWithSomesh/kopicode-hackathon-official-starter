import type { Compass, Room } from "./types";

// ILLUSTRATIVE ONLY. Seven Malaysian-condo unit types, each with its own footprint and room recipe.
// Unit-local metres: x east, y from the corridor door (0) to the facade (d).

export type UnitType = "Studio" | "1R1B" | "2R2B" | "3R2B" | "Dual-key" | "3+1 Corner" | "Penthouse";

const SQFT_M2 = 0.092903;

export type Spec = {
  sqft: number;
  d: number;
  /** RM per sqft factor against a 2-bed (small units cost more per sqft; penthouses a premium). */
  psf: number;
  /** Rooms for a unit w m wide (design metres). The 3+1 Corner is L-shaped: its recipe leaves the corridor-end corner (20% x 2.6 m) empty. */
  rooms: (w: number, d: number) => RoomRect[];
  /** The room whose corridor wall holds the front door. */
  door: string;
};
type RoomRect = [id: string, name: string, x: number, y: number, w: number, h: number];

export const SPECS: Record<UnitType, Spec> = {
  Studio: {
    sqft: 480, d: 10.5, psf: 1.15, door: "dapur",
    rooms: (w, d) => [
      ["dapur", "Kitchenette", 0, 0, w * 0.55, 2.4], ["tandas", "Bath", w * 0.55, 0, w * 0.45, 2.4],
      ["ruang_tamu", "Living", 0, 2.4, w, 3.6], ["bilik_utama", "Sleeping area", 0, 6.0, w, d - 7.4],
      ["balkoni", "Balcony", 0, d - 1.4, w, 1.4],
    ],
  },
  "1R1B": {
    sqft: 550, d: 11, psf: 1.08, door: "ruang_tamu",
    rooms: (w, d) => [
      ["ruang_tamu", "Living / dining", 0, 0, w, 3.4], ["tandas", "Bath", 0, 3.4, w * 0.5, 2.4], ["dapur", "Kitchen", w * 0.5, 3.4, w * 0.5, 2.4],
      ["bilik_utama", "Bedroom", 0, 5.8, w, d - 7.3], ["balkoni", "Balcony", 0, d - 1.5, w, 1.5],
    ],
  },
  "2R2B": {
    sqft: 695, d: 11.5, psf: 1.0, door: "ruang_tamu",
    rooms: (w, d) => [
      ["ruang_tamu", "Living", 0, 0, w * 0.6, 3.8], ["dapur", "Kitchen", w * 0.6, 0, w * 0.4, 3.8],
      ["makan", "Dining", 0, 3.8, w * 0.5, 2.2], ["tandas_2", "Ensuite", w * 0.5, 3.8, w * 0.25, 2.2], ["tandas", "Bath", w * 0.75, 3.8, w * 0.25, 2.2],
      ["bilik_utama", "Master bedroom", 0, 6.0, w * 0.5, d - 7.5], ["bilik_2", "Bedroom 2", w * 0.5, 6.0, w * 0.5, d - 7.5],
      ["balkoni", "Balcony", 0, d - 1.5, w, 1.5],
    ],
  },
  "3R2B": {
    sqft: 825, d: 12, psf: 0.97, door: "ruang_tamu",
    rooms: (w, d) => [
      ["ruang_tamu", "Living", 0, 0, w * 0.55, 4.2], ["makan", "Dining", w * 0.55, 0, w * 0.45, 4.2],
      ["dapur", "Kitchen", 0, 4.2, w * 0.4, 2.2], ["utiliti", "Utility / maid", w * 0.4, 4.2, w * 0.2, 2.2], ["tandas", "Bath", w * 0.6, 4.2, w * 0.2, 2.2], ["tandas_2", "Ensuite", w * 0.8, 4.2, w * 0.2, 2.2],
      ["bilik_utama", "Master bedroom", 0, 6.4, w * 0.4, d - 7.9], ["bilik_2", "Bedroom 2", w * 0.4, 6.4, w * 0.3, d - 7.9], ["bilik_3", "Bedroom 3", w * 0.7, 6.4, w * 0.3, d - 7.9],
      ["balkoni", "Balcony", 0, d - 1.5, w, 1.5],
    ],
  },
  "Dual-key": {
    sqft: 977, d: 12, psf: 1.0, door: "ruang_tamu",
    rooms: (w, d) => {
      const L = w * 0.6;
      const R = w - L;
      return [
        ["ruang_tamu", "Living", 0, 0, L, 4.0], ["dapur", "Kitchen", 0, 4.0, L * 0.5, 2.2], ["tandas", "Bath", L * 0.5, 4.0, L * 0.5, 2.2],
        ["bilik_utama", "Master bedroom", 0, 6.2, L, d - 7.7],
        ["dapur_2", "Suite kitchenette", L, 0, R, 2.4], ["tandas_2", "Suite bath", L, 2.4, R, 2.2], ["bilik_2", "Studio suite", L, 4.6, R, d - 6.1],
        ["balkoni", "Balcony", 0, d - 1.5, w, 1.5],
      ];
    },
  },
  "3+1 Corner": {
    sqft: 1250, d: 12, psf: 1.03, door: "ruang_tamu",
    rooms: (w, d) => [
      ["ruang_tamu", "Living", 0, 0, w * 0.5, 4.4], ["makan", "Dining", w * 0.5, 0, w * 0.3, 2.6], ["dapur", "Kitchen", w * 0.5, 2.6, w * 0.5, 1.8],
      ["utiliti", "Maid room", 0, 4.4, w * 0.2, 2.2], ["tandas", "Bath", w * 0.2, 4.4, w * 0.2, 2.2], ["tandas_2", "Ensuite", w * 0.4, 4.4, w * 0.2, 2.2], ["kajian", "Study (+1)", w * 0.6, 4.4, w * 0.4, 2.2],
      ["bilik_utama", "Master bedroom", 0, 6.6, w * 0.36, d - 8.2], ["bilik_2", "Bedroom 2", w * 0.36, 6.6, w * 0.32, d - 8.2], ["bilik_3", "Bedroom 3", w * 0.68, 6.6, w * 0.32, d - 8.2],
      ["balkoni", "Wrap balcony", 0, d - 1.6, w, 1.6],
    ],
  },
  Penthouse: {
    sqft: 1750, d: 13, psf: 0.85, door: "ruang_tamu",
    rooms: (w, d) => [
      ["ruang_tamu", "Grand living", 0, 0, w * 0.42, 4.6], ["makan", "Dining", w * 0.42, 0, w * 0.26, 4.6], ["dapur", "Kitchen", w * 0.68, 0, w * 0.32, 4.6],
      ["keluarga", "Family room", 0, 4.6, w * 0.3, 2.4], ["utiliti", "Utility / maid", w * 0.3, 4.6, w * 0.15, 2.4], ["tandas", "Powder room", w * 0.45, 4.6, w * 0.15, 2.4], ["tandas_2", "Master bath", w * 0.6, 4.6, w * 0.2, 2.4], ["tandas_3", "Bath", w * 0.8, 4.6, w * 0.2, 2.4],
      ["bilik_utama", "Master suite", 0, 7.0, w * 0.3, d - 9.0], ["bilik_2", "Bedroom 2", w * 0.3, 7.0, w * 0.22, d - 9.0], ["bilik_3", "Bedroom 3", w * 0.52, 7.0, w * 0.22, d - 9.0], ["bilik_4", "Bedroom 4", w * 0.74, 7.0, w * 0.26, d - 9.0],
      ["balkoni", "Wrap-around terrace", 0, d - 2.0, w, 2.0],
    ],
  },
};

/** Design width in metres of a unit of this type. */
export const widthOf = (t: UnitType) => (SPECS[t].sqft * SQFT_M2) / SPECS[t].d;

/** Rooms of a unit; `mirror` flips it left-right (the corner unit at the left end of a row, so its L opens to the end wall). */
export function roomsFor(type: UnitType, facing: Compass, mirror: boolean): Room[] {
  const s = SPECS[type];
  const w = widthOf(type);
  const near = (y: number, h: number) => y + h >= s.d - 1.6;
  return s.rooms(w, s.d).map(([id, name, x, y, rw, rh]) => {
    const x0 = mirror ? w - x - rw : x;
    return {
      id,
      name,
      polygon: [[x0, y], [x0 + rw, y], [x0 + rw, y + rh], [x0, y + rh]],
      windows: near(y, rh) && !id.startsWith("tandas") ? [facing] : [],
    };
  });
}

/** Where the front door gap starts along the corridor wall, in unit-local x (the gap is 0.95 m wide, 0.5 m into the door room). */
export function doorX(type: UnitType, mirror: boolean): number {
  const s = SPECS[type];
  const w = widthOf(type);
  const x = s.rooms(w, s.d).find((r) => r[0] === s.door)![2] + 0.5;
  return mirror ? w - x - 0.95 : x;
}
