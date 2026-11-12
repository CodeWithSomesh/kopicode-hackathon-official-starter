import { WALL_T, type FloorPlan, type Piece, type PlacedRoom, type Rect, type Wall } from "./layout";

// The floors that hold no flats: the ground-floor lobby, and a podium tower's car park and facilities floor.
// Plate metres, built at the real footprint size (the scene scales a plan by footprint / plan, here 1).
// x east, z south: the entrance and drop-off are on the south side.

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const piece = (x: number, z: number, y: number, sx: number, sy: number, sz: number, color: Piece["color"], r = 0.05): Piece => ({ x, z, y, sx, sy, sz, color, r });

/** The four outer walls (the south one with a gap [gx0, gx1] for the entrance, when given). */
function shell(w: number, d: number, gap?: [number, number]): Wall[] {
  const [hw, hd] = [w / 2 - WALL_T / 2, d / 2 - WALL_T / 2];
  const wl = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number): Wall => ({ x0, z0, x1, z1, nx, nz, outer: true, unit: -1 });
  const south: Wall[] = gap
    ? [wl(-hw, hd, gap[0], hd, 0, 1), wl(gap[1], hd, hw, hd, 0, 1)]
    : [wl(-hw, hd, hw, hd, 0, 1)];
  return [...south, wl(-hw, -hd, hw, -hd, 0, -1), wl(-hw, -hd, -hw, hd, -1, 0), wl(hw, -hd, hw, hd, 1, 0)];
}

const inner = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number): Wall => ({ x0, z0, x1, z1, nx, nz, outer: false, unit: -1 });
const rectOf = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });

const sofa = (out: Piece[], x: number, z: number, faceZ: 1 | -1) => {
  out.push(piece(x, z, 0, 2.2, 0.42, 0.8, "sofa"), piece(x, z - faceZ * 0.32, 0, 2.2, 0.85, 0.24, "sofa"));
  out.push(piece(x - 1.0, z, 0, 0.22, 0.6, 0.8, "sofa"), piece(x + 1.0, z, 0, 0.22, 0.6, 0.8, "sofa"));
};
const car = (out: Piece[], x: number, z: number, color: Piece["color"], alongZ = true) => {
  const [a, b] = alongZ ? [1.8, 4.2] : [4.2, 1.8];
  out.push(piece(x, z, 0.08, a, 0.62, b, color, 0.2), piece(x, z, 0.7, alongZ ? 1.55 : 2.3, 0.5, alongZ ? 2.3 : 1.55, "counterTop", 0.2));
};

/** Ground floor: entrance with a drop-off lane, lift core, mailboxes, guard counter, lounge seating; shops along the south wall on a serviced tower. */
export function planLobby(w: number, d: number, seed: number, retail = false): FloorPlan {
  const r = rng(seed * 131 + 5);
  const f: Piece[] = [];
  const hw = w / 2;
  const hd = d / 2;
  // Lift core on the north wall: a solid block with four lift doors on its south face.
  const coreD = Math.min(3, d * 0.2);
  const coreW = Math.min(7, w * 0.3);
  const coreZ = -hd + 0.4 + coreD / 2;
  f.push(piece(0, coreZ, 0, coreW, 2.4, coreD, "darkWood", 0.03));
  for (let i = 0; i < 4; i++) f.push(piece(-coreW / 2 + (coreW * (i + 0.5)) / 4, coreZ + coreD / 2 + 0.03, 0, coreW / 5, 2.0, 0.06, "counterTop", 0.02));
  // Guard counter by the entrance (east side), with a stool.
  const gz = retail ? hd - 5.6 : hd - 3.2;
  f.push(piece(4.8, gz, 0, 3.4, 1.05, 0.8, "counter"), piece(4.8, gz, 1.05, 3.5, 0.05, 0.95, "counterTop", 0.02), piece(4.8, gz + 0.9, 0, 0.4, 0.55, 0.4, "chair"));
  // Mailboxes on the west wall, near the entrance.
  const mz = retail ? 0 : hd - 4.5;
  f.push(piece(-hw + 0.45, mz, 0, 0.3, 1.5, 3.4, "counterTop", 0.02));
  for (let i = 0; i < 6; i++) f.push(piece(-hw + 0.62, mz - 1.4 + i * 0.55, 0.45, 0.04, 0.3, 0.4, "darkWood", 0.01));
  // Lounge: rug, two sofas facing each other, a coffee table and planters.
  const lx = Math.min(hw - 4.5, w * 0.28);
  const lz = Math.min(0, -hd * 0.05);
  f.push(piece(lx, lz, 0, 4.4, 0.02, 3.6, "rug", 0.01));
  sofa(f, lx, lz - 1.1, 1);
  sofa(f, lx, lz + 1.1, -1);
  f.push(piece(lx, lz, 0, 1.2, 0.4, 0.7, "darkWood"));
  for (const px of [-hw + 1.2, lx + 2.6]) f.push(piece(px, -hd + 1.0 + r() * 0.3, 0, 0.5, 0.9, 0.5, "darkWood"), piece(px, -hd + 1.0, 0.9, 0.7, 0.7, 0.7, "blanket2", 0.3));
  // Drop-off lane outside the entrance, with a car pulled up.
  f.push(piece(0, hd + 2.4, -0.04, Math.min(w, 16), 0.05, 3.4, "corridor", 0.01));
  car(f, -2.5, hd + 2.4, "blanket", false);
  const lobby: PlacedRoom = { id: "lobi", rect: { x0: -hw, z0: -hd, x1: hw, z1: hd } };
  const rooms = [lobby];
  const walls = shell(w, d, [-2.2, 2.2]);
  if (retail) {
    // Shop frontages along the south wall, either side of the entrance: a counter and shelves in each.
    const sd = 4.2;
    const zc = hd - sd / 2;
    for (const side of [-1, 1]) {
      const span = hw - 6.5;
      const n = Math.max(1, Math.floor(span / 4.4));
      const sw = span / n;
      for (let i = 0; i < n; i++) {
        const cx = side * (6.5 + sw * (i + 0.5));
        rooms.push({ id: "kedai", rect: rectOf(cx, zc, sw, sd) });
        f.push(piece(cx, zc - 0.4, 0, sw * 0.6, 1.0, 0.6, "counter"), piece(cx, hd - 0.45, 0, sw - 0.5, 1.8, 0.4, "darkWood", 0.03), piece(cx, zc + 0.4, 0, 0.9, 0.9, 0.9, "table", 0.1));
        walls.push(inner(cx - sw / 2, hd - sd, cx - sw / 2, hd, -1, 0));
      }
      walls.push(inner(side * 6.5, hd - sd, side * 6.5, hd - 0.1, -side, 0), inner(side * 6.5, hd - sd, side * hw, hd - sd, 0, -1));
    }
  }
  return { w, d, units: [{ index: -1, rect: lobby.rect, rooms, furniture: f }], walls };
}

/** Gym (north half) and function room (south half) in a block `fx` wide at the east end; walls partition it off. */
function facilities(f: Piece[], w: number, d: number, fx: number) {
  const [hw, hd] = [w / 2, d / 2];
  const wx = hw - fx;
  for (let i = 0; i < 4; i++) f.push(piece(wx + 1.6 + i * 1.7, -hd + 1.8, 0, 0.8, 1.2, 1.7, "darkWood", 0.06), piece(wx + 1.6 + i * 1.7, -hd + 1.0, 1.0, 0.7, 0.5, 0.06, "counterTop", 0.02));
  f.push(piece(hw - fx / 2, -1.6, 0, fx - 3, 0.5, 1.2, "bed", 0.1), piece(hw - fx / 2, -3.2, 0, fx - 2, 0.02, 2.4, "rug", 0.01));
  for (const tx of [-0.25, 0.25])
    for (const tz of [0.3, 0.75]) {
      const x = hw - fx / 2 + tx * fx;
      const z = hd * tz + 0.2;
      f.push(piece(x, z, 0, 1.6, 0.75, 1.6, "table", 0.3));
      for (const [cx, cz] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]]) f.push(piece(x + cx, z + cz, 0, 0.42, 0.46, 0.4, "chair"));
    }
  return {
    wx,
    rooms: [{ id: "gim", rect: rectOf(hw - fx / 2, -hd / 2, fx, d / 2) }, { id: "dewan", rect: rectOf(hw - fx / 2, hd / 2, fx, d / 2) }],
    walls: [inner(wx, -hd, wx, -0.8, -1, 0), inner(wx, 0.8, wx, hd, -1, 0), inner(wx, -0.02, hw, 0.02, 0, 1)],
  };
}

/** Podium floor 2: car park (bays, aisle, some cars) with a gym and a function room at the east end. */
export function planCarPark(w: number, d: number, seed: number): FloorPlan {
  const r = rng(seed * 977 + 3);
  const f: Piece[] = [];
  const [hw, hd] = [w / 2, d / 2];
  const fx = Math.min(10, w * 0.32);
  const px0 = -hw + 1.2;
  const bays = Math.max(2, Math.floor((hw - fx - 0.8 - px0) / 2.6));
  const bayLen = Math.min(5, (d - 5.5) / 2);
  const colours: Piece["color"][] = ["blanket", "blanket2", "sofa", "cushion", "fridge", "darkWood", "bed"];
  for (const side of [-1, 1]) {
    const zc = side * (hd - 0.6 - bayLen / 2);
    for (let i = 0; i <= bays; i++) f.push(piece(px0 + i * 2.6, zc, 0, 0.08, 0.02, bayLen, "counterTop", 0.01));
    for (let i = 0; i < bays; i++) if (r() < 0.62) car(f, px0 + (i + 0.5) * 2.6, zc, colours[Math.floor(r() * colours.length)]);
  }
  const fac = facilities(f, w, d, fx);
  const carpark: Rect = { x0: -hw, z0: -hd, x1: fac.wx, z1: hd };
  return { w, d, units: [{ index: -1, rect: carpark, rooms: [{ id: "parkir", rect: carpark }, ...fac.rooms], furniture: f }], walls: [...shell(w, d), ...fac.walls] };
}

/** A facilities deck (Level 6, Level 30): pool with loungers and planters, plus the gym and function room. */
export function planDeck(w: number, d: number): FloorPlan {
  const f: Piece[] = [];
  const [hw, hd] = [w / 2, d / 2];
  const fx = Math.min(10, w * 0.32);
  const wx = hw - fx;
  const cx = (-hw + wx) / 2;
  const pw = Math.min(16, wx + hw - 4);
  const pd = Math.min(5.5, d * 0.3);
  f.push(piece(cx, -1, -0.02, pw + 1.6, 0.04, pd + 1.6, "counterTop", 0.02), piece(cx, -1, 0, pw, 0.06, pd, "water", 0.02));
  for (let i = 0; i < 5; i++) f.push(piece(cx - pw / 2 + 1.4 + i * 1.5, -1 + pd / 2 + 1.6, 0, 0.7, 0.35, 1.8, "chair", 0.08));
  for (const px of [-hw + 1.2, wx - 1.2]) for (const pz of [-hd + 1.2, hd - 1.2]) f.push(piece(px, pz, 0, 0.5, 0.8, 0.5, "darkWood"), piece(px, pz, 0.8, 0.8, 0.8, 0.8, "blanket2", 0.3));
  f.push(piece(cx, hd - 2.0, 0, 3.4, 0.45, 1.0, "darkWood"), piece(cx, hd - 2.0, 0.45, 3.2, 0.1, 0.8, "cushion", 0.05)); // pavilion bench
  const fac = facilities(f, w, d, fx);
  const deck: Rect = { x0: -hw, z0: -hd, x1: fac.wx, z1: hd };
  return { w, d, units: [{ index: -1, rect: deck, rooms: [{ id: "dek", rect: deck }, ...fac.rooms], furniture: f }], walls: [...shell(w, d), ...fac.walls] };
}
