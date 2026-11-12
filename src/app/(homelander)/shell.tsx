"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixPanel } from "@/components/homelander/pixel";
import { Sprite, defineSprite, sprites, type SpriteArt, type SpriteName } from "@/components/homelander/sprite";
import { useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";

/** Feng Shui's tab icon: a compass ring with its needle pointing north. */
const compass = defineSprite([
  "..###..",
  ".#.#.#.",
  "#..#..#",
  "#..#..#",
  "#.....#",
  ".#...#.",
  "..###..",
]);

const tabs: { href: string; label: string; icon: SpriteName | SpriteArt }[] = [
  { href: "/", label: "Map", icon: "pin" },
  { href: "/onboarding", label: "Uncle", icon: "uncle" },
  { href: "/swipe", label: "Swipe", icon: "house" },
  { href: "/battle", label: "Battle", icon: "bars" },
  { href: "/bank", label: "Bank", icon: "bank" },
  { href: "/feng-shui", label: "Feng Shui", icon: compass },
];

/** Routes whose page draws edge to edge (the landing map); the header and tab bar float over it. */
const isFullBleed = (pathname: string) => pathname === "/";

/**
 * Responsive shell. Desktop (lg and up): a web app with a top nav bar and a wide content area.
 * Phones and tablets: an app layout with a compact header and a pixel tab bar at the bottom.
 */
export function HomeLanderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { liked } = useHomeLander();
  const full = isFullBleed(pathname);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/feng-shui"
        ? pathname === "/feng-shui" || pathname.endsWith("/feng-shui")
        : pathname.startsWith(href);

  return (
    <>
      {full ? null : <Sky />}

      <div className="relative z-10 flex min-h-svh flex-col">
        <header
          className={cn(
            "z-40 w-full px-4 pt-4 pb-2 lg:px-8 lg:pt-5",
            full ? "pointer-events-none fixed inset-x-0 top-0" : "relative",
          )}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 lg:gap-6">
            <Link
              href="/"
              className="pointer-events-auto"
              aria-label="HomeLander, back to the map"
            >
              <PixPanel flat className="flex items-center gap-2 px-2.5 py-1.5">
                <Sprite art="heart" scale={3} className="text-raya" />
                <span className="font-pixel text-xl leading-none font-bold tracking-wide">
                  HOMELANDER
                </span>
              </PixPanel>
            </Link>

            {/* Desktop nav */}
            <nav
              aria-label="HomeLander"
              className="pointer-events-auto hidden lg:block"
            >
              <PixPanel flat className="flex items-center gap-1 p-1">
                {tabs.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={isActive(t.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 font-pixel text-sm leading-none whitespace-nowrap transition-colors",
                      isActive(t.href) ? "bg-kaya" : "hover:bg-sky/40",
                    )}
                  >
                    <Sprite
                      art={t.icon}
                      scale={2}
                      // Six tabs with icons need about 1,100 px; below xl (1280) the icons drop so the header fits.
                      className={cn(
                        "hidden xl:block",
                        isActive(t.href) ? "text-ink" : "text-ink-soft",
                      )}
                    />
                    {t.label}
                  </Link>
                ))}
              </PixPanel>
            </nav>

            <div className="pointer-events-auto ml-auto flex items-center gap-3">
              <PixPanel
                flat
                className="flex items-center gap-1.5 px-2.5 py-1.5 max-sm:hidden"
                aria-live="polite"
              >
                <Sprite art="heart" scale={2} className="text-raya" />
                <span className="font-pixel text-base leading-none tabular-nums">
                  {liked.length}
                  <span className="sr-only"> homes liked</span>
                </span>
              </PixPanel>
              {/* A surface behind each bare link: the Night toggle darkens the map but not these tokens, so ink-on-map was 1.19:1 */}
              <PixPanel asChild flat>
                <Link href="/admin" className="hidden px-2 py-2 font-pixel-label text-xs whitespace-nowrap lg:inline">
                  Gamuda view
                </Link>
              </PixPanel>
              <PixPanel asChild flat>
                <Link href="/profile" className="px-2 py-1.5 font-pixel text-sm">
                  Profile
                </Link>
              </PixPanel>
              <Link href="/login" className="pix-btn inline-flex min-h-9 items-center px-3 text-sm text-white" style={{ "--pix-fill": "var(--color-pandan-deep)" } as React.CSSProperties}>
                Login
              </Link>
              <Link
                href="/about"
                className="max-sm:hidden"
                aria-label="About this prototype and photo credits"
              >
                <PixPanel
                  flat
                  className="flex size-8 items-center justify-center font-pixel text-lg"
                >
                  ?
                </PixPanel>
              </Link>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "flex-1",
            full
              ? ""
              : "mx-auto w-full max-w-6xl px-4 pt-3 pb-32 lg:px-8 lg:pt-6 lg:pb-16",
          )}
        >
          {children}
        </main>
      </div>

      <TabBar isActive={isActive} />
    </>
  );
}

/** Phone and tablet only; desktop uses the top nav. */
function TabBar({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <nav
      aria-label="HomeLander tabs"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-3 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden"
    >
      <PixPanel className="grid grid-cols-6 gap-1 p-1.5">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-1.5 font-pixel-label text-[10px] uppercase transition-colors",
              isActive(t.href) ? "bg-kaya" : "hover:bg-sky/40",
            )}
          >
            <Sprite
              art={t.icon}
              scale={3}
              className={isActive(t.href) ? "text-ink" : "text-ink-soft"}
            />
            {/* Six tabs leave ~56px each, so two-word labels stack. */}
            <span className="text-center leading-[1.15] whitespace-pre-line">{t.label.replace(" ", "\n")}</span>
          </Link>
        ))}
      </PixPanel>
    </nav>
  );
}

/* Background: drifting pixel clouds and a Klang Valley skyline (twin towers, KL Tower) with one kopi on a roof. */
function Sky() {
  return (
    <div
      aria-hidden
      className="j-sky pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {[
        { top: "9%", dur: "95s", delay: "-20s", scale: 5 },
        { top: "24%", dur: "140s", delay: "-90s", scale: 4 },
        { top: "41%", dur: "120s", delay: "-50s", scale: 6 },
      ].map((c, i) => (
        <div
          key={i}
          className="absolute left-0 animate-[pix-drift_var(--d)_steps(160)_infinite]"
          style={
            {
              top: c.top,
              "--d": c.dur,
              animationDelay: c.delay,
            } as React.CSSProperties
          }
        >
          <Sprite art={sprites.cloud} scale={c.scale} />
        </div>
      ))}
      <Skyline />
    </div>
  );
}

const far = "#7cc6f6";
const near = "#5aaee8";
// [x, width, height] in skyline pixels; the twin towers and KL Tower are drawn separately.
const farBlocks: [number, number, number][] = [
  [0, 14, 18],
  [12, 10, 26],
  [24, 16, 14],
  [44, 12, 30],
  [70, 18, 20],
  [92, 10, 34],
  [104, 14, 22],
  [122, 12, 28],
  [168, 14, 24],
  [186, 10, 32],
  [198, 16, 18],
  [216, 12, 26],
  [230, 14, 16],
];
const nearBlocks: [number, number, number][] = [
  [4, 18, 10],
  [26, 12, 14],
  [40, 20, 8],
  [78, 16, 12],
  [98, 22, 9],
  [130, 14, 13],
  [176, 20, 11],
  [200, 12, 15],
  [214, 24, 9],
];

function Skyline() {
  const H = 64;
  return (
    <svg
      viewBox={`0 0 244 ${H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className="absolute inset-x-0 bottom-0 h-[34vh] w-full"
    >
      {farBlocks.map(([x, w, h]) => (
        <rect key={`f${x}`} x={x} y={H - h} width={w} height={h} fill={far} />
      ))}
      {/* KL Tower */}
      <rect x={60} y={H - 40} width={2} height={40} fill={far} />
      <rect x={57} y={H - 44} width={8} height={4} fill={far} />
      <rect x={58} y={H - 45} width={6} height={1} fill={far} />
      <rect x={60.5} y={H - 52} width={1} height={7} fill={far} />
      {/* Twin towers with skybridge */}
      {[146, 158].map((x) => (
        <g key={x} fill={far}>
          <rect x={x} y={H - 46} width={8} height={46} />
          <rect x={x + 1} y={H - 50} width={6} height={4} />
          <rect x={x + 2} y={H - 53} width={4} height={3} />
          <rect x={x + 3.5} y={H - 60} width={1} height={7} />
        </g>
      ))}
      <rect x={154} y={H - 30} width={4} height={2} fill={far} />
      {nearBlocks.map(([x, w, h]) => (
        <rect key={`n${x}`} x={x} y={H - h} width={w} height={h} fill={near} />
      ))}
      {/* the hidden kopi, on a roof */}
      <g transform={`translate(203 ${H - 15 - 8})`}>
        {sprites.kopi.rows.map((row, y) =>
          [...row].map((ch, x) =>
            ch === "." ? null : (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={sprites.kopi.colors?.[ch] ?? near}
              />
            ),
          ),
        )}
      </g>
    </svg>
  );
}
