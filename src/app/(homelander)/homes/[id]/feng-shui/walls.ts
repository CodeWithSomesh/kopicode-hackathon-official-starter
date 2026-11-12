import type { Floor } from "./plans";

/**
 * Wall pieces for the 3D view, from the plan's room edges. Shared edges are merged so each
 * wall is built once; doors leave a gap with a lintel, windows leave a sill and a lintel
 * with glass between. Plan space: x right, y down; heights in metres.
 */

export const WALL_H = 2.7;
export const WALL_T = 0.12;
const DOOR_H = 2.1;
const EPS = 1e-6;

export type WallPiece = {
  /** Centre on the plan. */
  x: number;
  y: number;
  /** Length along the wall's own axis, and which axis that is. */
  len: number;
  axis: "x" | "y";
  /** Bottom and top heights. */
  y0: number;
  y1: number;
  glass?: boolean;
};

type Span = [number, number];

function union(spans: Span[]): Span[] {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

type Opening = {
  a: number;
  b: number;
  kind: "door" | "open" | "window";
  sill: number;
  head: number;
};

export function wallPieces(floor: Floor): WallPiece[] {
  const indoor = floor.rooms.filter((r) => r.kind !== "outdoor");
  const lines = { x: new Map<number, Span[]>(), y: new Map<number, Span[]>() };
  const key = (v: number) => Math.round(v * 1000) / 1000;
  const add = (axis: "x" | "y", at: number, span: Span) => {
    const m = lines[axis];
    const k = key(at);
    m.set(k, [...(m.get(k) ?? []), span]);
  };
  // axis "x" = a wall running along x (horizontal on the plan), positioned at some y.
  for (const r of indoor) {
    add("x", r.y, [r.x, r.x + r.w]);
    add("x", r.y + r.h, [r.x, r.x + r.w]);
    add("y", r.x, [r.y, r.y + r.h]);
    add("y", r.x + r.w, [r.y, r.y + r.h]);
  }

  const openingsOn = (axis: "x" | "y", at: number): Opening[] => {
    const out: Opening[] = [];
    const on = (p: [number, number], q: [number, number]) =>
      axis === "x"
        ? Math.abs(p[1] - q[1]) < EPS && Math.abs(p[1] - at) < 1e-3
        : Math.abs(p[0] - q[0]) < EPS && Math.abs(p[0] - at) < 1e-3;
    const span = (p: [number, number], q: [number, number]): Span =>
      axis === "x"
        ? [Math.min(p[0], q[0]), Math.max(p[0], q[0])]
        : [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
    for (const d of floor.doors) {
      if (!on(d.p, d.q)) continue;
      const [a, b] = span(d.p, d.q);
      out.push({
        a,
        b,
        kind: d.kind === "open" ? "open" : "door",
        sill: 0,
        head: d.kind === "open" ? 2.4 : DOOR_H,
      });
    }
    for (const w of floor.windows) {
      if (!on(w.p, w.q)) continue;
      const [a, b] = span(w.p, w.q);
      out.push({ a, b, kind: "window", sill: w.sill, head: w.head });
    }
    return out.sort((p, q) => p.a - q.a);
  };

  const pieces: WallPiece[] = [];
  for (const axis of ["x", "y"] as const) {
    for (const [at, spans] of lines[axis]) {
      const opens = openingsOn(axis, at);
      for (const [a, b] of union(spans)) {
        // Cut points: the span ends plus every opening edge inside it.
        const cuts = [a, b, ...opens.flatMap((o) => [o.a, o.b])].filter(
          (c) => c >= a - EPS && c <= b + EPS,
        );
        const sorted = [...new Set(cuts.map(key))].sort((p, q) => p - q);
        for (let i = 0; i < sorted.length - 1; i++) {
          const s0 = sorted[i];
          const s1 = sorted[i + 1];
          if (s1 - s0 < EPS) continue;
          const mid = (s0 + s1) / 2;
          const o = opens.find((op) => mid > op.a && mid < op.b);
          const piece = (
            y0: number,
            y1: number,
            glass?: boolean,
          ): WallPiece => ({
            x: axis === "x" ? mid : at,
            y: axis === "x" ? at : mid,
            len: s1 - s0,
            axis,
            y0,
            y1,
            glass,
          });
          if (!o) pieces.push(piece(0, WALL_H));
          else {
            if (o.sill > 0.02) pieces.push(piece(0, o.sill));
            if (o.kind === "window") pieces.push(piece(o.sill, o.head, true));
            if (o.head < WALL_H - 0.02) pieces.push(piece(o.head, WALL_H));
          }
        }
      }
    }
  }
  return pieces;
}
