import type { Kind } from "./furniture";

/**
 * Display names for replies. English room names read well after "in the"; Malay names are
 * for the Manglish replies, so "letak pokok kat ruang tamu", not "kat living".
 */

/** Malay names for the Manglish replies. */
export const KIND_MS: Record<Kind, string> = {
  sofa: "sofa",
  tv: "kabinet TV",
  coffee: "meja kopi",
  dining: "meja makan",
  bed: "katil",
  wardrobe: "almari",
  desk: "meja tulis",
  shoerack: "rak kasut",
  stove: "dapur gas",
  sink: "sinki",
  altar: "altar",
  mirror: "cermin",
  plant: "pokok",
};
export const ROOM_MS: Record<string, string> = {
  living: "ruang tamu",
  dining: "ruang makan",
  kitchen: "dapur",
  wet: "dapur basah",
  master: "bilik utama",
  bed2: "bilik 2",
  bed3: "bilik 3",
  bed4: "bilik 4",
  guest: "bilik tetamu",
  study: "bilik bacaan",
  foyer: "foyer",
  hall: "ruang keluarga",
  hallway: "lorong",
  corridor: "koridor",
  store: "stor",
  walkin: "walk-in",
  balcony: "balkoni",
  porch: "porch",
  yard: "laman belakang",
  bath1: "bilik air",
  bath2: "bilik air",
  mbath: "bilik air",
  stairs: "tangga",
};

export const kindMs = (k: Kind) => KIND_MS[k];

export const roomMs = (id: string, fallback: string) =>
  ROOM_MS[id] ?? fallback.toLowerCase();

const ROOM_EN: Record<string, string> = {
  living: "living room",
  dining: "dining area",
};

export const roomEn = (id: string, fallback: string) =>
  ROOM_EN[id] ?? fallback.toLowerCase();
