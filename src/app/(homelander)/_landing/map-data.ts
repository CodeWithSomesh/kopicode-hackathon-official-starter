import { defineSprite } from "@/components/homelander/sprite";
import { availabilityOf, railLines, townships, units, type Township, type Unit } from "@/lib/homelander/data";

/** One row per township: its units, cheapest price and units left (all SAMPLE data). */
export type TownInfo = {
  t: Township;
  units: Unit[];
  from: number;
  left: number;
};

export const towns: TownInfo[] = townships.map((t) => {
  const us = units.filter((u) => u.townshipId === t.id);
  return {
    t,
    units: us,
    from: Math.min(...us.map((u) => u.priceRM)),
    left: us.reduce((n, u) => n + availabilityOf(u.id).left, 0),
  };
});

export const townInfoById = Object.fromEntries(towns.map((x) => [x.t.id, x])) as Record<string, TownInfo>;

/**
 * Which way each pill leans off its pin, so close neighbours (Kundang/Gardens up north,
 * Highpark/Robertson in the middle) sit side by side instead of on top of each other.
 */
export const pillLean: Record<string, "left" | "right" | "center"> = {
  kundang: "left",
  gardens: "right",
  highpark: "left",
  robertson: "right",
};

export const railColors: Record<string, string> = {
  "mrt-kajang": "#23863e",
  "mrt-putrajaya": "#ffcf3f",
  "lrt-kj": "#ef4560",
  ktm: "#2f6fd6",
};

/** Rail as GeoJSON, drawn station to station (approximate alignment). */
export const railGeoJSON = {
  type: "FeatureCollection" as const,
  features: railLines.map((l) => ({
    type: "Feature" as const,
    properties: {
      id: l.id,
      name: l.name,
      color: railColors[l.id] ?? "#2b1d3f",
    },
    geometry: {
      type: "LineString" as const,
      coordinates: l.stations.map((s) => [s.pos.lng, s.pos.lat]),
    },
  })),
};

export const stationGeoJSON = {
  type: "FeatureCollection" as const,
  features: railLines.flatMap((l) =>
    l.stations.map((s) => ({
      type: "Feature" as const,
      properties: { name: s.name, color: railColors[l.id] ?? "#2b1d3f" },
      geometry: { type: "Point" as const, coordinates: [s.pos.lng, s.pos.lat] },
    })),
  ),
};

/** Bounds that hold all seven townships, [west, south, east, north]. */
export const townBounds: [number, number, number, number] = [
  Math.min(...townships.map((t) => t.pos.lng)),
  Math.min(...townships.map((t) => t.pos.lat)),
  Math.max(...townships.map((t) => t.pos.lng)),
  Math.max(...townships.map((t) => t.pos.lat)),
];

const KAYA = "#ffcf3f";
const RAYA = "#ef4560";
const WHITE = "#ffffff";

export const mapSprites = {
  plus: defineSprite(["..#..", "..#..", "#####", "..#..", "..#.."]),
  minus: defineSprite([".....", ".....", "#####", ".....", "....."]),
  needle: defineSprite(["..r..", ".rrr.", ".rrr.", "rrrrr", "..#..", "#####", ".###.", ".###.", "..#.."], { r: RAYA }),
  office: defineSprite(
    [
      "#########",
      "#k#k#k#k#",
      "#########",
      "#k#k#k#k#",
      "#########",
      "#k#k#k#k#",
      "#########",
      "###www###",
      "###w#w###",
    ],
    { k: KAYA, w: WHITE },
  ),
  train: defineSprite([".#####.", "#wwwww#", "#wwwww#", "#######", "#k###k#", "#######", ".#...#.", "#.....#"], {
    w: WHITE,
    k: KAYA,
  }),
  car: defineSprite(["..####...", ".#ww#w#..", "#########", "#k#####k#", "#########", ".##...##."], {
    w: WHITE,
    k: KAYA,
  }),
  tail: defineSprite(["#####", ".###.", "..#.."]),
};
