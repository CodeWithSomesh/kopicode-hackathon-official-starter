import { fixAll, fixOne, pickNote } from "./autofix";
import { kindMs, roomEn, roomMs } from "./names";
import type { Note } from "./fengshui";
import { CATALOG, defaultItems, type Item, type Kind } from "./furniture";
import {
  moveBy,
  place,
  remove,
  rotate,
  type Problem,
  type Result,
} from "./layout-ops";
import type { Plan, Room } from "./plans";
import { FACINGS, MONTHS } from "./sun";

/**
 * The command box: mixed English, Bahasa Melayu and Manglish in, structured commands out.
 * `parse` never touches state; `run` applies one command to a World and returns the new
 * World plus a reply in both languages. The AI route (phase 5) emits the same command text.
 */

export type Lang = "en" | "mg";
export type Reply = { ok: boolean; en: string; mg: string };

export type World = {
  items: Item[];
  facing: number;
  time: number;
  month: number;
  curtains: ReadonlySet<string>;
  floorIdx: number;
  selected: string | null;
};

export type Ctx = {
  plan: Plan;
  /** Living room sun right now and over the day, for "panas tak?". */
  heat: (w: World) => { share: number; hours: number };
  /** Ong meter and the worst problem, for "ong tak?". */
  ong: (w: World) => { score: number; top?: string };
  /** The feng shui notes for a world, for "fix it". */
  notes: (w: World) => Note[];
};

type Dir = "left" | "right" | "up" | "down";

export type Command =
  | { type: "place"; kind: Kind; room?: string }
  | { type: "relocate"; kind?: Kind; room: string }
  | { type: "remove"; kind?: Kind; room?: string }
  | { type: "move"; kind?: Kind; room?: string; dir: Dir; dist: number }
  | { type: "rotate"; kind?: Kind; room?: string; turns: number }
  | { type: "select"; kind: Kind; room?: string }
  | { type: "face"; deg: number }
  | { type: "time"; hour: number; ask: boolean }
  | { type: "month"; month: number }
  | { type: "curtain"; close: boolean; room?: string }
  | { type: "floor"; which: "ground" | "first" }
  | { type: "hot" }
  | { type: "ong" }
  | { type: "reset" }
  | { type: "fix"; kind?: Kind; all: boolean }
  | { type: "help" };

/* ------------------------------------------------------------------ words */

// Multi-word phrases first, longest first, so "barat daya" wins over "barat".
const PHRASES: [string, string][] = [
  ["north east", "C:45"],
  ["north-east", "C:45"],
  ["northeast", "C:45"],
  ["timur laut", "C:45"],
  ["south east", "C:135"],
  ["south-east", "C:135"],
  ["southeast", "C:135"],
  ["south west", "C:225"],
  ["south-west", "C:225"],
  ["southwest", "C:225"],
  ["barat daya", "C:225"],
  ["north west", "C:315"],
  ["north-west", "C:315"],
  ["northwest", "C:315"],
  ["barat laut", "C:315"],
  ["living room", "R:living"],
  ["ruang tamu", "R:living"],
  ["dining room", "R:dining"],
  ["ruang makan", "R:dining"],
  ["master bedroom", "R:master"],
  ["bilik utama", "R:master"],
  ["bilik tidur utama", "R:master"],
  ["bedroom 2", "R:bed2"],
  ["bilik 2", "R:bed2"],
  ["bedroom 3", "R:bed3"],
  ["bilik 3", "R:bed3"],
  ["bedroom 4", "R:bed4"],
  ["bilik 4", "R:bed4"],
  ["guest room", "R:guest"],
  ["bilik tetamu", "R:guest"],
  ["family hall", "R:hall"],
  ["wet kitchen", "R:wet"],
  ["dapur basah", "R:wet"],
  ["dry kitchen", "R:kitchen"],
  ["coffee table", "K:coffee"],
  ["meja kopi", "K:coffee"],
  ["dining table", "K:dining"],
  ["dining set", "K:dining"],
  ["meja makan", "K:dining"],
  ["tv console", "K:tv"],
  ["kabinet tv", "K:tv"],
  ["shoe rack", "K:shoerack"],
  ["rak kasut", "K:shoerack"],
  ["meja tulis", "K:desk"],
  ["meja belajar", "K:desk"],
  ["study table", "K:desk"],
  ["meja sembahyang", "K:altar"],
  ["dapur gas", "K:stove"],
  ["ground floor", "F:ground"],
  ["tingkat bawah", "F:ground"],
  ["first floor", "F:first"],
  ["tingkat atas", "F:first"],
  ["tingkat 1", "F:first"],
  ["mula semula", "V:reset"],
  ["start over", "V:reset"],
  ["turn around", "V:rotate X:2"],
  ["pusing balik", "V:rotate X:2"],
  ["tengah hari", "H:noon"],
  ["o clock", ""],
  ["panas tak", "V:hot"],
  ["hot or not", "V:hot"],
  ["feng shui", "V:ong"],
  ["ong tak", "V:ong"],
  ["ok tak", "V:ong"],
  ["apa boleh buat", "V:help"],
  ["boleh buat apa", "V:help"],
  ["what can i", "V:help"],
  ["what can you", "V:help"],
];

const WORDS: Record<string, string> = {
  // furniture
  sofa: "K:sofa",
  settee: "K:sofa",
  couch: "K:sofa",
  tv: "K:tv",
  television: "K:tv",
  telly: "K:tv",
  coffee: "K:coffee",
  bed: "K:bed",
  katil: "K:bed",
  wardrobe: "K:wardrobe",
  almari: "K:wardrobe",
  closet: "K:wardrobe",
  desk: "K:desk",
  shoerack: "K:shoerack",
  stove: "K:stove",
  cooker: "K:stove",
  sink: "K:sink",
  sinki: "K:sink",
  altar: "K:altar",
  mirror: "K:mirror",
  cermin: "K:mirror",
  plant: "K:plant",
  pokok: "K:plant",
  pasu: "K:plant",
  // rooms
  living: "R:living",
  hall: "R:living",
  lounge: "R:living",
  dining: "R:dining",
  kitchen: "R:kitchen",
  dapur: "R:kitchen",
  master: "R:master",
  guest: "R:guest",
  study: "R:study",
  foyer: "R:foyer",
  balcony: "R:balcony",
  balkoni: "R:balcony",
  porch: "R:porch",
  yard: "R:yard",
  // directions on the plan
  left: "D:left",
  kiri: "D:left",
  right: "D:right",
  kanan: "D:right",
  up: "D:up",
  atas: "D:up",
  depan: "D:up",
  forward: "D:up",
  down: "D:down",
  bawah: "D:down",
  belakang: "D:down",
  back: "D:down",
  backward: "D:down",
  // compass
  north: "C:0",
  utara: "C:0",
  east: "C:90",
  timur: "C:90",
  tenggara: "C:135",
  south: "C:180",
  selatan: "C:180",
  west: "C:270",
  barat: "C:270",
  ne: "C:45",
  se: "C:135",
  sw: "C:225",
  nw: "C:315",
  // verbs
  letak: "V:place",
  taruh: "V:place",
  put: "V:place",
  add: "V:place",
  tambah: "V:place",
  place: "V:place",
  bubuh: "V:place",
  buang: "V:remove",
  remove: "V:remove",
  delete: "V:remove",
  keluarkan: "V:remove",
  campak: "V:remove",
  angkat: "V:remove",
  alih: "V:move",
  gerak: "V:move",
  move: "V:move",
  tolak: "V:move",
  shift: "V:move",
  push: "V:move",
  slide: "V:move",
  pusing: "V:rotate",
  rotate: "V:rotate",
  turn: "V:rotate",
  putar: "V:rotate",
  spin: "V:rotate",
  hadap: "V:face",
  menghadap: "V:face",
  facing: "V:face",
  face: "V:face",
  faces: "V:face",
  pukul: "V:time",
  jam: "V:time",
  time: "V:time",
  tengok: "V:look",
  see: "V:look",
  show: "V:look",
  look: "V:look",
  bulan: "V:month",
  month: "V:month",
  langsir: "V:curtain",
  curtain: "V:curtain",
  curtains: "V:curtain",
  blind: "V:curtain",
  blinds: "V:curtain",
  tutup: "V:close",
  close: "V:close",
  pasang: "V:close",
  draw: "V:close",
  buka: "V:open",
  open: "V:open",
  panas: "V:hot",
  hot: "V:hot",
  sun: "V:hot",
  matahari: "V:hot",
  sunny: "V:hot",
  ong: "V:ong",
  score: "V:ong",
  luck: "V:ong",
  around: "X:2",
  balik: "X:2",
  tunjuk: "V:look",
  hide: "V:hide",
  sorok: "V:hide",
  reset: "V:reset",
  fix: "V:fix",
  betulkan: "V:fix",
  betulkn: "V:fix",
  baiki: "V:fix",
  repair: "V:fix",
  settle: "V:fix",
  selesaikan: "V:fix",
  sort: "V:fix",
  solve: "V:fix",
  all: "Q:all",
  semua: "Q:all",
  everything: "Q:all",
  help: "V:help",
  tolong: "",
  apa: "",
  upstairs: "F:first",
  downstairs: "F:ground",
  naik: "F:first",
  turun: "F:ground",
  // time of day
  pagi: "H:am",
  am: "H:am",
  morning: "H:am",
  petang: "H:pm",
  pm: "H:pm",
  afternoon: "H:pm",
  evening: "H:pm",
  malam: "H:pm",
  noon: "H:noon",
  // pronouns for the selected piece
  it: "IT",
  dia: "IT",
  itu: "IT",
  tu: "IT",
  this: "IT",
  ni: "IT",
  ini: "IT",
};

const MONTH_WORDS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mac: 3,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  julai: 7,
  july: 7,
  ogos: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oct: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  november: 11,
  dis: 12,
  dec: 12,
  disember: 12,
  december: 12,
};

/** Split "alih sofa kiri 1, lepas tu pusing dia" into one command per clause. */
export function splitClauses(raw: string) {
  return raw
    .toLowerCase()
    .split(
      /\s*(?:;|,|\bthen\b|\blepas tu\b|\bpastu\b|\blepastu\b|\band then\b|\bdan\b|\band\b)\s*/,
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokens(clause: string) {
  // Keep decimal points ("1.5"), drop every other full stop and punctuation mark.
  let s = ` ${clause
    .toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[?!:"']/g, " ")
    .replace(/\s+/g, " ")} `;
  // "1.5m" -> "1.5 m", "50cm" -> "50 cm", "5pm" -> "5 pm"
  s = s.replace(/(\d)(m|cm|am|pm)\b/g, "$1 $2");
  for (const [a, b] of [...PHRASES].sort((x, y) => y[0].length - x[0].length))
    s = s.split(` ${a} `).join(` ${b} `);
  return s
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (w in WORDS ? WORDS[w].split(" ").filter(Boolean) : [w]));
}

export function parse(clause: string): Command | null {
  const t = tokens(clause);
  const has = (tok: string) => t.includes(tok);
  const pick = (prefix: string) =>
    t.find((w) => w.startsWith(prefix))?.slice(prefix.length);
  const kind = pick("K:") as Kind | undefined;
  const room = pick("R:");
  const dir = pick("D:") as Dir | undefined;
  const compass = pick("C:");
  const floor = pick("F:") as "ground" | "first" | undefined;
  const numIdx = t.findIndex((w) => /^\d+(\.\d+)?$/.test(w));
  const num = numIdx >= 0 ? Number(t[numIdx]) : null;
  const unit = numIdx >= 0 ? t[numIdx + 1] : undefined;
  const monthWord = t.find((w) => w in MONTH_WORDS);
  const turns = Number(pick("X:") ?? 1);

  if (has("V:reset")) return { type: "reset" };
  // "fix it" / "betulkan semua" / "fix the mirror": let the Ong meter's problems fix themselves.
  if (has("V:fix")) return { type: "fix", kind, all: has("Q:all") };
  if (has("V:help")) return { type: "help" };
  if (has("V:curtain")) return { type: "curtain", close: !has("V:open"), room };

  const isTime = has("V:time") || has("H:am") || has("H:pm") || has("H:noon");
  if (isTime && (num !== null || has("H:noon"))) {
    let h = has("H:noon") && num === null ? 12 : (num ?? 12);
    if (has("H:pm") && h < 12) h += 12;
    else if (!has("H:am") && h < 7) h += 12;
    return { type: "time", hour: h, ask: has("V:hot") };
  }
  if (has("V:hot")) return { type: "hot" };
  if (monthWord && !kind)
    return { type: "month", month: MONTH_WORDS[monthWord] };
  if (has("V:month") && num !== null) return { type: "month", month: num };
  if (has("V:ong")) return { type: "ong" };
  if (compass && !kind && !dir) return { type: "face", deg: Number(compass) };
  if (floor && !kind) return { type: "floor", which: floor };

  const verb = ["V:place", "V:remove", "V:move", "V:rotate"].find(has);
  const target = kind || has("IT");
  if (verb === "V:place" && kind) return { type: "place", kind, room };
  if (verb === "V:remove" && target) return { type: "remove", kind, room };
  if (verb === "V:rotate" && target)
    return { type: "rotate", kind, room, turns: num === 180 ? 2 : turns };
  if ((verb === "V:move" || (!verb && dir)) && target) {
    if (!dir)
      return verb === "V:move" && room
        ? { type: "relocate", kind, room }
        : null;
    const metres = num === null ? 0.5 : unit === "cm" ? num / 100 : num;
    return {
      type: "move",
      kind,
      room,
      dir,
      dist: Math.min(Math.max(metres, 0.05), 6),
    };
  }
  if (kind && !verb) return { type: "select", kind, room };
  return null;
}

/* ------------------------------------------------------------------ run */

const say = (ok: boolean, en: string, mg: string): Reply => ({ ok, en, mg });
const low = (k: Kind) => CATALOG[k].label.toLowerCase();

const MONTHS_MS = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember",
];
const FLOOR_MS: Record<string, string> = {
  ground: "tingkat bawah",
  first: "tingkat atas",
  unit: "unit",
};
const ms = kindMs;

function findRoom(
  plan: Plan,
  w: World,
  key?: string,
): { room: Room; floorIdx: number } | undefined {
  if (!key) return undefined;
  const order = [
    w.floorIdx,
    ...plan.floors.map((_, i) => i).filter((i) => i !== w.floorIdx),
  ];
  for (const fi of order) {
    const rooms = plan.floors[fi].rooms;
    const room =
      rooms.find((r) => r.id === key) ?? rooms.find((r) => r.kind === key);
    if (room) return { room, floorIdx: fi };
  }
  return undefined;
}

/** The piece a command means: "it" is the selected one; otherwise this floor first, this room first. */
function findItem(
  plan: Plan,
  w: World,
  kind?: Kind,
  roomKey?: string,
): Item | undefined {
  const sel = w.items.find((i) => i.uid === w.selected);
  if (!kind) return sel;
  if (sel?.kind === kind && !roomKey) return sel;
  const floorId = plan.floors[w.floorIdx].id;
  const room = findRoom(plan, w, roomKey)?.room;
  const of = w.items.filter((i) => i.kind === kind);
  return (
    of.find((i) => i.floor === floorId && (!room || i.room === room.id)) ??
    of.find((i) => !room || i.room === room.id) ??
    of[0]
  );
}

export function describeProblem(
  p: Problem,
  roomLabel?: string,
): { en: string; mg: string } {
  switch (p.code) {
    case "hit":
      return {
        en: `It bumps into the ${low(p.other.kind)}.`,
        mg: `Tak boleh, terlanggar ${ms(p.other.kind)}.`,
      };
    case "door":
      return p.main
        ? {
            en: "That blocks the main door.",
            mg: "Aiyo, block pintu depan lah.",
          }
        : { en: "That blocks a door.", mg: "Block pintu lah, tak boleh." };
    case "outside":
      return {
        en: "Furniture has to sit inside one room.",
        mg: "Kena duduk dalam satu bilik je.",
      };
    case "stairs":
      return {
        en: "Can't put furniture on the stairs.",
        mg: "Atas tangga mana boleh letak barang.",
      };
    case "full": {
      const where = roomLabel ?? p.room?.label;
      return {
        en: `No space for the ${low(p.kind)}${where ? ` in the ${where.toLowerCase()}` : ""}. Move or remove something first.`,
        mg: `Tak muat lah ${ms(p.kind)}${p.room ? ` kat ${roomMs(p.room.id, p.room.label)}` : where ? ` kat ${where.toLowerCase()}` : ""}. Alih atau buang barang lain dulu.`,
      };
    }
    case "fixed":
      return {
        en: `The ${low(p.kind)} is built in, so it stays put.`,
        mg: `${ms(p.kind)} tu built-in, tak boleh usik.`,
      };
    case "missing":
      return {
        en: "That piece isn't in the layout any more.",
        mg: "Barang tu dah takde.",
      };
  }
}

function fail(p: Problem, roomLabel?: string): Reply {
  const d = describeProblem(p, roomLabel);
  return say(false, d.en, d.mg);
}

function applyResult(w: World, r: Result, plan: Plan): World {
  if (!r.ok) return w;
  const floorIdx = plan.floors.findIndex((f) => f.id === r.item.floor);
  return {
    ...w,
    items: r.items,
    selected: r.item.uid,
    floorIdx: floorIdx >= 0 ? floorIdx : w.floorIdx,
  };
}

const roomName = (plan: Plan, it: Item) =>
  roomEn(
    it.room,
    plan.floors.flatMap((f) => f.rooms).find((r) => r.id === it.room)?.label ??
      it.room,
  );
const roomNameMs = (plan: Plan, it: Item) =>
  roomMs(it.room, roomName(plan, it));

const DIR_WORDS: Record<Dir, { en: string; mg: string; v: [number, number] }> =
  {
    left: { en: "left", mg: "kiri", v: [-1, 0] },
    right: { en: "right", mg: "kanan", v: [1, 0] },
    up: { en: "up", mg: "atas", v: [0, -1] },
    down: { en: "down", mg: "bawah", v: [0, 1] },
  };

export const HELP: Reply = say(
  true,
  "Try: put a plant in the living room · move the sofa left 1 m · turn the bed · remove the mirror · face north · 9 am · December · close the curtains · hot or not? · how's the feng shui? · fix it · fix all · reset",
  "Cuba: letak pokok kat ruang tamu · alih sofa kiri 1 · pusing katil · buang cermin · hadap utara · pukul 9 pagi · bulan Disember · tutup langsir · panas tak? · ong tak? · betulkan · betulkan semua · mula semula",
);

export function run(
  cmd: Command,
  w: World,
  ctx: Ctx,
): { world: World; reply: Reply } {
  const { plan } = ctx;
  const floor = plan.floors[w.floorIdx];

  switch (cmd.type) {
    case "place": {
      const target = findRoom(plan, w, cmd.room);
      if (cmd.room && !target)
        return {
          world: w,
          reply: say(
            false,
            "This home doesn't have that room.",
            "Rumah ni takde bilik tu lah.",
          ),
        };
      const fl = target ? plan.floors[target.floorIdx] : floor;
      const r = place(cmd.kind, fl, w.items, target?.room.id);
      if (!r.ok)
        return { world: w, reply: fail(r.problem, target?.room.label) };
      return {
        world: applyResult(w, r, plan),
        reply: say(
          true,
          `Done, ${low(cmd.kind)} is in the ${roomName(plan, r.item)}.`,
          `Okay, ${ms(cmd.kind)} dah letak kat ${roomNameMs(plan, r.item)}.`,
        ),
      };
    }
    case "relocate": {
      const it = findItem(plan, w, cmd.kind);
      if (!it)
        return {
          world: w,
          reply: say(
            false,
            "Move what? Tap a piece or name it.",
            "Nak alih apa?",
          ),
        };
      const target = findRoom(plan, w, cmd.room);
      if (!target)
        return {
          world: w,
          reply: say(
            false,
            "This home doesn't have that room.",
            "Rumah ni takde bilik tu lah.",
          ),
        };
      if (CATALOG[it.kind].fixed)
        return { world: w, reply: fail({ code: "fixed", kind: it.kind }) };
      // Lift it out, place it in the new room, keep its id so the selection follows it.
      const rest = w.items.filter((i) => i.uid !== it.uid);
      const r = place(
        it.kind,
        plan.floors[target.floorIdx],
        rest,
        target.room.id,
      );
      if (!r.ok) return { world: w, reply: fail(r.problem, target.room.label) };
      const moved = { ...r.item, uid: it.uid };
      const items = r.items.map((i) => (i.uid === r.item.uid ? moved : i));
      return {
        world: applyResult(w, { ok: true, items, item: moved }, plan),
        reply: say(
          true,
          `Moved the ${low(it.kind)} to the ${roomEn(target.room.id, target.room.label)}.`,
          `Okay, ${ms(it.kind)} dah pindah ke ${roomMs(target.room.id, target.room.label)}.`,
        ),
      };
    }
    case "remove": {
      const it = findItem(plan, w, cmd.kind, cmd.room);
      if (!it)
        return {
          world: w,
          reply: say(
            false,
            "Remove what? Tap a piece or name it.",
            "Nak buang apa? Sebut nama barang.",
          ),
        };
      const r = remove(it.uid, w.items);
      if (!r.ok) return { world: w, reply: fail(r.problem) };
      return {
        world: { ...w, items: r.items, selected: null },
        reply: say(
          true,
          `The ${low(it.kind)} is gone.`,
          `Okay, ${ms(it.kind)} dah buang.`,
        ),
      };
    }
    case "move": {
      const it = findItem(plan, w, cmd.kind, cmd.room);
      if (!it)
        return {
          world: w,
          reply: say(
            false,
            "Move what? Tap a piece or name it.",
            "Nak alih apa?",
          ),
        };
      const fl = plan.floors.find((f) => f.id === it.floor)!;
      const d = DIR_WORDS[cmd.dir];
      const r = moveBy(
        it.uid,
        d.v[0] * cmd.dist,
        d.v[1] * cmd.dist,
        fl,
        w.items,
      );
      if (!r.ok)
        return { world: { ...w, selected: it.uid }, reply: fail(r.problem) };
      const m = Math.round(cmd.dist * 100) / 100;
      return {
        world: applyResult(w, r, plan),
        reply: say(
          true,
          `Moved the ${low(it.kind)} ${d.en} ${m} m.`,
          `Okay, ${ms(it.kind)} dah alih ${d.mg} ${m} meter.`,
        ),
      };
    }
    case "rotate": {
      const it = findItem(plan, w, cmd.kind, cmd.room);
      if (!it)
        return {
          world: w,
          reply: say(
            false,
            "Turn what? Tap a piece or name it.",
            "Nak pusing apa?",
          ),
        };
      const fl = plan.floors.find((f) => f.id === it.floor)!;
      let items = w.items;
      let last: Result | null = null;
      for (let i = 0; i < cmd.turns; i++) {
        last = rotate(it.uid, fl, items);
        if (!last.ok)
          return {
            world: { ...w, selected: it.uid },
            reply: fail(last.problem),
          };
        items = last.items;
      }
      return {
        world: applyResult(w, last!, plan),
        reply: say(
          true,
          `Turned the ${low(it.kind)} ${cmd.turns * 90}°.`,
          `Okay, ${ms(it.kind)} dah pusing ${cmd.turns * 90} darjah.`,
        ),
      };
    }
    case "select": {
      const it = findItem(plan, w, cmd.kind, cmd.room);
      if (!it)
        return {
          world: w,
          reply: say(
            false,
            `There's no ${low(cmd.kind)} yet.`,
            `Mana ada ${ms(cmd.kind)}.`,
          ),
        };
      const fi = plan.floors.findIndex((f) => f.id === it.floor);
      return {
        world: { ...w, selected: it.uid, floorIdx: fi },
        reply: say(
          true,
          `Picked the ${low(it.kind)} in the ${roomName(plan, it)}.`,
          `Okay, ${ms(it.kind)} kat ${roomNameMs(plan, it)}.`,
        ),
      };
    }
    case "face": {
      const f = FACINGS.find((x) => x.deg === cmd.deg)!;
      const next = { ...w, facing: cmd.deg };
      const h = ctx.heat(next);
      return {
        world: next,
        reply: say(
          true,
          `The front now faces ${f.name.toLowerCase()}. ${heatLine(h, "en")}`,
          `Okay, depan rumah hadap ${f.malay.toLowerCase()}. ${heatLine(h, "mg")}`,
        ),
      };
    }
    case "time": {
      if (cmd.hour < 7 || cmd.hour > 19)
        return {
          world: w,
          reply: say(
            false,
            "Pick a time between 7 am and 7 pm.",
            "Pilih antara 7 pagi sampai 7 malam je.",
          ),
        };
      const next = { ...w, time: cmd.hour };
      const h = ctx.heat(next);
      const t = clock(cmd.hour);
      return {
        world: next,
        reply: say(
          true,
          `It's ${t.en}. ${heatLine(h, "en")}`,
          `Pukul ${t.mg}. ${heatLine(h, "mg")}`,
        ),
      };
    }
    case "month": {
      if (cmd.month < 1 || cmd.month > 12)
        return { world: w, reply: say(false, "Which month?", "Bulan apa?") };
      const next = { ...w, month: cmd.month };
      const h = ctx.heat(next);
      return {
        world: next,
        reply: say(
          true,
          `${MONTHS[cmd.month - 1]}. ${heatLine(h, "en")}`,
          `Bulan ${MONTHS_MS[cmd.month - 1]}. ${heatLine(h, "mg")}`,
        ),
      };
    }
    case "curtain": {
      const target = findRoom(plan, w, cmd.room ?? "living");
      if (!target)
        return { world: w, reply: say(false, "Which room?", "Bilik mana?") };
      const curtains = new Set(w.curtains);
      if (cmd.close) curtains.add(target.room.id);
      else curtains.delete(target.room.id);
      const next = { ...w, curtains };
      const name = roomEn(target.room.id, target.room.label);
      const nameMs = roomMs(target.room.id, target.room.label);
      return {
        world: next,
        reply: cmd.close
          ? say(
              true,
              `Curtains closed in the ${name}.`,
              `Langsir kat ${nameMs} dah tutup. Sejuk sikit.`,
            )
          : say(
              true,
              `Curtains open in the ${name}.`,
              `Langsir kat ${nameMs} dah buka.`,
            ),
      };
    }
    case "floor": {
      const idx = cmd.which === "first" ? 1 : 0;
      if (!plan.floors[idx] || plan.floors.length === 1)
        return {
          world: w,
          reply: say(
            false,
            "This home has one floor.",
            "Rumah ni satu tingkat je.",
          ),
        };
      return {
        world: { ...w, floorIdx: idx, selected: null },
        reply: say(
          true,
          `Showing the ${plan.floors[idx].label.toLowerCase()}.`,
          `Okay, tengok ${FLOOR_MS[plan.floors[idx].id] ?? plan.floors[idx].label.toLowerCase()}.`,
        ),
      };
    }
    case "hot":
      return {
        world: w,
        reply: say(
          true,
          heatLine(ctx.heat(w), "en"),
          heatLine(ctx.heat(w), "mg"),
        ),
      };
    case "ong": {
      const o = ctx.ong(w);
      const en = `Ong meter ${o.score}/100.${o.top ? ` Fix first: ${o.top}.` : " Nothing to fix."}`;
      const mg = `Ong meter ${o.score}/100. ${o.score >= 85 ? "Huat ah!" : o.score >= 60 ? "Okay lah." : "Aiyo."}${o.top ? ` Betulkan dulu: ${o.top}.` : ""}`;
      return { world: w, reply: say(true, en, mg) };
    }
    case "fix": {
      const evaluate = (s: { items: Item[]; curtains: ReadonlySet<string> }) =>
        ctx.notes({ ...w, items: s.items, curtains: s.curtains });
      const start = { items: w.items, curtains: w.curtains };
      const after = (st: typeof start, uid?: string): World => {
        const it = uid ? st.items.find((i) => i.uid === uid) : undefined;
        const fi = it ? plan.floors.findIndex((f) => f.id === it.floor) : -1;
        return {
          ...w,
          items: st.items,
          curtains: st.curtains,
          selected: uid ?? w.selected,
          floorIdx: fi >= 0 ? fi : w.floorIdx,
        };
      };
      const score = (st: typeof start) =>
        ctx.ong({ ...w, items: st.items, curtains: st.curtains }).score;

      if (cmd.all) {
        const { state, done } = fixAll(plan, start, evaluate);
        const fixed = done.filter((d) => d.ok);
        const stuck = done.flatMap((d) =>
          !d.ok && d.note ? [d.note.title] : [],
        );
        if (!done.length)
          return {
            world: w,
            reply: say(
              true,
              "Nothing to fix. Huat!",
              "Takde apa nak betulkan. Huat ah!",
            ),
          };
        const s = score(state);
        const lastUid = [...fixed].reverse().find((d) => d.ok && d.uid);
        return {
          world: after(state, lastUid && lastUid.ok ? lastUid.uid : undefined),
          reply: say(
            fixed.length > 0,
            [
              fixed.length
                ? `Fixed ${fixed.length}: ${fixed.map((d) => (d.ok ? d.did.en : "")).join("; ")}.`
                : "",
              stuck.length
                ? `Couldn't fix ${stuck.map((n) => `"${n}"`).join(", ")} without moving other furniture first.`
                : "",
              `Ong meter now ${s}.`,
            ]
              .filter(Boolean)
              .join(" "),
            [
              fixed.length
                ? `Dah betulkan ${fixed.length}: ${fixed.map((d) => (d.ok ? d.did.mg : "")).join("; ")}.`
                : "",
              stuck.length
                ? `Tak boleh betulkan ${stuck.map((n) => `"${n}"`).join(", ")} tanpa alih barang lain dulu.`
                : "",
              `Ong meter sekarang ${s}.`,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        };
      }

      const note = pickNote(evaluate(start), w.items, cmd.kind);
      if (!note)
        return {
          world: w,
          reply: cmd.kind
            ? say(
                true,
                `Nothing wrong with the ${low(cmd.kind)}.`,
                `${ms(cmd.kind)} tu okay je, takde masalah.`,
              )
            : say(
                true,
                "Nothing to fix. Huat!",
                "Takde apa nak betulkan. Huat ah!",
              ),
        };
      const r = fixOne(plan, start, evaluate, note);
      if (!r.ok) return { world: w, reply: say(false, r.why.en, r.why.mg) };
      const s = score(r.state);
      return {
        world: after(r.state, r.uid),
        reply: say(
          true,
          `Fixed "${note.title}": ${r.did.en}. Ong meter now ${s}.`,
          `Dah betulkan "${note.title}": ${r.did.mg}. Ong meter sekarang ${s}.`,
        ),
      };
    }
    case "reset":
      return {
        world: { ...w, items: defaultItems(plan.id), selected: null },
        reply: say(
          true,
          "Furniture is back where it started.",
          "Okay, mula semula. Semua barang balik tempat asal.",
        ),
      };
    case "help":
      return { world: w, reply: HELP };
  }
}

function clock(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const h12 = hh > 12 ? hh - 12 : hh;
  const t = `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
  const mgPart =
    h < 12 ? "pagi" : h < 14 ? "tengah hari" : h < 19 ? "petang" : "malam";
  return { en: `${t} ${h < 12 ? "am" : "pm"}`, mg: `${t} ${mgPart}` };
}

export function heatLine(h: { share: number; hours: number }, lang: Lang) {
  const pct = Math.round(h.share * 100);
  if (lang === "en") {
    const now =
      pct >= 20
        ? `Hot: ${pct}% of the living room is in direct sun.`
        : pct >= 5
          ? `Warm: ${pct}% of the living room is in sun.`
          : "Cool: no real sun on the living room right now.";
    return `${now} ${h.hours ? `About ${h.hours} h of sun on it today.` : "No direct sun on it all day."}`;
  }
  const now =
    pct >= 20
      ? `Panas lah, ${pct}% ruang tamu kena matahari.`
      : pct >= 5
        ? `Suam je, ${pct}% kena matahari.`
        : "Sejuk, ruang tamu tak kena matahari sekarang.";
  return `${now} ${h.hours ? `Sehari dalam ${h.hours} jam kena.` : "Langsung tak kena sepanjang hari."}`;
}

/** Parse and run every clause in order; stop explaining at the first one it can't read. */
export function runText(
  raw: string,
  w: World,
  ctx: Ctx,
): { world: World; replies: Reply[] } {
  const clauses = splitClauses(raw);
  const replies: Reply[] = [];
  let world = w;
  for (const c of clauses) {
    const cmd = parse(c);
    if (!cmd) {
      replies.push(
        say(
          false,
          `Didn't catch "${c}". Type "help" for examples.`,
          `Tak faham lah "${c}". Taip "help" untuk contoh.`,
        ),
      );
      continue;
    }
    const r = run(cmd, world, ctx);
    world = r.world;
    replies.push(r.reply);
  }
  if (!clauses.length) replies.push(HELP);
  return { world, replies };
}

/** Room names the parser knows, per room id, for the AI prompt. Rooms not listed can't be addressed. */
export const ROOM_PHRASE: Record<string, string> = {
  living: "living room",
  dining: "dining room",
  kitchen: "kitchen",
  wet: "wet kitchen",
  master: "master bedroom",
  bed2: "bedroom 2",
  bed3: "bedroom 3",
  bed4: "bedroom 4",
  guest: "guest room",
  study: "study",
  foyer: "foyer",
  hall: "family hall",
  balcony: "balcony",
  porch: "porch",
  yard: "yard",
};

/** The furniture list in the words the parser knows, e.g. "sofa in living room". */
export function describeItems(plan: Plan, items: Item[]) {
  const label = (id: string) =>
    ROOM_PHRASE[id] ??
    plan.floors.flatMap((f) => f.rooms).find((r) => r.id === id)?.label ??
    id;
  return items.map((i) => `${low(i.kind)} in ${label(i.room)}`);
}

/** Clauses the local parser can't read, so the AI route knows what to translate. */
export const unreadable = (raw: string) =>
  splitClauses(raw).filter((c) => !parse(c) || isWish(c));

/**
 * Wishes and questions ("make the hall less hot", "kenapa katil tak ok") contain words the
 * quick parser would latch onto ("hot", "katil") and answer the wrong question. These go to
 * the AI first; the quick parser is still the fallback.
 */
const WISH =
  /\b(make|less|more|too|cooler|warmer|better|improve|should|would|could|why|what|which|where|how|kenapa|macam mana|kurang|kurangkan|lagi|patut|mana satu|boleh tak)\b/;
const isWish = (clause: string) =>
  WISH.test(clause.toLowerCase()) &&
  !/^(how's|hows) the feng shui/.test(clause.toLowerCase());
