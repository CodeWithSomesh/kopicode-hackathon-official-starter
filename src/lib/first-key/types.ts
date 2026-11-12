// First Key shared contract. Every value is illustrative / made up.
// Owner of this file: whoever merges chore/shared-contract. Change fields in small separate commits.

export type Compass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/** [lng, lat] — GeoJSON order. */
export type LngLat = [number, number];
/** [x, y] in metres, local to the unit (origin = top-left of the unit, x east, y south when facing N). */
export type XY = [number, number];

export type Room = {
  id: string; // e.g. "ruang_tamu"
  name: string; // e.g. "Living"
  polygon: XY[];
  windows: Compass[]; // which wall directions have a window
};

export type Unit = {
  project: string;
  block: string;
  buildingId: string;
  floor: number;
  unit: string; // "12-03"
  type: "Studio" | "1R1B" | "2R2B" | "3R2B" | "Dual-key" | "3+1 Corner" | "Penthouse";
  sizeSqft: number;
  price: number; // RM
  monthly: number; // RM, see monthlyInstalment()
  facing: Compass;
  lat: number;
  lng: number;
  rooms: Room[];
  /** The front door: a gap in `room`'s corridor wall starting at local x = at[0]. Dual-key suites have a second door in room "dapur_2". */
  door: { room: string; faces: Compass; at: XY };
};

export type Building = {
  id: string;
  block: string; // block name shown to the user
  footprint: LngLat[]; // closed-ring polygon (first point repeated at the end)
  floors: number;
  heightM: number;
  /** Rows of flats round the corridor on a unit floor (1 for a long thin block, else 2). */
  rows: 1 | 2;
  /** "serviced" = Maya Bay-style serviced-apartment tower with shops in the podium; "residence" = North Woods-style tower. */
  style: "serviced" | "residence";
  /** Floors with no flats besides floor 1 (lobby) and floor 2 (car park): facilities decks with pool, gym and function room. */
  decks: number[];
  /** Flats: none on floor 1 (lobby), floor 2 (car park) or a deck floor. */
  units: Unit[];
};

export type Station = { id: string; name: string; lng: number; lat: number };

export type PlaceKind = "school" | "clinic" | "grocery" | "kopitiam" | "worship" | "park";

export type Place = { id: string; name: string; kind: PlaceKind; lng: number; lat: number };

export type RailLine = { id: string; name: string; colour: string; path: LngLat[]; stations: Station[] };

export type Township = {
  name: string;
  center: LngLat;
  buildings: Building[];
  rail: RailLine;
  places: Place[];
};
