"use client";

import { useSyncExternalStore } from "react";
import type { PassReason } from "./data";
import { mergeProfile, type Profile } from "./profile";

/**
 * Demo state for HomeLander, kept in localStorage so the buyer app (/homelander) and the
 * Gamuda dashboard (/admin) see the same swipes and leads in one browser.
 * Swap for a Supabase table when this becomes real.
 */

export type Answers = {
  kids: "yes" | "maybe" | "no";
  parents: "yes" | "no";
  officeDays: number;
  mode: "car" | "train";
  priority: "space" | "time";
};

export type Lead = {
  id: string;
  name: string;
  unitId: string;
  maxPriceRM: number;
  createdAt: string;
  reasons: string[];
};

/** What the bank check worked out; read by Compare and Mochi. Null until the buyer runs the bank check. */
export type Budget = {
  grossRM: number;
  netRM: number;
  commitmentsRM: number;
  maxLoanRM: number;
  maxPriceRM: number;
};

export type HomeLanderState = {
  liked: string[];
  passed: { id: string; reason?: PassReason }[];
  /** Unit ids in the order they were swiped, for undo. */
  history: string[];
  anchorId: string;
  secondAnchorId: string;
  scanned: boolean;
  answers: Answers | null;
  leads: Lead[];
  budget: Budget | null;
  /** Unit ids picked for Battle (2 to 5). */
  compare: string[];
  /** What Mochi learned in onboarding (and the buyer corrected). */
  profile: Profile;
  /** Set when the buyer finishes onboarding. */
  onboardedAt: string | null;
};

const KEY = "homelander:v1";

const initial: HomeLanderState = {
  liked: [],
  passed: [],
  history: [],
  anchorId: "bangsar-south",
  secondAnchorId: "kajang",
  scanned: false,
  answers: null,
  leads: [],
  budget: null,
  compare: [],
  profile: {},
  onboardedAt: null,
};

let state: HomeLanderState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as Partial<HomeLanderState>) };
  } catch {
    state = initial;
  }
}

function set(next: Partial<HomeLanderState>) {
  state = { ...state, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage blocked: keep working in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

export function useHomeLander() {
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}

export const homelander = {
  /** Current state outside React (event handlers that must read the latest values). */
  snapshot() {
    load();
    return state;
  },
  like(id: string) {
    set({
      liked: [...state.liked.filter((x) => x !== id), id],
      passed: state.passed.filter((p) => p.id !== id),
      history: [...state.history.filter((x) => x !== id), id],
    });
  },
  pass(id: string) {
    set({
      passed: [...state.passed.filter((p) => p.id !== id), { id }],
      liked: state.liked.filter((x) => x !== id),
      history: [...state.history.filter((x) => x !== id), id],
    });
  },
  reason(id: string, reason: PassReason) {
    set({ passed: state.passed.map((p) => (p.id === id ? { ...p, reason } : p)) });
  },
  undo() {
    const id = state.history.at(-1);
    if (!id) return;
    set({
      history: state.history.slice(0, -1),
      liked: state.liked.filter((x) => x !== id),
      passed: state.passed.filter((p) => p.id !== id),
    });
  },
  /** Presenter shortcut: jump straight to a ready-made shortlist. */
  demoShortlist(ids: string[]) {
    set({ liked: ids, passed: [], history: ids });
  },
  unlike(id: string) {
    set({ liked: state.liked.filter((x) => x !== id) });
  },
  anchors(anchorId: string, secondAnchorId: string) {
    set({ anchorId, secondAnchorId });
  },
  scan() {
    set({ scanned: true });
  },
  answer(answers: Answers) {
    set({ answers });
  },
  addLead(lead: Lead) {
    set({ leads: [lead, ...state.leads.filter((l) => l.id !== lead.id)] });
  },
  setBudget(budget: Budget | null) {
    set({ budget, scanned: budget !== null });
  },
  patchProfile(patch: Partial<Profile>) {
    set({ profile: mergeProfile(state.profile, patch) });
  },
  setProfileField<K extends keyof Profile>(key: K, value: Profile[K] | undefined) {
    const next = { ...state.profile };
    if (value === undefined) delete next[key];
    else next[key] = value;
    set({ profile: next });
  },
  finishOnboarding(at: string) {
    set({ onboardedAt: at });
  },
  setCompare(ids: string[]) {
    set({ compare: ids.slice(0, 5) });
  },
  reset() {
    set({ ...initial });
  },
};
