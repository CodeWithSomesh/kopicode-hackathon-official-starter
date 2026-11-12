import { CATALOG, type Item } from "./furniture";
import { boxOf, frontOf, type Box } from "./layout-ops";

export type ItemColors = {
  ink: string;
  soft: string;
  surface: string;
  line: string;
  furniture: string;
  plant: string;
  glass: string;
  select: string;
  family: string;
};

/**
 * Furniture in plan space (metres). `px` is one CSS pixel in metres. Every piece shows which
 * way it faces: a darker band along its back (backrest, headboard, wall side).
 */
export function drawItems(
  ctx: CanvasRenderingContext2D,
  items: Item[],
  selected: string | null,
  c: ItemColors,
  px: number,
  /** Furniture name in the buyer's language (the EN | Manglish switch); English by default. */
  name: (en: string) => string = (en) => en,
) {
  for (const it of items) {
    const cat = CATALOG[it.kind];
    const b = boxOf(it);
    const [fx, fy] = frontOf(it.rot);

    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = c.ink;

    if (it.kind === "plant") {
      const r = Math.min(b.w, b.h) / 2;
      ctx.fillStyle = c.plant;
      ctx.beginPath();
      ctx.arc(it.cx, it.cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(it.cx, it.cy);
        ctx.lineTo(
          it.cx + Math.cos(a) * r * 0.7,
          it.cy + Math.sin(a) * r * 0.7,
        );
        ctx.stroke();
      }
    } else if (it.kind === "mirror") {
      ctx.fillStyle = c.glass;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    } else if (it.kind === "dining") {
      drawDining(ctx, b, it.rot % 2 === 1, c, px);
    } else {
      ctx.fillStyle = cat.fixed ? c.line : c.furniture;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (it.kind !== "coffee")
        drawBack(
          ctx,
          b,
          fx,
          fy,
          it.kind === "sofa" || it.kind === "bed" ? 0.18 : 0.08,
          c,
        );
      if (it.kind === "bed") drawPillows(ctx, b, fx, fy, c, px);
      if (it.kind === "stove") drawBurners(ctx, b, c, px);
      if (it.kind === "sink") {
        const inset = 0.12;
        ctx.strokeRect(
          b.x + inset,
          b.y + inset,
          b.w - inset * 2,
          b.h - inset * 2,
        );
      }
    }

    // Label, horizontal if it fits, else along the long side.
    ctx.font = `600 ${10 * px}px ${c.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.ink;
    const label = name(cat.label);
    const tw = ctx.measureText(label).width;
    const textH = 12 * px;
    // Plants, mirrors and stoves read from their drawing; text would sit on top of it.
    if (it.kind !== "plant" && it.kind !== "mirror" && it.kind !== "stove") {
      if (tw < b.w - 6 * px && textH < b.h)
        ctx.fillText(label, it.cx, it.cy);
      else if (tw < b.h - 6 * px && textH < b.w) {
        ctx.save();
        ctx.translate(it.cx, it.cy);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    if (it.uid === selected) {
      const pad = 4 * px;
      ctx.strokeStyle = c.select;
      ctx.lineWidth = 3 * px;
      ctx.setLineDash([5 * px, 3 * px]);
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.setLineDash([]);
      // Arrow off the front edge so it's clear which way the piece faces.
      const ex = it.cx + fx * (b.w / 2 + pad);
      const ey = it.cy + fy * (b.h / 2 + pad);
      const len = 10 * px;
      const half = 5 * px;
      ctx.fillStyle = c.select;
      ctx.beginPath();
      ctx.moveTo(ex + fx * len, ey + fy * len);
      ctx.lineTo(ex - fy * half, ey + fx * half);
      ctx.lineTo(ex + fy * half, ey - fx * half);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawBack(
  ctx: CanvasRenderingContext2D,
  b: Box,
  fx: number,
  fy: number,
  depth: number,
  c: ItemColors,
) {
  ctx.fillStyle = c.soft;
  if (fy > 0) ctx.fillRect(b.x, b.y, b.w, Math.min(depth, b.h / 2));
  else if (fy < 0)
    ctx.fillRect(
      b.x,
      b.y + b.h - Math.min(depth, b.h / 2),
      b.w,
      Math.min(depth, b.h / 2),
    );
  else if (fx > 0) ctx.fillRect(b.x, b.y, Math.min(depth, b.w / 2), b.h);
  else
    ctx.fillRect(
      b.x + b.w - Math.min(depth, b.w / 2),
      b.y,
      Math.min(depth, b.w / 2),
      b.h,
    );
}

function drawPillows(
  ctx: CanvasRenderingContext2D,
  b: Box,
  fx: number,
  fy: number,
  c: ItemColors,
  px: number,
) {
  ctx.fillStyle = c.surface;
  ctx.lineWidth = 1 * px;
  const along = fy !== 0 ? b.w : b.h;
  const pw = along / 2 - 0.12;
  const ph = 0.32;
  for (const i of [0, 1]) {
    const o = 0.08 + i * (pw + 0.08);
    let x: number;
    let y: number;
    let w: number;
    let h: number;
    if (fy > 0) [x, y, w, h] = [b.x + o, b.y + 0.24, pw, ph];
    else if (fy < 0) [x, y, w, h] = [b.x + o, b.y + b.h - 0.24 - ph, pw, ph];
    else if (fx > 0) [x, y, w, h] = [b.x + 0.24, b.y + o, ph, pw];
    else [x, y, w, h] = [b.x + b.w - 0.24 - ph, b.y + o, ph, pw];
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
}

function drawBurners(
  ctx: CanvasRenderingContext2D,
  b: Box,
  c: ItemColors,
  px: number,
) {
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 1.2 * px;
  const long = b.w >= b.h;
  for (const i of [0, 1]) {
    for (const j of [0, 1]) {
      const cx = long
        ? b.x + b.w * (0.3 + i * 0.2)
        : b.x + b.w * (0.35 + j * 0.3);
      const cy = long
        ? b.y + b.h * (0.35 + j * 0.3)
        : b.y + b.h * (0.3 + i * 0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, 0.09, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** A table with three chairs down each long side. */
function drawDining(
  ctx: CanvasRenderingContext2D,
  b: Box,
  turned: boolean,
  c: ItemColors,
  px: number,
) {
  const tableLong = 1.4;
  const tableShort = 0.8;
  const tw = turned ? tableShort : tableLong;
  const th = turned ? tableLong : tableShort;
  const tx = b.x + (b.w - tw) / 2;
  const ty = b.y + (b.h - th) / 2;
  ctx.fillStyle = c.furniture;
  ctx.lineWidth = 1.2 * px;
  const chair = 0.36;
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    const spots: [number, number][] = turned
      ? [
          [b.x, ty + th * t - chair / 2],
          [b.x + b.w - chair, ty + th * t - chair / 2],
        ]
      : [
          [tx + tw * t - chair / 2, b.y],
          [tx + tw * t - chair / 2, b.y + b.h - chair],
        ];
    for (const [x, y] of spots) {
      ctx.fillRect(x, y, chair, chair);
      ctx.strokeRect(x, y, chair, chair);
    }
  }
  ctx.fillRect(tx, ty, tw, th);
  ctx.lineWidth = 1.5 * px;
  ctx.strokeRect(tx, ty, tw, th);
}
