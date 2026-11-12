"use client";

import { useSyncExternalStore } from "react";
import type { Citizenship, Employment, JobTenure } from "@/lib/homelander/bank";

/**
 * Answers only the bank page asks for (Uncle doesn't collect them): employment type, time in
 * the job, citizenship, loan tenure and the home to check. Kept in this browser only.
 */

export type Target = { kind: "home"; id: string } | { kind: "price"; priceRM: number };

export type BankPrefs = {
  employment?: Employment;
  jobTenure?: JobTenure;
  citizenship?: Citizenship;
  /** Undefined: the longest tenure the buyer's age allows. */
  tenureYears?: number;
  target?: Target;
};

const KEY = "homelander:bank:v1";
const empty: BankPrefs = {};
let prefs: BankPrefs = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) prefs = JSON.parse(raw) as BankPrefs;
  } catch {
    prefs = empty;
  }
}

export function setPrefs(patch: Partial<BankPrefs>) {
  load();
  prefs = { ...prefs, ...patch };
  for (const k of Object.keys(prefs) as (keyof BankPrefs)[]) if (prefs[k] === undefined) delete prefs[k];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: keep the answers for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBankPrefs() {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return prefs;
    },
    () => empty,
  );
}
