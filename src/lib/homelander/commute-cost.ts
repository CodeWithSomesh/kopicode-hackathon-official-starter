import { driveMinutes, distanceKm, transitMinutes, type Anchor, type LatLng } from "./data";
import { estimateTolls, type TollEstimate } from "./tolls";

/**
 * What a commute really costs a month and a year: time, fuel, tolls, parking and train fares.
 * Every figure is an estimate; the shape (CommuteCost) is a contract.
 *
 * Assumptions (checked 12 Nov 2026):
 * - Fuel: RON95 at RM1.99/litre, the BUDI95 targeted-subsidy price for eligible Malaysians
 *   (MOF, "RON95 remains at RM1.99 per litre"; unchanged through Nov 2026). The unsubsidised price
 *   was RM4.27 from 5 Nov 2026 (The Vibes), so non-citizens pay roughly double.
 * - Consumption: 13 km/litre, a mixed city/highway figure for a typical 1.3–1.6 L Malaysian car
 *   (Myvi, City, Vios) in rush-hour traffic; brochure figures of 17–20 km/l are not reached in jams.
 * - Tolls: tolls.ts (estimated, Class 1).
 * - Parking per office day by workplace: our estimate from typical office-building rates
 *   (casual day rate, or a monthly season pass divided by ~22 working days). KLCC and Bukit
 *   Bintang are the dearest; Cyberjaya, Shah Alam and Kajang are cheapest.
 * - Rail: Rapid KL fares are distance-based, about RM1.20 to RM6.40 single trip (cashless). We
 *   model RM0.90 + RM0.16/km, capped at RM6.40, and cap the month at RM50 with the My50
 *   unlimited pass (Rapid KL rail + bus, Malaysians). KTM Komuter is not in My50 and is
 *   cheaper per km (Kuang to KL Sentral is roughly RM4): modelled as RM1.00 + RM0.10/km, no cap.
 * - Getting to the station: walk if within 1.2 km; up to 4 km a feeder bus (RM1 a trip, free
 *   inside My50); beyond 4 km drive and park-and-ride (RM4 a day station parking plus fuel).
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
const FUEL_RM_PER_LITRE = 1.99; // RON95 BUDI95 subsidised price (MOF, 2026)
const KM_PER_LITRE = 13;
const WEEKS = 48;

/** RM per office day, by anchor id. Anything not listed (custom workplaces) uses DEFAULT_PARKING_RM. */
export const PARKING_RM_PER_DAY: Record<string, number> = {
  klcc: 20,
  "bukit-bintang": 18,
  "kl-sentral": 14,
  "damansara-heights": 12,
  "bangsar-south": 10,
  "mid-valley": 10,
  pj: 8,
  "subang-usj": 5,
  puchong: 4,
  "shah-alam": 3,
  kajang: 3,
  cyberjaya: 2,
};
const DEFAULT_PARKING_RM = 8;

const RAIL_BASE_RM = 0.9;
const RAIL_PER_KM_RM = 0.16;
const RAIL_MAX_TRIP_RM = 6.4;
const KTM_BASE_RM = 1;
const KTM_PER_KM_RM = 0.1;
const MY50_RM = 50;
const FEEDER_RM = 1;
const PARK_AND_RIDE_RM = 4;

export function commuteCost(home: LatLng, work: Anchor, officeDays: number): CommuteCost {
  const km = distanceKm(home, work.pos) * ROAD_FACTOR;
  const peak = driveMinutes(home, work.pos);
  const transit = transitMinutes(home, work.pos);
  const tolls = estimateTolls(home, work.pos);
  const daysPerMonth = officeDays * (WEEKS / 12);
  const trips = daysPerMonth * 2;

  const fuelRM = Math.round((km * trips * FUEL_RM_PER_LITRE) / KM_PER_LITRE);
  const tollRM = Math.round(tolls.oneWayRM * trips);
  const parkingRM = Math.round(daysPerMonth * (PARKING_RM_PER_DAY[work.id] ?? DEFAULT_PARKING_RM));

  const railKm = km; // the train roughly follows the road distance
  const onKtm = transit.line.startsWith("KTM");
  const perTrip = onKtm
    ? KTM_BASE_RM + KTM_PER_KM_RM * railKm
    : Math.min(RAIL_BASE_RM + RAIL_PER_KM_RM * railKm, RAIL_MAX_TRIP_RM);
  let fareRM = perTrip * trips;
  if (!onKtm) fareRM = Math.min(fareRM, MY50_RM);

  let accessRM = 0;
  if (transit.stationKm > 4) {
    const accessFuel = (transit.stationKm * ROAD_FACTOR * 2 * FUEL_RM_PER_LITRE) / KM_PER_LITRE;
    accessRM = daysPerMonth * (PARK_AND_RIDE_RM + accessFuel);
  } else if (transit.stationKm > 1.2 && onKtm) {
    accessRM = trips * FEEDER_RM; // feeder bus is free inside My50 for Rapid KL commuters
  }

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
    train: { fareRM: Math.round(fareRM), accessRM: Math.round(accessRM), totalRM: Math.round(fareRM) + Math.round(accessRM) },
    hoursPerYear: {
      car: Math.round((peak * 2 * officeDays * WEEKS) / 60),
      train: Math.round((transit.minutes * 2 * officeDays * WEEKS) / 60),
    },
  };
}
