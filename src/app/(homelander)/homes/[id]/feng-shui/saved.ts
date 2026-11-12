import { CATALOG, type Item } from "./furniture";
import type { Plan } from "./plans";

/** One saved layout per unit in localStorage. Bump VERSION when the shape changes. */

const VERSION = 1;
const key = (unitId: string) => `homelander:feng-shui:v${VERSION}:${unitId}`;

export type Saved = {
  facing: number;
  time: number;
  month: number;
  curtains: string[];
  items: Item[];
};

export function loadLayout(unitId: string, plan: Plan): Saved | null {
  try {
    const raw = window.localStorage.getItem(key(unitId));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Saved>;
    const floors = new Set(plan.floors.map((f) => f.id));
    if (!Array.isArray(s.items) || typeof s.facing !== "number") return null;
    // Drop anything a newer plan or catalogue no longer knows about.
    const items = s.items.filter(
      (i) => i && i.kind in CATALOG && floors.has(i.floor),
    );
    return {
      facing: s.facing,
      time: typeof s.time === "number" ? s.time : 17,
      month: typeof s.month === "number" ? s.month : 6,
      curtains: Array.isArray(s.curtains) ? s.curtains : [],
      items,
    };
  } catch {
    return null;
  }
}

export function saveLayout(unitId: string, s: Saved) {
  try {
    window.localStorage.setItem(key(unitId), JSON.stringify(s));
  } catch {
    // Private mode or full storage: the layout just won't survive a reload.
  }
}

export function clearLayout(unitId: string) {
  try {
    window.localStorage.removeItem(key(unitId));
  } catch {}
}
