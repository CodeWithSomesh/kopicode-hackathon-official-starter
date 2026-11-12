"use client";

import type confettiLib from "canvas-confetti";
import { DECK_LIKE_LIMIT, LIKES_TO_BATTLE } from "@/lib/homelander/recommend";

/**
 * The like celebration: a short burst of hearts and confetti from where the card was, in the
 * theme's own colours (read from the CSS variables at runtime, so a theme switch just works).
 * canvas-confetti draws on its own fixed, pointer-events-none canvas, so it never blocks input.
 * Bigger party on the like that unlocks Battle, and on the one that fills the deck.
 */

type Confetti = typeof confettiLib;
type Origin = { x: number; y: number };

let lib: Promise<Confetti> | null = null;
let heart: confettiLib.Shape | null | undefined;

const load = () => (lib ??= import("canvas-confetti").then((m) => m.default));

/** Load the library ahead of the first like so the burst is instant. */
export function preloadConfetti() {
  void load();
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const VARS = ["--color-pandan", "--color-kaya", "--color-raya", "--color-sky-deep"];
// Heart from the canvas-confetti docs (shapeFromPath).
const HEART =
  "M167 72c19,-38 37,-56 75,-56 42,0 76,33 76,75 0,76 -76,151 -151,227 -76,-76 -151,-151 -151,-227 0,-42 33,-75 75,-75 38,0 57,18 76,56z";

function themeColors() {
  const root = document.querySelector<HTMLElement>(".homelander-world") ?? document.documentElement;
  const cs = getComputedStyle(root);
  const colors = VARS.map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
  return [...colors, "#ffffff"];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function originOf(rect: DOMRect | null): Origin {
  if (!rect) return { x: 0.5, y: 0.45 };
  return {
    x: clamp01((rect.left + rect.width / 2) / window.innerWidth),
    y: clamp01((rect.top + rect.height * 0.42) / window.innerHeight),
  };
}

/** Fire the like celebration. `likeCount` is the buyer's like count including this one. */
export async function celebrateLike(rect: DOMRect | null, likeCount: number) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  navigator.vibrate?.(likeCount === LIKES_TO_BATTLE || likeCount === DECK_LIKE_LIMIT ? [15, 40, 25] : 15);

  const confetti = await load();
  if (heart === undefined) {
    try {
      heart = confetti.shapeFromPath({ path: HEART });
    } catch {
      heart = null;
    }
  }
  const colors = themeColors();
  const origin = originOf(rect);
  const base: confettiLib.Options = {
    origin,
    colors,
    zIndex: 60,
    disableForReducedMotion: true,
    ticks: 80,
    gravity: 1.1,
    decay: 0.91,
  };

  // Hearts float up a little slower and bigger; the confetti pops wider around them.
  void confetti({
    ...base,
    particleCount: 18,
    spread: 70,
    startVelocity: 30,
    scalar: 1.7,
    angle: 90,
    shapes: heart ? [heart] : ["circle"],
    flat: true,
  });
  void confetti({ ...base, particleCount: 46, spread: 110, startVelocity: 38, scalar: 0.9, shapes: ["square", "circle"] });

  if (likeCount === LIKES_TO_BATTLE) partyCannons(confetti, base, 3);
  else if (likeCount === DECK_LIKE_LIMIT) {
    partyCannons(confetti, base, 5);
    fireworks(confetti, base);
  }
}

/** Two cannons from the bottom corners, a few volleys. */
function partyCannons(confetti: Confetti, base: confettiLib.Options, volleys: number) {
  for (let i = 0; i < volleys; i++) {
    window.setTimeout(() => {
      void confetti({ ...base, ticks: 110, particleCount: 34, angle: 60, spread: 55, startVelocity: 58, origin: { x: 0, y: 0.95 } });
      void confetti({ ...base, ticks: 110, particleCount: 34, angle: 120, spread: 55, startVelocity: 58, origin: { x: 1, y: 0.95 } });
    }, 140 + i * 180);
  }
}

/** A few bursts high on the screen for the full deck. */
function fireworks(confetti: Confetti, base: confettiLib.Options) {
  const spots: Origin[] = [
    { x: 0.25, y: 0.3 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.2 },
  ];
  spots.forEach((origin, i) => {
    window.setTimeout(
      () =>
        void confetti({
          ...base,
          origin,
          ticks: 100,
          particleCount: 70,
          spread: 360,
          startVelocity: 26,
          gravity: 0.8,
          shapes: heart && i === 2 ? [heart] : ["circle", "square"],
          scalar: heart && i === 2 ? 1.4 : 1,
        }),
      450 + i * 260,
    );
  });
}
