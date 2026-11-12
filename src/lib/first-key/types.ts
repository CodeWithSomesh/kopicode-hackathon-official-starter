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
  type: "2R1B" | "3R2B" | "4R3B";
  sizeSqft: number;
  price: number; // RM
  monthly: number; // RM, see monthlyInstalment()
  facing: Compass;
  lat: number;
  lng: number;
  rooms: Room[];
  door: { room: string; faces: Compass; at: XY };
};

export type Building = {
  id: string;
  block: string; // block name shown to the user
  footprint: LngLat[]; // closed-ring polygon (first point repeated at the end)
  floors: number;
  heightM: number;
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

/** A real Gamuda Land development (public facts from gamudaland.com.my). Unit numbers elsewhere stay made up. */
export type Development = {
  id: string;
  name: string;
  town: string;
  state: string;
  acres?: number;
  blurb: string;
  url: string;
  launch?: { name: string; type: string; fromPrice: number };
  /** Absent = no coordinate found, so it is not drawn on the map. */
  lng?: number;
  lat?: number;
  /** Where the point came from (OpenStreetMap object), or why there is none. */
  coordSource: string;
};
