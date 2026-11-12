"use client";

import type confettiLib from "canvas-confetti";

/**
 * The K.O. celebration: a burst from the winner's card plus two cannons from the bottom corners,
 * in the theme's own colours (read from the CSS variables at runtime, like the swipe deck's
 * confetti). canvas-confetti draws on its own fixed, pointer-events-none canvas.
 * Reduced motion: nothing fires.
 */

type Confetti = typeof confettiLib;

let lib: Promise<Confetti> | null = null;
const load = () => (lib ??= import("canvas-confetti").then((m) => m.default));

export function preloadConfetti() {
  void load();
}

const VARS = [
  "--color-kaya",
  "--color-pandan",
  "--color-raya",
  "--color-sky-deep",
  "--color-lilac",
  "--color-cloud",
];

function themeColors() {
  const root =
    document.querySelector<HTMLElement>(".homelander-world") ??
    document.documentElement;
  const cs = getComputedStyle(root);
  return VARS.map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export async function celebrateWinner(rect: DOMRect | null) {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const confetti = await load();
  const colors = themeColors();
  const origin = rect
    ? {
        x: clamp01((rect.left + rect.width / 2) / window.innerWidth),
        y: clamp01((rect.top + rect.height * 0.35) / window.innerHeight),
      }
    : { x: 0.5, y: 0.4 };
  const base: confettiLib.Options = {
    colors: colors.length ? colors : undefined,
    zIndex: 60,
    disableForReducedMotion: true,
    ticks: 110,
    gravity: 1,
    decay: 0.91,
    shapes: ["square"],
  };
  void confetti({
    ...base,
    origin,
    particleCount: 70,
    spread: 100,
    startVelocity: 40,
  });
  for (let i = 0; i < 3; i++) {
    window.setTimeout(
      () => {
        void confetti({
          ...base,
          particleCount: 32,
          angle: 60,
          spread: 55,
          startVelocity: 58,
          origin: { x: 0, y: 0.95 },
        });
        void confetti({
          ...base,
          particleCount: 32,
          angle: 120,
          spread: 55,
          startVelocity: 58,
          origin: { x: 1, y: 0.95 },
        });
      },
      160 + i * 200,
    );
  }
}
