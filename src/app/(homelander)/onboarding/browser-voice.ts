"use client";

/**
 * Mochi's voice on /onboarding. Speaking: CAMB AI text-to-speech through /api/mochi/speak (a
 * Malaysian voice), falling back to the browser's own speechSynthesis when that route has no
 * CAMB_API_KEY (503) or fails. Listening fallback: SpeechRecognition (Chrome, Edge, Safari).
 */

type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

export type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResult) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export type VoiceLang = "en" | "ms" | "zh" | "ta";

/** Speech-recognition locale for each language the buyer can talk in. */
export const listenLocale: Record<VoiceLang, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-CN", ta: "ta-IN" };

/**
 * Locales to try per reply language for the browser fallback voice, best first. English prefers
 * Malaysian, Singapore and Indian English voices; Mandarin prefers a mainland voice.
 */
const voiceLocales: Record<VoiceLang, string[]> = {
  en: ["en-my", "en-sg", "en-in", "en-hk", "en-ph", "en-gb", "en"],
  ms: ["ms-my", "ms", "id"],
  zh: ["zh-cn", "zh-sg", "zh-tw", "zh-hk", "zh"],
  ta: ["ta-my", "ta-sg", "ta-in", "ta"],
};

/** Prefers the natural/neural system voices (Edge "Natural", Safari "Enhanced"/"Premium"). */
function pickVoice(lang: VoiceLang) {
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  for (const prefix of voiceLocales[lang]) {
    const match = voices.filter((v) => norm(v).startsWith(prefix));
    if (!match.length) continue;
    return match.find((v) => /natural|online|enhanced|premium/i.test(v.name)) ?? match[0];
  }
  return undefined;
}

type Handlers = { start?: () => void; end?: () => void };

/** Bumped by every new speak() and hush(), so a cancelled request never starts playing late. */
let generation = 0;
/** The CAMB clip playing now, if any. */
let current: { audio: HTMLAudioElement; url: string } | null = null;
/** Set once /api/mochi/speak says CAMB isn't configured (503), so later lines skip the round trip. */
let cambOff = false;

function stopClip() {
  if (!current) return;
  current.audio.pause();
  current.audio.removeAttribute("src");
  URL.revokeObjectURL(current.url);
  current = null;
}

/** The browser's own voice: a calm, friendly delivery. */
function speakBrowser(text: string, on: Handlers, lang: VoiceLang, run: number) {
  if (!canSpeak()) return on.end?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = { en: "en-GB", ms: "ms-MY", zh: "zh-CN", ta: "ta-IN" }[lang];
  }
  u.rate = 1;
  u.pitch = 1.1;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    on.end?.();
  };
  u.onstart = () => {
    if (run === generation) on.start?.();
  };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
}

/**
 * Says a line. Tries CAMB AI first and plays the returned audio; `start`/`end` fire on the clip's
 * play and ended events, which drive Mochi's "speaking" face. Any failure falls back to the browser voice.
 */
export function speak(text: string, on: Handlers = {}, lang: VoiceLang = "en") {
  hush();
  const run = generation;
  if (cambOff || typeof Audio === "undefined") return speakBrowser(text, on, lang, run);

  void (async () => {
    try {
      const res = await fetch("/api/mochi/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (res.status === 503) cambOff = true;
      if (!res.ok) throw new Error(`speak ${res.status}`);
      const blob = await res.blob();
      if (run !== generation) return on.end?.();

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      current = { audio, url };
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        if (current?.audio === audio) stopClip();
        on.end?.();
      };
      audio.onplaying = () => {
        if (run === generation) on.start?.();
      };
      audio.onended = finish;
      audio.onpause = () => {
        // hush() pauses the clip: treat it as the end of the line.
        if (!audio.ended) finish();
      };
      audio.onerror = finish;
      await audio.play();
    } catch {
      if (run !== generation) return on.end?.();
      stopClip();
      speakBrowser(text, on, lang, run);
    }
  })();
}

export function hush() {
  generation++;
  stopClip();
  if (canSpeak()) window.speechSynthesis.cancel();
}
