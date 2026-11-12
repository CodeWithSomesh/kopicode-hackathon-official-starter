import { ongScore, type Note } from "./fengshui";
import { CATALOG, type Item, type Kind, type Rot } from "./furniture";
import { check, snap } from "./layout-ops";
import type { Plan } from "./plans";

/**
 * "Fix it": change the layout so an Ong meter problem goes away. The feng shui rules are
 * the judge: a candidate layout is accepted only if that note disappears and nothing gets
 * worse. Moves stay inside the same room and go through the normal collision check.
 */

export type FixState = { items: Item[]; curtains: ReadonlySet<string> };
type Words = { en: string; mg: string };

export type FixOutcome =
  | { ok: true; state: FixState; note: Note; did: Words; uid?: string }
  | { ok: false; note?: Note; why: Words };

const problems = (notes: Note[]) => notes.filter((n) => n.tone !== "good");
const label = (k: Kind) => CATALOG[k].label.toLowerCase();
const roomName = (id: string, fallback: string) =>
  ({ living: "living room", dining: "dining area" })[id] ??
  fallback.toLowerCase();

/** Problems the layout can't change: they're built into the plan. */
const BUILT_IN = ["bath-centre-", "stove-sink-"];

export const isFixable = (n: Note) =>
  n.tone !== "good" && !BUILT_IN.some((p) => n.id.startsWith(p));

function nextUid(kind: Kind, items: Item[]) {
  let n = 1;
  while (items.some((i) => i.uid === `${kind}-${n}`)) n++;
  return `${kind}-${n}`;
}

/** Accept a candidate when the note is gone, no new problems appear, and the score doesn't drop. */
function better(before: Note[], after: Note[], noteId: string) {
  if (after.some((n) => n.id === noteId)) return false;
  const was = new Set(problems(before).map((n) => n.id));
  if (problems(after).some((n) => !was.has(n.id))) return false;
  return ongScore(after) >= ongScore(before);
}

export function fixOne(
  plan: Plan,
  s: FixState,
  evaluate: (s: FixState) => Note[],
  note: Note,
): FixOutcome {
  const before = evaluate(s);
  const floor = plan.floors.find((f) => f.id === note.floor);

  if (!isFixable(note)) {
    return {
      ok: false,
      note,
      why: {
        en: `"${note.title}" is built into the plan, so moving furniture can't fix it.`,
        mg: `"${note.title}" tu memang dalam pelan rumah, alih perabot pun tak boleh betulkan.`,
      },
    };
  }

  // Too much afternoon sun: close the living room curtains.
  if (note.id === "living-yang") {
    const living = plan.floors
      .flatMap((f) => f.rooms)
      .find((r) => r.kind === "living");
    if (living) {
      const next = { ...s, curtains: new Set([...s.curtains, living.id]) };
      if (better(before, evaluate(next), note.id))
        return {
          ok: true,
          state: next,
          note,
          did: {
            en: "closed the living room curtains",
            mg: "langsir ruang tamu dah tutup",
          },
        };
    }
  }

  // Main door in line with a window: stand a plant in the strip, nearest the middle first.
  if (note.strip && floor) {
    const st = note.strip;
    const uid = nextUid("plant", s.items);
    const spots: [number, number][] = [];
    for (let y = st.y + 0.25; y <= st.y + st.h - 0.25; y += 0.25)
      for (let x = st.x + 0.25; x <= st.x + st.w - 0.25; x += 0.25)
        spots.push([snap(x), snap(y)]);
    const mid: [number, number] = [st.x + st.w / 2, st.y + st.h / 2];
    spots.sort(
      (a, b) =>
        Math.hypot(a[0] - mid[0], a[1] - mid[1]) -
        Math.hypot(b[0] - mid[0], b[1] - mid[1]),
    );
    for (const [x, y] of spots) {
      const plant: Item = {
        uid,
        kind: "plant",
        floor: floor.id,
        room: "",
        cx: x,
        cy: y,
        rot: 0,
      };
      const c = check(plant, s.items, floor);
      if ("problem" in c) continue;
      const next = { ...s, items: [...s.items, { ...plant, room: c.room.id }] };
      if (better(before, evaluate(next), note.id))
        return {
          ok: true,
          state: next,
          note,
          uid,
          did: {
            en: `put a plant in the ${roomName(c.room.id, c.room.label)} to break the line from the main door`,
            mg: `letak pokok kat ${c.room.label.toLowerCase()} untuk halang laluan dari pintu depan`,
          },
        };
    }
  }

  // Furniture problems: turn and/or slide the piece within its room, smallest change first.
  const target = s.items.find((i) => i.uid === note.uids[0]);
  if (target && floor && !CATALOG[target.kind].fixed) {
    const candidates: {
      dx: number;
      dy: number;
      turns: number;
      cost: number;
    }[] = [];
    for (let dx = -2.5; dx <= 2.5 + 1e-6; dx += 0.25)
      for (let dy = -2.5; dy <= 2.5 + 1e-6; dy += 0.25)
        for (let turns = 0; turns < 4; turns++) {
          if (!turns && !dx && !dy) continue;
          // A turn "costs" about as much as a 0.75 m slide, so short slides win over spins.
          candidates.push({
            dx,
            dy,
            turns,
            cost: Math.hypot(dx, dy) + (turns ? 0.75 : 0),
          });
        }
    candidates.sort((a, b) => a.cost - b.cost);
    for (const c of candidates) {
      const moved: Item = {
        ...target,
        cx: snap(target.cx + c.dx),
        cy: snap(target.cy + c.dy),
        rot: ((target.rot + c.turns) % 4) as Rot,
      };
      const res = check(moved, s.items, floor);
      if ("problem" in res || res.room.id !== target.room) continue;
      const next = {
        ...s,
        items: s.items.map((i) => (i.uid === target.uid ? moved : i)),
      };
      if (!better(before, evaluate(next), note.id)) continue;
      const dist = Math.round(Math.hypot(c.dx, c.dy) * 10) / 10;
      const name = label(target.kind);
      const turnEn = c.turns ? `turned the ${name} ${c.turns * 90}°` : "";
      const turnMg = c.turns ? `pusing ${name} ${c.turns * 90} darjah` : "";
      const moveEn = dist
        ? `${turnEn ? "and moved it" : `moved the ${name}`} ${dist} m`
        : "";
      const moveMg = dist
        ? `${turnMg ? "dan alih" : `alih ${name}`} ${dist} meter`
        : "";
      return {
        ok: true,
        state: next,
        note,
        uid: target.uid,
        did: {
          en: [turnEn, moveEn].filter(Boolean).join(" "),
          mg: [turnMg, moveMg].filter(Boolean).join(" "),
        },
      };
    }
  }

  return {
    ok: false,
    note,
    why: {
      en: `Couldn't fix "${note.title}" without moving other furniture. Try moving what's around it first.`,
      mg: `Tak boleh betulkan "${note.title}" tanpa alih barang lain. Cuba alih barang sekeliling dulu.`,
    },
  };
}

/** Pick which problem a "fix" command means: one involving the named piece, else the worst. */
export function pickNote(notes: Note[], items: Item[], kind?: Kind) {
  const list = problems(notes).filter(isFixable);
  if (!kind) return list[0];
  return list.find((n) =>
    n.uids.some((u) => items.find((i) => i.uid === u)?.kind === kind),
  );
}

/** Fix every fixable problem in turn, worst first, until none are left or nothing helps. */
export function fixAll(
  plan: Plan,
  s: FixState,
  evaluate: (s: FixState) => Note[],
) {
  let state = s;
  const done: FixOutcome[] = [];
  const tried = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const note = problems(evaluate(state)).find(
      (n) => isFixable(n) && !tried.has(n.id),
    );
    if (!note) break;
    tried.add(note.id);
    const r = fixOne(plan, state, evaluate, note);
    done.push(r);
    if (r.ok) state = r.state;
  }
  return { state, done };
}
