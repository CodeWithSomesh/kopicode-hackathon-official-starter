"use client";

/**
 * Battle sound effects, synthesised with the Web Audio API (no audio files). A 16-bit-RPG
 * flavour: crisp metallic clashes, short whooshes, a soft thud and a little square-wave fanfare.
 * One AudioContext, created lazily on the first user gesture (browsers block audio before that).
 * Every call is a no-op when muted, on the server, or when Web Audio is missing; nothing throws.
 */

const MUTE_KEY = "homelander.battle.muted";
const MASTER = 0.3;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

/* ---------------------------------------------------------------- mute store */

let muted = false;
let loaded = false;
const listeners = new Set<() => void>();

function readMuted() {
  if (!loaded) {
    loaded = true;
    try {
      muted = window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export const sfxMuted = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => readMuted(),
  getServer: () => false,
};

export function setSfxMuted(next: boolean) {
  loaded = true;
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* storage blocked: keep it for this visit only */
  }
  if (next) void ctx?.suspend().catch(() => {});
  listeners.forEach((fn) => fn());
}

/* ---------------------------------------------------------------- context */

/** Call from a click/tap handler: creates or resumes the AudioContext. */
export function unlockSfx() {
  if (typeof window === "undefined" || readMuted()) return;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER;
      // A gentle limiter so stacked hits never clip.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
    master = null;
  }
}

function ready(): { ac: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined" || readMuted() || !ctx || !master)
    return null;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return { ac: ctx, out: master };
}

function noiseBuffer(ac: AudioContext) {
  if (noise) return noise;
  const len = Math.floor(ac.sampleRate * 0.6);
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

const safe = (fn: (ac: AudioContext, out: GainNode) => void) => () => {
  const r = ready();
  if (!r) return;
  try {
    fn(r.ac, r.out);
  } catch {
    /* never let a sound break the fight */
  }
};

/** A gain envelope: fast attack, exponential decay. */
function env(ac: AudioContext, t: number, peak: number, decay: number) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

function tone(
  ac: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  freq: number,
  t: number,
  peak: number,
  decay: number,
  glideTo?: number,
) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
  const g = env(ac, t, peak, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.02);
}

function burst(
  ac: AudioContext,
  out: AudioNode,
  t: number,
  filter: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  decay: number,
) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value = q;
  const g = env(ac, t, peak, decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.3);
  src.stop(t + decay + 0.02);
}

/* ---------------------------------------------------------------- the sounds */

/** Blade swing: a band-passed noise sweep, low to high and back. */
export const playSwing = safe((ac, out) => {
  const t = ac.currentTime;
  const dur = 0.22;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 2.2;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55);
  f.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
});

/** Sword clash: a bright noise click plus a few inharmonic, decaying metal partials. */
export const playClash = safe((ac, out) => {
  const t = ac.currentTime;
  const jitter = 1 + (Math.random() - 0.5) * 0.06;
  burst(ac, out, t, "bandpass", 3200, 1.4, 0.55, 0.06);
  burst(ac, out, t, "highpass", 5000, 0.7, 0.18, 0.12);
  const partials: [number, number, number][] = [
    [1520, 0.16, 0.42],
    [2390, 0.12, 0.34],
    [3170, 0.09, 0.26],
    [3940, 0.06, 0.2],
  ];
  for (const [f, peak, decay] of partials)
    tone(ac, out, "sine", f * jitter, t, peak, decay);
});

/** Round won: a soft, weighty thud with a short crunch on top. */
export const playHit = safe((ac, out) => {
  const t = ac.currentTime;
  tone(ac, out, "triangle", 150, t, 0.5, 0.18, 55);
  burst(ac, out, t, "lowpass", 900, 0.8, 0.3, 0.09);
});

/** K.O.: a short square-wave fanfare, with a little triangle bass under it. */
export const playVictory = safe((ac, out) => {
  const t0 = ac.currentTime + 0.05;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.connect(out);
  // An original rising arpeggio, then a held top C: G4 C5 E5 G5 · E5 G5 C6.
  const notes: [number, number, number][] = [
    [392.0, 0, 0.09],
    [523.25, 0.1, 0.09],
    [659.25, 0.2, 0.09],
    [783.99, 0.3, 0.2],
    [659.25, 0.54, 0.09],
    [783.99, 0.64, 0.09],
    [1046.5, 0.76, 0.6],
  ];
  for (const [f, at, len] of notes) {
    tone(ac, lp, "square", f, t0 + at, 0.13, len + 0.05);
    tone(ac, lp, "square", f * 1.5, t0 + at, 0.035, len);
  }
  const bass: [number, number, number][] = [
    [130.81, 0, 0.5],
    [98.0, 0.54, 0.2],
    [130.81, 0.76, 0.8],
  ];
  for (const [f, at, len] of bass)
    tone(ac, out, "triangle", f, t0 + at, 0.3, len);
});

/** "Ready? Fight!": a quick double ring of drawn blades. */
export const playReady = safe((ac, out) => {
  const t = ac.currentTime;
  for (const [at, f] of [
    [0, 2100],
    [0.11, 2800],
  ] as const) {
    burst(ac, out, t + at, "highpass", 4500, 0.7, 0.12, 0.2);
    tone(ac, out, "sine", f, t + at, 0.06, 0.35, f * 1.04);
  }
});
