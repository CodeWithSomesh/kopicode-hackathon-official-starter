"use client";

import { useEffect, useRef, useState } from "react";
import { township } from "@/lib/first-key/township";
import { centroid } from "@/lib/first-key/geo";
import { anchorOptions, rmShort, townshipById } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { railColors, railGeoJSON, towns } from "@/app/(homelander)/_landing/map-data";
import type { ControlMap } from "@/app/(homelander)/_landing/map-controls";
import { usePrefersReducedMotion } from "../use-reduced-motion";
import { setMapNight } from "../use-map-colors";
import { readThemeColors } from "../use-theme-colors";

// Google Maps Platform photorealistic 3D (Map3DElement, Maps JavaScript API, `v=beta` channel, `maps3d` + `marker` libraries).
// Used when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set; find-client.tsx then mounts no other map (Google's terms: no Google content
// on a screen that also shows a non-Google map). Same props as mapbox-map.tsx. Google's logo and attribution stay visible.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
export const COVE_ID = "cove";

// ---- loader: one script tag (Google's documented dynamic library import, without the minified bootstrap) ----
type G = { maps: { importLibrary(name: string): Promise<Record<string, unknown>> } };
let loading: Promise<G> | undefined;
function loadGoogle(): Promise<G> {
  const w = window as unknown as { google?: G; __hlGoogleReady?: () => void };
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  loading ??= new Promise<G>((resolve, reject) => {
    w.__hlGoogleReady = () => resolve(w.google!);
    const s = document.createElement("script");
    const q = new URLSearchParams({ key: KEY ?? "", v: "beta", loading: "async", callback: "__hlGoogleReady" });
    s.src = `https://maps.googleapis.com/maps/api/js?${q}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps JavaScript API could not load"));
    document.head.append(s);
  });
  return loading;
}

// ---- the slice of the 3D API we use (no @types/google.maps package) ----
type LatLngAlt = { lat: number; lng: number; altitude: number };
type Cam = { center: LatLngAlt; range: number; tilt: number; heading: number; fov?: number };
type Map3D = HTMLElement &
  Cam & {
    fov: number;
    flyCameraTo(o: { endCamera: Partial<Cam>; durationMillis: number }): void;
    flyCameraAround(o: { camera: Partial<Cam>; durationMillis: number; repeatCount: number }): void;
    stopCameraAnimation(): void;
  };
type Ctor<T = HTMLElement> = new (o?: Record<string, unknown>) => T;

// ---- cameras (Google heading = compass degrees; range = metres from the camera to the centre) ----
const wide = () => window.matchMedia("(min-width: 1024px)").matches;
const ll = (lat: number, lng: number, altitude = 30): LatLngAlt => ({ lat, lng, altitude });
// Space over Peninsular Malaysia: where the intro starts.
const SPACE: Cam = { center: ll(3.6, 102.2, 0), range: 9_000_000, tilt: 0, heading: 0 };
// Klang Valley overview: every selling project (2.88-3.30 N, 101.51-101.75 E) in view, clear of the left list on desktop.
// ponytail: hand-tuned per width class, like mapbox-map's klangView; tune here if the pins leave the screen.
const klangCam = (): Cam =>
  wide()
    ? { center: ll(3.07, 101.6), range: 86_000, tilt: 52, heading: 348 }
    : { center: ll(2.98, 101.62), range: 125_000, tilt: 48, heading: 348 };
// Google's camera has no padding. Phones: the bottom sheet covers the lower half, so the camera looks at a point
// 0.18 x range nearer the viewer: the pin lands ~y 215 on a 400x860 phone, between the chips and the sheet (measured).
const lift = (c: Cam): Cam => {
  if (wide()) return c;
  const d = 0.18 * c.range;
  const h = (c.heading * Math.PI) / 180;
  const lat = c.center.lat - (d * Math.cos(h)) / 110_574;
  const lng = c.center.lng - (d * Math.sin(h)) / (111_320 * Math.cos((c.center.lat * Math.PI) / 180));
  return { ...c, center: { ...c.center, lat, lng } };
};
const [CLNG, CLAT] = township.center;
const coveCam = (heading: number): Cam => lift({ center: ll(CLAT, CLNG, 15), range: 950, tilt: 55, heading });
const devCam = (id: string, heading: number): Cam => {
  if (id === COVE_ID) return coveCam(heading);
  const t = townshipById[id];
  return lift({ center: ll(t.pos.lat, t.pos.lng), range: 2600, tilt: 60, heading });
};
// Kundang, Gardens and Gardens Park sit 2-3 km apart: at the overview their labels would stack, so their pins stand at
// different heights (metres above ground; about 25 px apart on screen at 86 km range). ponytail: hand-tuned like pillLean.
const PIN_ALT: Record<string, number> = { kundang: 140, gardens: 1600, "gardens-park": 3100 };
// glTF is +Y up; how Google maps the model's axes onto the globe (heading, tilt, roll in degrees). Tuned by measurement.
const MODEL_ORIENTATION = { heading: 0, tilt: 0, roll: 0 };
const centres = Object.fromEntries(township.buildings.map((b) => [b.id, centroid(b.footprint)]));
const buildingCam = (id: string, heading: number): Cam => {
  const [lng, lat] = centres[id];
  return { center: ll(lat, lng, 15), range: 320, tilt: 60, heading };
};

type Props = {
  selectedId?: string;
  onSelect: (buildingId: string | undefined) => void;
  paused: boolean;
  onArrived: () => void;
  startAtSelected?: boolean;
  devId?: string;
  onSelectDev: (id: string) => void;
  onMapReady?: (map: ControlMap) => void;
  /** The load intro finished (or was skipped): the list and pitch card can show. */
  onIntroDone?: () => void;
  /** True while the camera flies to a township; the panel waits for false. */
  onFlying?: (flying: boolean) => void;
  /** Google refused (bad key, billing, API not enabled) or did not load: the page swaps to the other map. */
  onFail?: () => void;
};

/** MapControls (zoom, compass, 2D/3D) and the burst's map-view capture, over Google's camera. */
function controlAdapter(map: Map3D): ControlMap {
  const fly = (c: Partial<Cam>, ms = 600) => map.flyCameraTo({ endCamera: { ...cam(map), ...c }, durationMillis: ms });
  const events: Record<string, string> = { rotate: "gmp-headingchange", pitchend: "gmp-tiltchange" };
  return {
    getBearing: () => map.heading ?? 0,
    getPitch: () => map.tilt ?? 0,
    // mapViewOf turns zoom back into a distance: this inverts it so the burst gets exactly Google's range.
    getZoom: () => {
      const lat = map.center?.lat ?? 0;
      const px = (0.5 * map.clientHeight) / Math.tan(((map.fov || 35) * Math.PI) / 360);
      return Math.log2((40_075_016.686 * Math.cos((lat * Math.PI) / 180) * px) / (512 * map.range));
    },
    getVerticalFieldOfView: () => map.fov || 35,
    getCenter: () => ({ lng: map.center?.lng ?? 0, lat: map.center?.lat ?? 0 }),
    getContainer: () => map,
    on: (t, fn) => map.addEventListener(events[t] ?? t, fn),
    off: (t, fn) => map.removeEventListener(events[t] ?? t, fn),
    zoomIn: ({ animate }) => fly({ range: map.range / 2 }, animate ? 600 : 0),
    zoomOut: ({ animate }) => fly({ range: map.range * 2 }, animate ? 600 : 0),
    resetNorth: ({ animate }) => fly({ heading: 0 }, animate ? 600 : 0),
    easeTo: ({ pitch, duration }) => fly({ tilt: pitch }, duration),
  };
}
const cam = (m: Map3D): Cam => ({
  center: { lat: m.center.lat, lng: m.center.lng, altitude: m.center.altitude },
  range: m.range,
  tilt: m.tilt,
  heading: m.heading,
});
const css = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

export default function GoogleMap({ selectedId, onSelect, paused, onArrived, startAtSelected, devId, onSelectDev, onMapReady, onIntroDone, onFlying, onFail }: Props) {
  const hl = useHomeLander();
  const workAnchor = anchorOptions.find((a) => a.id === hl.anchorId) ?? anchorOptions[0]!;
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map3D>();
  const [lib, setLib] = useState<Record<string, Ctor>>();
  const reduced = usePrefersReducedMotion();
  const props = useRef({ onSelect, onSelectDev, onArrived, onIntroDone, onFlying, onFail });
  useEffect(() => {
    props.current = { onSelect, onSelectDev, onArrived, onIntroDone, onFlying, onFail };
  });

  // One flight at a time: each new flight bumps the token; an older flight's "animationend" is ignored.
  const token = useRef(0);
  const flight = (to: Cam, ms: number, then?: () => void) => {
    if (!map) return;
    const mine = ++token.current;
    map.stopCameraAnimation();
    if (reduced || ms === 0) {
      Object.assign(map, to);
      then?.();
      return;
    }
    const done = () => {
      map.removeEventListener("gmp-animationend", done);
      if (mine === token.current) then?.();
    };
    map.addEventListener("gmp-animationend", done);
    map.flyCameraTo({ endCamera: to, durationMillis: ms });
  };
  const orbit = (around: Cam) => {
    if (!map || reduced || !wide()) return; // phones: the lifted centre would swing the site under the sheet
    map.flyCameraAround({ camera: around, durationMillis: 90_000, repeatCount: 1 });
  };

  // Load the API and build the map once.
  useEffect(() => {
    let dead = false;
    let el: Map3D | undefined;
    setMapNight(false); // a Night left on from the other maps would darken the UI with no button to turn it off
    // A refused key (bad key, billing, referrer, API not enabled) only shows as Google's console error "...MapError" on the
    // 3D map: no gm_authFailure call, no gmp-error event (measured with an invalid key). Then the page falls back to the other map.
    // ponytail: matches Google's documented error-message prefix; if Google rewords it, the fallback stops firing (map shows Google's error box).
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => props.current.onFail?.();
    const consoleError = console.error;
    console.error = (...a: unknown[]) => {
      if (typeof a[0] === "string" && /Google Maps JavaScript API error: \w*MapError/.test(a[0])) props.current.onFail?.();
      consoleError.apply(console, a);
    };
    const giveUp = setTimeout(() => props.current.onIntroDone?.(), 12_000); // the list never waits longer than this
    loadGoogle()
      .then(async (g) => {
        const [m3d, mk] = await Promise.all([g.maps.importLibrary("maps3d"), g.maps.importLibrary("marker")]);
        if (dead || !host.current) return;
        const Map3DElement = m3d.Map3DElement as Ctor<Map3D>;
        const deep = !!startAtSelected || !!(devId && townshipById[devId]);
        const start = startAtSelected && selectedId ? buildingCam(selectedId, 20) : devId && townshipById[devId] ? devCam(devId, 20) : klangCam();
        const intro = !deep && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el = new Map3DElement({ ...(intro ? SPACE : start), mode: "SATELLITE", defaultUIHidden: true });
        el.style.cssText = "display:block;width:100%;height:100%";
        host.current.append(el);
        setLib({ ...(m3d as Record<string, Ctor>), PinElement: mk.PinElement as Ctor });
        setMap(el);
        onMapReady?.(controlAdapter(el));
        if (!intro) {
          props.current.onIntroDone?.();
          if (startAtSelected && selectedId) props.current.onArrived();
          return;
        }
        // The intro: wait for the globe to be drawn, then fly from space into the Klang Valley.
        let started = false;
        const go = () => {
          if (started || dead) return;
          started = true;
          const done = () => {
            el!.removeEventListener("gmp-animationend", done);
            clearTimeout(giveUp);
            props.current.onIntroDone?.();
          };
          el!.addEventListener("gmp-animationend", done);
          el!.flyCameraTo({ endCamera: klangCam(), durationMillis: 7000 });
        };
        el.addEventListener("gmp-error", () => props.current.onFail?.());
        el.addEventListener("gmp-steadychange", (e) => (e as Event & { isSteady?: boolean }).isSteady && go(), { once: false });
        setTimeout(go, 2500); // never hold the page on a globe that is slow to settle
      })
      .catch((e) => {
        console.warn(e);
        props.current.onFail?.();
      });
    return () => {
      dead = true;
      clearTimeout(giveUp);
      console.error = consoleError;
      el?.remove();
    };
    // built once; later prop changes drive the camera below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Township picked (or "Show all"): swing in, then one slow orbit; the panel opens on landing.
  const firstDev = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (firstDev.current) {
      firstDev.current = false;
      return; // the start camera already shows it
    }
    if (selectedId) return; // a building has its own fly-in
    if (devId && townshipById[devId]) {
      const to = devCam(devId, (map.heading + 70) % 360);
      props.current.onFlying?.(true);
      flight(to, 4200, () => {
        props.current.onFlying?.(false);
        orbit(to);
      });
    } else {
      props.current.onFlying?.(false);
      flight(klangCam(), 4000);
    }
    // flight/orbit close over map and reduced only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devId, map]);

  // Building picked: fly close, then hand over to the burst.
  const firstSel = useRef(true);
  useEffect(() => {
    if (!map) return;
    const isFirst = firstSel.current;
    firstSel.current = false;
    if (!selectedId || (isFirst && startAtSelected)) return;
    before.current = cam(map);
    flight(buildingCam(selectedId, map.heading), 1800, () => props.current.onArrived());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map]);

  // Burst closed: back to the camera the tower was picked from (a deep link has none: the block view).
  const before = useRef<Cam>(undefined);
  const wasPaused = useRef(false);
  useEffect(() => {
    if (wasPaused.current && !paused && map) flight(before.current ?? coveCam(map.heading), 1400);
    wasPaused.current = paused;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, map]);

  // Project pins: Google 3D markers (interactive markers draw only a PinElement + text label). Completed projects muted.
  useEffect(() => {
    if (!map || !lib || !host.current) return;
    const { Marker3DInteractiveElement, Marker3DElement, PinElement, Polyline3DElement } = lib;
    const root = host.current;
    const c = (n: string) => css(root, n);
    const made: HTMLElement[] = [];
    for (const l of railGeoJSON.features) {
      made.push(
        new Polyline3DElement({
          path: l.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
          altitudeMode: "CLAMP_TO_GROUND",
          strokeColor: railColors[l.properties.id] ?? c("--color-ink"),
          outerColor: c("--color-ink"),
          strokeWidth: 6,
          outerWidth: 0.3,
          drawsOccludedSegments: true,
        }),
      );
    }
    if (!selectedId) {
      const phone = !wide();
      for (const x of towns) {
        if (x.t.region !== "klang-valley" && x.t.id !== devId) continue;
        const done = x.t.status === "completed";
        const sel = devId === x.t.id;
        const m = new Marker3DInteractiveElement({
          position: { lat: x.t.pos.lat, lng: x.t.pos.lng, altitude: sel || devId ? 140 : (PIN_ALT[x.t.id] ?? (done ? 60 : 140)) * (phone ? 1.6 : 1) },
          altitudeMode: "RELATIVE_TO_GROUND",
          extruded: true,
          drawsWhenOccluded: true,
          sizePreserved: true,
          // phones: completed pins go unlabelled (muted pin + hover title), or the overview is a wall of text
          label: done ? (phone ? undefined : `${x.t.name} · resale`) : `${x.t.name} · From ${rmShort(x.from)}`,
          title: done ? `${x.t.name}, completed, resale only` : `${x.t.name}, from ${rmShort(x.from)}, ${x.left} units left`,
          collisionBehavior: done ? "OPTIONAL_AND_HIDES_LOWER_PRIORITY" : "REQUIRED",
          collisionPriority: sel ? 3 : done ? 0 : 2,
          zIndex: sel ? 3 : done ? 0 : 2,
        });
        m.append(
          new PinElement({
            background: sel ? c("--color-kaya") : done ? c("--color-cloud") : c("--color-pandan-deep"),
            borderColor: c("--color-ink"),
            glyphColor: done ? c("--color-ink-soft") : sel ? c("--color-ink") : c("--color-cloud"),
            scale: done ? 0.8 : sel ? 1.25 : 1.05,
          }),
        );
        m.addEventListener("gmp-click", () => props.current.onSelectDev(x.t.id));
        made.push(m);
      }
      const w = new Marker3DElement({
        position: { lat: workAnchor.pos.lat, lng: workAnchor.pos.lng, altitude: 80 },
        altitudeMode: "RELATIVE_TO_GROUND",
        extruded: true,
        label: phone ? "Work" : `Your work: ${workAnchor.name}`,
        collisionBehavior: "OPTIONAL_AND_HIDES_LOWER_PRIORITY",
      });
      w.append(new PinElement({ background: c("--color-lilac"), borderColor: c("--color-ink"), glyphColor: c("--color-ink"), scale: 0.8 }));
      made.push(w);
    }
    map.append(...made);
    return () => made.forEach((m) => m.remove());
  }, [map, lib, devId, selectedId, workAnchor]);

  // Our 12 illustrative towers as .glb models: the burst's own procedural shell, built once in the browser.
  const [glbs, setGlbs] = useState<Record<string, string> | "failed">();
  useEffect(() => {
    if (!lib) return;
    let dead = false;
    const colors = readThemeColors();
    // three.js + GLTFExporter load only here, after the map is up (the burst chunk shares them)
    import("./tower-glb")
      .then(({ towerGlb }) => Promise.all(township.buildings.map(async (b) => [b.id, await towerGlb(b, colors)] as const)))
      .then((pairs) => {
        if (!dead) setGlbs(Object.fromEntries(pairs));
      })
      .catch((e) => {
        console.warn(e);
        if (!dead) setGlbs("failed");
      });
    return () => {
      dead = true;
    };
  }, [lib]);

  // The picked block in the primary colour, as the other maps draw it: the burst's first frame starts in that colour.
  const [tinted, setTinted] = useState<{ id: string; src: string }>();
  useEffect(() => {
    if (!selectedId || glbs === "failed" || !glbs) return;
    let dead = false;
    const colors = readThemeColors();
    const b = township.buildings.find((x) => x.id === selectedId);
    if (b) void import("./tower-glb").then(({ towerGlb }) => towerGlb(b, colors, colors.primary)).then((src) => !dead && setTinted({ id: b.id, src }));
    return () => {
      dead = true;
    };
  }, [selectedId, glbs]);

  // Our illustrative block at Gamuda Cove on the real photoreal ground: clickable glTF towers (Model3DInteractiveElement);
  // if the models could not be built, extruded clickable footprints (Polygon3DInteractiveElement) instead. Built once:
  // a pick only swaps one model's src (below), so the towers don't blink while the camera flies in.
  const towers = useRef<Record<string, HTMLElement & { src?: string; fillColor?: string }>>({});
  useEffect(() => {
    if (!map || !lib || !host.current || !glbs) return;
    const { Model3DInteractiveElement, Polygon3DInteractiveElement } = lib;
    const root = host.current;
    const made = township.buildings.map((b) => {
      const title = `Block ${b.block}: illustrative block, made-up units and prices`;
      const [lng, lat] = centres[b.id];
      const el =
        glbs !== "failed"
          ? new Model3DInteractiveElement({ src: glbs[b.id], position: { lat, lng, altitude: 0 }, altitudeMode: "CLAMP_TO_GROUND", orientation: MODEL_ORIENTATION })
          : new Polygon3DInteractiveElement({
              path: b.footprint.map(([lng, lat]) => ({ lat, lng, altitude: b.heightM })),
              altitudeMode: "RELATIVE_TO_GROUND",
              extruded: true,
              fillColor: css(root, "--color-cloud"),
              strokeColor: css(root, "--color-ink"),
              strokeWidth: 1,
            });
      el.title = title;
      el.addEventListener("gmp-click", () => props.current.onSelect(b.id));
      towers.current[b.id] = el;
      return el;
    });
    map.append(...made);
    return () => {
      made.forEach((m) => m.remove());
      towers.current = {};
    };
  }, [map, lib, glbs]);

  // The picked tower in the primary colour; the others back to glass.
  useEffect(() => {
    if (!glbs) return;
    for (const [id, el] of Object.entries(towers.current)) {
      const want = id === selectedId;
      if (glbs === "failed") el.fillColor = want ? readThemeColors().primary : css(host.current ?? document.body, "--color-cloud");
      else {
        const src = want && tinted?.id === id ? tinted.src : glbs[id];
        if (el.src !== src) el.src = src;
      }
    }
  }, [selectedId, tinted, glbs]);

  // Close to Cove, a label says what the block is, on the map itself.
  useEffect(() => {
    if (!map || !lib || !host.current || (devId !== COVE_ID && !selectedId)) return;
    const { Marker3DElement, PinElement } = lib;
    const c = (n: string) => css(host.current!, n);
    const label = new Marker3DElement({
      position: { lat: CLAT, lng: CLNG, altitude: Math.max(...township.buildings.map((b) => b.heightM)) + 25 },
      altitudeMode: "RELATIVE_TO_GROUND",
      label: "Illustrative block, made-up units and prices",
      collisionBehavior: "REQUIRED",
    });
    label.append(new PinElement({ background: c("--color-kaya"), borderColor: c("--color-ink"), glyphColor: c("--color-ink"), scale: 0.7 }));
    map.append(label);
    return () => label.remove();
  }, [map, lib, devId, selectedId]);

  return (
    // Phones: the map ends above the tab bar so Google's logo and attribution (bottom of the canvas) stay visible.
    <div ref={host} className="absolute inset-x-0 top-0 bottom-0 max-lg:bottom-[96px]" aria-label="Photorealistic 3D map of Gamuda Land projects" role="region" />
  );
}
