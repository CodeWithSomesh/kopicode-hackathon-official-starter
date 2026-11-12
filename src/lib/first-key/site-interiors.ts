import type { Building, LngLat } from "./types";
import { makeUnits } from "./township";
import { parseVariant, siteIndexOf, siteKind, siteLayout } from "./site-layout";
import { townshipById, units as products } from "../homelander/data";

// ILLUSTRATIVE ONLY. The towers spawned at the other Gamuda sites (site-layout.json) opened up with the Cove block's own unit
// generator (township.ts makeUnits): made-up floors, flats and prices. Landed buildings are in landed.ts (siteGroup).
// What comes from the site: the storeys (the variant key, from the research), the project name, the serviced-apartment style
// and the price level (the site's "From" price over its size, data.ts). Ids are "sb<n>", n = index in site-layout.json.

const M_LAT = 110_574;
/** RM per sqft the Cove block's formula gives a 2-bed on floor 6 (600 + 6 x 7): a site's price level is its own psf over this. */
const COVE_PSF = 642;

/** The township (data.ts id) a spawned building belongs to. */
export const siteOf = (id: string): string | undefined => {
  const i = siteIndexOf(id);
  return i === undefined ? undefined : siteLayout.buildings[i].site;
};

/** Multiplier on the Cove block's prices: the site's flats' average RM per built-up sqft (landed homes if it sells no flats), within 0.6x to 3x. */
function priceLevel(site: string): number {
  const all = products.filter((u) => u.townshipId === site);
  const flats = all.filter((u) => !u.landed);
  const pool = flats.length ? flats : all;
  if (!pool.length) return 1;
  const psf = pool.reduce((t, u) => t + u.priceRM / u.builtUpSqft, 0) / pool.length;
  return Math.min(3, Math.max(0.6, psf / COVE_PSF));
}

const cache = new Map<string, Building>();

/** The tower spawned at `sb<n>`, with its made-up flats; undefined for anything else. */
export function siteTower(id: string): Building | undefined {
  const idx = siteIndexOf(id);
  if (idx === undefined || siteKind(siteLayout.buildings[idx]) !== "tower") return undefined;
  const hit = cache.get(id);
  if (hit) return hit;
  const b = siteLayout.buildings[idx];
  const floors = parseVariant(b.variant).storeys;
  const style: Building["style"] = products.some((u) => u.townshipId === b.site && u.type === "Serviced apartment") ? "serviced" : "residence";
  // Podium and decks follow tower/variants.ts (designFor): a 2-storey podium of lobby and car park from 12 floors up; a facilities deck on floor 6 of a tall
  // tower, and another two floors under the roof of a very tall one.
  const podium = floors >= 12 ? 2 : 0;
  const decks = floors >= 30 ? [6, floors - 2] : floors >= 20 ? [6] : [];
  // The map's tower: a w x d rectangle with chamfered corners, built unturned here (the burst turns it by `rot`).
  const [w, d] = [b.w, b.d];
  const c = Math.min(4, d * 0.18);
  const [x, z] = [w / 2, d / 2];
  const corners: [number, number][] = [[-x + c, -z], [x - c, -z], [x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c]];
  const kx = 111_320 * Math.cos((b.lat * Math.PI) / 180);
  const ring = corners.map(([px, pz]): LngLat => [b.lng + px / kx, b.lat - pz / M_LAT]);
  const rows: 1 | 2 = w / d > 2.3 ? 1 : 2;
  const mine = siteLayout.buildings.filter((o) => o.site === b.site && siteKind(o) === "tower");
  const block = String.fromCharCode(65 + mine.indexOf(b));
  const units = makeUnits(id, block, floors, (rows * (w - 4)) / 8, rows, style === "serviced", decks, [b.lng, b.lat], idx, {
    project: townshipById[b.site]?.name ?? b.site,
    podium,
    priceK: priceLevel(b.site),
  });
  const tower: Building = { id, block, footprint: [...ring, ring[0]], floors, heightM: b.h, rows, style, decks, podium, units, variant: b.variant, rot: b.rot - 90 };
  cache.set(id, tower);
  return tower;
}
