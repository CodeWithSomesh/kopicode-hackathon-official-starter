import type { Plan } from "./plans";

/**
 * Furniture catalogue at real sizes (metres) and the starting layout for each sample plan.
 *
 * `w` runs along the item's front edge, `d` is its depth. At rot 0 the front faces down the
 * plan (+y), so a sofa at rot 0 has its backrest at the top and its seat facing down.
 * Each rot step turns the item 90° clockwise.
 */

export type Kind =
  | "sofa"
  | "tv"
  | "coffee"
  | "dining"
  | "bed"
  | "wardrobe"
  | "desk"
  | "shoerack"
  | "stove"
  | "sink"
  | "altar"
  | "mirror"
  | "plant";

export type CatalogEntry = {
  label: string;
  w: number;
  d: number;
  /** Part of the plan: can't be moved, turned or removed. */
  fixed?: boolean;
  round?: boolean;
  /** Room kinds tried first when the buyer adds one without naming a room. */
  prefer: string[];
};

export const CATALOG: Record<Kind, CatalogEntry> = {
  sofa: { label: "Sofa", w: 2.2, d: 0.9, prefer: ["living"] },
  tv: { label: "TV console", w: 1.8, d: 0.45, prefer: ["living"] },
  coffee: { label: "Coffee table", w: 1.0, d: 0.6, prefer: ["living"] },
  dining: { label: "Dining set", w: 1.8, d: 1.6, prefer: ["dining", "living"] },
  bed: { label: "Bed", w: 1.6, d: 2.0, prefer: ["bedroom"] },
  wardrobe: { label: "Wardrobe", w: 1.8, d: 0.6, prefer: ["bedroom", "store"] },
  desk: { label: "Desk", w: 1.2, d: 0.6, prefer: ["store", "bedroom", "hall"] },
  shoerack: { label: "Shoe rack", w: 1.0, d: 0.35, prefer: ["hall", "living"] },
  stove: { label: "Stove", w: 1.8, d: 0.6, fixed: true, prefer: ["kitchen"] },
  sink: { label: "Sink", w: 1.2, d: 0.6, fixed: true, prefer: ["kitchen"] },
  altar: { label: "Altar", w: 1.0, d: 0.5, prefer: ["living", "dining"] },
  mirror: {
    label: "Mirror",
    w: 0.8,
    d: 0.1,
    prefer: ["bedroom", "hall", "living"],
  },
  plant: {
    label: "Plant",
    w: 0.5,
    d: 0.5,
    round: true,
    prefer: ["living", "hall", "dining"],
  },
};

/** Kinds the buyer can add from the panel (the fixed kitchen pieces come with the plan). */
export const ADDABLE: Kind[] = (Object.keys(CATALOG) as Kind[]).filter(
  (k) => !CATALOG[k].fixed,
);

export type Rot = 0 | 1 | 2 | 3;

export type Item = {
  uid: string;
  kind: Kind;
  floor: string;
  room: string;
  /** Centre of the item in plan metres. */
  cx: number;
  cy: number;
  rot: Rot;
};

type Seed = [
  kind: Kind,
  floor: string,
  room: string,
  cx: number,
  cy: number,
  rot: Rot,
];

const seeds: Record<Plan["id"], Seed[]> = {
  terrace: [
    ["sofa", "ground", "living", 0.45, 7.5, 3],
    ["coffee", "ground", "living", 1.6, 7.5, 1],
    ["tv", "ground", "living", 6.175, 7.5, 1],
    ["shoerack", "ground", "living", 5.65, 5.2, 0],
    ["plant", "ground", "living", 0.4, 9.5, 0],
    ["dining", "ground", "dining", 2, 12, 0],
    ["altar", "ground", "dining", 0.25, 12, 3],
    ["stove", "ground", "kitchen", 0.3, 15.7, 3],
    ["sink", "ground", "kitchen", 2.2, 16.9, 2],
    ["bed", "first", "master", 1, 4.5, 3],
    ["wardrobe", "first", "master", 6.1, 4, 1],
    ["mirror", "first", "master", 6.35, 6.2, 1],
    ["bed", "first", "bed2", 1, 13.6, 0],
    ["bed", "first", "bed3", 5.2, 13.6, 0],
    ["desk", "first", "bed3", 4, 16.9, 2],
  ],
  semid: [
    ["sofa", "ground", "living", 0.45, 7.75, 3],
    ["coffee", "ground", "living", 1.7, 7.75, 1],
    ["tv", "ground", "living", 5.275, 8.2, 1],
    ["plant", "ground", "living", 0.4, 10, 0],
    ["shoerack", "ground", "foyer", 9.325, 6, 1],
    ["bed", "ground", "guest", 6.5, 8.8, 3],
    ["dining", "ground", "dining", 2.75, 12.5, 0],
    ["altar", "ground", "dining", 0.25, 12.5, 3],
    ["stove", "ground", "wet", 9.2, 15.6, 1],
    ["sink", "ground", "kitchen", 2.25, 17.7, 2],
    ["bed", "first", "master", 1, 4.75, 3],
    ["mirror", "first", "master", 5.95, 2.6, 1],
    ["desk", "first", "study", 0.3, 12.25, 3],
    ["bed", "first", "bed2", 1.5, 15, 0],
    ["wardrobe", "first", "bed2", 0.3, 17, 3],
    ["bed", "first", "bed3", 7.4, 15, 0],
    ["bed", "first", "bed4", 8.5, 9, 1],
  ],
  apartment: [
    ["sofa", "unit", "living", 5.55, 2.9, 1],
    ["tv", "unit", "living", 0.225, 2.9, 3],
    ["coffee", "unit", "living", 4.2, 2.9, 1],
    ["plant", "unit", "living", 0.35, 5.15, 0],
    ["dining", "unit", "dining", 3, 6.75, 0],
    ["altar", "unit", "dining", 0.25, 6.75, 3],
    ["shoerack", "unit", "foyer", 5.825, 9, 1],
    ["mirror", "unit", "foyer", 3.05, 9, 3],
    ["stove", "unit", "kitchen", 0.3, 9, 3],
    ["sink", "unit", "kitchen", 1.9, 9.7, 2],
    ["bed", "unit", "master", 9, 2, 1],
    ["wardrobe", "unit", "master", 6.3, 2, 3],
    ["bed", "unit", "bed2", 8.9, 7.4, 0],
    ["desk", "unit", "bed2", 7, 9.7, 2],
  ],
};

export function defaultItems(planId: Plan["id"]): Item[] {
  const count: Partial<Record<Kind, number>> = {};
  return seeds[planId].map(([kind, floor, room, cx, cy, rot]) => {
    count[kind] = (count[kind] ?? 0) + 1;
    return { uid: `${kind}-${count[kind]}`, kind, floor, room, cx, cy, rot };
  });
}
