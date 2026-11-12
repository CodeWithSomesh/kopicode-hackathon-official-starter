import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Building } from "@/lib/first-key/types";
import type { ThemeColors } from "../use-theme-colors";
import { FLOOR_H } from "../burst/layout";

/**
 * One procedural condo tower, shared by the burst (R3F) and the map (exported to glTF for Mapbox's model layer), so the
 * map tower and the burst's first frame are the same geometry. Big rhythm is geometry (slab bands, columns, fins,
 * balconies, podium, crown): it survives at map distance, where a window texture turns to haze. Small rhythm (panes,
 * mullions, curtains) is a canvas texture drawn from theme tokens. Units: metres, x east, y up, z south (three/glTF).
 */

export type Facade = "curtain" | "columns" | "balcony" | "fins";
export type Crown = "plant" | "frame";
export type Role = "glass" | "frame" | "podium" | "wall" | "sign" | "water" | "green" | "roof" | "tile" | "rail";
/** Geometry per material role: what towerParts returns, and what tower/landed-model.ts' landedParts returns too. */
export type TowerParts = Partial<Record<Role, THREE.BufferGeometry>>;
const TEXTURED: Role[] = ["glass"]; // only these keep UVs
export type Design = {
  facade: Facade;
  crown: Crown;
  setback: boolean;
  /** "retail": shopfronts behind a five-foot-way arcade with a signage band (Maya Bay's podium of shops); "plain": lobby + car park. */
  podium?: "retail" | "plain";
  /** Storeys (L-numbers, 1 = ground) drawn as an open facilities deck instead of flats (North Woods' L6 and L30). */
  decks?: number[];
  /** Map-only level of detail for spawned site buildings (never the burst): one glass shaft instead of a prism per floor,
   * capless slab bands, balcony slabs without rails, fins at twice the spacing. About half the bytes. */
  lod?: boolean;
};

// The Cove block: 5 towers in the north row. a-c after Maya Bay Residences (3 serviced-apartment towers on a retail
// podium), d-e after North Woods Residences (2 blocks with facilities decks). Neighbours differ in facade or crown.
// ponytail: deck storeys are placeholders until exec-fk-plans sends the real ones; edit `decks` here.
const DESIGNS: Record<string, Design> = {
  a: { facade: "balcony", crown: "frame", setback: false, podium: "retail" },
  b: { facade: "columns", crown: "plant", setback: true, podium: "retail" },
  c: { facade: "balcony", crown: "plant", setback: false, podium: "retail" },
  d: { facade: "curtain", crown: "frame", setback: false, podium: "plain", decks: [6, 30] },
  e: { facade: "fins", crown: "plant", setback: true, podium: "plain", decks: [6, 30] },
};
export const designOf = (b: Building): Design => DESIGNS[b.id] ?? { facade: "balcony", crown: "plant", setback: false };

// Per facade: how far the glass sits behind the outline (recess), and the slab band's height and overhang.
const FACADE = {
  curtain: { inset: 0, slabH: 0.12, slabOut: 0.04 },
  columns: { inset: 0.6, slabH: 0.45, slabOut: 0 },
  balcony: { inset: 0.3, slabH: 0.3, slabOut: 0.1 },
  fins: { inset: 0.25, slabH: 0.22, slabOut: 0.05 },
} as const;

const TEX_W = 6; // metres across one texture tile
const TEX_FLOORS = 4; // floors up one texture tile
const SETBACK = 1.6;
const SETBACK_FLOORS = 2;
const ARCADE = 3.6; // the five-foot way: shopfronts sit this far behind the podium's edge (it is wider than five feet)
const podiumFloors = (b: Building, d: Design) =>
  d.podium === "retail" ? (b.floors >= 28 ? 3 : 2) : d.podium === "plain" || b.floors >= 15 ? 2 : 0;

export type P = [number, number]; // x east, z south
export type Edge = { a: P; b: P; dir: P; n: P; len: number };

export function edgesOf(poly: P[]): Edge[] {
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let n: P = [dir[1], -dir[0]];
    // outward: away from the centroid (the origin)
    if (n[0] * (a[0] + b[0]) + n[1] * (a[1] + b[1]) < 0) n = [-n[0], -n[1]];
    return { a, b, dir, n, len };
  });
}

/** The convex outline pushed out by d (in by -d), corners mitred. */
export function offset(poly: P[], d: number): P[] {
  const e = edgesOf(poly);
  return poly.map((p, i) => {
    const n1 = e[(i - 1 + e.length) % e.length].n;
    const n2 = e[i].n;
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}

/**
 * Indexed geometry builder with flat normals: every flat polygon (a quad side, a cap) shares its corner vertices and is
 * wound to face `n`. Mapbox's glTF decoder needs the index (measured: "reading 'bufferView'" without one).
 */
export class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  /** A flat convex polygon, corners in order (either way round), facing n. */
  poly(pts: number[][], n: number[], uvs: number[][]) {
    const [a, b, c] = pts;
    const cr = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const base = this.pos.length / 3;
    pts.forEach((p, i) => {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
    });
    for (let i = 1; i < pts.length - 1; i++) this.idx.push(base, base + (flip ? i + 1 : i), base + (flip ? i : i + 1));
  }
  /** Vertical prism of a convex outline from y0 to y1; sides UV'd along the perimeter in texture tiles. */
  prism(poly: P[], y0: number, y1: number, caps: { top?: boolean; bottom?: boolean } = { top: true, bottom: true }) {
    if (y1 - y0 < 1e-3) return;
    const v0 = y0 / (TEX_FLOORS * FLOOR_H);
    const v1 = y1 / (TEX_FLOORS * FLOOR_H);
    let s = 0;
    for (const e of edgesOf(poly)) {
      const u0 = s / TEX_W;
      const u1 = (s + e.len) / TEX_W;
      s += e.len;
      const A = [e.a[0], y0, e.a[1]], B = [e.b[0], y0, e.b[1]], C = [e.b[0], y1, e.b[1]], D = [e.a[0], y1, e.a[1]];
      this.poly([A, B, C, D], [e.n[0], 0, e.n[1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    }
    for (const [y, up, on] of [[y1, 1, caps.top], [y0, -1, caps.bottom]] as const) {
      if (on) this.poly(poly.map((p) => [p[0], y, p[1]]), [0, up, 0], poly.map((p) => [p[0] / TEX_W, p[1] / TEX_W]));
    }
  }
  /** Another mesher's geometry, moved by (dx, 0, dz). */
  append(m: Mesher, dx = 0, dz = 0) {
    const base = this.pos.length / 3;
    for (let i = 0; i < m.pos.length; i += 3) this.pos.push(m.pos[i] + dx, m.pos[i + 1], m.pos[i + 2] + dz);
    this.nor.push(...m.nor);
    this.uv.push(...m.uv);
    for (const i of m.idx) this.idx.push(base + i);
  }
  /** A box `w` along edge e (centred `at` metres from e.a), `d` deep from `out` metres outside the edge, y0..y1. */
  edgeBox(e: Edge, at: number, w: number, d: number, out: number, y0: number, y1: number) {
    const c: P = [e.a[0] + e.dir[0] * at + e.n[0] * (out + d / 2), e.a[1] + e.dir[1] * at + e.n[1] * (out + d / 2)];
    const hx: P = [(e.dir[0] * w) / 2, (e.dir[1] * w) / 2];
    const hz: P = [(e.n[0] * d) / 2, (e.n[1] * d) / 2];
    // a box is a prism of a convex quad; its "outward" test needs the quad's own centre as origin
    const m = new Mesher();
    m.prism([[-hx[0] - hz[0], -hx[1] - hz[1]], [hx[0] - hz[0], hx[1] - hz[1]], [hx[0] + hz[0], hx[1] + hz[1]], [-hx[0] + hz[0], -hx[1] + hz[1]]], y0, y1);
    this.append(m, c[0], c[1]);
  }
  /** A square post (crown frame, arcade). */
  post(p: P, w: number, y0: number, y1: number) {
    const h = w / 2;
    const m = new Mesher();
    m.prism([[-h, -h], [h, -h], [h, h], [-h, h]], y0, y1);
    this.append(m, p[0], p[1]);
  }
  /** An axis-aligned box: centre x/z, size w (x) by d (z), y0..y1. */
  box(x: number, z: number, w: number, d: number, y0: number, y1: number) {
    const m = new Mesher();
    m.prism([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], y0, y1);
    this.append(m, x, z);
  }
  /** `uv`: only textured roles need it (it is a quarter of the bytes). */
  geometry(uv = true) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

/** Positions (metres along the edge) of evenly spaced members about `step` apart, inside a margin. */
export const along = (len: number, step: number, margin: number) => {
  const n = Math.max(1, Math.round((len - 2 * margin) / step));
  return Array.from({ length: n + 1 }, (_, i) => margin + ((len - 2 * margin) * i) / n);
};

/**
 * Geometry per material role for floors [from, to) (0-based), plus the roof and crown when `roof`. The burst builds
 * the floors below its cut and the floors above it (which lift away) as two calls; the map builds 0..floors with roof.
 */
export function towerParts(b: Building, outline: P[], from: number, to: number, roof: boolean, design?: Design): TowerParts {
  const d = design ?? designOf(b);
  const f = FACADE[d.facade];
  const M = Object.fromEntries(ROLES.map((r) => [r, new Mesher()])) as Record<Role, Mesher>;
  const pod = podiumFloors(b, d);
  const deck = new Set((d.decks ?? []).map((l) => l - 1).filter((fl) => fl >= pod && fl < b.floors - 1)); // 0-based, never the roof storey
  const top = b.floors;
  const setFrom = d.setback && top - SETBACK_FLOORS > pod + 3 ? top - SETBACK_FLOORS : top;
  const shape = (fl: number) => (fl >= setFrom ? offset(outline, -SETBACK) : outline);
  const faces = edgesOf(outline).filter((e) => e.len > 6); // the straight facades, not the chamfers
  const longest = [...faces].sort((x, y) => y.len - x.len).slice(0, 2);

  for (let fl = from; fl < to; fl++) {
    const y0 = fl * FLOOR_H;
    const y1 = y0 + FLOOR_H;
    if (fl < pod && d.podium === "retail") {
      const edge = 4; // the podium reaches 4 m past the tower
      if (fl === 0) {
        // Shopfronts behind an arcade: glass set back, a mullion between shops, columns on the podium edge, a signage band on the canopy fascia.
        M.glass.prism(offset(outline, edge - ARCADE), y0, y1 - 0.4, { top: false, bottom: false });
        for (const e of faces) {
          if (!d.lod) for (const t of along(e.len, 6, 0)) M.frame.edgeBox(e, t, 0.15, 0.2, edge - ARCADE, y0, y1 - 0.4);
          for (const t of along(e.len, d.lod ? 8 : 5, 0.5)) M.podium.edgeBox(e, t, 0.5, 0.5, edge - 0.55, y0, y1 - 0.4);
          const shops = along(e.len, 6, 0);
          for (let i = 0; i < shops.length - 1; i++)
            M[i % 2 ? "podium" : "sign"].edgeBox(e, (shops[i] + shops[i + 1]) / 2, shops[i + 1] - shops[i] - 0.3, 0.08, edge, y1 - 0.4 - 0.55, y1 - 0.4 - 0.08);
        }
        M.podium.prism(offset(outline, edge), y1 - 0.4, y1); // the canopy: the arcade's roof is the first floor slab
      } else {
        M.podium.prism(offset(outline, edge - 0.2), y0, y0 + 0.8, { top: false, bottom: false });
        M.glass.prism(offset(outline, edge - 0.5), y0 + 0.8, y1 - 0.6, { top: false, bottom: false });
        M.podium.prism(offset(outline, edge), y1 - 0.6, y1);
        if (fl === pod - 1) for (const e of longest) M.green.edgeBox(e, e.len / 2, e.len - 2, 1.2, 1.6, y1, y1 + 0.7); // planters on the podium roof
      }
      continue;
    }
    if (fl < pod) {
      // Podium: a lobby glass band at ground, a solid car-park floor with a dark opening band above, wider than the tower.
      if (fl === 0) {
        M.glass.prism(offset(outline, 0.9), y0, y1 - 0.5, { top: false, bottom: false });
        M.podium.prism(offset(outline, 1.4), y1 - 0.5, y1);
      } else {
        M.podium.prism(offset(outline, 1.2), y0, y0 + 0.9, { top: false, bottom: false });
        M.glass.prism(offset(outline, 0.9), y0 + 0.9, y1 - 0.7, { top: false, bottom: false });
        M.podium.prism(offset(outline, 1.4), y1 - 0.7, y1);
      }
      continue;
    }
    const o = shape(fl);
    if (deck.has(fl)) {
      // A facilities deck: open between slabs, columns at the corners, a glass balustrade, a pool strip and planters round a core.
      M.frame.prism(offset(o, f.slabOut), y0, y0 + 0.35);
      for (const p of offset(o, -0.5)) M.frame.post(p, 0.6, y0 + 0.35, y1);
      M.rail.prism(offset(o, -0.2), y0 + 0.35, y0 + 1.45, { top: false, bottom: false });
      const core = offset(o, -Math.min(...longest.map((e) => e.len), 18) * 0.28);
      M.podium.prism(core, y0 + 0.35, y1, { top: false, bottom: false });
      const [l0, l1] = longest;
      if (l0) M.water.edgeBox(l0, l0.len / 2, l0.len * 0.6, 2.4, -3.2, y0 + 0.35, y0 + 0.5);
      if (l1) M.green.edgeBox(l1, l1.len / 2, l1.len * 0.7, 1, -1.8, y0 + 0.35, y0 + 0.95);
      continue;
    }
    if (!d.lod) M.glass.prism(offset(o, -f.inset), y0, y1, { top: false, bottom: fl === from || deck.has(fl - 1) });
    M.frame.prism(offset(o, f.slabOut), y0, y0 + f.slabH, d.lod ? { top: false, bottom: false } : undefined);
    if (fl === setFrom) M.frame.prism(offset(outline, f.slabOut), y0 - 0.05, y0 + 0.35); // the terrace slab under the setback
    if (d.facade === "balcony" && fl < setFrom) {
      for (const e of longest) {
        const w = e.len - 2.4;
        M.frame.edgeBox(e, e.len / 2, w, 1.5, 0, y0, y0 + 0.22);
        if (d.lod) continue;
        M.rail.edgeBox(e, e.len / 2, w, 0.04, 1.44, y0 + 0.22, y0 + 1.15);
        M.frame.edgeBox(e, e.len / 2, w, 0.1, 1.4, y0 + 1.15, y0 + 1.22);
      }
    }
  }

  // Vertical members, built for this floor range only so the burst's two halves meet at the cut.
  const lo = Math.max(from, pod) * FLOOR_H;
  if (d.lod) {
    // one glass shaft below the setback, one above it (LOD designs have no decks)
    const a = Math.max(from, pod), z = Math.min(to, setFrom);
    if (z > a) M.glass.prism(offset(outline, -f.inset), a * FLOOR_H, z * FLOOR_H, { top: false, bottom: false });
    if (to > setFrom) M.glass.prism(offset(shape(top), -f.inset), Math.max(from, setFrom) * FLOOR_H, to * FLOOR_H, { top: false, bottom: false });
  }
  const hiCol = Math.min(to, setFrom) * FLOOR_H + (to >= setFrom ? 0.35 : 0);
  if (hiCol > lo) {
    if (d.facade === "columns")
      for (const e of faces) for (const t of along(e.len, 4.2, 0.6)) M.frame.edgeBox(e, t, 0.7, 0.75, -0.6, lo, hiCol + (to === top ? 1.2 : 0));
    if (d.facade === "balcony")
      for (const e of longest) for (const t of along(e.len, 7.5, 1.2)) M.frame.edgeBox(e, t, 0.25, 1.6, -0.3, lo, hiCol);
    if (d.facade === "fins")
      for (const e of faces) for (const t of along(e.len, d.lod ? 3 : 1.5, 0.5)) M.frame.edgeBox(e, t, d.lod ? 0.25 : 0.16, 0.8, -0.25, lo, hiCol + (to === top ? 0.8 : 0));
    if (d.facade === "curtain") for (const e of faces) for (const t of [0.15, e.len - 0.15]) M.frame.edgeBox(e, t, 0.3, 0.12, 0, lo, hiCol); // corner mullions
  }

  if (roof && to >= top) {
    const H = top * FLOOR_H;
    const o = shape(top);
    M.roof.prism(offset(o, 0.25), H, H + 0.45);
    for (const e of edgesOf(offset(o, 0.25))) M.frame.edgeBox(e, e.len / 2, e.len, 0.25, -0.25, H + 0.45, H + 1.5); // parapet
    const w = Math.max(...o.map((p) => p[0])) - Math.min(...o.map((p) => p[0]));
    const dd = Math.max(...o.map((p) => p[1])) - Math.min(...o.map((p) => p[1]));
    if (d.crown === "plant") {
      M.roof.prism([[-w * 0.15, -dd * 0.15], [w * 0.15, -dd * 0.15], [w * 0.15, dd * 0.15], [-w * 0.15, dd * 0.15]], H + 0.45, H + 3.2);
      M.roof.post([w * 0.28, 0], 2.6, H + 0.45, H + 2.6);
      M.roof.post([w * 0.28, dd * 0.22], 2.6, H + 0.45, H + 2.6);
    } else {
      // An open crown frame: posts at every corner and a ring beam 4 m above the roof.
      const ring = offset(o, 0.1);
      for (const p of ring) M.frame.post(p, 0.6, H + 0.45, H + 4.4);
      for (const e of edgesOf(ring)) M.frame.edgeBox(e, e.len / 2, e.len + 0.6, 0.6, -0.6, H + 3.7, H + 4.4);
      M.roof.prism(offset(o, -3), H + 0.45, H + 2.4); // lift core under the frame
    }
  }

  const out: Partial<Record<Role, THREE.BufferGeometry>> = {};
  for (const k of Object.keys(M) as Role[]) {
    const g = M[k].geometry(TEXTURED.includes(k));
    if (g) out[k] = g;
  }
  return out;
}

/** Every part in one geometry (position + normal): the burst's picked-colour overlay covers exactly the tower. */
export function wholeTower(parts: TowerParts) {
  // position + normal only: the roles differ in whether they carry UVs, and merging needs the same attributes
  const gs = (Object.values(parts).filter(Boolean) as THREE.BufferGeometry[]).map((g) => {
    const c = new THREE.BufferGeometry();
    c.setAttribute("position", g.getAttribute("position"));
    c.setAttribute("normal", g.getAttribute("normal"));
    c.setIndex(g.getIndex());
    return c;
  });
  return gs.length ? mergeGeometries(gs, false) : null;
}

// ---------- materials ----------

const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Window texture for one facade type, from theme tokens, with a night twin lighting about a fifth of the panes. */
function facadeTexture(facade: Facade, colors: ThemeColors, dark: boolean, seed: number, scale: number) {
  const W = 512 * scale;
  const H = 1024 * scale;
  const rowH = H / TEX_FLOORS;
  const base = document.createElement("canvas");
  const glow = document.createElement("canvas");
  base.width = glow.width = W;
  base.height = glow.height = H;
  const g = base.getContext("2d")!;
  const e = glow.getContext("2d")!;
  e.fillStyle = "#000";
  e.fillRect(0, 0, W, H);
  const tint = colors["chart-3"];
  // Daylight glass: the theme's chart-3 pulled most of the way to a clean sky blue-grey, so it reads as glass, not paint.
  const sky = mix(tint, "#a9bccb", 0.7);
  // Mid-tone glass under off-white frames: pale glass washed out against Mapbox's light ground (measured by eye, 02:35).
  const glassA = dark ? mix(tint, colors.background, 0.62) : mix(sky, "#ffffff", facade === "curtain" ? 0.1 : 0.2);
  const glassB = dark ? mix(tint, colors.background, 0.8) : mix(sky, "#1f2b35", facade === "curtain" ? 0.6 : 0.45);
  const frame = dark ? "#2a2f36" : facade === "curtain" ? "#56606a" : "#e9e4dc";
  const spandrel = dark ? "#3a4048" : facade === "columns" ? "#ddd6cb" : "#cfc8bd";
  const curtains = dark ? ["#3a3631", "#2f3238"] : ["#efe6d6", "#e3d6c2", "#f4efe7", "#d9cdb8"];
  let s = seed * 7919 + 13;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = frame;
  g.fillRect(0, 0, W, H);
  // pane width in metres and the solid spandrel at the foot of each floor (as a share of the floor)
  const pane = { curtain: 3, columns: 1.4, balcony: 1.5, fins: 1.5 }[facade];
  const sill = { curtain: 0.0, columns: 0.3, balcony: 0.06, fins: 0.18 }[facade];
  const mull = facade === "curtain" ? 2 : 4;
  const cols = Math.round(TEX_W / pane);
  const pw = W / cols;
  for (let r = 0; r < TEX_FLOORS; r++) {
    const y = r * rowH; // canvas y grows down; texture v grows up: row 0 is the top floor of the tile
    const glassTop = y + rowH * 0.04;
    const glassBot = y + rowH * (1 - sill);
    if (sill > 0) {
      g.fillStyle = spandrel;
      g.fillRect(0, glassBot, W, y + rowH - glassBot);
    }
    for (let c = 0; c < cols; c++) {
      const x = c * pw + mull / 2;
      const w = pw - mull;
      const grad = g.createLinearGradient(0, glassTop, 0, glassBot);
      grad.addColorStop(0, glassA);
      grad.addColorStop(1, glassB);
      g.fillStyle = grad;
      g.fillRect(x, glassTop, w, glassBot - glassTop);
      // homes behind the glass: drawn curtains on some panes (homes, not offices)
      const k = rand();
      if (facade !== "curtain" && k < 0.45) {
        g.fillStyle = curtains[Math.floor(rand() * curtains.length)];
        g.globalAlpha = dark ? 0.5 : 0.75;
        const cw = w * (0.25 + rand() * 0.5);
        g.fillRect(rand() < 0.5 ? x : x + w - cw, glassTop + 3, cw, glassBot - glassTop - 3);
        g.globalAlpha = 1;
      }
      // the slab above throws a soft shadow onto the top of each pane (baked AO)
      const ao = g.createLinearGradient(0, glassTop, 0, glassTop + rowH * 0.18);
      ao.addColorStop(0, "rgba(0,0,0,0.28)");
      ao.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = ao;
      g.fillRect(x, glassTop, w, rowH * 0.18);
      // a sky glint, stronger on the big curtain-wall panes
      g.fillStyle = dark ? "rgba(255,255,255,0.04)" : `rgba(255,255,255,${facade === "curtain" ? 0.3 : 0.18})`;
      g.beginPath();
      g.moveTo(x, glassTop + (glassBot - glassTop) * 0.55);
      g.lineTo(x + w * 0.55, glassTop);
      g.lineTo(x + w * 0.75, glassTop);
      g.lineTo(x, glassTop + (glassBot - glassTop) * 0.8);
      g.fill();
      // a transom on the punched windows
      if (facade === "columns" || facade === "fins") {
        g.fillStyle = frame;
        g.fillRect(x, glassTop + (glassBot - glassTop) * 0.22, w, 3);
      }
      if (rand() < 0.22) {
        const warm = e.createLinearGradient(0, glassTop, 0, glassBot);
        warm.addColorStop(0, "#ffd08a");
        warm.addColorStop(1, "#d98a3c");
        e.fillStyle = warm;
        e.fillRect(x, glassTop, w, glassBot - glassTop);
      }
    }
  }
  const make = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.mimeType = "image/jpeg"; // GLTFExporter: JPEG, not PNG (about a fifth of the size)
    return t;
  };
  return { map: make(base), emissiveMap: make(glow) };
}

/**
 * Materials per role. `physical` (the burst): clearcoat glass that reflects the studio environment. Otherwise plain
 * core-glTF PBR for the map's model (Mapbox has no environment map for clearcoat to reflect). `lit` turns the night
 * windows on.
 */
export function towerMaterials(
  b: Building,
  colors: ThemeColors,
  dark: boolean,
  physical: boolean,
  lit = dark,
  design?: Design,
  /** texture size: 1 = 512 x 1024 (our towers); spawned site buildings use 0.5 to stay under their size budget */
  texScale = 1,
): Record<Role, THREE.Material> {
  const d = design ?? designOf(b);
  const { map, emissiveMap } = facadeTexture(d.facade, colors, dark, b.id.charCodeAt(0), texScale);
  const frameCol = dark ? "#565c66" : d.facade === "curtain" ? "#b9bec4" : "#f2eee7";
  const glass = physical
    ? new THREE.MeshPhysicalMaterial({ map, emissiveMap, emissive: "#ffffff", emissiveIntensity: lit ? 1.1 : 0, roughness: 0.22, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })
    : new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0, ...(lit ? { emissiveMap, emissive: "#ffffff", emissiveIntensity: 1 } : {}) });
  const solid = (color: string, roughness: number) =>
    physical ? new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.3, clearcoatRoughness: 0.3 }) : new THREE.MeshStandardMaterial({ color, roughness });
  const rail = new THREE.MeshStandardMaterial({
    color: dark ? mix(colors["chart-3"], colors.background, 0.5) : mix(colors["chart-3"], "#ffffff", 0.45),
    roughness: 0.1,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  return {
    glass,
    frame: solid(frameCol, 0.55),
    podium: solid(dark ? "#4a4640" : "#d8cfc2", 0.8),
    // shop signage: the theme's accent, muted towards the stone so a row of shops reads as signs, not as an alarm
    sign: solid(mix(colors.primary, dark ? "#4a4640" : "#d8cfc2", 0.35), 0.6),
    water: solid(mix(colors["chart-3"], "#5fb4d6", 0.6), 0.1),
    green: solid(mix(colors["chart-2"], "#6f9a5a", 0.7), 0.9),
    roof: solid(dark ? "#4d525a" : "#e4dfd7", 0.7),
    // landed homes: rendered walls and clay-tile roofs (warm grey-terracotta, muted so the block reads calm)
    wall: solid(dark ? "#5a5650" : "#efe9df", 0.85),
    tile: solid(dark ? "#5b3f36" : mix("#a65a3f", "#d8cfc2", 0.25), 0.8),
    rail,
  };
}

export const ROLES: Role[] = ["glass", "frame", "podium", "wall", "sign", "water", "green", "roof", "tile", "rail"]; // rail last: it is see-through
