import { isOpenAir, type Group, type House } from "@/lib/first-key/landed";
import { landedFrame, type LandedSpec } from "../tower/landed-model";
import { WALL_T, furnish, type FloorPlan, type PlacedRoom, type PlacedUnit, type Piece, type Wall } from "./layout";

/**
 * One storey of a landed group (a terrace row, a pair, a bungalow) as the FloorPlan the burst's InteriorMeshes already
 * draws. Frame = the model's: metres, origin at the centre of the group's w x d footprint, x along the row, z south (the
 * front, porch and street at +z). House plans are in their own lot frame, whose x runs the same way as the model's
 * (see landed.ts), so a house's body maps by a plain shift; house i of the group sits at the west end first, or at the east end first when the
 * group is `reversed` (the enclave's heading-180 groups).
 */
export function landedPlan(spec: LandedSpec, group: Group, houses: House[], storey: number): FloorPlan {
  const { bd, front } = landedFrame(spec);
  const zN = spec.d / 2 - front - bd; // north edge of the body
  const n = houses.length;
  const units: PlacedUnit[] = [];
  const walls: Wall[] = [];
  houses.forEach((h, i) => {
    const g0 = h.storeys[0].body;
    const st = h.storeys[Math.min(storey, h.storeys.length - 1)];
    const xW = !group.reversed ? -spec.w / 2 + i * g0.w : spec.w / 2 - (i + 1) * g0.w; // west edge of this house's body
    const X = (x: number) => xW + (x - g0.x);
    const Z = (y: number) => zN + (y - g0.y);
    // neighbours (party walls) on the model's west / east side
    const west = !group.reversed ? i > 0 : i < n - 1;
    const east = !group.reversed ? i < n - 1 : i > 0;
    const rooms: PlacedRoom[] = [];
    const furniture: Piece[] = [];
    const u = units.length;
    for (const r of st.rooms) {
      if (isOpenAir(r)) continue;
      const xs = r.polygon.map((p) => p[0]);
      const ys = r.polygon.map((p) => p[1]);
      const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      rooms.push({ id: r.id, rect: { x0: X(x0), z0: Z(y0), x1: X(x1), z1: Z(y1) } });
      for (const f of furnish(r.id, x0 - g0.x, y0 - g0.y, x1 - x0, y1 - y0))
        furniture.push({ x: X(f.lx + g0.x), z: Z(f.ly + g0.y), y: f.y, sx: f.sx, sy: f.sy, sz: f.sz, color: f.color, r: f.r });
      // walls on each room edge, inset half a wall so neighbouring rooms make a double wall
      const b = st.body;
      const eps = 1e-6;
      const edges: [number, number, number, number, number, number, boolean][] = [
        [x0, y0, x1, y0, 0, -1, Math.abs(y0 - b.y) < eps],
        [x0, y1, x1, y1, 0, 1, Math.abs(y1 - (b.y + b.d)) < eps],
        [x0, y0, x0, y1, -1, 0, Math.abs(x0 - b.x) < eps && !west],
        [x1, y0, x1, y1, 1, 0, Math.abs(x1 - (b.x + b.w)) < eps && !east],
      ];
      const door = storey === 0 && (r.id === "foyer" || (r.id === "ruang_tamu" && !st.rooms.some((q) => q.id === "foyer")));
      for (const [ax, ay, bx, by, nx, nz, outer] of edges) {
        const h2 = WALL_T / 2;
        const [a0, a1] = [X(ax) - nx * h2, Z(ay) - nz * h2];
        const [b0, b1] = [X(bx) - nx * h2, Z(by) - nz * h2];
        const wall = { nx, nz, outer, unit: u };
        if (door && nz === 1) {
          // the front door: a gap in the front wall, at the room's western third
          const g = Math.min(a0, b0) + (Math.abs(b0 - a0) - 1) * 0.35;
          walls.push({ x0: Math.min(a0, b0), z0: a1, x1: g, z1: b1, ...wall }, { x0: g + 1, z0: a1, x1: Math.max(a0, b0), z1: b1, ...wall });
        } else walls.push({ x0: a0, z0: a1, x1: b0, z1: b1, ...wall });
      }
    }
    units.push({ index: i, rect: { x0: xW, z0: zN, x1: xW + g0.w, z1: zN + g0.d }, rooms, furniture });
  });
  return { w: spec.w, d: bd, units, walls };
}
