import type { HomeType } from "@/lib/homelander/data";

/**
 * Sample floor plans, one per home type, in metres. Not the real Gamuda Land layouts.
 * Plan space: x runs right, y runs down, and y = 0 is the FRONT of the home, the side
 * the buyer sets as "facing". Every room is an axis-aligned rectangle.
 */

export type Pt = [number, number];

export type RoomKind =
  | "living"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "bath"
  | "stairs"
  | "hall"
  | "store"
  | "outdoor";

export type Room = {
  id: string;
  label: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** A window on a wall from p to q. `n` points out of the room, `sill`/`head` are heights in metres. */
export type Window = {
  room: string;
  p: Pt;
  q: Pt;
  n: Pt;
  sill: number;
  head: number;
};

/** A doorway on a wall from p to q. `main` is the front door; `open` is an opening with no leaf. */
export type Door = {
  kind: "main" | "room" | "back" | "open";
  p: Pt;
  q: Pt;
  rooms: [string, string];
};

export type Floor = {
  id: string;
  label: string;
  rooms: Room[];
  windows: Window[];
  doors: Door[];
};

export type Plan = {
  id: "terrace" | "semid" | "apartment";
  label: string;
  floors: Floor[];
};

const room = (
  id: string,
  label: string,
  kind: RoomKind,
  x: number,
  y: number,
  w: number,
  h: number,
): Room => ({
  id,
  label,
  kind,
  x,
  y,
  w,
  h,
});

const UP: Pt = [0, -1];
const DOWN: Pt = [0, 1];
const LEFT: Pt = [-1, 0];
const RIGHT: Pt = [1, 0];

/** Terrace, 22 ft wide: party walls both sides, so light only comes from front and back. */
const terrace: Plan = {
  id: "terrace",
  label: "Terrace",
  floors: [
    {
      id: "ground",
      label: "Ground floor",
      rooms: [
        room("porch", "Car porch", "outdoor", 0, 0, 6.4, 5),
        room("living", "Living", "living", 0, 5, 6.4, 5),
        room("dining", "Dining", "dining", 0, 10, 4, 4),
        room("stairs", "Stairs", "stairs", 4, 10, 2.4, 2.6),
        room("bath1", "Bath", "bath", 4, 12.6, 2.4, 1.4),
        room("kitchen", "Kitchen", "kitchen", 0, 14, 6.4, 3.2),
        room("yard", "Yard", "outdoor", 0, 17.2, 6.4, 1.8),
      ],
      windows: [
        { room: "living", p: [0.5, 5], q: [3.3, 5], n: UP, sill: 0, head: 2.4 },
        {
          room: "kitchen",
          p: [0.8, 17.2],
          q: [3.2, 17.2],
          n: DOWN,
          sill: 1,
          head: 2.1,
        },
      ],
      doors: [
        { kind: "main", p: [3.9, 5], q: [4.9, 5], rooms: ["porch", "living"] },
        {
          kind: "open",
          p: [0.3, 10],
          q: [3.7, 10],
          rooms: ["living", "dining"],
        },
        {
          kind: "open",
          p: [4.3, 10],
          q: [6.1, 10],
          rooms: ["living", "stairs"],
        },
        {
          kind: "room",
          p: [4, 12.8],
          q: [4, 13.6],
          rooms: ["dining", "bath1"],
        },
        {
          kind: "open",
          p: [0.6, 14],
          q: [3.4, 14],
          rooms: ["dining", "kitchen"],
        },
        {
          kind: "back",
          p: [4.4, 17.2],
          q: [5.4, 17.2],
          rooms: ["kitchen", "yard"],
        },
      ],
    },
    {
      id: "first",
      label: "First floor",
      rooms: [
        room("master", "Master", "bedroom", 0, 2, 6.4, 5),
        room("bath2", "Bath", "bath", 0, 7, 2.4, 2.4),
        room("hall", "Family hall", "hall", 2.4, 7, 4, 3),
        room("store", "Store", "store", 0, 9.4, 2.4, 3.2),
        room("corridor", "Corridor", "hall", 2.4, 10, 1.6, 2.6),
        room("stairs", "Stairs", "stairs", 4, 10, 2.4, 2.6),
        room("bed2", "Bedroom 2", "bedroom", 0, 12.6, 3.2, 4.6),
        room("bed3", "Bedroom 3", "bedroom", 3.2, 12.6, 3.2, 4.6),
      ],
      windows: [
        { room: "master", p: [1, 2], q: [5.4, 2], n: UP, sill: 0.9, head: 2.1 },
        {
          room: "bed2",
          p: [0.6, 17.2],
          q: [2.6, 17.2],
          n: DOWN,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "bed3",
          p: [3.8, 17.2],
          q: [5.8, 17.2],
          n: DOWN,
          sill: 0.9,
          head: 2.1,
        },
      ],
      doors: [
        { kind: "room", p: [3.4, 7], q: [4.2, 7], rooms: ["master", "hall"] },
        {
          kind: "room",
          p: [2.4, 7.8],
          q: [2.4, 8.6],
          rooms: ["bath2", "hall"],
        },
        {
          kind: "open",
          p: [2.5, 10],
          q: [3.9, 10],
          rooms: ["hall", "corridor"],
        },
        { kind: "open", p: [4.2, 10], q: [6.2, 10], rooms: ["hall", "stairs"] },
        {
          kind: "room",
          p: [2.4, 10.6],
          q: [2.4, 11.4],
          rooms: ["store", "corridor"],
        },
        {
          kind: "room",
          p: [2.45, 12.6],
          q: [3.15, 12.6],
          rooms: ["corridor", "bed2"],
        },
        {
          kind: "room",
          p: [3.25, 12.6],
          q: [3.95, 12.6],
          rooms: ["corridor", "bed3"],
        },
      ],
    },
  ],
};

/** Semi-D, 40 ft lot: party wall on the left, open side on the right (x = 9.5). */
const semid: Plan = {
  id: "semid",
  label: "Semi-D",
  floors: [
    {
      id: "ground",
      label: "Ground floor",
      rooms: [
        room("porch", "Car porch", "outdoor", 0, 0, 9.5, 5),
        room("living", "Living", "living", 0, 5, 5.5, 5.5),
        room("foyer", "Foyer", "hall", 5.5, 5, 4, 2),
        room("guest", "Guest room", "bedroom", 5.5, 7, 4, 3.5),
        room("dining", "Dining", "dining", 0, 10.5, 5.5, 4),
        room("stairs", "Stairs", "stairs", 5.5, 10.5, 2.2, 4),
        room("bath1", "Bath", "bath", 7.7, 10.5, 1.8, 4),
        room("kitchen", "Dry kitchen", "kitchen", 0, 14.5, 6, 3.5),
        room("wet", "Wet kitchen", "kitchen", 6, 14.5, 3.5, 3.5),
        room("yard", "Yard", "outdoor", 0, 18, 9.5, 1.8),
      ],
      windows: [
        { room: "living", p: [0.5, 5], q: [4.5, 5], n: UP, sill: 0, head: 2.4 },
        {
          room: "guest",
          p: [9.5, 7.6],
          q: [9.5, 9.6],
          n: RIGHT,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "bath1",
          p: [9.5, 11.5],
          q: [9.5, 12.5],
          n: RIGHT,
          sill: 1.5,
          head: 2.1,
        },
        {
          room: "kitchen",
          p: [1, 18],
          q: [3.5, 18],
          n: DOWN,
          sill: 1,
          head: 2.1,
        },
        {
          room: "wet",
          p: [9.5, 15],
          q: [9.5, 17],
          n: RIGHT,
          sill: 1,
          head: 2.1,
        },
      ],
      doors: [
        { kind: "main", p: [6.6, 5], q: [7.8, 5], rooms: ["porch", "foyer"] },
        {
          kind: "open",
          p: [5.5, 5.4],
          q: [5.5, 6.8],
          rooms: ["foyer", "living"],
        },
        { kind: "room", p: [6.4, 7], q: [7.2, 7], rooms: ["foyer", "guest"] },
        {
          kind: "open",
          p: [0.4, 10.5],
          q: [4.8, 10.5],
          rooms: ["living", "dining"],
        },
        {
          kind: "open",
          p: [5.5, 11],
          q: [5.5, 13.8],
          rooms: ["dining", "stairs"],
        },
        {
          kind: "room",
          p: [7.7, 13],
          q: [7.7, 13.8],
          rooms: ["stairs", "bath1"],
        },
        {
          kind: "open",
          p: [1, 14.5],
          q: [4.2, 14.5],
          rooms: ["dining", "kitchen"],
        },
        { kind: "room", p: [6, 15.4], q: [6, 16.4], rooms: ["kitchen", "wet"] },
        { kind: "back", p: [7, 18], q: [8, 18], rooms: ["wet", "yard"] },
      ],
    },
    {
      id: "first",
      label: "First floor",
      rooms: [
        room("master", "Master", "bedroom", 0, 2, 6, 5.5),
        room("mbath", "Master bath", "bath", 6, 2, 3.5, 3),
        room("walkin", "Walk-in", "store", 6, 5, 3.5, 2.5),
        room("hall", "Family hall", "hall", 0, 7.5, 5.5, 3),
        room("bed4", "Bedroom 4", "bedroom", 5.5, 7.5, 4, 3),
        room("study", "Study", "store", 0, 10.5, 3.5, 3.5),
        room("corridor", "Corridor", "hall", 3.5, 10.5, 2, 3.5),
        room("stairs", "Stairs", "stairs", 5.5, 10.5, 2.2, 3.5),
        room("bath2", "Bath", "bath", 7.7, 10.5, 1.8, 3.5),
        room("bed2", "Bedroom 2", "bedroom", 0, 14, 4.8, 4),
        room("bed3", "Bedroom 3", "bedroom", 4.8, 14, 4.7, 4),
      ],
      windows: [
        { room: "master", p: [1, 2], q: [5, 2], n: UP, sill: 0.9, head: 2.1 },
        {
          room: "mbath",
          p: [9.5, 2.8],
          q: [9.5, 4],
          n: RIGHT,
          sill: 1.5,
          head: 2.1,
        },
        {
          room: "bed4",
          p: [9.5, 8],
          q: [9.5, 10],
          n: RIGHT,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "bath2",
          p: [9.5, 11.2],
          q: [9.5, 12.2],
          n: RIGHT,
          sill: 1.5,
          head: 2.1,
        },
        {
          room: "bed2",
          p: [1, 18],
          q: [3.5, 18],
          n: DOWN,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "bed3",
          p: [6, 18],
          q: [8.5, 18],
          n: DOWN,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "bed3",
          p: [9.5, 15],
          q: [9.5, 17],
          n: RIGHT,
          sill: 0.9,
          head: 2.1,
        },
      ],
      doors: [
        { kind: "room", p: [2, 7.5], q: [2.8, 7.5], rooms: ["master", "hall"] },
        { kind: "room", p: [6, 3.2], q: [6, 4], rooms: ["master", "mbath"] },
        { kind: "room", p: [6, 5.6], q: [6, 6.4], rooms: ["master", "walkin"] },
        { kind: "room", p: [5.5, 8.2], q: [5.5, 9], rooms: ["hall", "bed4"] },
        {
          kind: "open",
          p: [3.6, 10.5],
          q: [5.4, 10.5],
          rooms: ["hall", "corridor"],
        },
        {
          kind: "room",
          p: [3.5, 11.5],
          q: [3.5, 12.3],
          rooms: ["study", "corridor"],
        },
        {
          kind: "open",
          p: [5.5, 11],
          q: [5.5, 13.6],
          rooms: ["corridor", "stairs"],
        },
        {
          kind: "room",
          p: [7.7, 11],
          q: [7.7, 11.8],
          rooms: ["stairs", "bath2"],
        },
        {
          kind: "room",
          p: [3.7, 14],
          q: [4.5, 14],
          rooms: ["corridor", "bed2"],
        },
        {
          kind: "room",
          p: [4.85, 14],
          q: [5.45, 14],
          rooms: ["corridor", "bed3"],
        },
      ],
    },
  ],
};

/** Corner apartment, one floor: balcony at the front, front door at the back from the lift lobby. */
const apartment: Plan = {
  id: "apartment",
  label: "Apartment",
  floors: [
    {
      id: "unit",
      label: "Unit",
      rooms: [
        room("balcony", "Balcony", "outdoor", 0, 0, 6, 1.5),
        room("living", "Living", "living", 0, 1.5, 6, 4),
        room("dining", "Dining", "dining", 0, 5.5, 6, 2.5),
        room("kitchen", "Kitchen", "kitchen", 0, 8, 3, 2),
        room("foyer", "Foyer", "hall", 3, 8, 3, 2),
        room("master", "Master", "bedroom", 6, 0, 4, 4.2),
        room("hallway", "Hallway", "hall", 6, 4.2, 2.4, 2.2),
        room("mbath", "Bath", "bath", 8.4, 4.2, 1.6, 2.2),
        room("bed2", "Bedroom 2", "bedroom", 6, 6.4, 4, 3.6),
      ],
      windows: [
        {
          room: "living",
          p: [0.4, 1.5],
          q: [5.6, 1.5],
          n: UP,
          sill: 0,
          head: 2.4,
        },
        {
          room: "living",
          p: [0, 2.4],
          q: [0, 4.6],
          n: LEFT,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "kitchen",
          p: [0, 8.4],
          q: [0, 9.6],
          n: LEFT,
          sill: 1,
          head: 2.1,
        },
        {
          room: "master",
          p: [6.6, 0],
          q: [9.4, 0],
          n: UP,
          sill: 0.9,
          head: 2.1,
        },
        {
          room: "mbath",
          p: [10, 4.7],
          q: [10, 5.7],
          n: RIGHT,
          sill: 1.5,
          head: 2.1,
        },
        {
          room: "bed2",
          p: [10, 7.2],
          q: [10, 9.2],
          n: RIGHT,
          sill: 0.9,
          head: 2.1,
        },
      ],
      doors: [
        { kind: "main", p: [4, 10], q: [5, 10], rooms: ["lobby", "foyer"] },
        {
          kind: "open",
          p: [0.3, 5.5],
          q: [5.7, 5.5],
          rooms: ["living", "dining"],
        },
        {
          kind: "open",
          p: [0.5, 8],
          q: [2.5, 8],
          rooms: ["dining", "kitchen"],
        },
        { kind: "open", p: [3.4, 8], q: [5.6, 8], rooms: ["dining", "foyer"] },
        {
          kind: "open",
          p: [6, 4.6],
          q: [6, 5.4],
          rooms: ["living", "hallway"],
        },
        {
          kind: "room",
          p: [6.6, 4.2],
          q: [7.4, 4.2],
          rooms: ["hallway", "master"],
        },
        {
          kind: "room",
          p: [8.5, 4.2],
          q: [9.3, 4.2],
          rooms: ["master", "mbath"],
        },
        {
          kind: "room",
          p: [6.6, 6.4],
          q: [7.4, 6.4],
          rooms: ["hallway", "bed2"],
        },
      ],
    },
  ],
};

export const plans = { terrace, semid, apartment } as const;

/** The plan type as a noun mid-sentence: "terrace", "apartment", but "Semi-D" keeps its caps. */
export const planNoun = (plan: Plan) =>
  plan.id === "semid" ? plan.label : plan.label.toLowerCase();

export function planFor(type: HomeType): Plan {
  if (type === "Semi-D" || type === "Bungalow") return semid;
  if (type === "Terrace") return terrace;
  return apartment;
}

export function floorBounds(floor: Floor) {
  let w = 0;
  let h = 0;
  for (const r of floor.rooms) {
    w = Math.max(w, r.x + r.w);
    h = Math.max(h, r.y + r.h);
  }
  return { w, h };
}

/** The plan's overall footprint across all floors, so switching floors keeps the same scale. */
export function planBounds(plan: Plan) {
  return plan.floors
    .map(floorBounds)
    .reduce((a, b) => ({ w: Math.max(a.w, b.w), h: Math.max(a.h, b.h) }));
}
