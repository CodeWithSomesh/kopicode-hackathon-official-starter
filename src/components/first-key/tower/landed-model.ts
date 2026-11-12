import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ROOF, STOREY_H, type Group, type RoofStyle } from "@/lib/first-key/landed";
import { parseVariant } from "@/lib/first-key/site-layout";
import type { ThemeColors } from "../use-theme-colors";
import { Mesher } from "./tower-model";

/**
 * Low-rise landed buildings and the clubhouse as procedural geometry: a terrace row, a semi-D pair, a bungalow, a clubhouse
 * with its deck and pool. Same conventions as towerParts: metres, x east, y up, z south, the footprint centred on the origin,
 * indexed geometry (Mapbox's glTF decoder needs it), one geometry per material role. The front facade, car porch and balconies
 * face +z (south); rotate the model for other headings. `spec.w` x `spec.d` is the whole footprint, as site-layout.ts places it:
 * the car porch (or the clubhouse deck and pool) takes the front 6 m (or 45% of the depth, at most 12 m) of `d`, the body
 * sits behind it, and any depth left over at the back is garden. The origin is the centre of that w x d rectangle. Windows are flat quads (frame quad under glass panes), not boxes:
 * that keeps a seven-house row near 50 KB as a .glb.
 */

export type LRole = "glass" | "frame" | "wall" | "tile" | "water" | "green" | "roof" | "rail";
export const LROLES: LRole[] = ["glass", "frame", "wall", "tile", "green", "water", "roof", "rail"]; // rail last: it is see-through
export type LandedType = "terrace" | "superlink" | "link" | "townhouse" | "cluster" | "semid" | "bungalow" | "clubhouse";
/** `n` units along the row; `w` the whole building's width along the row and `d` its body depth (the porch comes on top). */
export type LandedSpec = { type: LandedType; storeys: number; style?: string; n?: number; w: number; d: number };
export type LandedRange = { from: number; to: number; roof: boolean };

type V = number[];
const DEFAULT_STYLE: Record<LandedType, RoofStyle> = { terrace: "gable", superlink: "hip", link: "gable", townhouse: "flat", cluster: "hip", semid: "prairie", bungalow: "hip", clubhouse: "flat" };
const DEFAULT_N: Record<LandedType, number> = { terrace: 6, superlink: 4, link: 4, townhouse: 6, cluster: 4, semid: 2, bungalow: 1, clubhouse: 1 };
const PORCH: Record<LandedType, number> = { terrace: 6, superlink: 6, link: 6, townhouse: 0, cluster: 0, semid: 6, bungalow: 6, clubhouse: 0 };
/** Deepest body a type builds; a deeper footprint is rear garden. */
const MAX_BODY: Record<LandedType, number> = { terrace: 13.5, superlink: 15, link: 13.5, townhouse: 15, cluster: 20, semid: 14, bungalow: 14, clubhouse: 16 };
const ROW: LandedType[] = ["terrace", "superlink", "townhouse", "cluster"]; // one continuous body and roof; the others get a roof per unit
const U0 = [0, 0], U1 = [1, 0], U2 = [1, 1], U3 = [0, 1];

/** An axis-aligned box. Built round its own centre (Mesher.prism decides "outward" from the origin), then moved into place. */
function box(m: Mesher, cx: number, cz: number, w: number, d: number, y0: number, y1: number, caps: { top?: boolean; bottom?: boolean } = { top: true }) {
  if (y1 - y0 < 1e-3 || w < 1e-3 || d < 1e-3) return;
  const t = new Mesher();
  t.prism([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], y0, y1, caps);
  m.append(t, cx, cz);
}

/** A flat polygon (3 or 4 points) facing away from `centre`. */
function face(m: Mesher, pts: V[], centre: V) {
  const [a, b, c] = pts;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  n = n.map((x) => x / l);
  const mid = [0, 1, 2].map((k) => pts.reduce((t, p) => t + p[k], 0) / pts.length - centre[k]);
  if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0) n = n.map((x) => -x);
  m.poly(pts, n, pts.length === 4 ? [U0, U1, U2, U3] : [U0, U1, U2]);
}

// ---------- facades ----------

/** A wall seen from outside: `at(s, y, off)` is the point s metres along it, y up, off metres out of the wall. */
type Wall = { len: number; at: (s: number, y: number, off?: number) => V; n: V };
const wall = (ox: number, oz: number, ux: number, uz: number, nx: number, nz: number, len: number): Wall => ({
  len,
  n: [nx, 0, nz],
  at: (s, y, off = 0) => [ox + ux * s + nx * off, y, oz + uz * s + nz * off],
});
function quad(m: Mesher, w: Wall, s0: number, s1: number, y0: number, y1: number, off: number) {
  m.poly([w.at(s0, y0, off), w.at(s1, y0, off), w.at(s1, y1, off), w.at(s0, y1, off)], w.n, [U0, U1, U2, U3]);
}
type Opening = { s0: number; s1: number; y0: number; y1: number; door?: boolean };
/** A window: a frame quad under one or two glass panes. A door is a solid frame-coloured leaf. */
function opening(M: Record<LRole, Mesher>, w: Wall, o: Opening) {
  const e = o.door ? 0.04 : 0.07;
  quad(M.frame, w, o.s0 - e, o.s1 + e, Math.max(0, o.y0 - e), o.y1 + e, 0.015);
  if (o.door) return;
  if (o.s1 - o.s0 > 1.5) {
    const mid = (o.s0 + o.s1) / 2;
    quad(M.glass, w, o.s0, mid - 0.03, o.y0, o.y1, 0.03);
    quad(M.glass, w, mid + 0.03, o.s1, o.y0, o.y1, 0.03);
  } else quad(M.glass, w, o.s0, o.s1, o.y0, o.y1, 0.03);
}

/** `n` windows spread over `len` metres, each at most `max` wide. */
const spread = (len: number, n: number, max: number, y0: number, y1: number): Opening[] =>
  Array.from({ length: n }, (_, i) => {
    const c = ((i + 0.5) / n) * len;
    const hw = Math.min(max, (0.62 * len) / n) / 2;
    return { s0: c - hw, s1: c + hw, y0, y1 };
  });

/** Front and rear openings of one unit, `uw` wide, on storey `fl` (0 = ground). */
function unitOpenings(type: LandedType, uw: number, fl: number, porch: boolean) {
  const big = uw > 8;
  let front: Opening[];
  if (fl === 0) {
    if (type === "townhouse") front = [{ s0: 0.1 * uw, s1: 0.58 * uw, y0: 0, y1: 2.2, door: true }, { s0: 0.68 * uw, s1: 0.78 * uw, y0: 0, y1: 2.2, door: true }];
    else if (porch)
      front = big
        ? [{ s0: 0.08 * uw, s1: 0.2 * uw, y0: 0, y1: 2.2, door: true }, ...spread(0.7 * uw, 2, 2.4, 0.2, 2.3).map((o) => ({ ...o, s0: o.s0 + 0.26 * uw, s1: o.s1 + 0.26 * uw }))]
        : [{ s0: 0.06 * uw, s1: 0.33 * uw, y0: 0.9, y1: 2.1 }, { s0: 0.43 * uw, s1: 0.58 * uw, y0: 0, y1: 2.2, door: true }, { s0: 0.66 * uw, s1: 0.94 * uw, y0: 0.2, y1: 2.3 }];
    else front = spread(uw, Math.max(2, Math.round(uw / 3)), 2, 0.9, 2.2);
  } else front = big ? spread(uw, Math.max(3, Math.round(uw / 3)), 2.2, 0.9, 2.2) : [{ s0: 0.06 * uw, s1: 0.62 * uw, y0: porch ? 0.2 : 0.9, y1: porch ? 2.3 : 2.2 }, { s0: 0.7 * uw, s1: 0.92 * uw, y0: 0.9, y1: 2.1 }];
  const rear: Opening[] =
    fl === 0 ? [{ s0: 0.1 * uw, s1: 0.33 * uw, y0: 1.0, y1: 2.1 }, { s0: 0.45 * uw, s1: 0.58 * uw, y0: 0, y1: 2.2, door: true }, { s0: 0.68 * uw, s1: 0.92 * uw, y0: 1.0, y1: 2.1 }] : spread(uw, big ? 3 : 2, 1.7, 0.9, 2.1);
  return { front, rear };
}

// ---------- roofs ----------

/** A gable roof, ridge along x: two slopes and, when `ends`, gable triangles. */
function gable(M: Record<LRole, Mesher>, w: number, d: number, y: number) {
  const { ov, pitch } = ROOF.gable;
  const hd = d / 2 + ov;
  const xe = w / 2 + 0.3;
  const rise = hd * Math.tan((pitch * Math.PI) / 180);
  const c = [0, y + rise / 2, 0];
  face(M.tile, [[-xe, y, hd], [xe, y, hd], [xe, y + rise, 0], [-xe, y + rise, 0]], c);
  face(M.tile, [[-xe, y, -hd], [xe, y, -hd], [xe, y + rise, 0], [-xe, y + rise, 0]], c);
  for (const sx of [-1, 1]) face(M.wall, [[sx * xe, y, -hd], [sx * xe, y, hd], [sx * xe, y + rise, 0]], c);
  for (const sz of [-1, 1]) box(M.frame, 0, sz * hd, 2 * xe, 0.12, y - 0.16, y + 0.06, {}); // eave fascia
}

/** A hip roof over a w x d body, any pitch; `fascia` adds a deep band round the eaves (prairie). */
function hip(M: Record<LRole, Mesher>, cx: number, cz: number, w: number, d: number, y: number, style: "hip" | "prairie") {
  const { ov, pitch } = ROOF[style];
  const [W, D] = [w + 2 * ov, d + 2 * ov];
  const s = Math.min(W, D) / 2;
  const rise = s * Math.tan((pitch * Math.PI) / 180);
  const L = Math.abs(W - D) / 2;
  const alongX = W >= D;
  const [rx, rz] = alongX ? [L, 0] : [0, L];
  const R1 = [cx - rx, y + rise, cz - rz], R2 = [cx + rx, y + rise, cz + rz];
  const c = [cx, y + rise / 2, cz];
  const C = (sx: number, sz: number) => [cx + (sx * W) / 2, y, cz + (sz * D) / 2];
  if (alongX) {
    face(M.tile, [C(-1, 1), C(1, 1), R2, R1], c);
    face(M.tile, [C(-1, -1), C(1, -1), R2, R1], c);
    face(M.tile, [C(1, -1), C(1, 1), R2], c);
    face(M.tile, [C(-1, -1), C(-1, 1), R1], c);
  } else {
    face(M.tile, [C(-1, 1), C(1, 1), R2], c);
    face(M.tile, [C(-1, -1), C(1, -1), R1], c);
    face(M.tile, [C(1, -1), C(1, 1), R2, R1], c);
    face(M.tile, [C(-1, -1), C(-1, 1), R2, R1], c);
  }
  const band = style === "prairie" ? 0.3 : 0.12;
  for (const sz of [-1, 1]) box(M.frame, cx, cz + (sz * D) / 2, W, 0.14, y - band, y + 0.04, {});
  for (const sx of [-1, 1]) box(M.frame, cx + (sx * W) / 2, cz, 0.14, D, y - band, y + 0.04, {});
}

/** A flat roof: slab and parapet. */
function flat(M: Record<LRole, Mesher>, cx: number, cz: number, w: number, d: number, y: number, ov: number) {
  box(M.roof, cx, cz, w + 2 * ov, d + 2 * ov, y, y + 0.25);
  const [W, D] = [w + 2 * ov, d + 2 * ov];
  for (const sz of [-1, 1]) box(M.frame, cx, cz + (sz * D) / 2, W, 0.18, y + 0.25, y + 0.75);
  for (const sx of [-1, 1]) box(M.frame, cx + (sx * W) / 2, cz, 0.18, D - 0.36, y + 0.25, y + 0.75);
}

// ---------- the building ----------

/** The model spec of one placed group (a terrace row, a pair, a bungalow) or the clubhouse, from its variant key and footprint. */
export function groupSpec(g: Pick<Group, "variant" | "w" | "d"> & { houses?: string[] }): LandedSpec {
  const v = parseVariant(g.variant);
  return { type: v.type as LandedType, storeys: v.storeys, style: v.style, n: g.houses?.length ?? v.n, w: g.w, d: g.d };
}

/** Where the body sits inside the w x d footprint (front-aligned): porch or deck depth, body depth, body centre z. */
export function landedFrame(spec: LandedSpec) {
  const front = spec.type === "clubhouse" ? Math.min(12, 0.45 * spec.d) : Math.min(PORCH[spec.type], 0.4 * spec.d);
  const bd = Math.min(spec.d - front, MAX_BODY[spec.type]);
  return { front, bd, zc: spec.d / 2 - front - bd / 2 };
}

export function landedParts(spec: LandedSpec, _colors?: ThemeColors, _night?: boolean, range?: LandedRange): Partial<Record<LRole, THREE.BufferGeometry>> {
  void _colors; // geometry carries no colour; landedMaterials(colors, night) does
  void _night;
  const { type, w } = spec;
  const H = STOREY_H;
  const { front, bd: d, zc } = landedFrame(spec); // porch or deck depth, body depth, body centre z
  const style = (ROOF[spec.style as RoofStyle] ? (spec.style as RoofStyle) : DEFAULT_STYLE[type]) as RoofStyle;
  const n = spec.n ?? DEFAULT_N[type];
  const uw = w / n;
  const top = spec.storeys;
  const from = range?.from ?? 0;
  const to = range?.to ?? top;
  const roofOn = (range?.roof ?? true) && to >= top;
  const M = Object.fromEntries(LROLES.map((r) => [r, new Mesher()])) as Record<LRole, Mesher>;

  if (type === "clubhouse") clubhouse(M, w, d, front, top, from, to, roofOn);
  else {
    const porchD = front;
    const pavilion = type === "bungalow" && top >= 3; // the top level is a lounge pavilion on the first-floor roof
    const dims = (fl: number): [number, number] => (pavilion && fl === top - 1 ? [w, d / 2] : [w, d]);
    const [x0, x1, zF] = [-w / 2, w / 2, d / 2];
    for (let fl = from; fl < to; fl++) {
      const y0 = fl * H;
      const y1 = y0 + H;
      const [bw, bd] = dims(fl);
      M.wall.prism([[-bw / 2, -bd / 2], [bw / 2, -bd / 2], [bw / 2, bd / 2], [-bw / 2, bd / 2]], y0, y1, { top: false, bottom: fl === from });
      if (fl < top - 1) box(M.frame, 0, 0, bw + 0.12, bd + 0.12, y1 - 0.22, y1, {}); // band course between storeys
      const zf = bd / 2; // front/rear wall planes of this storey
      const fw = wall(-bw / 2, zf, 1, 0, 0, 1, bw);
      const rw = wall(bw / 2, -zf, -1, 0, 0, -1, bw);
      for (let i = 0; i < n; i++) {
        const { front, rear } = unitOpenings(type, bw / n, fl, porchD > 0);
        for (const o of front) opening(M, fw, { ...o, s0: o.s0 + i * (bw / n), s1: o.s1 + i * (bw / n), y0: o.y0 + y0, y1: o.y1 + y0 });
        for (const o of rear) opening(M, rw, { ...o, s0: o.s0 + i * (bw / n), s1: o.s1 + i * (bw / n), y0: o.y0 + y0, y1: o.y1 + y0 });
      }
      // side windows on the building's two ends
      const sideN = Math.max(1, Math.round(bd / 4));
      for (const sx of [-1, 1]) {
        const sw = sx === 1 ? wall(bw / 2, -bd / 2, 0, 1, 1, 0, bd) : wall(-bw / 2, bd / 2, 0, -1, -1, 0, bd);
        for (const o of spread(bd, sideN, 1.3, 0.9, 2.1)) opening(M, sw, { ...o, y0: o.y0 + y0, y1: o.y1 + y0 });
      }
      // balconies on every upper storey of the stacked types
      if (fl > 0 && (type === "townhouse" || type === "cluster")) {
        for (let i = 0; i < n; i++) {
          const cx = x0 + (i + 0.5) * uw;
          box(M.frame, cx, zf + 0.7, uw - 0.5, 1.4, y0 - 0.2, y0, {});
          box(M.rail, cx, zf + 1.38, uw - 0.5, 0.04, y0, y0 + 1.0);
        }
      }
    }
    // car porch: posts and dividing walls on the ground storey, the canopy slab that is the balcony floor, its glass rail
    if (porchD > 0) {
      const zp = zF + porchD;
      const unitSpan: [number, number][] = ROW.includes(type) ? [[x0, x1]] : type === "bungalow" ? [[x0, x0 + 8]] : Array.from({ length: n }, (_, i) => [x0 + i * uw, x0 + (i + 1) * uw] as [number, number]);
      for (const [a, b] of unitSpan) {
        if (from <= 0 && to > 0) {
          box(M.frame, (a + b) / 2, zF + porchD / 2, b - a, porchD, H - 0.2, H, { top: true, bottom: true });
          for (const px of ROW.includes(type) ? Array.from({ length: n + 1 }, (_, i) => x0 + i * uw) : [a + 0.2, b - 0.2]) box(M.frame, px, zp - 0.2, 0.25, 0.25, 0, H - 0.2);
        }
        if (from <= 1 && to > 1 && top > 1) {
          box(M.rail, (a + b) / 2, zp - 0.04, b - a - 0.3, 0.04, H, H + 1.05);
          box(M.frame, (a + b) / 2, zp - 0.04, b - a - 0.3, 0.1, H + 1.05, H + 1.13);
        }
      }
      if (ROW.includes(type) && from <= 0 && to > 0) for (let i = 0; i <= n; i++) box(M.wall, x0 + i * uw, zF + porchD / 2, 0.15, porchD, 0, 1.1); // porch dividing walls
    }
    // roof
    if (roofOn) {
      const yT = top * H;
      if (pavilion) {
        // first-floor roof terrace with a glass balustrade, and the lounge's hip roof
        const yL = (top - 1) * H;
        box(M.roof, 0, 0, w + 0.4, d + 0.4, yL, yL + 0.25);
        const [W, D] = [w + 0.4, d + 0.4];
        for (const sz of [-1, 1]) box(M.rail, 0, (sz * D) / 2, W, 0.04, yL + 0.25, yL + 1.2);
        for (const sx of [-1, 1]) box(M.rail, (sx * W) / 2, 0, 0.04, D, yL + 0.25, yL + 1.2);
        hip(M, 0, 0, w, d / 2, yT, "hip");
      } else if (style === "gable") gable(M, w, d, yT);
      else if (style === "flat") flat(M, 0, 0, w, d, yT, ROOF.flat.ov);
      else if (ROW.includes(type)) hip(M, 0, 0, w, d, yT, style);
      else for (let i = 0; i < n; i++) hip(M, x0 + (i + 0.5) * uw, 0, uw, d, yT, style);
    }
  }
  const out: Partial<Record<LRole, THREE.BufferGeometry>> = {};
  for (const k of LROLES) {
    for (let i = 2; i < M[k].pos.length; i += 3) M[k].pos[i] += zc;
    const g = M[k].geometry(false);
    if (g) out[k] = g;
  }
  return out;
}

/** Two storeys: a glazed ground floor with posts, a solid upper floor with ribbon windows, a deep flat roof, a deck and a raised pool. */
function clubhouse(M: Record<LRole, Mesher>, w: number, d: number, deckD: number, top: number, from: number, to: number, roofOn: boolean) {
  const H = STOREY_H;
  const rect: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  for (let fl = from; fl < to; fl++) {
    const y0 = fl * H;
    if (fl === 0) {
      M.glass.prism(rect, y0, y0 + H - 0.4, { top: false, bottom: false });
      box(M.wall, 0, 0, w + 0.1, d + 0.1, y0 + H - 0.4, y0 + H, { bottom: true });
      for (const sz of [-1, 1]) for (let i = 0; i <= 5; i++) box(M.frame, -w / 2 + (i * w) / 5, (sz * d) / 2, 0.4, 0.4, y0, y0 + H - 0.4);
    } else {
      M.wall.prism(rect, y0, y0 + H, { top: false, bottom: false });
      const wf = wall(-w / 2, d / 2, 1, 0, 0, 1, w);
      const wr = wall(w / 2, -d / 2, -1, 0, 0, -1, w);
      for (const wl of [wf, wr]) for (const o of spread(w, 4, 3.4, 0.7, 2.4)) opening(M, wl, { ...o, y0: o.y0 + y0, y1: o.y1 + y0 });
    }
  }
  if (roofOn && to >= top) flat(M, 0, 0, w, d, top * H, 1.2);
  if (from <= 0) {
    // deck in front, then the pool (raised, with a coping), hedges either side
    const pd = Math.max(3, deckD - 5); // pool depth
    const zd = d / 2 + 2.2 + pd / 2;
    box(M.wall, 0, d / 2 + deckD / 2, w + 2, deckD, 0, 0.25);
    box(M.water, 0, zd, w * 0.72, pd, 0.25, 0.3);
    for (const sz of [-1, 1]) box(M.frame, 0, zd + (sz * pd) / 2, w * 0.72 + 0.4, 0.2, 0.25, 0.42, {});
    for (const sx of [-1, 1]) box(M.frame, (sx * w * 0.72) / 2, zd, 0.2, pd, 0.25, 0.42, {});
    for (const sx of [-1, 1]) box(M.green, sx * (w / 2 + 0.6), d / 2 + deckD / 2, 0.8, deckD, 0.25, 1.2);
  }
}

/** Every part in one geometry: the burst's picked-colour overlay covers exactly the building. */
export function wholeLanded(parts: Partial<Record<LRole, THREE.BufferGeometry>>) {
  const gs = Object.values(parts).filter(Boolean) as THREE.BufferGeometry[];
  return gs.length ? mergeGeometries(gs, false) : null;
}

// ---------- materials ----------

const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Plain core-glTF PBR for the map; `physical` adds clearcoat to the glass for the burst. */
export function landedMaterials(colors: ThemeColors, night: boolean, physical = false): Record<LRole, THREE.Material> {
  const solid = (color: string, roughness: number) => new THREE.MeshStandardMaterial({ color, roughness });
  const glassOpts = { color: night ? "#26303f" : "#7f98a9", roughness: 0.15, metalness: 0.1, ...(night ? { emissive: "#ffc77a", emissiveIntensity: 0.35 } : {}) };
  return {
    wall: solid(night ? mix(colors.card, "#8a8076", 0.45) : mix(colors.muted, "#f1e8da", 0.55), 0.9),
    tile: solid(night ? mix(colors.primary, colors.background, 0.55) : mix(colors.primary, "#c4673f", 0.55), 0.8),
    roof: solid(night ? "#4d525a" : "#d9d3c9", 0.85),
    frame: solid(night ? "#575c66" : "#f5f0e8", 0.6),
    glass: physical ? new THREE.MeshPhysicalMaterial({ ...glassOpts, clearcoat: 1, clearcoatRoughness: 0.05 }) : new THREE.MeshStandardMaterial(glassOpts),
    water: new THREE.MeshStandardMaterial({ color: night ? "#1d5f78" : "#4fb3c9", roughness: 0.05, ...(night ? { emissive: "#2aa0c0", emissiveIntensity: 0.25 } : {}) }),
    green: solid(night ? "#2f4a33" : "#6f9a5a", 1),
    rail: new THREE.MeshStandardMaterial({ color: night ? mix(colors["chart-3"], colors.background, 0.5) : mix(colors["chart-3"], "#ffffff", 0.45), roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }),
  };
}
