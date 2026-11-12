import type { Dict } from "./types";
import { about } from "./about";
import { admin } from "./admin";
import { auth } from "./auth";
import { bank } from "./bank";
import { battle } from "./battle";
import { engine } from "./engine";
import { fengshui } from "./fengshui";
import { landing } from "./landing";
import { map } from "./map";
import { misc } from "./misc";
import { onboarding } from "./onboarding";
import { profile } from "./profile";
import { shared } from "./shared";
import { shell } from "./shell";
import { swipe } from "./swipe";

/**
 * Every area's Manglish entries in one lookup. Owned by exec-fk-5pm: lanes edit only their own area file, never this one.
 * ponytail: all strings ship in one bundle (about 100 KB at most); split per route only if that ever shows up in a measurement.
 */
export const dict: Dict = {
  ...shared, ...shell, ...landing, ...map, ...swipe, ...battle, ...bank,
  ...onboarding, ...profile, ...admin, ...about, ...auth, ...fengshui, ...misc, ...engine,
};
