// ILLUSTRATIVE ONLY. Made-up buildings placed on empty land at each Gamuda Land site, typed by what Gamuda really builds
// there (research: 2nd-brain notes/research/2026-11-12-gamuda-hackathon/sites/<id>.md). Not Gamuda's plans.
//
// Contract between three lanes:
//   layout  (scripts/site-layout.mjs) writes site-layout.json
//   models  (tower/variants.ts)        turns a variant key into a glb
//   map     (map/site-buildings.tsx)   draws site-layout.json with those glbs
import layout from "./site-layout.json";

/**
 * Variant key grammar: `<type>-<storeys>[-<style>][-<n>]`, lowercase, dash-separated.
 * - type:    one of VARIANT_TYPES
 * - storeys: integer
 * - style:   roof or facade, e.g. gable | hip | flat | prairie | balcony | column | curtain | fins | retail
 * - n:       units in a row (terrace, superlink, link, shoplot, townhouse); omitted for single buildings
 * Examples: terrace-2-gable-6, semid-2-hip, bungalow-3-hip, shoplot-3-flat-8, tower-30-balcony, mall-3-flat, clubhouse-2-flat
 */
export const VARIANT_TYPES = [
  "terrace", "superlink", "link", "townhouse", "cluster", "semid", "bungalow",
  "shoplot", "office", "mall", "tower", "clubhouse",
] as const;
export type VariantType = (typeof VARIANT_TYPES)[number];

/** One placed building. lng/lat = footprint centre; rot = degrees clockwise from north; w (along the row), d, h in metres. */
export type SiteBuilding = { site: string; variant: string; lng: number; lat: number; rot: number; w: number; d: number; h: number };
/** One "illustrative" label per site, at the centre of its spawned area. */
export type SiteLabel = { site: string; lng: number; lat: number };
export type SiteLayout = { buildings: SiteBuilding[]; labels: SiteLabel[] };

export const siteLayout = layout as SiteLayout;

export function parseVariant(key: string): { type: VariantType; storeys: number; style?: string; n?: number } {
  const [type, storeys, ...rest] = key.split("-");
  if (!(VARIANT_TYPES as readonly string[]).includes(type)) throw new Error(`unknown variant type: ${key}`);
  const n = rest.length && /^\d+$/.test(rest[rest.length - 1]) ? Number(rest.pop()) : undefined;
  return { type: type as VariantType, storeys: Number(storeys), style: rest[0], n };
}

/** Spawned buildings you can open up: a tower (a condo or serviced-apartment block) gets the tower burst, landed homes the landed burst. Shops, offices, malls and clubhouses only open their township. */
export const siteKind = (b: SiteBuilding): "tower" | "landed" | undefined => {
  const type = parseVariant(b.variant).type;
  return type === "tower" ? "tower" : (["terrace", "superlink", "link", "townhouse", "cluster", "semid", "bungalow"] as const).includes(type as "terrace") ? "landed" : undefined;
};
/** An openable building's id is "sb<n>", n = its index in site-layout.json; the township panel and the URL use it like the Cove block ids. */
export const siteIndexOf = (id: string): number | undefined => {
  const m = /^sb(\d+)$/.exec(id);
  return m && Number(m[1]) < siteLayout.buildings.length ? Number(m[1]) : undefined;
};
