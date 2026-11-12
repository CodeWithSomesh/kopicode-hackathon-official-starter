import { distanceKm, type LatLng } from "./data";
import { schoolRows } from "./schools-data";

/**
 * Schools near a home, by type. Real OpenStreetMap schools within 8 km of every Gamuda Land
 * project (nearest 40 each), generated into schools-data.ts by scripts/fetch-schools.mjs.
 * © OpenStreetMap contributors, ODbL. Type is guessed from the school's name; religious
 * (KAFA / tahfiz) and other non-government schools fall under "private".
 */

export type SchoolType = "national_primary" | "chinese_primary" | "tamil_primary" | "secondary" | "international" | "private";

export const schoolTypeLabel: Record<SchoolType, string> = {
  national_primary: "National primary (SK)",
  chinese_primary: "Chinese primary (SJKC)",
  tamil_primary: "Tamil primary (SJKT)",
  secondary: "Secondary (SMK)",
  international: "International",
  private: "Private",
};

export type School = { name: string; type: SchoolType; pos: LatLng };
export type NearbySchool = School & { km: number };

export const schools: School[] = schoolRows.map((r) => ({ name: r.name, type: r.type, pos: { lat: r.lat, lng: r.lng } }));

export function schoolsWithin(pos: LatLng, km: number): NearbySchool[] {
  return schools
    .map((s) => ({ ...s, km: distanceKm(pos, s.pos) }))
    .filter((s) => s.km <= km)
    .sort((a, b) => a.km - b.km);
}

/** The closest school of each type (types with none in the data are left out). */
export function nearestByType(pos: LatLng): Partial<Record<SchoolType, NearbySchool>> {
  const out: Partial<Record<SchoolType, NearbySchool>> = {};
  for (const s of schools) {
    const km = distanceKm(pos, s.pos);
    const best = out[s.type];
    if (!best || km < best.km) out[s.type] = { ...s, km };
  }
  return out;
}
