import { Mesher, ROLES, type Role, type TowerParts } from "./tower-model";

/**
 * Commercial site buildings (spawned at the Gamuda sites; illustrative): a shoplot row with its five-foot way, and a
 * mall / retail podium. Same frame: metres, origin at the footprint centre on the ground, x along the row (w), z the
 * depth (d) with the street front at +z, y up. Same material roles as the towers.
 */

const SHOP_GROUND = 4.2;
const SHOP_UPPER = 3.6;
const ARCADE = 2.4; // the five-foot way under the upper floors (wider than five feet, as built)

const parts = (M: Record<Role, Mesher>): TowerParts => {
  const out: TowerParts = {};
  for (const r of ROLES) {
    const g = M[r].geometry(r === "glass");
    if (g) out[r] = g;
  }
  return out;
};
const meshers = () => Object.fromEntries(ROLES.map((r) => [r, new Mesher()])) as Record<Role, Mesher>;

/** n shop units of `unit` m frontage, `storeys` high: shopfronts behind an arcade, a signage band, upper-floor windows. */
export function shoplotParts(n: number, storeys: number, unit: number, d: number): TowerParts {
  const M = meshers();
  const w = n * unit;
  const H = SHOP_GROUND + (storeys - 1) * SHOP_UPPER;
  const front = d / 2;
  // ground: shopfront glass set back by the arcade; upper floors overhang it (their slab is the arcade's roof)
  M.glass.box(0, front - ARCADE - 0.1, w - 0.2, 0.2, 0, SHOP_GROUND - 0.6);
  M.wall.box(0, -ARCADE / 2, w, d - ARCADE, 0, SHOP_GROUND); // shop interiors' back walls and sides
  M.wall.box(0, 0, w, d, SHOP_GROUND, H);
  M.podium.box(0, 0, w, d, SHOP_GROUND - 0.35, SHOP_GROUND); // the first-floor slab, edge shows over the arcade
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + i * unit;
    M.podium.box(x, front - 0.3, 0.45, 0.45, 0, SHOP_GROUND); // arcade columns on the party walls
    M.frame.box(x, 0, 0.3, d + 0.05, SHOP_GROUND, H + 0.6); // party-wall fins up the facade
    if (i < n) {
      const cx = x + unit / 2;
      // signage band: one sign per shop on the fascia, alternating muted primary and stone
      M[i % 2 ? "podium" : "sign"].box(cx, front + 0.05, unit - 0.6, 0.1, SHOP_GROUND - 1.0, SHOP_GROUND - 0.4);
      for (let s = 1; s < storeys; s++) {
        const y0 = SHOP_GROUND + (s - 1) * SHOP_UPPER;
        M.glass.box(cx, front, unit * 0.62, 0.12, y0 + 0.9, y0 + 2.6); // a window per shop per floor (front only: the map rarely sees the back)
      }
    }
  }
  M.roof.box(0, 0, w + 0.2, d + 0.2, H, H + 0.25);
  M.frame.box(0, front, w + 0.2, 0.25, H + 0.25, H + 1.1); // front parapet
  M.roof.box(-w / 2 + unit / 2, -d / 2 + 2, 2, 2, H + 0.25, H + 1.8); // water tanks at the back
  M.roof.box(w / 2 - unit / 2, -d / 2 + 2, 2, 2, H + 0.25, H + 1.8);
  return parts(M);
}

/** A mall / retail podium: stone body, a glass band per storey, a glass entrance bay on the street side, signs, roof plant. */
export function mallParts(storeys: number, w: number, d: number): TowerParts {
  const M = meshers();
  const fl = 5;
  const H = storeys * fl;
  M.podium.box(0, 0, w, d, 0, H);
  for (let s = 0; s < storeys; s++) {
    const y = s * fl;
    // continuous glass band round the body, recessed between stone spandrels
    for (const [x, z, bw, bd] of [[0, d / 2, w - 2, 0.3], [0, -d / 2, w - 2, 0.3], [w / 2, 0, 0.3, d - 2], [-w / 2, 0, 0.3, d - 2]] as const)
      M.glass.box(x, z, bw, bd, y + 1.2, y + fl - 1.0);
  }
  // the entrance: a full-height glass bay with a canopy, and signage either side
  M.glass.box(0, d / 2 + 1, w * 0.22, 2, 0, H - 1.5);
  M.frame.box(0, d / 2 + 3.5, w * 0.3, 7, fl - 0.6, fl - 0.2);
  for (const x of [-w * 0.3, w * 0.3]) M.sign.box(x, d / 2 + 0.2, w * 0.18, 0.3, H - 3.2, H - 1.2);
  M.roof.box(0, 0, w + 0.4, d + 0.4, H, H + 0.4);
  M.frame.box(0, d / 2, w + 0.4, 0.3, H + 0.4, H + 1.4);
  M.frame.box(0, -d / 2, w + 0.4, 0.3, H + 0.4, H + 1.4);
  for (const [x, z] of [[-w * 0.25, -d * 0.15], [w * 0.2, d * 0.1], [w * 0.05, -d * 0.25]] as const) M.roof.box(x, z, 8, 6, H + 0.4, H + 2.8);
  M.green.box(-w * 0.32, d * 0.2, w * 0.2, d * 0.3, H + 0.4, H + 1.0); // a roof garden
  return parts(M);
}
