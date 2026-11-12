import type { Floor, Pt, Room } from "./plans";

/**
 * Sun position and sunlight on the floor plan. A small solar formula (declination, hour
 * angle, equation of time) is accurate to a degree or two, plenty for "panas tak?".
 */

export const FACINGS = [
  { deg: 0, short: "N", name: "North", malay: "Utara" },
  { deg: 45, short: "NE", name: "North-east", malay: "Timur laut" },
  { deg: 90, short: "E", name: "East", malay: "Timur" },
  { deg: 135, short: "SE", name: "South-east", malay: "Tenggara" },
  { deg: 180, short: "S", name: "South", malay: "Selatan" },
  { deg: 225, short: "SW", name: "South-west", malay: "Barat daya" },
  { deg: 270, short: "W", name: "West", malay: "Barat" },
  { deg: 315, short: "NW", name: "North-west", malay: "Barat laut" },
] as const;

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MID_MONTH_DAY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

export type SunInput = {
  lat: number;
  lng: number;
  month: number;
  time: number;
  facing: number;
};

export type Sun = {
  up: boolean;
  /** Bearing from north, degrees. */
  azimuth: number;
  /** Height above the horizon, degrees. */
  elevation: number;
  /** Unit vector toward the sun in plan space (x right, y down; up on the plan = facing). */
  sx: number;
  sy: number;
  /** Vertical component of the same unit vector. */
  sz: number;
};

const rad = Math.PI / 180;

export function sunAt({ lat, lng, month, time, facing }: SunInput): Sun {
  const day = MID_MONTH_DAY[month - 1];
  const decl = 23.44 * rad * Math.sin((2 * Math.PI * (284 + day)) / 365);
  const b = (2 * Math.PI * (day - 81)) / 364;
  const eotMin =
    9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  // Malaysia runs on UTC+8 (meridian 120°E), so solar noon lands around 1:10 pm.
  const solarNoon = 12 + (120 - lng) / 15 - eotMin / 60;
  const hour = 15 * (time - solarNoon) * rad;
  const phi = lat * rad;

  const east = -Math.cos(decl) * Math.sin(hour);
  const north =
    Math.cos(phi) * Math.sin(decl) -
    Math.sin(phi) * Math.cos(decl) * Math.cos(hour);
  const upZ =
    Math.sin(phi) * Math.sin(decl) +
    Math.cos(phi) * Math.cos(decl) * Math.cos(hour);

  // Plan "up" points at compass bearing `facing`; plan "right" is 90° clockwise of it.
  const f = facing * rad;
  const sx = east * Math.cos(f) - north * Math.sin(f);
  const sy = -(east * Math.sin(f) + north * Math.cos(f));

  let azimuth = Math.atan2(east, north) / rad;
  if (azimuth < 0) azimuth += 360;
  const elevation = Math.asin(Math.max(-1, Math.min(1, upZ))) / rad;
  return { up: upZ > 0.02, azimuth, elevation, sx, sy, sz: upZ };
}

export type Patch = { room: string; poly: Pt[] };

/** Where direct sun lands on the floor: each window's sill-to-head band projected through it. */
export function sunPatches(
  floor: Floor,
  sun: Sun,
  curtains: ReadonlySet<string>,
): Patch[] {
  if (!sun.up) return [];
  const out: Patch[] = [];
  for (const w of floor.windows) {
    if (curtains.has(w.room)) continue;
    if (sun.sx * w.n[0] + sun.sy * w.n[1] <= 0) continue;
    const shift = (h: number): Pt => [
      (-sun.sx * h) / sun.sz,
      (-sun.sy * h) / sun.sz,
    ];
    const a = shift(w.sill);
    const b = shift(w.head);
    out.push({
      room: w.room,
      poly: [
        [w.p[0] + a[0], w.p[1] + a[1]],
        [w.q[0] + a[0], w.q[1] + a[1]],
        [w.q[0] + b[0], w.q[1] + b[1]],
        [w.p[0] + b[0], w.p[1] + b[1]],
      ],
    });
  }
  return out;
}

function inPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}

/** Share of a room's floor in direct sun, sampled on a 20 cm grid. */
export function sunShare(room: Room, patches: Patch[]) {
  const mine = patches.filter((p) => p.room === room.id);
  if (!mine.length) return 0;
  const step = 0.2;
  let n = 0;
  let hit = 0;
  for (let y = room.y + step / 2; y < room.y + room.h; y += step) {
    for (let x = room.x + step / 2; x < room.x + room.w; x += step) {
      n++;
      if (mine.some((p) => inPoly(x, y, p.poly))) hit++;
    }
  }
  return n ? hit / n : 0;
}

export type Heat = { share: number; level: "cool" | "warm" | "hot" };

export const heatOf = (share: number): Heat => ({
  share,
  level: share < 0.05 ? "cool" : share < 0.2 ? "warm" : "hot",
});

/** Sun share of one room at every half hour from 7 am to 7 pm, for the day strip. */
export function dayStrip(
  floor: Floor,
  roomId: string,
  base: Omit<SunInput, "time">,
  curtains: ReadonlySet<string>,
) {
  const room = floor.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  const out: { time: number; share: number }[] = [];
  for (let t = 7; t < 19; t += 0.5) {
    const s = sunAt({ ...base, time: t + 0.25 });
    out.push({
      time: t,
      share: sunShare(room, sunPatches(floor, s, curtains)),
    });
  }
  return out;
}

export function timeLabel(t: number) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${t < 12 ? "am" : "pm"}`;
}

export function bearingLabel(az: number) {
  return FACINGS[Math.round(az / 45) % 8].name.toLowerCase();
}
