// Illustrative building layout for the 15 Gamuda Land sites -> src/lib/first-key/site-layout.json
//   node scripts/site-layout.mjs              fetch (cached) + lay out + assert + print table + write JSON
//   node scripts/site-layout.mjs --fetch      only fetch/cache Overpass responses
// Offline after the first fetch (cache: $SITE_LAYOUT_CACHE or <tmpdir>/site-layout-cache). Deterministic: PRNG seeded per site.
// ILLUSTRATIVE: made-up buildings typed by what Gamuda really builds at each site (research: 2nd-brain
// notes/research/2026-11-12-gamuda-hackathon/sites/<id>.md). Not Gamuda's plans.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "../src/lib/first-key/site-layout.json");
const CACHE = process.env.SITE_LAYOUT_CACHE || path.join(os.tmpdir(), "site-layout-cache");
const OVERPASS = "https://overpass-api.de/api/interpreter";

/* ------------------------------------------------------------------ variants (w along the row, d, h in metres) */
// kind: row = back-to-back row pairs (6 m back lane); det = detached/semi-D lines (8 m between back-to-back lines);
//       one = single line (shoplots, office, mall, clubhouse); tower = single line, towers 40 m apart. gap = metres between neighbours along the row.
export const VAR = {
  "terrace-2-gable-6": { w: 39, d: 20, h: 9, kind: "row", gap: 8 },
  "terrace-2-gable-8": { w: 52, d: 20, h: 9, kind: "row", gap: 8 },
  "terrace-3-gable-6": { w: 39, d: 20, h: 12, kind: "row", gap: 8 },
  "link-2-gable-4": { w: 30, d: 20, h: 9, kind: "row", gap: 8 },
  "superlink-2-gable-6": { w: 47, d: 24, h: 9, kind: "row", gap: 8 },
  "townhouse-3-flat-6": { w: 42, d: 16, h: 12, kind: "row", gap: 8 },
  "cluster-2-hip": { w: 24, d: 22, h: 9, kind: "det", gap: 8 },
  "cluster-3-hip": { w: 24, d: 22, h: 12, kind: "det", gap: 8 },
  "semid-2-hip": { w: 26, d: 14, h: 9, kind: "det", gap: 8 },
  "semid-3-hip": { w: 26, d: 14, h: 12, kind: "det", gap: 8 },
  "bungalow-2-hip": { w: 15, d: 18, h: 9, kind: "det", gap: 8 },
  "bungalow-3-hip": { w: 15, d: 18, h: 12, kind: "det", gap: 8 },
  "shoplot-2-flat-8": { w: 52, d: 22, h: 9, kind: "one", gap: 8 },
  "shoplot-3-flat-8": { w: 52, d: 24, h: 13, kind: "one", gap: 8 },
  "office-9-curtain": { w: 40, d: 30, h: 34, kind: "one", gap: 12 },
  "mall-3-flat": { w: 90, d: 60, h: 15, kind: "one", gap: 12 },
  "clubhouse-2-flat": { w: 30, d: 20, h: 9, kind: "one", gap: 12 },
  "tower-10-balcony": { w: 36, d: 20, h: 31, kind: "tower", gap: 40 },
  "tower-25-balcony": { w: 40, d: 22, h: 78, kind: "tower", gap: 40 },
  "tower-27-balcony": { w: 40, d: 22, h: 84, kind: "tower", gap: 40 },
  "tower-30-balcony": { w: 40, d: 22, h: 93, kind: "tower", gap: 40 },
  "tower-31-fins": { w: 42, d: 22, h: 96, kind: "tower", gap: 40 },
  "tower-33-curtain": { w: 42, d: 24, h: 102, kind: "tower", gap: 40 },
  "tower-42-column": { w: 44, d: 26, h: 130, kind: "tower", gap: 40 },
  "tower-46-column": { w: 44, d: 26, h: 143, kind: "tower", gap: 40 },
};

/* ------------------------------------------------------------------ sites
 * pin = src/lib/homelander/data.ts (Gardens Park / Bukit Bantayan already corrected). zones = programmes in priority order:
 *   at: research parcel [lng,lat] (+ rad) or null = "empty land near the pin" (fallback search, <= 1.5 km)
 *   R: zone radius (m); items: [variant, wanted count] ordered from the road edge inwards (shoplots first, towers next, landed behind).
 * Counts are buildings (a terrace row of 6 counts once). Cap 60 per site (asserted).
 * noGo (Cove only): the Cove block (5 towers around CENTER) + the landed enclave another lane places. */
const COVE_CENTER = [101.6097, 2.8806];
export const SITES = [
  { id: "cove", name: "Gamuda Cove", pin: [101.6091, 2.8828], parcels: [[101.6138, 2.8903], [101.618, 2.8918], [101.6014, 2.8881]],
    noGo: { circle: { c: COVE_CENTER, r: 600 }, rects: [{ e: -580, n: 50, hw: 130 + 40, hh: 90 + 40 }, // landed enclave (landed.ts ZONE, 260 x 180 m) + 40 m margin
      { e: -580, n: 186, hw: 4 + 40, hh: 46 + 40 }] }, // its made-up access road, 92 m north from the gate to the real road, + 40 m margin
    note: "Own illustrative towers + landed enclave already exist here; only shop offices, retail and the clubhouse spawn, all >= 600 m from CENTER.",
    zones: [
      { at: [101.6138, 2.8903], rad: 150, R: 130, items: [["shoplot-3-flat-8", 4], ["shoplot-2-flat-8", 4]] }, // Cove Centrum shop offices 2-3 storey
      { at: [101.618, 2.8918], rad: 150, R: 120, items: [["mall-3-flat", 1]] }, // OSM brownfield 'Future Gamuda Cove Mall'
      { at: [101.6014, 2.8881], rad: 200, R: 80, items: [["clubhouse-2-flat", 1]] }, // Kelab Tani (location not published; near the landed products)
    ] },
  { id: "gardens", name: "Gamuda Gardens", pin: [101.5359, 3.2908], parcels: [[101.5395, 3.2955], [101.5309, 3.2905], [101.5322, 3.287]],
    zones: [
      { at: [101.5395, 3.2955], rad: 150, R: 140, items: [["superlink-2-gable-6", 8], ["semid-3-hip", 8], ["bungalow-3-hip", 8]] }, // Heston Hills: 209/237 superlink, semi-D, 16 villas
      { at: [101.5309, 3.2905], rad: 150, R: 140, items: [["terrace-2-gable-6", 10], ["superlink-2-gable-6", 4]] },
      { at: [101.5322, 3.287], rad: 150, R: 120, items: [["shoplot-2-flat-8", 3], ["terrace-2-gable-6", 6]] }, // The Atrium / Gardens Square retail
    ] },
  { id: "gardens-park", name: "Gardens Park", pin: [101.5177, 3.3004], parcels: [[101.5172, 3.3033], [101.5136, 3.296]],
    zones: [
      { at: [101.5172, 3.3033], rad: 200, R: 160, items: [["shoplot-2-flat-8", 3], ["terrace-2-gable-6", 14], ["semid-2-hip", 6]] }, // Park Square, Elgar/Astor
      { at: [101.5136, 3.296], rad: 150, R: 130, items: [["terrace-2-gable-6", 10]] },
    ] },
  { id: "tf7", name: "twentyfive.7", pin: [101.5567, 2.9577], parcels: [[101.5585, 2.9602], [101.5513, 2.95318]],
    zones: [
      { at: [101.5585, 2.9602], rad: 150, R: 140, items: [["terrace-3-gable-6", 6], ["superlink-2-gable-6", 4], ["cluster-2-hip", 6], ["semid-2-hip", 6]] }, // Clove Signature park/cluster/semi-D, link villas, Lucent
      { at: [101.5513, 2.95318], rad: 120, R: 110, items: [["shoplot-3-flat-8", 2], ["tower-30-balcony", 2]] }, // Quay District next to the Amber towers (2 x 30 floors)
    ] },
  { id: "jade", name: "Jade Hills", pin: [101.7541, 2.9972], parcels: [[101.75032, 3.001], [101.7578, 3.00226]],
    zones: [
      { at: [101.7578, 3.00226], rad: 100, R: 130, items: [["shoplot-3-flat-8", 2], ["tower-10-balcony", 2], ["clubhouse-2-flat", 1]] }, // Jade Square, Jadite Suites (4 low-density blocks), Resort Club
      { at: [101.75032, 3.001], rad: 150, R: 140, items: [["terrace-3-gable-6", 4], ["semid-3-hip", 6], ["bungalow-3-hip", 6]] }, // Hana / Hana Garden / Summerwoods
    ] },
  { id: "kundang", name: "Kundang Estates", pin: [101.5083, 3.2882], parcels: [[101.5065, 3.2901], [101.511, 3.2901]],
    zones: [
      { at: [101.5065, 3.2901], rad: 200, R: 160, items: [["terrace-2-gable-6", 12], ["link-2-gable-4", 4]] }, // Anise / Valerian, Citron link homes
      { at: [101.511, 3.2901], rad: 120, R: 110, items: [["terrace-2-gable-6", 6]] },
    ] },
  { id: "haus15", name: "Haus on 15", pin: [101.5919, 3.0756], parcels: [[101.5919, 3.0756]],
    zones: [{ at: null, R: 100, items: [["shoplot-3-flat-8", 2], ["tower-31-fins", 2]] }] }, // 2 x 31-floor towers on a retail podium
  { id: "horizon", name: "Horizon Hills", pin: [103.6456, 1.4576], parcels: [[103.6327, 1.4606], [103.6268, 1.4641], [103.6407, 1.4464]],
    zones: [
      { at: [103.6327, 1.4606], rad: 150, R: 140, items: [["terrace-2-gable-6", 8], ["cluster-2-hip", 6], ["clubhouse-2-flat", 1]] }, // GreenVille/Morrinsville, KingsWood/MontCourt, golf & country club
      { at: [103.6268, 1.4641], rad: 150, R: 140, items: [["cluster-3-hip", 6], ["semid-3-hip", 6], ["bungalow-3-hip", 8]] }, // The Peak, Mansion18
      { at: [103.6407, 1.4464], rad: 150, R: 150, items: [["mall-3-flat", 1], ["shoplot-3-flat-8", 3], ["tower-10-balcony", 2]] }, // Horizon Mall, Horizon Square, D'Suites
    ] },
  { id: "bantayan", name: "Bukit Bantayan Residences", pin: [116.1343, 5.9778], parcels: [[116.1343, 5.9778]],
    zones: [{ at: [116.1343, 5.9778], rad: 120, R: 120, items: [["shoplot-2-flat-8", 2], ["tower-25-balcony", 2], ["tower-27-balcony", 1]] }] }, // Curve 25 shop lots; Ebena + Cemara 25, Dilenia 27
  { id: "highpark", name: "HighPark Suites", pin: [101.5989, 3.1028], parcels: [],
    zones: [{ at: null, R: 100, items: [["tower-33-curtain", 2], ["shoplot-3-flat-8", 2]] }] }, // 2 x 33-floor towers + 3-level retail podium
  { id: "robertson", name: "The Robertson", pin: [101.7045, 3.1442], parcels: [],
    zones: [{ at: null, R: 110, items: [["shoplot-2-flat-8", 1], ["office-9-curtain", 1], ["tower-42-column", 1], ["tower-46-column", 1]] }] }, // 42 + 46 floor towers, GMBB commercial complex
  { id: "madge", name: "Madge Mansions", pin: [101.727, 3.1579], parcels: [],
    zones: [{ at: null, R: 80, items: [["tower-10-balcony", 3]] }] }, // 3 blocks x 10 storeys
  { id: "valencia", name: "Valencia", pin: [101.5874, 3.2133], parcels: [],
    zones: [{ at: null, R: 150, items: [["bungalow-2-hip", 12], ["semid-2-hip", 6], ["terrace-2-gable-6", 4], ["clubhouse-2-flat", 1]] }] },
  { id: "botanic", name: "Bandar Botanic", pin: [101.4399, 2.9881], parcels: [[101.4426, 2.9779], [101.4364, 2.99221], [101.4468, 2.9934]],
    zones: [
      { at: [101.4426, 2.9779], rad: 100, R: 140, items: [["shoplot-2-flat-8", 3], ["terrace-2-gable-6", 8], ["superlink-2-gable-6", 4], ["semid-2-hip", 4], ["bungalow-2-hip", 4]] }, // Botanic Walk shop offices, link/superlink/semi-D/bungalow
      { at: [101.4364, 2.99221], rad: 100, R: 100, items: [["clubhouse-2-flat", 1], ["terrace-2-gable-6", 4]] }, // Botanic Resort Club
      { at: null, R: 80, items: [["tower-25-balcony", 1]] }, // Ambang Residensi serviced apartments (618 units; floors unknown)
    ] },
  { id: "kemuning", name: "Kota Kemuning", pin: [101.536, 3.0049], parcels: [],
    zones: [{ at: null, R: 150, items: [["shoplot-2-flat-8", 2], ["office-9-curtain", 1], ["terrace-2-gable-8", 10], ["townhouse-3-flat-6", 3], ["semid-2-hip", 5], ["bungalow-2-hip", 5], ["clubhouse-2-flat", 1]] }] },
];

/* ------------------------------------------------------------------ overpass fetch + cache */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const M_LAT = 110_574;
const mLng = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

function siteBBox(s) {
  const lat0 = s.pin[1], lng0 = s.pin[0];
  const pts = [[lng0, lat0, 1600], ...s.parcels.map(([x, y]) => [x, y, 1200])];
  let S = 90, W = 999, N = -90, E = -999;
  S = 999;
  for (const [x, y, r] of pts) {
    S = Math.min(S, y - r / M_LAT); N = Math.max(N, y + r / M_LAT);
    W = Math.min(W, x - r / mLng(y)); E = Math.max(E, x + r / mLng(y));
  }
  return [S, W, N, E].map((v) => +v.toFixed(5));
}

function query(b) {
  const bb = b.join(",");
  return `[out:json][timeout:180];(
way["building"](${bb});relation["building"](${bb});
way["highway"](${bb});way["railway"~"^(rail|light_rail|subway|monorail|construction)$"](${bb});
way["waterway"~"^(river|stream|canal|drain|ditch)$"](${bb});
way["natural"~"^(water|wood|wetland)$"](${bb});relation["natural"~"^(water|wood|wetland)$"](${bb});
way["landuse"](${bb});relation["landuse"](${bb});
way["leisure"](${bb});relation["leisure"](${bb});
way["amenity"~"^(school|college|university|hospital|kindergarten|place_of_worship|grave_yard)$"](${bb});
relation["boundary"="protected_area"](${bb});way["boundary"="protected_area"](${bb});
);out geom;`;
}

async function fetchSite(s) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${s.id}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const q = query(siteBBox(s));
  let wait = 15000;
  for (let i = 0; i < 9; i++) {
    try {
      const r = await fetch(OVERPASS, { method: "POST", headers: { "User-Agent": "kopicode-hackathon-layout/1.0", "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(200000) });
      const txt = await r.text();
      if (r.ok && txt.startsWith("{")) {
        const j = JSON.parse(txt);
        if (!j.remark || !/error|timed out|out of memory/i.test(j.remark)) {
          fs.writeFileSync(file, txt);
          console.error(`fetched ${s.id}: ${j.elements.length} elements, ${(txt.length / 1e6).toFixed(1)} MB`);
          return j;
        }
      }
      console.error(`${s.id}: HTTP ${r.status}, retry in ${wait / 1000}s`);
    } catch (e) { console.error(`${s.id}: ${e.message}, retry in ${wait / 1000}s`); }
    await sleep(wait); wait = Math.min(wait * 2, 240000);
  }
  throw new Error(`overpass failed for ${s.id}`);
}

export { siteBBox };

/* ------------------------------------------------------------------ geometry (local metres: x east, y north, origin = site pin) */
const rad = (d) => (d * Math.PI) / 180;
const hash = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const bboxOf = (pts) => { let a = 1e12, b = 1e12, c = -1e12, d = -1e12; for (const [x, y] of pts) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };
const ovl = (p, q) => p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3];
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segX = (a, b, c, d) => { const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b); return o1 * o2 < 0 && o3 * o4 < 0; };
const ptSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const segSeg = (a, b, c, d) => (segX(a, b, c, d) ? 0 : Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b)));

/** Footprint rectangle: centre, w along the row (bearing rot, clockwise from north), d across; margin grows every side. */
function rect(cx, cy, w, d, rot, m = 0) {
  const u = [Math.sin(rad(rot)), Math.cos(rad(rot))], v = [Math.cos(rad(rot)), -Math.sin(rad(rot))];
  const hw = w / 2 + m, hd = d / 2 + m;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + s * hw * u[0] + t * hd * v[0], cy + s * hw * u[1] + t * hd * v[1]]);
  return { c: [cx, cy], u, v, hw, hd, pts, bb: bboxOf(pts) };
}
const inRect = (r, p) => Math.abs((p[0] - r.c[0]) * r.u[0] + (p[1] - r.c[1]) * r.u[1]) <= r.hw && Math.abs((p[0] - r.c[0]) * r.v[0] + (p[1] - r.c[1]) * r.v[1]) <= r.hd;
/** Exact rectangle-vs-simple-polygon overlap (edge crossing, or one contains the other): same answer as SAT on convex shapes, also right for concave OSM outlines. */
function rectPoly(r, ring) {
  const n = ring.length;
  for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; for (let k = 0; k < 4; k++) if (segX(r.pts[k], r.pts[(k + 1) % 4], a, b)) return true; }
  return inRing(r.pts[0][0], r.pts[0][1], ring) || inRect(r, ring[0]);
}
const rectSegDist = (r, a, b) => { if (inRect(r, a) || inRect(r, b)) return 0; let m = 1e9; for (let k = 0; k < 4; k++) m = Math.min(m, segSeg(r.pts[k], r.pts[(k + 1) % 4], a, b)); return m; };
function rectRect(p, q) { // SAT
  for (const r of [p, q]) for (const ax of [r.u, r.v]) {
    const pr = (s) => s.pts.map((t) => t[0] * ax[0] + t[1] * ax[1]);
    const A = pr(p), B = pr(q);
    if (Math.max(...A) < Math.min(...B) || Math.max(...B) < Math.min(...A)) return false;
  }
  return true;
}

class Grid {
  constructor(cell = 150) { this.cell = cell; this.m = new Map(); }
  add(item, bb) { for (let i = Math.floor(bb[0] / this.cell); i <= Math.floor(bb[2] / this.cell); i++) for (let j = Math.floor(bb[1] / this.cell); j <= Math.floor(bb[3] / this.cell); j++) { const k = i * 100003 + j; (this.m.get(k) || this.m.set(k, []).get(k)).push(item); } }
  query(bb) { const out = new Set(); for (let i = Math.floor(bb[0] / this.cell); i <= Math.floor(bb[2] / this.cell); i++) for (let j = Math.floor(bb[1] / this.cell); j <= Math.floor(bb[3] / this.cell); j++) for (const it of this.m.get(i * 100003 + j) || []) if (ovl(it.bb, bb)) out.add(it); return out; }
}

/* ------------------------------------------------------------------ OSM -> world */
const PATH_CLASSES = new Set(["footway", "path", "steps", "cycleway", "pedestrian", "bridleway", "track", "corridor", "proposed", "platform", "elevator"]);
const EXCL_LANDUSE = new Set(["forest", "reservoir", "basin", "cemetery", "quarry", "military", "recreation_ground", "religious", "education", "industrial", "railway", "landfill", "salt_pond", "aquaculture", "winter_sports"]);
const EXCL_LEISURE = new Set(["park", "pitch", "golf_course", "nature_reserve", "garden", "playground", "sports_centre", "stadium", "track", "swimming_pool", "marina", "water_park", "dog_park", "common", "fitness_station", "recreation_ground", "horse_riding", "miniature_golf"]);

function stitch(segs) { // join way fragments into closed rings
  const rings = [], left = segs.filter((s) => s.length > 1).map((s) => s.slice());
  while (left.length) {
    let cur = left.pop();
    for (let guard = 0; guard < 5000; guard++) {
      const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3;
      if (same(cur[0], cur[cur.length - 1])) break;
      const i = left.findIndex((s) => same(s[0], cur[cur.length - 1]) || same(s[s.length - 1], cur[cur.length - 1]));
      if (i < 0) { cur = null; break; }
      const s = left.splice(i, 1)[0];
      cur = cur.concat(same(s[0], cur[cur.length - 1]) ? s.slice(1) : s.slice(0, -1).reverse());
    }
    if (cur && cur.length > 3) rings.push(cur.slice(0, -1));
  }
  return rings;
}

/** Overpass is the primary source. Optional --extra=<dir>: same-shaped files from Mapbox Streets tiles (what the map actually draws),
 *  merged in for COLLISION only (a footprint must not land on a building the viewer can see); parcel emptiness counts stay OSM-only. */
function loadElements(s) {
  const j = JSON.parse(fs.readFileSync(path.join(CACHE, `${s.id}.json`), "utf8")), ex = process.argv.find((a) => a.startsWith("--extra="))?.slice(8);
  const extra = ex && fs.existsSync(path.join(ex, `${s.id}.json`)) ? JSON.parse(fs.readFileSync(path.join(ex, `${s.id}.json`), "utf8")).elements.map((e) => ({ ...e, mvt: true })) : [];
  return j.elements.concat(extra);
}
function buildWorld(elements, P) {
  const W = { bld: new Grid(), road: new Grid(), path: new Grid(), line: new Grid(), excl: new Grid(), tag: [], nB: 0, nR: 0, lines: [] };
  const geo = (g) => g.map((p) => P.fwd([p.lon, p.lat]));
  const addPoly = (grid, ring, extra = {}) => { grid.add({ ring, bb: bboxOf(ring), ...extra }, bboxOf(ring)); };
  const polysOf = (el) => {
    if (el.type === "way") { if (!el.geometry || el.geometry.length < 4) return []; const g = geo(el.geometry); const a = g[0], b = g[g.length - 1]; return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3 ? [g.slice(0, -1)] : []; }
    if (el.type === "relation") return stitch((el.members || []).filter((m) => m.type === "way" && m.role !== "inner" && m.geometry).map((m) => geo(m.geometry)));
    return [];
  };
  for (const el of elements) {
    const t = el.tags || {};
    if (t.building) { for (const ring of polysOf(el)) { addPoly(W.bld, ring, { mvt: !!el.mvt }); W.nB++; } continue; }
    if (t.highway && el.type === "way" && el.geometry) {
      const g = geo(el.geometry), cls = t.highway, isPath = PATH_CLASSES.has(cls);
      for (let i = 0; i + 1 < g.length; i++) { const seg = { a: g[i], b: g[i + 1], cls, name: t.name, bb: bboxOf([g[i], g[i + 1]]) }; (isPath ? W.path : W.road).add(seg, seg.bb); if (!isPath) W.nR++; }
      continue;
    }
    const lineBuf = t.railway ? 8 : t.waterway ? (t.waterway === "river" ? 10 : 4) : 0;
    if (lineBuf && el.type === "way" && el.geometry) { const g = geo(el.geometry); for (let i = 0; i + 1 < g.length; i++) { const seg = { a: g[i], b: g[i + 1], buf: lineBuf, what: t.railway ? "railway" : "waterway", bb: bboxOf([g[i], g[i + 1]]) }; W.line.add(seg, seg.bb); } continue; }
    const exclWhat = t.natural && ["water", "wood", "wetland"].includes(t.natural) ? `natural=${t.natural}` : EXCL_LANDUSE.has(t.landuse) ? `landuse=${t.landuse}` : EXCL_LEISURE.has(t.leisure) ? `leisure=${t.leisure}` : t.boundary === "protected_area" ? "protected_area" : t.amenity ? `amenity=${t.amenity}` : null;
    const rival = t.name && /\bby\b/i.test(t.name) && !/gamuda/i.test(t.name) && (t.landuse || t.building) ? `other developer "${t.name}"` : null;
    if (rival && t.landuse) { for (const ring of polysOf(el)) addPoly(W.excl, ring, { what: rival }); continue; }
    if (exclWhat) { for (const ring of polysOf(el)) addPoly(W.excl, ring, { what: exclWhat, name: t.name }); continue; }
    if (t.landuse) for (const ring of polysOf(el)) W.tag.push({ ring, bb: bboxOf(ring), what: `landuse=${t.landuse}`, name: t.name });
  }
  return W;
}

/** Why a footprint is not allowed here (null = free). margin only for OSM buildings (2 m) and roads (5 m, as briefed). */
function blocked(W, r, ctx, strict = false) {
  const bb = [r.bb[0] - 12, r.bb[1] - 12, r.bb[2] + 12, r.bb[3] + 12];
  const rb = strict ? r : rect(r.c[0], r.c[1], r.hw * 2, r.hd * 2, Math.atan2(r.u[0], r.u[1]) * 180 / Math.PI, 2);
  for (const b of W.bld.query(bb)) if (ovl(b.bb, rb.bb) && rectPoly(rb, b.ring)) return "osm-building";
  for (const s of W.road.query(bb)) if (rectSegDist(r, s.a, s.b) < 5) return "road";
  for (const s of W.line.query(bb)) if (rectSegDist(r, s.a, s.b) < s.buf) return s.what;
  for (const e of W.excl.query(r.bb)) if (rectPoly(r, e.ring)) return e.what;
  if (ctx?.noGo) { const n = ctx.noGo; if (r.pts.some((p) => Math.hypot(p[0] - n.circ[0], p[1] - n.circ[1]) < n.r) || Math.hypot(r.c[0] - n.circ[0], r.c[1] - n.circ[1]) < n.r) return "cove-block"; if (n.rects.some((q) => rectRect(r, q))) return "cove-landed-enclave"; }
  return null;
}

/* ------------------------------------------------------------------ 10 m raster of "not empty" for the fallback land search */
const CELL = 10;
function mkMask(W, P, bbLL, extraBlocks) {
  const [x0, y0] = P.fwd([bbLL[1], bbLL[0]]), [x1, y1] = P.fwd([bbLL[3], bbLL[2]]);
  const M = { x0, y0, nx: Math.ceil((x1 - x0) / CELL), ny: Math.ceil((y1 - y0) / CELL) };
  M.a = new Uint8Array(M.nx * M.ny);
  const mark = (i, j) => { if (i >= 0 && j >= 0 && i < M.nx && j < M.ny) M.a[j * M.nx + i] = 1; };
  const disc = (x, y, r) => { const i0 = Math.floor((x - r - x0) / CELL), i1 = Math.floor((x + r - x0) / CELL), j0 = Math.floor((y - r - y0) / CELL), j1 = Math.floor((y + r - y0) / CELL); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(x0 + (i + 0.5) * CELL - x, y0 + (j + 0.5) * CELL - y) <= r + CELL * 0.4) mark(i, j); };
  const seg = (a, b, r) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let k = 0; k <= n; k++) disc(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, r); };
  const fill = (ring) => { const [, by0, , by1] = bboxOf(ring); for (let j = Math.max(0, Math.floor((by0 - y0) / CELL)); j <= Math.min(M.ny - 1, Math.floor((by1 - y0) / CELL)); j++) { const y = y0 + (j + 0.5) * CELL, xs = []; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (a[1] > y !== b[1] > y) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); } xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let i = Math.max(0, Math.floor((xs[k] - x0) / CELL)); i <= Math.min(M.nx - 1, Math.floor((xs[k + 1] - x0) / CELL)); i++) mark(i, j); } };
  const seen = new Set();
  const each = (grid, f) => { for (const arr of grid.m.values()) for (const it of arr) if (!seen.has(it)) { seen.add(it); f(it); } };
  each(W.bld, (b) => { fill(b.ring); for (let i = 0; i < b.ring.length; i++) seg(b.ring[i], b.ring[(i + 1) % b.ring.length], 8); });
  each(W.excl, (e) => { fill(e.ring); for (let i = 0; i < e.ring.length; i++) seg(e.ring[i], e.ring[(i + 1) % e.ring.length], 4); });
  each(W.road, (s) => seg(s.a, s.b, 9));
  each(W.path, (s) => seg(s.a, s.b, 3));
  each(W.line, (s) => seg(s.a, s.b, s.buf + 4));
  for (const f of extraBlocks) f(disc, fill);
  // outside the fetched data = unknown = blocked
  for (let j = 0; j < M.ny; j++) for (const i of [0, 1, M.nx - 2, M.nx - 1]) mark(i, j);
  for (let i = 0; i < M.nx; i++) for (const j of [0, 1, M.ny - 2, M.ny - 1]) mark(i, j);
  return M;
}
const circleOffsets = {};
function freeFraction(M, cx, cy, R) {
  const key = R; if (!circleOffsets[key]) { const o = []; const n = Math.ceil(R / CELL); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) if (Math.hypot(i * CELL, j * CELL) <= R) o.push([i, j]); circleOffsets[key] = o; }
  const ci = Math.floor((cx - M.x0) / CELL), cj = Math.floor((cy - M.y0) / CELL); let free = 0, n = 0;
  for (const [i, j] of circleOffsets[key]) { n++; const ii = ci + i, jj = cj + j; if (ii >= 0 && jj >= 0 && ii < M.nx && jj < M.ny && !M.a[jj * M.nx + ii]) free++; }
  return free / n;
}
/** Nearest free circle to the pin within 1.5 km: passes from strict to relaxed, R shrinks only as a last resort. */
function findEmpty(M, R, avoid, [ax, ay] = [0, 0], minScale = 0.6, limit = 1500) {
  const passes = [[1, 0.93], [1, 0.85], [0.8, 0.9], [0.8, 0.8], [0.6, 0.85]].filter(([rs]) => rs >= minScale);
  for (const [rs, thr] of passes) {
    let best = null;
    for (let x = ax - 1500; x <= ax + 1500; x += 30) for (let y = ay - 1500; y <= ay + 1500; y += 30) {
      const d = Math.hypot(x - ax, y - ay); if (d > limit || (best && d >= best.d)) continue;
      if (avoid.some(([ax, ay, ar]) => Math.hypot(x - ax, y - ay) < ar + R * rs + 20)) continue;
      if (freeFraction(M, x, y, R * rs) >= thr) best = { x, y, d, R: Math.round(R * rs), thr };
    }
    if (best) return best;
  }
  return null;
}

/* ------------------------------------------------------------------ zone packing */
function describeLand(W, x, y) {
  const hit = W.tag.filter((t) => inRing(x, y, t.ring)).map((t) => t.what + (t.name ? ` "${t.name}"` : ""));
  return hit.length ? [...new Set(hit)].slice(0, 3).join(", ") : "no OSM landuse polygon (open ground, 0 buildings/roads/water/forest in the circle)";
}
function roadFrame(W, cx, cy, R) {
  let best = null;
  for (const s of W.road.query([cx - R - 500, cy - R - 500, cx + R + 500, cy + R + 500])) {
    const d = ptSeg([cx, cy], s.a, s.b), pen = s.cls === "service" ? 60 : 0;
    if (d < R + 500 && (!best || d + pen < best.score) && Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 15) best = { score: d + pen, s, d };
  }
  if (!best) return { rot: 90, road: null };
  const { a, b } = best.s; let rot = ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 180;
  const t = Math.max(0, Math.min(1, ((cx - a[0]) * (b[0] - a[0]) + (cy - a[1]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) ** 2)));
  const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  if ((p[0] - cx) * Math.cos(rad(rot)) - (p[1] - cy) * Math.sin(rad(rot)) < 0) rot += 180; // keep "v" (rot+90) pointing at the road
  return { rot, road: best.s.name || best.s.cls, dist: Math.round(best.d) };
}

function packZone(W, site, zone, c, R, rng, ctx, placed) {
  const { rot: rotA, road } = roadFrame(W, c[0], c[1], R);
  const u = [Math.sin(rad(rotA)), Math.cos(rad(rotA))], v = [Math.cos(rad(rotA)), -Math.sin(rad(rotA))];
  const out = [], drops = {}; let cursor = R * 0.85;
  const drop = (why) => (drops[why] = (drops[why] || 0) + 1);
  for (const [key, want] of zone.items) {
    const V = VAR[key]; let got = 0, guard = 0;
    while (got < want && cursor > -R * 0.95 && guard++ < 400) {
      const two = V.kind === "row" || V.kind === "det", lane = V.kind === "row" ? 6 : 8;
      const bs = two ? [cursor - V.d / 2, cursor - V.d * 1.5 - lane] : [cursor - V.d / 2];
      const cand = [];
      bs.forEach((b, li) => {
        const pitch = V.w + V.gap, ph = (rng() - 0.5) * V.gap;
        for (let k = -40; k <= 40; k++) {
          const a = ph + k * pitch; // axis-aligned in zone frame: corners must sit inside the circle
          if ([[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([s, t]) => Math.hypot(a + (s * V.w) / 2, b + (t * V.d) / 2) <= R)) cand.push({ a, b, flip: li === 1, dist: Math.hypot(a, b) });
        }
      });
      if (!cand.length) { cursor -= 6; continue; } // nothing of this strip fits the circle yet: slide inwards until it does
      cand.sort((p, q) => p.dist - q.dist);
      for (const cd of cand) {
        if (got >= want) break;
        const x = c[0] + cd.a * u[0] + cd.b * v[0], y = c[1] + cd.a * u[1] + cd.b * v[1], rot = (rotA + (cd.flip ? 180 : 0)) % 360;
        const r = rect(x, y, V.w, V.d, rot);
        const why = blocked(W, r, ctx) || (placed.concat(out).some((o) => ovl(o.r.bb, r.bb) && rectRect(rect(o.x, o.y, VAR[o.key].w, VAR[o.key].d, o.rot, 3), r)) ? "overlaps-own" : null);
        if (why) { drop(why); continue; }
        out.push({ key, x, y, rot, r }); got++;
      }
      cursor -= (two ? 2 * V.d + lane : V.d) + (V.kind === "tower" ? 40 : 12);
    }
    if (got < want) drop(`no-room(${key} ${want - got})`);
  }
  return { out, drops, rotA, road };
}


/** Last resort in built-up sites: no free circle, so put each building on the nearest clear slot (>= 4 m clear of everything), clustering round the first one. */
const SCAT = (() => { const o = []; for (let i = -125; i <= 125; i++) for (let j = -125; j <= 125; j++) if (Math.hypot(i, j) <= 125) o.push([i * 12, j * 12, Math.hypot(i, j) * 12]); return o.sort((a, b) => a[2] - b[2]); })();
function scatter(W, M, zone, anchor, ctx, placed, avoid, limit = 1500) {
  const out = [], drops = {}; let a = anchor.slice(), far = 0;
  for (const [key, want] of zone.items) {
    const V = VAR[key];
    for (let i = 0; i < want; i++) {
      let hit = null;
      for (const [dx, dy] of SCAT) {
        const x = a[0] + dx, y = a[1] + dy;
        if (Math.hypot(x - anchor[0], y - anchor[1]) > limit || (out.length && Math.hypot(x - out[0].x, y - out[0].y) > (V.kind === "tower" || V.kind === "one" ? 450 : 250))) continue; // cluster: within 250 m (towers/shops 450 m) of the first slot
        if (freeFraction(M, x, y, Math.max(V.w, V.d) / 2 + 4) < 0.97) continue;
        if (avoid.some(([ux, uy, ur]) => Math.hypot(x - ux, y - uy) < ur + 20)) continue;
        const { rot } = roadFrame(W, x, y, 40);
        const r = rect(x, y, V.w, V.d, rot, 4);
        if (blocked(W, r, ctx) || placed.concat(out).some((o) => rectRect(rect(o.x, o.y, VAR[o.key].w, VAR[o.key].d, o.rot, 6), r))) continue;
        hit = { key, x, y, rot, r: rect(x, y, V.w, V.d, rot) }; break;
      }
      if (!hit) { drops[`no-room(${key})`] = (drops[`no-room(${key})`] || 0) + 1; continue; }
      out.push(hit); if (out.length === 1) a = [hit.x, hit.y]; far = Math.max(far, Math.hypot(hit.x - anchor[0], hit.y - anchor[1]));
    }
  }
  return { out, drops, far, rotA: out[0]?.rot ?? 0, road: "nearest road per slot" };
}

/* ------------------------------------------------------------------ main */
const mkProj = (pin) => { const kx = mLng(pin[1]); return { fwd: ([lng, lat]) => [(lng - pin[0]) * kx, (lat - pin[1]) * M_LAT], inv: ([x, y]) => [pin[0] + x / kx, pin[1] + y / M_LAT] }; };
const CAP = 60;
async function main() {
if (process.argv.includes("--fetch")) { for (const s of process.argv.includes("--reverse") ? [...SITES].reverse() : SITES) { await fetchSite(s); await sleep(4000); } return; }
const argv = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const KEY_RE = /^(terrace|superlink|link|townhouse|cluster|semid|bungalow|shoplot|office|mall|tower|clubhouse)-\d+(-[a-z]+)?(-\d+)?$/;

const buildings = [], labels = [], table = [], viz = [];
for (const s of SITES.filter((x) => !argv("only") || argv("only").split(",").includes(x.id))) {
  await fetchSite(s); const P = mkProj(s.pin), W = buildWorld(loadElements(s), P), rng = mulberry(hash(s.id));
  const ctx = s.noGo ? (() => { const cc = P.fwd(s.noGo.circle.c); return { noGo: { circ: cc, r: s.noGo.circle.r, rects: s.noGo.rects.map((q) => rect(cc[0] + q.e, cc[1] + q.n, q.hw * 2, q.hh * 2, 0)) } }; })() : null;
  const M = mkMask(W, P, siteBBox(s), ctx ? [(disc) => { const { circ, r, rects } = ctx.noGo; disc(circ[0], circ[1], r); for (const R of rects) for (let x = R.bb[0]; x <= R.bb[2]; x += 5) for (let y = R.bb[1]; y <= R.bb[3]; y += 5) disc(x, y, 5); }] : []);
  const used = [], placed = [], zones = [];
  for (const [zi, z] of s.zones.entries()) {
    let c, R = z.R, how, why = "";
    if (z.at) {
      const p = P.fwd(z.at); let cnt = 0; for (const b of W.bld.query([p[0] - z.rad, p[1] - z.rad, p[0] + z.rad, p[1] + z.rad])) { if (b.mvt) continue; const q = b.ring[0]; if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= z.rad) cnt++; }
      const free = freeFraction(M, p[0], p[1], z.R);
      if (cnt === 0 && free >= 0.4 && !used.some(([ux, uy, ur]) => Math.hypot(p[0] - ux, p[1] - uy) < ur + z.R)) { c = p; how = `parcel (${z.at.join(",")}) r${z.rad}, 0 OSM buildings, ${Math.round(free * 100)}% free in R${z.R}`; }
      else why = cnt ? `parcel has ${cnt} OSM buildings inside ${z.rad} m` : `parcel only ${Math.round(free * 100)}% free (roads/water/forest) or overlaps another zone`;
    }
    let res = null;
    if (!c) {
      const anchor = z.at ? P.fwd(z.at) : [0, 0], want = z.items.reduce((t, [, n]) => t + n, 0);
      const lim = z.at ? 800 : 1500, f = findEmpty(M, z.R, used, anchor, z.items.some(([k]) => k.startsWith("tower")) ? 0.8 : 0.6, lim); // brief: nearest empty land to the pin; for a failed research parcel, to that parcel
      let circ = null;
      if (f) { circ = { c: [f.x, f.y], R: f.R, how: `FALLBACK ${Math.round(f.d)} m from ${z.at ? "the parcel" : "the pin"} (${Math.round(Math.hypot(f.x, f.y))} m from pin), R${f.R} (${Math.round(f.thr * 100)}% free): ${describeLand(W, f.x, f.y)}${why ? ` [${why}]` : ""}` }; circ.res = packZone(W, s, z, circ.c, circ.R, mulberry(hash(s.id + zi)), ctx, placed); }
      let sc = null;
      const compact = z.items.every(([k]) => VAR[k].kind === "tower" || VAR[k].kind === "one");
      if (!circ || circ.res.out.length < want * (compact ? 1 : 0.5)) { sc = scatter(W, M, z, anchor, ctx, placed, used, lim); if (!sc.out.length) sc = null; }
      if (sc && (!circ || sc.out.length > circ.res.out.length)) {
        const cx = sc.out.reduce((t, o) => t + o.x, 0) / sc.out.length, cy = sc.out.reduce((t, o) => t + o.y, 0) / sc.out.length;
        c = [cx, cy]; R = Math.max(40, ...sc.out.map((o) => Math.hypot(o.x - cx, o.y - cy) + 40)); res = sc;
        how = `SCATTER (no free circle${circ ? " big enough" : ""}): ${sc.out.length} buildings on the nearest clear slots, up to ${Math.round(sc.far)} m from ${z.at ? "the parcel" : "the pin"}${why ? ` [${why}]` : ""}`;
      } else if (circ) { c = circ.c; R = circ.R; how = circ.how; res = circ.res; }
      else { zones.push({ zi, none: true, items: z.items, why: `${why ? why + "; " : ""}no empty circle and no clear slot within ${lim} m of ${z.at ? "the parcel" : "the pin"} (0 buildings, off roads, not water/forest/park)` }); continue; }
    }
    used.push([c[0], c[1], R]);
    const budget = CAP - placed.length;
    res ??= packZone(W, s, z, c, R, rng, ctx, placed);
    let out = res.out; if (out.length > budget) { res.drops.cap = out.length - budget; out = out.slice(0, budget); }
    placed.push(...out);
    zones.push({ zi, c, R, how, out, drops: res.drops, rot: res.rotA, road: res.road });
  }
  for (const o of placed) { const [lng, lat] = P.inv([o.x, o.y]), V = VAR[o.key]; buildings.push({ site: s.id, variant: o.key, lng: +lng.toFixed(6), lat: +lat.toFixed(6), rot: +(((o.rot % 360) + 360) % 360).toFixed(1), w: V.w, d: V.d, h: V.h }); }
  const main = zones.filter((z) => z.out?.length).sort((a, b) => b.out.length - a.out.length)[0];
  if (main) { const [lng, lat] = P.inv([main.out.reduce((t, o) => t + o.x, 0) / main.out.length, main.out.reduce((t, o) => t + o.y, 0) / main.out.length]); labels.push({ site: s.id, lng: +lng.toFixed(6), lat: +lat.toFixed(6) }); }
  const drops = {}; for (const z of zones) for (const [k, n] of Object.entries(z.drops || {})) drops[k] = (drops[k] || 0) + n;
  table.push({ site: s.id, placed: placed.length, dropped: Object.values(drops).reduce((t, n) => t + n, 0), drops, variants: [...new Set(placed.map((o) => o.key))], zones });
  viz.push({ site: s.id, pin: s.pin, zones: zones.map((z) => ({ c: z.c && P.inv(z.c), R: z.R, n: z.out?.length })), b: placed.map((o) => ({ c: P.inv([o.x, o.y]), pts: o.r.pts.map((p) => P.inv(p)), key: o.key })) });

  // ---- assert 0 intersections, independently of the packer (exact geometry, no margin on buildings, roads buffered 5 m) ----
  let paths = 0;
  placed.forEach((o, i) => {
    const r = rect(o.x, o.y, VAR[o.key].w, VAR[o.key].d, o.rot);
    const bad = blocked(W, r, ctx, true); if (bad) throw new Error(`ASSERT ${s.id}: ${o.key} touches ${bad}`);
    for (let k = i + 1; k < placed.length; k++) if (rectRect(r, rect(placed[k].x, placed[k].y, VAR[placed[k].key].w, VAR[placed[k].key].d, placed[k].rot))) throw new Error(`ASSERT ${s.id}: own buildings overlap`);
    for (const q of W.path.query(r.bb)) if (rectSegDist(r, q.a, q.b) < 1) { paths++; break; }
    if (ctx && Math.min(...r.pts.map((p) => Math.hypot(p[0] - ctx.noGo.circ[0], p[1] - ctx.noGo.circ[1]))) < 600) throw new Error("ASSERT cove: building < 600 m from CENTER");
  });
  table.at(-1).onPath = paths;
  if (placed.length > CAP) throw new Error(`ASSERT ${s.id}: > ${CAP}`);
}

const keys = [...new Set(buildings.map((b) => b.variant))].sort();
if (keys.length > 30) throw new Error(`ASSERT: ${keys.length} variant keys > 30`);
for (const k of keys) if (!KEY_RE.test(k) || !VAR[k]) throw new Error(`ASSERT: bad key ${k}`);

fs.writeFileSync(argv("out") || OUT, `{\n  "buildings": [\n${buildings.map((b) => JSON.stringify(b).replace(/^\{/, "    { ").replace(/,"/g, ', "').replace(/\}$/, " }")).join(",\n")}\n  ],\n  "labels": [\n${labels.map((b) => JSON.stringify(b).replace(/^\{/, "    { ").replace(/,"/g, ', "').replace(/\}$/, " }")).join(",\n")}\n  ]\n}\n`);
if (argv("variants")) fs.writeFileSync(argv("variants"), ["# VARIANTS.txt (exec-fk-layout): variant keys actually placed in src/lib/first-key/site-layout.json", "# key  w  d  h   (metres; w along the row; one w/d/h per key)", ...keys.map((k) => `${k.padEnd(22)} ${VAR[k].w}  ${VAR[k].d}  ${VAR[k].h}`), ""].join("\n"));
if (argv("viz")) fs.writeFileSync(argv("viz"), JSON.stringify(viz));

console.log("\nsite          placed dropped  variants  | zone details");
for (const t of table) {
  console.log(`${t.site.padEnd(13)} ${String(t.placed).padStart(5)} ${String(t.dropped).padStart(7)}  ${String(t.variants.length).padStart(3)}      | ${JSON.stringify(t.drops)} paths-touched(not asserted)=${t.onPath}`);
  for (const z of t.zones) console.log(z.none ? `     zone ${z.zi}: NO SPAWN: ${z.why}` : `     zone ${z.zi}: ${z.out.length} placed, rows rot ${Math.round(z.rot)}, road ${z.road ?? "none within 600 m (default E-W rows)"}: ${z.how}`);
}
console.log(`\n${buildings.length} buildings, ${labels.length} labels, ${keys.length} variant keys; all asserts passed (0 intersections with OSM (+Mapbox-tile) buildings, roads+5 m, water/forest/parks, Cove no-go, own buildings; <= ${CAP}/site)`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
