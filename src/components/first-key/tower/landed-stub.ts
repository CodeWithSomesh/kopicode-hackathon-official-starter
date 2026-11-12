import { Mesher, ROLES, type Role, type TowerParts } from "./tower-model";
import type { ThemeColors } from "../use-theme-colors";

/**
 * STAND-IN for exec-fk-landed's tower/landed-model.ts (same signature): plain landed homes until that lands, then
 * variants.ts swaps its one import. Frame: metres, origin at the footprint centre on the ground, x along the row (w),
 * z the depth (d) with the street front at +z, y up.
 */
export type LandedSpec = { type: string; storeys: number; style?: string; n?: number; w: number; d: number };

const STOREY = 3.3;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- same signature as landed-model.ts, which uses them
export function landedParts(spec: LandedSpec, colors: ThemeColors, night: boolean): TowerParts {
  const M = Object.fromEntries(ROLES.map((r) => [r, new Mesher()])) as Record<Role, Mesher>;
  const { storeys, w, d } = spec;
  const n = Math.max(1, spec.n ?? (spec.type === "semid" ? 2 : 1));
  const unit = w / n;
  const H = storeys * STOREY;
  const flat = spec.style === "flat" || spec.type === "clubhouse";
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + unit * (i + 0.5);
    const body = spec.type === "clubhouse" ? d * 0.6 : d - 5; // front garden / car porch zone
    const bz = d / 2 - 5 - body / 2;
    M.wall.box(cx, bz, unit - 0.15, body, 0, H);
    for (let s = 0; s < storeys; s++)
      for (const side of [bz + body / 2, bz - body / 2]) M.glass.box(cx, side, unit * 0.55, 0.12, s * STOREY + 0.9, s * STOREY + 2.6);
    M.frame.box(cx, d / 2 - 2.5, unit - 0.6, 5, 2.6, 2.85); // car-porch canopy
    if (flat) {
      M.roof.box(cx, bz, unit, body + 0.3, H, H + 0.3);
      M.frame.box(cx, bz + body / 2, unit, 0.2, H + 0.3, H + 1.1);
    } else gable(M.tile, cx, bz, unit + 0.4, body + 0.8, H, spec.style === "hip" ? 0.3 : 0);
  }
  if (spec.type === "clubhouse") {
    M.water.box(0, d / 2 - 2.5, w * 0.7, 4, 0, 0.25); // the pool in front
    M.frame.box(0, d / 2 - 2.5, w * 0.74, 4.8, 0, 0.12);
  }
  const out: TowerParts = {};
  for (const r of ROLES) {
    const g = M[r].geometry(r === "glass");
    if (g) out[r] = g;
  }
  return out;
}

/** A pitched roof, ridge along x, `hip` = share of the length the ends slope in (0 = gable). */
function gable(m: Mesher, cx: number, cz: number, w: number, d: number, y: number, hip: number) {
  const r = Math.min(3, d * 0.3); // ridge height
  const hx = w / 2;
  const hz = d / 2;
  const ix = hx - hip * w; // the ridge's half length
  const A = [cx - hx, y, cz + hz], B = [cx + hx, y, cz + hz], C = [cx + hx, y, cz - hz], D = [cx - hx, y, cz - hz];
  const R0 = [cx - ix, y + r, cz], R1 = [cx + ix, y + r, cz];
  const slope = Math.hypot(r, hz);
  m.poly([A, B, R1, R0], [0, hz / slope, r / slope], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  m.poly([C, D, R0, R1], [0, hz / slope, -r / slope], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const end = Math.hypot(r, hx - ix) || 1;
  m.poly([D, A, R0], [-(r / end) * (hip ? 1 : 0) - (hip ? 0 : 1), hip ? (hx - ix) / end : 0, 0], [[0, 0], [1, 0], [0.5, 1]]);
  m.poly([B, C, R1], [(r / end) * (hip ? 1 : 0) + (hip ? 0 : 1), hip ? (hx - ix) / end : 0, 0], [[0, 0], [1, 0], [0.5, 1]]);
  m.poly([A, D, C, B], [0, -1, 0], [[0, 0], [0, 1], [1, 1], [1, 0]]); // soffit
}
