import type { LatLng } from "./data";

/**
 * ESTIMATED toll for a drive. No API prices Malaysian tolls, so this is a hand-built table of
 * Klang Valley toll plazas (Class 1, private car, RM) and a rough guess at which ones a commute
 * passes. Always show it to buyers as "estimated". CONTRACT: keep the signatures.
 *
 * Rates (Class 1):
 * - motorist.my "List of Malaysia highway toll rates" (updated 22 May 2026), read 12 Nov 2026:
 *   LDP, SPRINT, KESAS, NPE, SILK, Grand Saga, MEX, DUKE, LATAR, GCE.
 *   https://www.motorist.my/article/2829/list-of-malaysia-highway-toll-rates-plus-klk-lpt-and-others
 * - GCE also matches PROLINTAS's rate page (RM1.75, undated).
 * - `approx: true` marks rates I could not confirm from a 2025/2026 source (PLUS/NKVE open
 *   plazas, SKVE, ELITE). They are best guesses; check the operator before quoting.
 * Positions: OpenStreetMap / Nominatim building outlines of each plaza (ODbL), read 12 Nov 2026;
 * `approx: true` plazas without an OSM match are placed by hand to about 1 km.
 *
 * Batu Tiga and Sungai Rasau (Federal Highway) were abolished in 2020 and are not listed.
 */

export type TollPlaza = { id: string; name: string; highway: string; pos: LatLng; class1RM: number; approx?: boolean };

export type TollEstimate = { plazas: TollPlaza[]; oneWayRM: number };

const p = (id: string, name: string, highway: string, lat: number, lng: number, class1RM: number, approx?: boolean): TollPlaza => ({
  id, name, highway, pos: { lat, lng }, class1RM, ...(approx ? { approx } : {}),
});

export const plazas: TollPlaza[] = [
  // LDP (Damansara–Puchong)
  p("ldp-penchala", "Penchala", "LDP", 3.157, 101.612, 2.1, true), // rate confirmed, position by hand
  p("ldp-pj", "Petaling Jaya", "LDP", 3.0605, 101.6136, 2.1),
  p("ldp-puchong-barat", "Puchong Barat", "LDP", 3.0209, 101.6023, 2.1),
  p("ldp-puchong-selatan", "Puchong Selatan", "LDP", 2.9813, 101.6363, 2.1),
  // SPRINT
  p("sprint-damansara", "Damansara", "SPRINT", 3.13, 101.6402, 2.0),
  p("sprint-pantai", "Pantai (Kerinchi Link)", "SPRINT", 3.1302, 101.6616, 2.5),
  p("sprint-bukit-kiara", "Bukit Kiara", "SPRINT", 3.153, 101.634, 3.0, true), // rate confirmed, position by hand
  // NPE
  p("npe-pantai-dalam", "Pantai Dalam", "NPE", 3.0921, 101.6706, 2.3),
  p("npe-pjs2", "Petaling Jaya Selatan 2", "NPE", 3.0839, 101.6314, 1.0),
  p("npe-pjs5", "Petaling Jaya Selatan 5", "NPE", 3.0792, 101.6234, 2.3),
  // KESAS
  p("kesas-kemuning", "Kemuning", "KESAS", 2.9973, 101.5221, 2.0),
  p("kesas-sunway", "Sunway", "KESAS", 3.0587, 101.6083, 2.0),
  p("kesas-awan-besar", "Awan Besar", "KESAS", 3.065, 101.672, 2.0),
  // SKVE
  p("skve-saujana-putra", "Bandar Saujana Putra", "SKVE", 2.956, 101.5799, 2.0, true),
  // ELITE / NSE Central Link (closed system; Gamuda Cove to KL)
  p("elite-putrajaya", "Putrajaya (NSE Central Link)", "ELITE", 2.9251, 101.6128, 2.5, true),
  // MEX
  p("mex-putrajaya", "Putrajaya", "MEX", 2.9501, 101.6517, 3.5),
  p("mex-salak-selatan", "Salak Selatan", "MEX", 3.1106, 101.7119, 2.0),
  // SILK and Grand Saga (Kajang)
  p("silk-bukit-kajang", "Bukit Kajang", "SILK", 2.9756, 101.815, 1.66),
  p("silk-sungai-long", "Sungai Long", "SILK", 3.0278, 101.8103, 1.66),
  p("saga-batu-9", "Batu 9", "Grand Saga", 3.0745, 101.7604, 1.3),
  // PLUS (NSE / NKVE): closed system priced by entry/exit; flat approximations for the KL end.
  p("plus-sungai-buloh", "Sungai Buloh", "PLUS NSE", 3.2015, 101.586, 2.6, true),
  p("nkve-bukit-lanjan", "Bukit Lanjan", "NKVE", 3.168, 101.617, 1.6, true),
  // DUKE
  p("duke-segambut", "Segambut", "DUKE", 3.1903, 101.6555, 2.5),
  // GCE and LATAR (north: Gamuda Gardens, Gardens Park, Kundang)
  p("gce-lagong", "Lagong", "GCE", 3.2622, 101.5392, 1.75),
  p("gce-elmina", "Elmina", "GCE", 3.2037, 101.5073, 1.75),
  p("latar-kuang-timur", "Kuang Timur", "LATAR", 3.2708, 101.5305, 2.5),
  p("latar-kundang-timur", "Kundang Timur", "LATAR", 3.2716, 101.5083, 1.3),
];

/** Corridor half-width around the straight line, km. */
const CORRIDOR_KM = 2.5;
/** At most this many plazas per highway (open-system plazas are a few km apart along a route). */
const MAX_PER_HIGHWAY = 2;
/** A real route uses one or two tolled highways; keep the ones closest to the straight line. */
const MAX_HIGHWAYS = 2;
/** Never charge more than this many plazas one way. */
const MAX_PLAZAS = 3;

/** Local flat projection (km) around `o`; fine at Klang Valley distances. */
function toXY(o: LatLng, q: LatLng) {
  const kx = 111.32 * Math.cos((o.lat * Math.PI) / 180);
  return { x: (q.lng - o.lng) * kx, y: (q.lat - o.lat) * 110.57 };
}

/**
 * Rough one-way toll estimate between two points. Deterministic heuristic, NOT routing:
 * 1. treat the drive as the straight segment from → to, buffered by CORRIDOR_KM;
 * 2. every plaza inside that corridor (and between the ends) is paid once (open-system flat fee);
 * 3. keep at most MAX_PER_HIGHWAY plazas per highway and the MAX_HIGHWAYS highways whose plazas
 *    sit closest to the line, since parallel highways are alternatives, not both driven, and at
 *    most MAX_PLAZAS in all (toll-free roads such as the Federal Highway are not modelled, so
 *    this leans high for routes that can avoid tolls);
 * 4. return the plazas in order along the segment and their sum.
 * Trips under 3 km pay nothing. Outside the Klang Valley the table is empty, so the toll is 0.
 */
export function estimateTolls(from: LatLng, to: LatLng): TollEstimate {
  const b = toXY(from, to);
  const len = Math.hypot(b.x, b.y);
  if (len < 3) return { plazas: [], oneWayRM: 0 };

  const hits = plazas
    .map((pl) => {
      const q = toXY(from, pl.pos);
      const t = (q.x * b.x + q.y * b.y) / (len * len);
      const off = Math.abs(q.x * b.y - q.y * b.x) / len;
      return { pl, t, off };
    })
    .filter((h) => h.t > -0.02 && h.t < 1.02 && h.off <= CORRIDOR_KM);

  const byHighway = new Map<string, typeof hits>();
  for (const h of [...hits].sort((a, c) => a.off - c.off || a.pl.id.localeCompare(c.pl.id))) {
    const list = byHighway.get(h.pl.highway) ?? [];
    if (list.length < MAX_PER_HIGHWAY) list.push(h);
    byHighway.set(h.pl.highway, list);
  }
  const chosen = [...byHighway.entries()]
    .sort((a, c) => a[1][0]!.off - c[1][0]!.off || a[0].localeCompare(c[0]))
    .slice(0, MAX_HIGHWAYS)
    .flatMap(([, list]) => list)
    .sort((a, c) => a.off - c.off || a.pl.id.localeCompare(c.pl.id))
    .slice(0, MAX_PLAZAS)
    .sort((a, c) => a.t - c.t);

  const oneWayRM = Math.round(chosen.reduce((sum, h) => sum + h.pl.class1RM, 0) * 100) / 100;
  return { plazas: chosen.map((h) => h.pl), oneWayRM };
}
