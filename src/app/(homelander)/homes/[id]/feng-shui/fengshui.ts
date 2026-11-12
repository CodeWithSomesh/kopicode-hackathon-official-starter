import { CATALOG, type Item, type Kind } from "./furniture";
import { boxOf, frontOf, type Box } from "./layout-ops";
import type { TFn } from "@/lib/homelander/i18n/translate";
import type { Door, Floor, Plan, Pt, Room, Window } from "./plans";

/**
 * Rule-based feng shui notes: gentle, for buyers who care, never a verdict. Every rule is
 * plain geometry on the plan and the furniture, so moving a piece changes the notes live.
 */

export type Tone = "fix" | "watch" | "good";

export type Note = {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  fix?: string;
  /** Title, detail and fix as English templates ("{room}" slots) plus their values, so the UI can translate them. */
  tpl?: { title: string; detail: string; fix?: string };
  vars?: Record<string, string>;
  floor: string;
  /** Pieces the note is about; tapping the note selects the first. */
  uids: string[];
  /** A strip to draw on the plan, e.g. the line from the main door out the window. */
  strip?: Box;
};

/** i18n marker: npm run i18n:check sees tr(text) literals; the UI calls noteText() which translates them. */
const tr = (s: string) => s;

const fill = (s: string, v?: Record<string, string>) => (v ? s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m) : s);

/** Fills the English text in place (commands.ts and autofix.ts quote it) and keeps the templates for translation. */
function withText(n: Note): Note {
  return {
    ...n,
    tpl: { title: n.title, detail: n.detail, fix: n.fix },
    title: fill(n.title, n.vars),
    detail: fill(n.detail, n.vars),
    fix: n.fix === undefined ? undefined : fill(n.fix, n.vars),
  };
}

/** One field of a note in the buyer's language; the slot values (room, piece) are translated too. */
export function noteText(n: Note, t: TFn, field: "title" | "detail" | "fix"): string {
  const src = n.tpl?.[field] ?? n[field] ?? "";
  const vars = Object.fromEntries(Object.entries(n.vars ?? {}).map(([k, v]) => [k, t(v)]));
  return t(src, vars);
}

const EPS = 1e-6;
const WALL_GAP = 0.15;

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const centre = (it: Item): Pt => [it.cx, it.cy];
const label = (k: Kind) => CATALOG[k].label.toLowerCase();

const isHorizontal = (s: { p: Pt; q: Pt }) => Math.abs(s.p[1] - s.q[1]) < EPS;

/** Is point `pt` in front of a piece, within `halfWidth` either side of its centre line? */
function inFront(
  from: Pt,
  front: Pt,
  pt: Pt,
  halfWidth: number,
  maxDist = Infinity,
) {
  const v = sub(pt, from);
  const along = dot(v, front);
  const side = Math.abs(v[0] * front[1] - v[1] * front[0]);
  return along > 0.2 && along < maxDist && side <= halfWidth;
}

/** Half the width of a piece's front edge. */
const halfFront = (it: Item) => CATALOG[it.kind].w / 2;

function backEdge(it: Item): { side: Pt; box: Box } {
  return { side: sub([0, 0], frontOf(it.rot)), box: boxOf(it) };
}

/** Is the piece's back against its room's wall? Returns the wall line coordinate if so. */
function backWall(it: Item, room: Room) {
  const { side, box } = backEdge(it);
  if (side[1] < 0 && Math.abs(box.y - room.y) < WALL_GAP)
    return { axis: "y" as const, at: room.y, side };
  if (side[1] > 0 && Math.abs(box.y + box.h - (room.y + room.h)) < WALL_GAP)
    return { axis: "y" as const, at: room.y + room.h, side };
  if (side[0] < 0 && Math.abs(box.x - room.x) < WALL_GAP)
    return { axis: "x" as const, at: room.x, side };
  if (side[0] > 0 && Math.abs(box.x + box.w - (room.x + room.w)) < WALL_GAP)
    return { axis: "x" as const, at: room.x + room.w, side };
  return null;
}

/** A window on the wall behind the piece, overlapping its back edge. */
function windowBehind(it: Item, room: Room, floor: Floor): Window | undefined {
  const wall = backWall(it, room);
  if (!wall) return undefined;
  const box = boxOf(it);
  return floor.windows.find((w) => {
    if (w.room !== room.id) return false;
    if (wall.axis === "y") {
      if (!isHorizontal(w) || Math.abs(w.p[1] - wall.at) > EPS) return false;
      return (
        Math.min(w.p[0], w.q[0]) < box.x + box.w &&
        Math.max(w.p[0], w.q[0]) > box.x
      );
    }
    if (isHorizontal(w) || Math.abs(w.p[0] - wall.at) > EPS) return false;
    return (
      Math.min(w.p[1], w.q[1]) < box.y + box.h &&
      Math.max(w.p[1], w.q[1]) > box.y
    );
  });
}

/** The room on the other side of the wall behind a piece. */
function roomBehind(it: Item, floor: Floor) {
  const room = floor.rooms.find((r) => r.id === it.room);
  if (!room) return undefined;
  const wall = backWall(it, room);
  if (!wall) return undefined;
  const probe = add(centre(it), [0, 0]);
  if (wall.axis === "y") probe[1] = wall.at + wall.side[1] * 0.2;
  else probe[0] = wall.at + wall.side[0] * 0.2;
  return floor.rooms.find(
    (r) =>
      r.id !== room.id &&
      probe[0] > r.x &&
      probe[0] < r.x + r.w &&
      probe[1] > r.y &&
      probe[1] < r.y + r.h,
  );
}

/** Doors that open into a room (not open archways). */
const doorsOf = (floor: Floor, roomId: string) =>
  floor.doors.filter((d) => d.kind !== "open" && d.rooms.includes(roomId));

const roomById = (floor: Floor, id: string) =>
  floor.rooms.find((r) => r.id === id);

/**
 * Main door in a straight line with a window or back door ("chuan tang sha": qi rushes
 * straight through). Walls in between break the line; furniture in the strip blocks it.
 */
function doorThroughLine(floor: Floor, items: Item[]): Note | null {
  const main = floor.doors.find((d) => d.kind === "main");
  if (!main) return null;
  const horiz = isHorizontal(main);
  const lo = horiz
    ? Math.min(main.p[0], main.q[0])
    : Math.min(main.p[1], main.q[1]);
  const hi = horiz
    ? Math.max(main.p[0], main.q[0])
    : Math.max(main.p[1], main.q[1]);
  const at = horiz ? main.p[1] : main.p[0];

  const targets: { p: Pt; q: Pt; what: string }[] = [
    ...floor.windows.map((w) => ({
      p: w.p,
      q: w.q,
      what: w.sill < 0.1 ? "the sliding door" : "a window",
    })),
    ...floor.doors
      .filter((d) => d.kind === "back")
      .map((d) => ({ p: d.p, q: d.q, what: "the back door" })),
  ];

  let best: { from: number; to: number; at2: number; what: string } | null =
    null;
  for (const t of targets) {
    if (isHorizontal(t) !== horiz) continue;
    const at2 = horiz ? t.p[1] : t.p[0];
    if (Math.abs(at2 - at) < 1) continue;
    const from = Math.max(
      lo,
      horiz ? Math.min(t.p[0], t.q[0]) : Math.min(t.p[1], t.q[1]),
    );
    const to = Math.min(
      hi,
      horiz ? Math.max(t.p[0], t.q[0]) : Math.max(t.p[1], t.q[1]),
    );
    if (to - from < 0.3) continue;
    if (!lineIsOpen(floor, horiz, from, to, at, at2)) continue;
    if (!best || Math.abs(at2 - at) < Math.abs(best.at2 - at))
      best = { from, to, at2, what: t.what };
  }
  if (!best) return null;

  const a = Math.min(at, best.at2);
  const b = Math.max(at, best.at2);
  const strip: Box = horiz
    ? { x: best.from, y: a, w: best.to - best.from, h: b - a }
    : { x: a, y: best.from, w: b - a, h: best.to - best.from };
  const blockers = items.filter(
    (i) =>
      i.floor === floor.id &&
      !["coffee", "mirror", "dining"].includes(i.kind) &&
      overlaps(boxOf(i), strip),
  );
  if (blockers.length) {
    return {
      id: `through-blocked-${floor.id}`,
      tone: "good",
      title: tr("The {piece} breaks the door-to-{what} line"),
      vars: { piece: label(blockers[0].kind), what: best.what.replace(/^(a|the) /, "") },
      detail: tr("Qi now slows down and settles instead of rushing straight out."),
      floor: floor.id,
      uids: blockers.map((i) => i.uid),
    };
  }
  return {
    id: `through-${floor.id}`,
    tone: "fix",
    title: tr("Main door lines up with {what}"),
    vars: { what: best.what },
    detail:
      tr("Qi comes in the front and rushes straight out the back, so the home struggles to hold wealth."),
    fix: tr("Put a plant, shoe rack or screen somewhere along the red strip."),
    floor: floor.id,
    uids: [],
    strip,
  };
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - EPS &&
  b.x < a.x + a.w - EPS &&
  a.y < b.y + b.h - EPS &&
  b.y < a.y + a.h - EPS;

/** Does any sample line between two parallel walls cross only openings? */
function lineIsOpen(
  floor: Floor,
  horiz: boolean,
  from: number,
  to: number,
  a: number,
  b: number,
) {
  const lo = Math.min(a, b) + EPS * 10;
  const hi = Math.max(a, b) - EPS * 10;
  const samples = [from + 0.1, (from + to) / 2, to - 0.1];
  return samples.some((s) => {
    for (const r of floor.rooms) {
      // Edges parallel to the walls, crossed by the sample line.
      const edges = horiz ? [r.y, r.y + r.h] : [r.x, r.x + r.w];
      const span = horiz ? [r.x, r.x + r.w] : [r.y, r.y + r.h];
      if (s <= span[0] || s >= span[1]) continue;
      for (const e of edges) {
        if (e <= lo || e >= hi) continue;
        const gap = floor.doors.some((d) => {
          if (isHorizontal(d) !== horiz) return false;
          const dAt = horiz ? d.p[1] : d.p[0];
          if (Math.abs(dAt - e) > EPS) return false;
          const d0 = horiz
            ? Math.min(d.p[0], d.q[0])
            : Math.min(d.p[1], d.q[1]);
          const d1 = horiz
            ? Math.max(d.p[0], d.q[0])
            : Math.max(d.p[1], d.q[1]);
          return s > d0 && s < d1;
        });
        if (!gap) return false;
      }
    }
    return true;
  });
}

function doorCentre(d: Door): Pt {
  return mid(d.p, d.q);
}

/** Unit normal of a door pointing into `roomId`. */
function doorInto(d: Door, room: Room): Pt {
  const c = doorCentre(d);
  const n: Pt = isHorizontal(d) ? [0, 1] : [1, 0];
  const rc: Pt = [room.x + room.w / 2, room.y + room.h / 2];
  return dot(sub(rc, c), n) >= 0 ? n : [-n[0], -n[1]];
}

export type RuleInput = {
  plan: Plan;
  items: Item[];
  facing: number;
  /** Hours of direct sun on the living room floor over the day. */
  livingSunHours: number;
  livingCurtains: boolean;
};

export function readFengShui({
  plan,
  items,
  facing,
  livingSunHours,
  livingCurtains,
}: RuleInput): Note[] {
  const notes: Note[] = [];
  const push = (n: Note | null) => n && notes.push(withText(n));

  for (const floor of plan.floors) {
    const on = items.filter((i) => i.floor === floor.id);
    const main = floor.doors.find((d) => d.kind === "main");
    const wealth = baguaCells(floor, facing).find((c) => c.area === "Wealth");

    push(doorThroughLine(floor, items));

    for (const it of on) {
      const room = roomById(floor, it.room);
      if (!room) continue;
      const c = centre(it);
      const f = frontOf(it.rot);

      if (
        it.kind === "mirror" &&
        main &&
        inFront(c, f, doorCentre(main), 1.2, 5)
      ) {
        push({
          id: `mirror-door-${it.uid}`,
          tone: "fix",
          title: tr("Mirror faces the main door"),
          detail:
            tr("It bounces the good qi straight back out the door as it comes in."),
          fix: tr("Turn the mirror or move it to a side wall."),
          floor: floor.id,
          uids: [it.uid],
        });
      }

      if (it.kind === "bed") {
        const toDoor = doorsOf(floor, room.id).find((d) =>
          inFront(c, f, doorCentre(d), halfFront(it) + 0.1, 6),
        );
        if (toDoor) {
          push({
            id: `bed-door-${it.uid}`,
            tone: "fix",
            title: tr("Bed in {room} points its feet at the door"),
            vars: { room: room.label.toLowerCase() },
            detail:
              tr("The 'coffin position'. Most aunties will tell you to avoid it."),
            fix: tr("Turn the bed so the door is to one side."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
        if (windowBehind(it, room, floor)) {
          push({
            id: `bed-window-${it.uid}`,
            tone: "watch",
            title: tr("Bed in {room} has a window behind the headboard"),
            vars: { room: room.label.toLowerCase() },
            detail:
              tr("No solid backing while you sleep, and the sun and noise come in right at your head."),
            fix: tr("Move the headboard to a solid wall."),
            floor: floor.id,
            uids: [it.uid],
          });
        } else if (!backWall(it, room)) {
          push({
            id: `bed-float-${it.uid}`,
            tone: "watch",
            title: tr("Bed in {room} isn't against a wall"),
            vars: { room: room.label.toLowerCase() },
            detail:
              tr("A headboard against a solid wall gives support, like a mountain behind you."),
            fix: tr("Slide the bed until its head touches a wall."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
        const bath = doorsOf(floor, room.id).find((d) => {
          const other = d.rooms.find((r) => r !== room.id);
          const o = other ? roomById(floor, other) : undefined;
          return (
            o?.kind === "bath" &&
            inFront(doorCentre(d), doorInto(d, room), c, 1.2, 5)
          );
        });
        if (bath) {
          push({
            id: `bed-bath-${it.uid}`,
            tone: "fix",
            title: tr("Bathroom door faces the bed in {room}"),
            vars: { room: room.label.toLowerCase() },
            detail: tr("Bathroom qi flows straight onto the bed."),
            fix: tr("Move the bed out of line with the bathroom door, or keep that door shut."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
        const mirror = on.find(
          (m) =>
            m.kind === "mirror" &&
            m.room === room.id &&
            inFront(centre(m), frontOf(m.rot), c, halfFront(it) + 0.3, 6),
        );
        if (mirror) {
          push({
            id: `mirror-bed-${mirror.uid}`,
            tone: "fix",
            title: tr("Mirror reflects the bed"),
            detail:
              tr("Said to disturb sleep and invite a third party into the relationship."),
            fix: tr("Turn the mirror so it doesn't face the bed."),
            floor: floor.id,
            uids: [mirror.uid, it.uid],
          });
        }
      }

      if (it.kind === "sofa") {
        if (
          main &&
          dot(f, sub(doorCentre(main), c)) < -0.5 &&
          Math.hypot(...sub(doorCentre(main), c)) < 7
        ) {
          push({
            id: `sofa-door-${it.uid}`,
            tone: "fix",
            title: tr("Sofa has its back to the main door"),
            detail:
              tr("You can't see who comes in. Feng shui likes a 'commanding position' facing the door."),
            fix: tr("Turn the sofa so you can see the main door from it."),
            floor: floor.id,
            uids: [it.uid],
          });
        } else if (!backWall(it, room)) {
          push({
            id: `sofa-float-${it.uid}`,
            tone: "watch",
            title: tr("Sofa isn't backed by a wall"),
            detail: tr("A solid wall behind the sofa gives the family support."),
            fix: tr("Push the sofa back against a wall."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
      }

      if (it.kind === "desk") {
        // The front is where you sit, so your back points along the front.
        const behind = doorsOf(floor, room.id).find(
          (d) => dot(f, sub(doorCentre(d), c)) > 0.3,
        );
        if (behind) {
          push({
            id: `desk-door-${it.uid}`,
            tone: "watch",
            title: tr("Desk in {room} puts your back to the door"),
            vars: { room: room.label.toLowerCase() },
            detail:
              tr("You'll keep turning around. Facing the door is the commanding position for work and study."),
            fix: tr("Turn the desk so you can see the door when you sit."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
      }

      if (it.kind === "altar") {
        const behind = roomBehind(it, floor);
        if (behind?.kind === "bath") {
          push({
            id: `altar-bath-${it.uid}`,
            tone: "fix",
            title: tr("Altar backs onto a bathroom"),
            detail: tr("The altar should rest on a clean, solid wall."),
            fix: tr("Move the altar to a wall that isn't shared with a bathroom."),
            floor: floor.id,
            uids: [it.uid],
          });
        } else if (!backWall(it, room)) {
          push({
            id: `altar-float-${it.uid}`,
            tone: "watch",
            title: tr("Altar isn't against a wall"),
            detail: tr("An altar needs a solid wall behind it."),
            fix: tr("Push the altar back against a solid wall."),
            floor: floor.id,
            uids: [it.uid],
          });
        } else {
          push({
            id: `altar-ok-${it.uid}`,
            tone: "good",
            title: tr("Altar sits against a solid wall"),
            detail: tr("Good support, with clear space in front."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
      }

      if (it.kind === "plant") {
        if (wealth && inBox(c, wealth.box)) {
          push({
            id: `plant-wealth-${it.uid}`,
            tone: "good",
            title: tr("Plant in the wealth corner ({dir})"),
            vars: { dir: wealth.dir },
            detail: tr("Wood energy feeds wealth. Nice!"),
            floor: floor.id,
            uids: [it.uid],
          });
        } else if (main && Math.hypot(...sub(doorCentre(main), c)) < 2.2) {
          push({
            id: `plant-door-${it.uid}`,
            tone: "good",
            title: tr("Plant welcomes qi at the main door"),
            detail: tr("Healthy greenery near the entrance draws good energy in."),
            floor: floor.id,
            uids: [it.uid],
          });
        }
      }
    }

    const stove = on.find((i) => i.kind === "stove");
    const sink = on.find((i) => i.kind === "sink");
    if (stove && sink) {
      const a = boxOf(stove);
      const b = boxOf(sink);
      const gap = Math.max(
        b.x - (a.x + a.w),
        a.x - (b.x + b.w),
        b.y - (a.y + a.h),
        a.y - (b.y + b.h),
      );
      const facingEachOther =
        dot(frontOf(stove.rot), frontOf(sink.rot)) < -0.9 &&
        dot(frontOf(stove.rot), sub(centre(sink), centre(stove))) > 0;
      if (gap < 0.3 || facingEachOther) {
        push({
          id: `stove-sink-${floor.id}`,
          tone: "watch",
          title: facingEachOther
            ? tr("Stove faces the sink")
            : tr("Stove sits right next to the sink"),
          detail:
            tr("Fire and water clash, which is said to stir up quarrels at home."),
          floor: floor.id,
          uids: [stove.uid, sink.uid],
        });
      } else {
        push({
          id: `stove-sink-ok-${floor.id}`,
          tone: "good",
          title: tr("Stove and sink keep their distance"),
          detail: tr("Fire and water aren't fighting in this kitchen."),
          floor: floor.id,
          uids: [stove.uid],
        });
      }
    }

    const centreCell = baguaCells(floor, facing).find(
      (cell) => cell.area === "Health",
    );
    const centreBath =
      centreCell &&
      floor.rooms.find(
        (r) => r.kind === "bath" && inBox(roomCentre(r), centreCell.box),
      );
    if (centreBath) {
      push({
        id: `bath-centre-${floor.id}`,
        tone: "watch",
        title: tr("A bathroom sits in the centre of the floor"),
        detail:
          tr("The centre is the heart of the home, so plumbing here is a classic worry. It's built in, so keep it clean and the door shut."),
        floor: floor.id,
        uids: [],
      });
    }
  }

  if (livingSunHours >= 4 && !livingCurtains) {
    const livingFloor = plan.floors.find((f) =>
      f.rooms.some((r) => r.kind === "living"),
    )!;
    push({
      id: "living-yang",
      tone: "watch",
      title: tr("About {hours} hours of direct sun on the living room"),
      vars: { hours: String(livingSunHours) },
      detail:
        tr("Too much yang: hot, glary and restless. Your aircon bill will feel it too."),
      fix: tr("Close the living room curtains in the afternoon, or pick a different facing."),
      floor: livingFloor.id,
      uids: [],
    });
  }

  const order: Record<Tone, number> = { fix: 0, watch: 1, good: 2 };
  return notes.sort((a, b) => order[a.tone] - order[b.tone]);
}

const inBox = (p: Pt, b: Box) =>
  p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
const roomCentre = (r: Room): Pt => [r.x + r.w / 2, r.y + r.h / 2];

const WEIGHT: Record<Tone, number> = { fix: -12, watch: -5, good: 4 };

/** The Ong meter: 0 to 100. Starts at 75, issues pull it down, good placements push it up. */
export function ongScore(notes: Note[]) {
  const raw = notes.reduce((s, n) => s + WEIGHT[n.tone], 75);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function ongVerdict(score: number) {
  if (score >= 85) return { word: tr("Great"), tone: "pandan" as const };
  if (score >= 60) return { word: tr("Okay"), tone: "kaya" as const };
  return { word: tr("Needs work"), tone: "raya" as const };
}

/* ------------------------------------------------------------------ bagua */

export type BaguaElement = "Water" | "Wood" | "Fire" | "Earth" | "Metal";

const SECTORS: { dir: string; area: string; element: BaguaElement }[] = [
  { dir: "N", area: "Career", element: "Water" },
  { dir: "NE", area: "Knowledge", element: "Earth" },
  { dir: "E", area: "Family", element: "Wood" },
  { dir: "SE", area: "Wealth", element: "Wood" },
  { dir: "S", area: "Fame", element: "Fire" },
  { dir: "SW", area: "Love", element: "Earth" },
  { dir: "W", area: "Children", element: "Metal" },
  { dir: "NW", area: "Helpers", element: "Metal" },
];

export type BaguaCell = {
  box: Box;
  dir: string;
  area: string;
  element: BaguaElement;
};

/**
 * The Lo Shu 3x3 grid over the floor's indoor footprint. Plan "up" points at the facing
 * bearing, so each outer cell's compass direction turns with the facing.
 */
export function baguaCells(floor: Floor, facing: number): BaguaCell[] {
  const indoor = floor.rooms.filter((r) => r.kind !== "outdoor");
  const x0 = Math.min(...indoor.map((r) => r.x));
  const y0 = Math.min(...indoor.map((r) => r.y));
  const x1 = Math.max(...indoor.map((r) => r.x + r.w));
  const y1 = Math.max(...indoor.map((r) => r.y + r.h));
  const cw = (x1 - x0) / 3;
  const ch = (y1 - y0) / 3;
  const cells: BaguaCell[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const box = { x: x0 + col * cw, y: y0 + row * ch, w: cw, h: ch };
      if (row === 1 && col === 1) {
        cells.push({ box, dir: "Centre", area: "Health", element: "Earth" });
        continue;
      }
      // Plan offset to compass bearing: up the plan is `facing`, right is facing + 90.
      const dx = col - 1;
      const dy = row - 1;
      const bearing =
        (facing + (Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const s = SECTORS[Math.round(bearing / 45) % 8];
      cells.push({ box, ...s });
    }
  }
  return cells;
}
