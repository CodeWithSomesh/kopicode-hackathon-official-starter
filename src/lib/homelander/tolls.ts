import type { LatLng } from "./data";

/**
 * Estimated toll for a drive. No API prices Malaysian tolls, so the data agent fills `plazas`
 * with a hand-built table of Klang Valley toll plazas (Class 1 car rates) and estimates which a
 * route passes. Always shown to buyers as "estimated". CONTRACT: keep the signatures.
 */

export type TollPlaza = { id: string; name: string; highway: string; pos: LatLng; class1RM: number };

export type TollEstimate = { plazas: TollPlaza[]; oneWayRM: number };

export const plazas: TollPlaza[] = [];

export function estimateTolls(from: LatLng, to: LatLng): TollEstimate {
  void from;
  void to;
  return { plazas: [], oneWayRM: 0 };
}
