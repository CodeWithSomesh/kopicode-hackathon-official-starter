import type { Compass, LngLat } from "./types";

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. Points are [lng, lat]. */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial compass bearing a → b in degrees, 0 = north, clockwise, 0..360. */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const POINTS: Compass[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compassOf = (deg: number): Compass => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Walking minutes at 80 m a minute, rounded up (a 1 m walk is still 1 minute). */
export const walkingMinutes = (metres: number): number => Math.ceil(metres / 80);

/** Centre of a ring (mean of its points, ignoring the repeated closing point). */
export function centroid(ring: LngLat[]): LngLat {
  const pts = ring.slice(0, -1);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Nearest item (station, place…) to a point, with metres. */
export function nearest<T extends { lng: number; lat: number }>(from: LngLat, items: T[]): { item: T; metres: number } {
  let best: { item: T; metres: number } | undefined;
  for (const item of items) {
    const metres = distanceM(from, [item.lng, item.lat]);
    if (!best || metres < best.metres) best = { item, metres };
  }
  if (!best) throw new Error("nearest: empty list");
  return best;
}

// Self-check: `npm run check:geo`. Known points: KLCC (3.1579, 101.7116) to KL Sentral (3.1343, 101.6869). Needs Node 22.18+ (runs .ts directly).
export function selfCheck() {
  const klcc: LngLat = [101.7116, 3.1579];
  const sentral: LngLat = [101.6869, 3.1343];
  const d = distanceM(klcc, sentral);
  if (Math.abs(d - 3_730) > 100) throw new Error(`distance off: ${d}`);
  const b = bearingDeg(klcc, sentral);
  if (b < 220 || b > 230) throw new Error(`bearing off: ${b}`); // south-west
  // one degree of latitude is ~111.2 km; due north bearing is 0
  if (Math.abs(distanceM([0, 0], [0, 1]) - 111_195) > 50) throw new Error("1deg lat off");
  if (bearingDeg([0, 0], [0, 1]) !== 0) throw new Error("north bearing off");
  if (walkingMinutes(801) !== 11) throw new Error("walking minutes off");
  console.log(`geo self-check ok: ${Math.round(d)} m, bearing ${b.toFixed(1)}° (${compassOf(b)})`);
}

if (process.argv[1]?.endsWith("geo.ts")) selfCheck();
