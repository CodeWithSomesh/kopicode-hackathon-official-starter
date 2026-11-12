"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Floor, Pt } from "./plans";
import type { Patch, Sun } from "./sun";

type Props = {
  floor: Floor;
  /** Footprint of the whole plan, so every floor draws at the same scale. */
  bounds: { w: number; h: number };
  patches: Patch[];
  sun: Sun;
  facing: number;
  className?: string;
};

const PAD = 0.6;
const COMPASS_BAND = 76;

/** Reads the theme's colours so the drawing follows Kopitiam (and later themes) without hex. */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--color-ink", "#17332a"),
    soft: v("--color-ink-soft", "#4a6359"),
    surface: v("--j-surface", "#ffffff"),
    cloud: v("--color-cloud", "#e4efe8"),
    line: v("--j-line", "#c9dbd1"),
    sun: v("--color-kaya", "#f2b632"),
    sunDeep: v("--color-kaya-deep", "#a97a0c"),
    glass: v("--color-sky-deep", "#3f8fb5"),
    door: v("--color-raya", "#d8452f"),
    // Canvas can't resolve CSS variables in a font string, so take the computed family.
    family: css.fontFamily || "system-ui, sans-serif",
  };
}

export function PlanCanvas({ floor, bounds, patches, sun, facing, className }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !size.w || !size.h) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);

    const c = palette(cv);
    const worldW = bounds.w + PAD * 2;
    const worldH = bounds.h + PAD * 2;
    // Keep a strip on the right for the compass so it never sits on top of a room.
    const usableW = size.w - COMPASS_BAND;
    const scale = Math.min(usableW / worldW, size.h / worldH);
    const offX = (usableW - worldW * scale) / 2;
    const offY = (size.h - worldH * scale) / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + PAD * scale), dpr * (offY + PAD * scale));

    const px = 1 / scale; // one CSS pixel in metres
    const font = (sizePx: number, weight = 500) => `${weight} ${sizePx * px}px ${c.family}`;
    const seg = (a: Pt, b: Pt, color: string, width: number, dash?: number[]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Floors: indoor rooms in the surface colour, outdoor areas hatched.
    for (const r of floor.rooms) {
      ctx.fillStyle = r.kind === "outdoor" ? c.cloud : c.surface;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (r.kind === "outdoor") {
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        for (let d = -r.h; d < r.w; d += 0.5) seg([r.x + d, r.y + r.h], [r.x + d + r.h, r.y], c.line, 1.2 * px);
        ctx.restore();
      }
      if (r.kind === "stairs") {
        const across = r.w > r.h;
        const n = Math.floor((across ? r.w : r.h) / 0.28);
        for (let i = 1; i < n; i++) {
          const t = i * 0.28;
          if (across) seg([r.x + t, r.y], [r.x + t, r.y + r.h], c.line, 1.2 * px);
          else seg([r.x, r.y + t], [r.x + r.w, r.y + t], c.line, 1.2 * px);
        }
      }
    }

    // Sunlight on the floor, clipped to the room it falls in.
    for (const p of patches) {
      const r = floor.rooms.find((x) => x.id === p.room);
      if (!r) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.beginPath();
      p.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = c.sun;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Walls.
    for (const r of floor.rooms) {
      ctx.strokeStyle = r.kind === "outdoor" ? c.soft : c.ink;
      ctx.lineWidth = (r.kind === "outdoor" ? 1.5 : 3) * px;
      ctx.setLineDash(r.kind === "outdoor" ? [4 * px, 4 * px] : []);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
    }

    // Openings: punch the wall out, then draw glass or a door leaf.
    const wallGap = 5 * px;
    for (const w of floor.windows) {
      seg(w.p, w.q, c.surface, wallGap);
      seg(w.p, w.q, c.glass, 2.5 * px);
    }
    for (const d of floor.doors) {
      seg(d.p, d.q, c.surface, wallGap);
      if (d.kind === "open") continue;
      const color = d.kind === "main" ? c.door : c.soft;
      // Short jambs at each end so the doorway reads as a door, not a missing wall.
      const vertical = Math.abs(d.p[0] - d.q[0]) < 1e-6;
      const j = 0.12;
      const jamb = (p: Pt): [Pt, Pt] => (vertical ? [[p[0] - j, p[1]], [p[0] + j, p[1]]] : [[p[0], p[1] - j], [p[0], p[1] + j]]);
      seg(...jamb(d.p), color, 2.5 * px);
      seg(...jamb(d.q), color, 2.5 * px);
      seg(d.p, d.q, color, (d.kind === "main" ? 2.5 : 1.2) * px, [3 * px, 3 * px]);
    }

    // Labels.
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const r of floor.rooms) {
      ctx.font = font(11, 600);
      if (ctx.measureText(r.label).width > r.w - 0.2) continue;
      ctx.fillStyle = r.kind === "outdoor" ? c.soft : c.ink;
      ctx.fillText(r.label, r.x + 0.15, r.y + 0.15);
      ctx.font = font(10);
      ctx.fillStyle = c.soft;
      if (r.kind !== "outdoor" && r.kind !== "stairs" && r.h > 1.6)
        ctx.fillText(`${(r.w * r.h).toFixed(1)} m²`, r.x + 0.15, r.y + 0.15 + 15 * px);
    }
    const main = floor.doors.find((d) => d.kind === "main");
    if (main) {
      ctx.font = font(10, 700);
      ctx.fillStyle = c.door;
      ctx.textAlign = "center";
      const mx = (main.p[0] + main.q[0]) / 2;
      const my = (main.p[1] + main.q[1]) / 2;
      // Write the label on the outside of the door so it never sits on a room label.
      const indoorAbove = floor.rooms.some(
        (r) => r.kind !== "outdoor" && mx > r.x && mx < r.x + r.w && my - 0.3 > r.y && my - 0.3 < r.y + r.h,
      );
      ctx.textBaseline = indoorAbove ? "top" : "bottom";
      ctx.fillText("MAIN DOOR", mx, my + (indoorAbove ? 6 * px : -6 * px));
    }

    // Scale bar, bottom-left: 1 metre.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const barX = 12;
    const barY = size.h - 14;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY);
    ctx.lineTo(barX + scale, barY);
    ctx.lineTo(barX + scale, barY - 4);
    ctx.stroke();
    ctx.font = `600 10px ${c.family}`;
    ctx.fillStyle = c.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("1 m", barX + scale + 6, barY + 1);

    // Compass, top-right: needle points north (rotated by facing), sun dot on the horizon ring.
    const r = 24;
    const cx = size.w - r - 12;
    const cy = r + 22;
    ctx.fillStyle = c.surface;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const f = (facing * Math.PI) / 180;
    const nx = -Math.sin(f);
    const ny = -Math.cos(f);
    const tip = r - 5;
    const half = 5;
    ctx.fillStyle = c.door;
    ctx.beginPath();
    ctx.moveTo(cx + nx * tip, cy + ny * tip);
    ctx.lineTo(cx - ny * half, cy + nx * half);
    ctx.lineTo(cx + ny * half, cy - nx * half);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.soft;
    ctx.beginPath();
    ctx.moveTo(cx - nx * tip, cy - ny * tip);
    ctx.lineTo(cx - ny * half, cy + nx * half);
    ctx.lineTo(cx + ny * half, cy - nx * half);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 11px ${c.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = c.ink;
    ctx.fillText("N", cx + nx * (r + 9), cy + ny * (r + 9));
    if (sun.up) {
      const len = Math.hypot(sun.sx, sun.sy) || 1;
      const k = (r - 3) * Math.cos((sun.elevation * Math.PI) / 180);
      ctx.fillStyle = c.sun;
      ctx.strokeStyle = c.sunDeep;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + (sun.sx / len) * k, cy + (sun.sy / len) * k, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [size, floor, bounds, patches, sun, facing]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {/* Absolutely placed so the canvas's pixel size can never feed back into the layout. */}
      <canvas
        ref={canvas}
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label={`Floor plan, ${floor.label}, with sunlight on the floor`}
      />
    </div>
  );
}
