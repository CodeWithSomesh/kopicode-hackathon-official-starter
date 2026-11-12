import { driveMinutes, distanceKm, transitMinutes, type Anchor, type LatLng } from "./data";
import { estimateTolls, type TollEstimate } from "./tolls";

/**
 * What a commute really costs a month and a year: time, fuel, tolls, parking and train fares.
 * CONTRACT: the data agent refines the assumptions (fuel price, consumption, parking by area,
 * rail fares); the shape stays. Every figure is an estimate.
 */

export type CommuteCost = {
  driveKmOneWay: number;
  driveMinPeak: number;
  driveMinOffPeak: number;
  trainMinOneWay: number;
  station: string;
  stationKm: number;
  line: string;
  tolls: TollEstimate;
  /** Monthly, at the given office days. */
  car: { fuelRM: number; tollRM: number; parkingRM: number; totalRM: number };
  train: { fareRM: number; accessRM: number; totalRM: number };
  hoursPerYear: { car: number; train: number };
};

const ROAD_FACTOR = 1.35;
const FUEL_RM_PER_LITRE = 2.05; // RON95, subsidised (estimate)
const KM_PER_LITRE = 14;
const WEEKS = 48;

export function commuteCost(home: LatLng, work: Anchor, officeDays: number): CommuteCost {
  const km = distanceKm(home, work.pos) * ROAD_FACTOR;
  const peak = driveMinutes(home, work.pos);
  const transit = transitMinutes(home, work.pos);
  const tolls = estimateTolls(home, work.pos);
  const trips = officeDays * 2 * (WEEKS / 12);
  const fuelRM = Math.round((km * trips * FUEL_RM_PER_LITRE) / KM_PER_LITRE);
  const tollRM = Math.round(tolls.oneWayRM * trips);
  const parkingRM = Math.round(officeDays * (WEEKS / 12) * 10);
  const fareRM = Math.round(Math.min(km * 0.12 + 1, 8) * trips);
  const accessRM = transit.stationKm > 1.2 ? Math.round(officeDays * (WEEKS / 12) * 4) : 0;
  return {
    driveKmOneWay: Math.round(km * 10) / 10,
    driveMinPeak: peak,
    driveMinOffPeak: Math.round(peak * 0.65),
    trainMinOneWay: transit.minutes,
    station: transit.station,
    stationKm: transit.stationKm,
    line: transit.line,
    tolls,
    car: { fuelRM, tollRM, parkingRM, totalRM: fuelRM + tollRM + parkingRM },
    train: { fareRM, accessRM, totalRM: fareRM + accessRM },
    hoursPerYear: {
      car: Math.round((peak * 2 * officeDays * WEEKS) / 60),
      train: Math.round((transit.minutes * 2 * officeDays * WEEKS) / 60),
    },
  };
}
