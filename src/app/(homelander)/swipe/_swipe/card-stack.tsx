"use client";

import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./confetti";

export type Dir = "left" | "right";

export type StackHandle = {
  /** Throw the top card off (buttons and arrow keys). */
  fling: (dir: Dir) => void;
  /** Bring the top card back in from a side (after undo). */
  returnFrom: (dir: Dir) => void;
};

/** Drag distance (px) that counts as a decision on release. */
export const THRESHOLD = 110;
/** Release speed (px/ms) that counts as a flick even under the threshold. */
const FLICK_SPEED = 0.55;
const MAX_TILT = 22;
const BEHIND = 2;

/** A damped spring sampled into a CSS linear() easing: real overshoot and settle, no JS loop. */
function springEasing(damping = 0.52, freq = 1.55, points = 48) {
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - damping ** 2);
  const out: string[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points; // seconds over a 1s curve; the duration scales it
    const v = 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
    out.push(i === points ? "1" : v.toFixed(4));
  }
  return `linear(${out.join(", ")})`;
}
const SPRING = springEasing();
const SETTLE = springEasing(0.7, 1.4);

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);

type Phase = "idle" | "drag" | "spring" | "fling" | "return";

type Props<T extends { id: string }> = {
  ref?: Ref<StackHandle>;
  /** Top card first; up to three are drawn. */
  cards: T[];
  renderCard: (card: T, isTop: boolean) => ReactNode;
  /** What the right-hand stamp says for a card ("SUKA!", or "PING ME" when sold out). */
  yesLabel: (card: T) => string;
  /** Labels the top card for screen readers. */
  label: (card: T) => string;
  /** Dragging is off while the details sheet is open. */
  dragDisabled?: boolean;
  /** A decision has been made and the card is leaving (fires before the animation). */
  onRelease: (dir: Dir, card: T, rect: DOMRect | null) => void;
  /** The card has left: commit the decision. */
  onDone: (dir: Dir, card: T) => void;
  /** A tap (no drag) on the card. */
  onTap?: () => void;
};

/**
 * The physical deck. The top card follows the pointer with a continuous tilt (it pivots
 * around where you grabbed it), springs back if you let go early, and flies out along your
 * release velocity if you flick or drag past the threshold. The next two cards sit behind,
 * scaled and offset, and rise as the top one leaves. Transforms only, so it stays on the GPU.
 */
export function CardStack<T extends { id: string }>({
  ref,
  cards,
  renderCard,
  yesLabel,
  label,
  dragDisabled,
  onRelease,
  onDone,
  onTap,
}: Props<T>) {
  const t = useT();
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [flingMs, setFlingMs] = useState(320);
  const [tiltSign, setTiltSign] = useState(1);
  const topEl = useRef<HTMLDivElement>(null);
  const grab = useRef({ x: 0, y: 0, t: 0, moved: 0 });
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const timer = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const top = cards[0];
  const reduced = useReducedMotion();

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  // After undo the card is placed off-screen with no transition; on the next frames, spring it home.
  useEffect(() => {
    if (phase !== "return") return;
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => {
        setX(0);
        setY(0);
        phaseRef.current = "spring";
        setPhase("spring");
      });
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [phase]);

  function launch(dir: Dir, vx: number, vy: number) {
    const card = top;
    const el = topEl.current;
    if (!card || phaseRef.current === "fling") return;
    const rect = el?.getBoundingClientRect() ?? null;
    onRelease(dir, card, rect);
    if (prefersReducedMotion() || !el) {
      onDone(dir, card);
      setX(0);
      setY(0);
      go("idle");
      return;
    }
    // Throw it far enough that the card (tilted) clears the viewport edge.
    const width = el.offsetWidth;
    const homeLeft = (rect?.left ?? 0) - x;
    const targetX = dir === "right" ? window.innerWidth - homeLeft + width * 0.35 : -(homeLeft + width * 1.35);
    const speed = Math.max(Math.abs(vx), 1.3);
    const ms = Math.round(Math.min(Math.max(Math.abs(targetX - x) / speed, 200), 420));
    setFlingMs(ms);
    go("fling");
    setX(targetX);
    setY(y + (vy ? vy * ms * 0.6 : -24));
    timer.current = window.setTimeout(() => {
      onDone(dir, card);
      setX(0);
      setY(0);
      go("idle");
    }, ms);
  }

  useImperativeHandle(ref, () => ({
    fling: (dir) => {
      setTiltSign(1);
      launch(dir, 0, 0);
    },
    returnFrom: (dir) => {
      if (prefersReducedMotion()) return;
      if (timer.current) window.clearTimeout(timer.current);
      setTiltSign(1);
      setX(dir === "right" ? window.innerWidth * 0.9 : -window.innerWidth * 0.9);
      setY(-30);
      go("return");
    },
  }));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragDisabled || phaseRef.current === "fling" || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-no-drag]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Grab the top half and it tips one way; grab the bottom and it tips the other.
    setTiltSign(e.clientY - rect.top < rect.height / 2 ? 1 : -1);
    grab.current = { x: e.clientX - x, y: e.clientY - y, t: performance.now(), moved: 0 };
    samples.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    e.currentTarget.setPointerCapture?.(e.pointerId);
    go("drag");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "drag") return;
    const nx = e.clientX - grab.current.x;
    // Vertical movement is damped: the card floats, it doesn't slide.
    const ny = (e.clientY - grab.current.y) * 0.35;
    grab.current.moved = Math.max(grab.current.moved, Math.hypot(nx, ny));
    const now = performance.now();
    samples.current.push({ x: e.clientX, y: e.clientY, t: now });
    while (samples.current.length > 2 && now - samples.current[0]!.t > 90) samples.current.shift();
    setX(nx);
    setY(ny);
  };

  const onPointerUp = () => {
    if (phaseRef.current !== "drag") return;
    const s = samples.current;
    const first = s[0]!;
    const last = s.at(-1)!;
    const dt = Math.max(last.t - first.t, 1);
    const vx = (last.x - first.x) / dt;
    const vy = ((last.y - first.y) / dt) * 0.35;
    if (grab.current.moved < 6 && performance.now() - grab.current.t < 350) {
      go("spring");
      setX(0);
      setY(0);
      onTap?.();
      return;
    }
    const flickRight = vx > FLICK_SPEED && x > 30;
    const flickLeft = vx < -FLICK_SPEED && x < -30;
    if (x > THRESHOLD || flickRight) launch("right", Math.max(vx, 0), vy);
    else if (x < -THRESHOLD || flickLeft) launch("left", Math.min(vx, 0), vy);
    else {
      go("spring");
      setX(0);
      setY(0);
    }
  };

  const onPointerCancel = () => {
    if (phaseRef.current !== "drag") return;
    go("spring");
    setX(0);
    setY(0);
  };

  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, x * 0.065 * tiltSign));
  // How far the rest of the deck has risen: follows the drag, complete once the card is thrown.
  const rise = phase === "fling" ? 1 : Math.min(Math.abs(x) / (THRESHOLD * 1.6), 1);
  const stamping = phase === "drag" || phase === "fling";
  const yes = stamping ? Math.min(Math.max(x / THRESHOLD, 0), 1) : 0;
  const no = stamping ? Math.min(Math.max(-x / THRESHOLD, 0), 1) : 0;

  const topTransition =
    reduced || phase === "drag" || phase === "return"
      ? "none"
      : phase === "fling"
        ? `transform ${flingMs}ms cubic-bezier(0.2, 0.6, 0.35, 1)`
        : `transform 620ms ${SPRING}`;

  const visible = cards.slice(0, BEHIND + 1);

  return (
    <div className="relative h-[clamp(360px,calc(100svh-26rem),560px)] lg:h-[clamp(440px,64svh,640px)] w-full [perspective:1600px]">
      {visible
        .map((card, i) => {
          const isTop = i === 0;
          const depth = isTop ? 0 : i - rise;
          const transform = isTop
            ? `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg) scale(1)`
            : `translate3d(0px, ${depth * 16}px, 0) rotate(0deg) scale(${1 - depth * 0.05})`;
          return (
            <div
              key={card.id}
              ref={isTop ? topEl : undefined}
              aria-hidden={isTop ? undefined : true}
              inert={!isTop}
              role={isTop ? "group" : undefined}
              aria-roledescription={isTop ? "card" : undefined}
              aria-label={isTop ? label(card) : undefined}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerCancel : undefined}
              className={cn(
                "pix-frame absolute inset-0 overflow-hidden will-change-transform",
                isTop ? "touch-pan-y" : "pointer-events-none",
                isTop && !dragDisabled && (phase === "drag" ? "cursor-grabbing" : "cursor-grab"),
                i === BEHIND && "animate-in duration-300 fade-in-0 motion-reduce:animate-none",
              )}
              style={
                {
                  zIndex: 10 - i,
                  transform,
                  transformOrigin: isTop ? (tiltSign > 0 ? "50% 110%" : "50% -10%") : "50% 100%",
                  transition: isTop ? topTransition : reduced || phase === "drag" ? "none" : `transform 460ms ${SETTLE}`,
                  "--pix-drop": isTop ? "6px" : "0px",
                } as React.CSSProperties
              }
            >
              {renderCard(card, isTop)}
              {isTop ? (
                <>
                  <Stamp side="left" opacity={yes} className="text-pandan-deep">
                    {yesLabel(card)}
                  </Stamp>
                  <Stamp side="right" opacity={no} className="text-raya-deep">
                    {t("PASS")}
                  </Stamp>
                </>
              ) : (
                // Cards further back are dimmed a touch, so the top one reads as the one in hand.
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-ink transition-opacity duration-300"
                  style={{ opacity: Math.max(0, depth) * 0.12 }}
                />
              )}
            </div>
          );
        })
        .reverse()}
    </div>
  );
}

/** Rubber stamp that inks in with drag distance. */
function Stamp({ side, opacity, className, children }: { side: "left" | "right"; opacity: number; className?: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{ opacity, transform: `rotate(${side === "left" ? -14 : 14}deg) scale(${1.25 - opacity * 0.25})` }}
      className={cn(
        "pointer-events-none absolute top-16 rounded-xl transition-opacity duration-150 border-[5px] border-current bg-white/90 px-4 py-1.5 font-pixel text-4xl leading-none tracking-wider sm:text-5xl",
        side === "left" ? "left-5 origin-top-left" : "right-5 origin-top-right",
        className,
      )}
    >
      {children}
    </span>
  );
}
