import { distanceKm, type LatLng } from "./data";

/**
 * Schools near a home, by type. CONTRACT: the data agent replaces `schools` with real
 * OpenStreetMap schools (ODbL) around every project; the functions keep their signatures.
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

export const schools: School[] = [];

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
