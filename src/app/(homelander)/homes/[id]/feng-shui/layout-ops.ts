import { CATALOG, type Item, type Kind, type Rot } from "./furniture";
import type { Door, Floor, Pt, Room } from "./plans";

/**
 * Pure layout operations. The canvas, the side panel, the Manglish parser and the AI route
 * all go through these, so a layout can never end up with furniture through a wall.
 */

export type Box = { x: number; y: number; w: number; h: number };

const EPS = 1e-6;
/** How far a door's swing and walkway reach into the rooms on each side. */
const DOOR_CLEAR = 0.6;
const SNAP = 0.05;

export const snap = (v: number) => Math.round(v / SNAP) * SNAP;

export function boxOf(it: Pick<Item, "kind" | "cx" | "cy" | "rot">): Box {
  const c = CATALOG[it.kind];
  const w = it.rot % 2 ? c.d : c.w;
  const h = it.rot % 2 ? c.w : c.d;
  return { x: it.cx - w / 2, y: it.cy - h / 2, w, h };
}

/** Unit vector the item's front faces, in plan space. */
export function frontOf(rot: Rot): Pt {
  return (
    [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ] as Pt[]
  )[rot];
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - EPS &&
  b.x < a.x + a.w - EPS &&
  a.y < b.y + b.h - EPS &&
  b.y < a.y + a.h - EPS;

const inside = (a: Box, r: Room) =>
  a.x >= r.x - EPS &&
  a.y >= r.y - EPS &&
  a.x + a.w <= r.x + r.w + EPS &&
  a.y + a.h <= r.y + r.h + EPS;

export function doorZone(d: Door): Box {
  const vertical = Math.abs(d.p[0] - d.q[0]) < EPS;
  const lo = Math.min(vertical ? d.p[1] : d.p[0], vertical ? d.q[1] : d.q[0]);
  const hi = Math.max(vertical ? d.p[1] : d.p[0], vertical ? d.q[1] : d.q[0]);
  return vertical
    ? { x: d.p[0] - DOOR_CLEAR, y: lo, w: DOOR_CLEAR * 2, h: hi - lo }
    : { x: lo, y: d.p[1] - DOOR_CLEAR, w: hi - lo, h: DOOR_CLEAR * 2 };
}

export type Problem =
  | { code: "hit"; other: Item }
  | { code: "door"; main: boolean }
  | { code: "outside" }
  | { code: "stairs" }
  | { code: "full"; kind: Kind; room?: Room }
  | { code: "fixed"; kind: Kind }
  | { code: "missing" };

/** Where the item would sit, or why it can't. */
export function check(
  item: Item,
  items: Item[],
  floor: Floor,
): { room: Room } | { problem: Problem } {
  const box = boxOf(item);
  const room = floor.rooms.find((r) => inside(box, r));
  if (!room) return { problem: { code: "outside" } };
  if (room.kind === "stairs") return { problem: { code: "stairs" } };
  for (const d of floor.doors) {
    if (d.kind === "open") continue;
    if (overlaps(box, doorZone(d)))
      return { problem: { code: "door", main: d.kind === "main" } };
  }
  for (const o of items) {
    if (o.uid === item.uid || o.floor !== item.floor) continue;
    if (overlaps(box, boxOf(o))) return { problem: { code: "hit", other: o } };
  }
  return { room };
}

export type Result =
  { ok: true; items: Item[]; item: Item } | { ok: false; problem: Problem };

function commit(items: Item[], next: Item, floor: Floor): Result {
  const c = check(next, items, floor);
  if ("problem" in c) return { ok: false, problem: c.problem };
  const placed = { ...next, room: c.room.id };
  const exists = items.some((i) => i.uid === next.uid);
  return {
    ok: true,
    item: placed,
    items: exists
      ? items.map((i) => (i.uid === next.uid ? placed : i))
      : [...items, placed],
  };
}

function nextUid(kind: Kind, items: Item[]) {
  let n = 1;
  while (items.some((i) => i.uid === `${kind}-${n}`)) n++;
  return `${kind}-${n}`;
}

/** Rooms to try for a new item: the named room, else preferred room kinds, else any room. */
function candidateRooms(kind: Kind, floor: Floor, roomId?: string) {
  const usable = floor.rooms.filter((r) => r.kind !== "stairs");
  if (roomId) return usable.filter((r) => r.id === roomId);
  const prefer = CATALOG[kind].prefer;
  const ranked = [...usable].sort((a, b) => {
    const ia = prefer.indexOf(a.kind);
    const ib = prefer.indexOf(b.kind);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return ranked.filter((r) => r.kind !== "outdoor" || kind === "plant");
}

/** Place a new item in the first spot where it fits, hugging the room's top-left walls. */
export function place(
  kind: Kind,
  floor: Floor,
  items: Item[],
  roomId?: string,
): Result {
  const uid = nextUid(kind, items);
  const rooms = candidateRooms(kind, floor, roomId);
  for (const room of rooms) {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const b = boxOf({ kind, cx: 0, cy: 0, rot });
      for (
        let y = room.y + b.h / 2;
        y <= room.y + room.h - b.h / 2 + EPS;
        y += 0.1
      ) {
        for (
          let x = room.x + b.w / 2;
          x <= room.x + room.w - b.w / 2 + EPS;
          x += 0.1
        ) {
          const r = commit(
            items,
            { uid, kind, floor: floor.id, room: room.id, cx: x, cy: y, rot },
            floor,
          );
          if (r.ok) return r;
        }
      }
    }
  }
  return {
    ok: false,
    problem: { code: "full", kind, room: roomId ? rooms[0] : undefined },
  };
}

function find(items: Item[], uid: string) {
  return items.find((i) => i.uid === uid);
}

export function moveTo(
  uid: string,
  cx: number,
  cy: number,
  floor: Floor,
  items: Item[],
): Result {
  const it = find(items, uid);
  if (!it) return { ok: false, problem: { code: "missing" } };
  if (CATALOG[it.kind].fixed)
    return { ok: false, problem: { code: "fixed", kind: it.kind } };
  return commit(items, { ...it, cx: snap(cx), cy: snap(cy) }, floor);
}

export function moveBy(
  uid: string,
  dx: number,
  dy: number,
  floor: Floor,
  items: Item[],
): Result {
  const it = find(items, uid);
  if (!it) return { ok: false, problem: { code: "missing" } };
  return moveTo(uid, it.cx + dx, it.cy + dy, floor, items);
}

/**
 * Turn 90° clockwise. If the turned piece doesn't fit where it is (a sofa against a wall
 * swings into it), slide it to the nearest spot within a metre that does fit.
 */
export function rotate(uid: string, floor: Floor, items: Item[]): Result {
  const it = find(items, uid);
  if (!it) return { ok: false, problem: { code: "missing" } };
  if (CATALOG[it.kind].fixed)
    return { ok: false, problem: { code: "fixed", kind: it.kind } };
  const turned = { ...it, rot: ((it.rot + 1) % 4) as Rot };
  const first = commit(items, turned, floor);
  if (first.ok) return first;
  const offsets: [number, number][] = [];
  for (let dx = -1; dx <= 1 + EPS; dx += 0.05)
    for (let dy = -1; dy <= 1 + EPS; dy += 0.05) offsets.push([dx, dy]);
  offsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  for (const [dx, dy] of offsets) {
    const r = commit(
      items,
      { ...turned, cx: snap(it.cx + dx), cy: snap(it.cy + dy) },
      floor,
    );
    // Stay in the same room: sliding a bed into the corridor to turn it isn't what anyone meant.
    if (r.ok && r.item.room === it.room) return r;
  }
  return first;
}

export function remove(uid: string, items: Item[]): Result {
  const it = find(items, uid);
  if (!it) return { ok: false, problem: { code: "missing" } };
  if (CATALOG[it.kind].fixed)
    return { ok: false, problem: { code: "fixed", kind: it.kind } };
  return { ok: true, item: it, items: items.filter((i) => i.uid !== uid) };
}

export function hitTest(items: Item[], floorId: string, x: number, y: number) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.floor !== floorId) continue;
    const b = boxOf(it);
    // Thin pieces (a mirror is 10 cm deep) get a bigger target so they can be picked up.
    const pad = Math.max(0, (0.3 - Math.min(b.w, b.h)) / 2);
    if (
      x >= b.x - pad &&
      x <= b.x + b.w + pad &&
      y >= b.y - pad &&
      y <= b.y + b.h + pad
    )
      return it;
  }
  return undefined;
}

export function describe(
  p: Problem,
  roomLabel?: (id: string) => string,
): string {
  switch (p.code) {
    case "hit":
      return `It bumps into the ${CATALOG[p.other.kind].label.toLowerCase()}.`;
    case "door":
      return p.main ? "That blocks the main door." : "That blocks a door.";
    case "outside":
      return "Furniture has to sit inside one room.";
    case "stairs":
      return "Can't put furniture on the stairs.";
    case "full": {
      const where = p.room
        ? ` in the ${(roomLabel?.(p.room.id) ?? p.room.label).toLowerCase()}`
        : " on this floor";
      return `No space for the ${CATALOG[p.kind].label.toLowerCase()}${where}. Move or remove something first.`;
    }
    case "fixed":
      return `The ${CATALOG[p.kind].label.toLowerCase()} is built in, so it stays put.`;
    case "missing":
      return "That piece isn't in the layout any more.";
  }
}
