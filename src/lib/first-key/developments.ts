import type { Development } from "./types";

/** Facts below are copied from the official site only as stated there. */
export const SOURCE = { site: "gamudaland.com.my", url: "https://www.gamudaland.com.my/", retrieved: "12 Nov 2026" };

const page = (slug: string) => `https://www.gamudaland.com.my/developments/${slug}`;

export const developments: Development[] = [
  {
    id: "gamuda-cove",
    name: "Gamuda Cove",
    town: "Kuala Langat, Selangor",
    state: "Selangor",
    acres: 1866,
    blurb: "A 1,866-acre township in Kuala Langat, next to Paya Indah Discovery Wetlands.",
    url: page("gamuda-cove"),
    launch: { name: "Mori Pines", type: "2-storey terrace & semi-D", fromPrice: 849_800 },
    lng: 101.6091032,
    lat: 2.8827801,
    coordSource: "OpenStreetMap way 649199292 (landuse=residential 'Gamuda Cove'), via Nominatim; same label in the map file",
  },
  {
    id: "gamuda-gardens",
    name: "Gamuda Gardens",
    town: "Sungai Buloh North, Selangor",
    state: "Selangor",
    acres: 810,
    blurb: "An 810-acre township in Sungai Buloh North.",
    url: page("gamuda-gardens"),
    launch: { name: "Valeria Garden Homes", type: "2 & 3 storey terrace", fromPrice: 1_130_800 },
    lng: 101.5359344,
    lat: 3.2907584,
    coordSource: "OpenStreetMap relation 16766471 (landuse=residential 'Bandar Gamuda Gardens'), via Nominatim; same label in the map file",
  },
  {
    id: "gardens-park",
    name: "Gardens Park",
    town: "Sungai Buloh North, Selangor",
    state: "Selangor",
    acres: 532,
    blurb: "A 532-acre township in Sungai Buloh North, adjacent to Gamuda Gardens.",
    url: page("gardens-park"),
    launch: { name: "Astor", type: "2-storey terrace", fromPrice: 800_000 },
    lng: 101.5165938,
    lat: 3.302299,
    coordSource:
      "OpenStreetMap relation 18460640 (landuse=construction 'Gardens Park'), via Nominatim; same label in the map file. OSM puts it about 2 km west of Gamuda Gardens, not touching it",
  },
  {
    id: "twentyfive7",
    name: "twentyfive7",
    town: "South of Kota Kemuning, Selangor",
    state: "Selangor",
    acres: 257,
    blurb: "A 257-acre development south of Kota Kemuning.",
    url: page("twentyfive-7"),
    coordSource: "NOT FOUND: no 'twentyfive7' in OpenStreetMap (Nominatim, 5 queries) or in the map file's labels. Left off the map",
  },
  {
    id: "jade-hills",
    name: "Jade Hills",
    town: "Kajang, Selangor",
    state: "Selangor",
    blurb: "A Gamuda Land township in Kajang.",
    url: page("jade-hills"),
    lng: 101.7541106,
    lat: 2.9972172,
    coordSource: "OpenStreetMap way 1221511596 (place=quarter 'Jade Hills'), via Nominatim; not labelled in the map file",
  },
  {
    id: "kundang-estates",
    name: "Kundang Estates",
    town: "Kundang, Selangor",
    state: "Selangor",
    blurb: "A Gamuda Land township in Kundang.",
    url: page("kundang-estates"),
    lng: 101.5082516,
    lat: 3.288243,
    coordSource: "OpenStreetMap way 922331618 (place=neighbourhood 'Kundang Estates'), via Nominatim; same label in the map file",
  },
  {
    id: "horizon-hills",
    name: "Horizon Hills",
    town: "Iskandar Puteri, Johor",
    state: "Johor",
    blurb: "A Gamuda Land township in Iskandar Puteri, Johor.",
    url: page("horizon-hills"),
    lng: 103.6455504,
    lat: 1.4576014,
    coordSource: "OpenStreetMap relation 17249507 (place=suburb 'Horizon Hills'), via Nominatim. Outside the Klang Valley map file, so not drawn",
  },
];

/** The Klang Valley map file's bounding box (lng/lat). Developments outside it are data only. */
export const MAP_BBOX = { w: 101.35, s: 2.75, e: 101.85, n: 3.4 };

export const onMap = (d: Development): d is Development & { lng: number; lat: number } =>
  d.lng !== undefined && d.lat !== undefined && d.lng >= MAP_BBOX.w && d.lng <= MAP_BBOX.e && d.lat >= MAP_BBOX.s && d.lat <= MAP_BBOX.n;
