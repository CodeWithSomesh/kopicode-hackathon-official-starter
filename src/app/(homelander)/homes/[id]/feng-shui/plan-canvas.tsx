"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { drawItems } from "./draw-items";
import { CATALOG, type Item } from "./furniture";
import { boxOf, hitTest, type Box } from "./layout-ops";
import type { Floor, Pt } from "./plans";
import type { Patch, Sun } from "./sun";

type Props = {
  floor: Floor;
  /** Footprint of the whole plan, so every floor draws at the same scale. */
  bounds: { w: number; h: number };
  patches: Patch[];
  sun: Sun;
  facing: number;
  /** Furniture on this floor. */
  items: Item[];
  selected: string | null;
  onSelect: (uid: string | null) => void;
  /** Asks to move a piece's centre; the parent decides whether it fits. */
  onDrag: (uid: string, cx: number, cy: number) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLCanvasElement>) => void;
  /** Pieces with a feng shui problem get a red marker. */
  flagged: ReadonlySet<string>;
  /** Problem strips, e.g. the main door's straight line out the window. */
  strips: Box[];
  className?: string;
};

const PAD = 0.6;
const COMPASS_BAND = 76;

/** Reads the theme's colours so the drawing follows Kopitiam (and later themes) without hex. */
function palette(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
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
    furniture: v("--color-lilac", "#d6ebf3"),
    plant: v("--color-pandan", "#1f9d6b"),
    select: v("--color-pandan-deep", "#12704b"),
    // Canvas can't resolve CSS variables in a font string, so take the computed family.
    family: css.fontFamily || "system-ui, sans-serif",
  };
}

export function PlanCanvas({
  floor,
  bounds,
  patches,
  sun,
  facing,
  items,
  selected,
  onSelect,
  onDrag,
  onKeyDown,
  flagged,
  strips,
  className,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** CSS-pixel to plan-metre mapping from the last draw, for pointer hit tests. */
  const view = useRef({ scale: 1, offX: 0, offY: 0 });
  const drag = useRef<{ uid: string; dx: number; dy: number } | null>(null);
  const latest = useRef({ items, floor });
  useEffect(() => {
    latest.current = { items, floor };
  });

  const toWorld = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    const { scale, offX, offY } = view.current;
    return [
      (clientX - r.left - offX) / scale - PAD,
      (clientY - r.top - offY) / scale - PAD,
    ] as const;
  };

  // Touching a piece of furniture drags it; touching anywhere else still scrolls the page.
  // Only a non-passive native listener can cancel the scroll, so this can't be a React prop.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const [x, y] = toWorld(t.clientX, t.clientY);
      const hit = hitTest(latest.current.items, latest.current.floor.id, x, y);
      if (hit && !CATALOG[hit.kind].fixed) e.preventDefault();
    };
    cv.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => cv.removeEventListener("touchstart", onTouchStart);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
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
    view.current = { scale, offX, offY };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * (offX + PAD * scale),
      dpr * (offY + PAD * scale),
    );

    const px = 1 / scale; // one CSS pixel in metres
    const font = (sizePx: number, weight = 500) =>
      `${weight} ${sizePx * px}px ${c.family}`;
    const seg = (
      a: Pt,
      b: Pt,
      color: string,
      width: number,
      dash?: number[],
    ) => {
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
        for (let d = -r.h; d < r.w; d += 0.5)
          seg([r.x + d, r.y + r.h], [r.x + d + r.h, r.y], c.line, 1.2 * px);
        ctx.restore();
      }
      if (r.kind === "stairs") {
        const across = r.w > r.h;
        const n = Math.floor((across ? r.w : r.h) / 0.28);
        for (let i = 1; i < n; i++) {
          const t = i * 0.28;
          if (across)
            seg([r.x + t, r.y], [r.x + t, r.y + r.h], c.line, 1.2 * px);
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

    for (const st of strips) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = c.door;
      ctx.fillRect(st.x, st.y, st.w, st.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.door;
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.strokeRect(st.x, st.y, st.w, st.h);
      ctx.setLineDash([]);
    }

    drawItems(ctx, items, selected, c, px);

    for (const it of items) {
      if (!flagged.has(it.uid)) continue;
      const b = boxOf(it);
      const r = 7 * px;
      const bx = b.x + b.w;
      const by = b.y;
      ctx.fillStyle = c.door;
      ctx.strokeStyle = c.surface;
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.surface;
      ctx.font = `800 ${10 * px}px ${c.family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", bx, by + 0.5 * px);
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
      const color = d.kind === "main" ? c.ink : c.soft;
      // Short jambs at each end so the doorway reads as a door, not a missing wall.
      const vertical = Math.abs(d.p[0] - d.q[0]) < 1e-6;
      const j = 0.12;
      const jamb = (p: Pt): [Pt, Pt] =>
        vertical
          ? [
              [p[0] - j, p[1]],
              [p[0] + j, p[1]],
            ]
          : [
              [p[0], p[1] - j],
              [p[0], p[1] + j],
            ];
      seg(...jamb(d.p), color, 2.5 * px);
      seg(...jamb(d.q), color, 2.5 * px);
      seg(d.p, d.q, color, (d.kind === "main" ? 2.5 : 1.2) * px, [
        3 * px,
        3 * px,
      ]);
    }

    // Labels.
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const r of floor.rooms) {
      ctx.font = font(11, 600);
      const nameW = ctx.measureText(r.label).width;
      if (nameW > r.w - 0.2) continue;
      const area =
        r.kind !== "outdoor" && r.kind !== "stairs" && r.h > 1.6
          ? `${(r.w * r.h).toFixed(1)} m²`
          : "";
      ctx.font = font(10);
      const areaW = area ? ctx.measureText(area).width : 0;
      // A light plate behind the label keeps it readable when furniture sits in the corner.
      if (r.kind !== "outdoor") {
        const pad = 2 * px;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = c.surface;
        ctx.fillRect(
          r.x + 0.15 - pad,
          r.y + 0.15 - pad,
          Math.max(nameW, areaW) + pad * 2,
          (area ? 27 : 13) * px + pad * 2,
        );
        ctx.globalAlpha = 1;
      }
      ctx.font = font(11, 600);
      ctx.fillStyle = r.kind === "outdoor" ? c.soft : c.ink;
      ctx.fillText(r.label, r.x + 0.15, r.y + 0.15);
      if (area) {
        ctx.font = font(10);
        ctx.fillStyle = c.soft;
        ctx.fillText(area, r.x + 0.15, r.y + 0.15 + 15 * px);
      }
    }
    const main = floor.doors.find((d) => d.kind === "main");
    if (main) {
      ctx.font = font(10, 700);
      ctx.fillStyle = c.ink;
      ctx.textAlign = "center";
      const mx = (main.p[0] + main.q[0]) / 2;
      const my = (main.p[1] + main.q[1]) / 2;
      // Write the label on the outside of the door so it never sits on a room label.
      const indoorAbove = floor.rooms.some(
        (r) =>
          r.kind !== "outdoor" &&
          mx > r.x &&
          mx < r.x + r.w &&
          my - 0.3 > r.y &&
          my - 0.3 < r.y + r.h,
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
      ctx.arc(
        cx + (sun.sx / len) * k,
        cy + (sun.sy / len) * k,
        5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  }, [
    size,
    floor,
    bounds,
    patches,
    sun,
    facing,
    items,
    selected,
    flagged,
    strips,
  ]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {/* Absolutely placed so the canvas's pixel size can never feed back into the layout. */}
      <canvas
        ref={canvas}
        tabIndex={0}
        className="absolute inset-0 block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pandan-deep"
        role="application"
        aria-roledescription="floor plan"
        aria-label={`Floor plan, ${floor.label}. Tap a piece of furniture to select it, then drag it or use the arrow keys. R turns it, Delete removes it.`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          const [x, y] = toWorld(e.clientX, e.clientY);
          const hit = hitTest(items, floor.id, x, y);
          onSelect(hit?.uid ?? null);
          if (hit && !CATALOG[hit.kind].fixed) {
            drag.current = { uid: hit.uid, dx: hit.cx - x, dy: hit.cy - y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const [x, y] = toWorld(e.clientX, e.clientY);
          if (drag.current) {
            onDrag(drag.current.uid, x + drag.current.dx, y + drag.current.dy);
            return;
          }
          const hit = hitTest(items, floor.id, x, y);
          e.currentTarget.style.cursor = hit
            ? CATALOG[hit.kind].fixed
              ? "not-allowed"
              : "grab"
            : "default";
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
    </div>
  );
}
