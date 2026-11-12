"use client";

/**
 * Demo voice for Uncle when the live Agora agent isn't configured: the browser's own
 * speechSynthesis to talk and SpeechRecognition (Chrome, Edge, Safari) to listen.
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
 * Voices that sound like an older uncle: male system voices on macOS/iOS, Windows/Edge (Natural)
 * and Chrome. Matched on the voice name, so it's only a preference; any voice of the right
 * language still works.
 */
const UNCLE_VOICES = /\b(wayne|prabhat|rishi|ravi|hemant|osman|surya|valluvar|yunxi|yunjian|yunyang|yunye|kangkang|li-mu|daniel|aaron|arthur|fred|male)\b/i;

/**
 * Locales to try per reply language, best first. English prefers Malaysian, Singapore and Indian
 * English voices; Mandarin prefers a mainland voice and falls back to Taiwan or any zh voice.
 */
const voiceLocales: Record<VoiceLang, string[]> = {
  en: ["en-my", "en-sg", "en-in", "en-hk", "en-ph", "en-gb", "en"],
  ms: ["ms-my", "ms", "id"],
  zh: ["zh-cn", "zh-sg", "zh-tw", "zh-hk", "zh"],
  ta: ["ta-my", "ta-sg", "ta-in", "ta"],
};

function pickVoice(lang: VoiceLang) {
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  for (const prefix of voiceLocales[lang]) {
    const match = voices.filter((v) => norm(v).startsWith(prefix));
    if (!match.length) continue;
    return (
      match.find((v) => UNCLE_VOICES.test(v.name) && /natural|online|enhanced|premium/i.test(v.name)) ??
      match.find((v) => UNCLE_VOICES.test(v.name)) ??
      match.find((v) => /natural|online|enhanced|premium/i.test(v.name)) ??
      match[0]
    );
  }
  return undefined;
}

/**
 * Interjections Uncle performs on their own, with a beat after: "Haiyaa…", "Aiyo", "Walao",
 * "Wah", "Fuyoh", "Alamak", 哎呀, ஐயோ. They're split off so the voice can milk them.
 */
const INTERJECTION =
  /(^|[\s,.!?…])((?:hai+y+a+h?|aiy+o+h?|aiya+h?|walao+(?: eh)?|wah+|fuyo+h?|alamak|aduh+|adoi+)(?=[\s,.!?…]|$)[,.!?…]*|哎呀[，。！…]*|哎哟[，。！…]*|哇[，。！…]*|ஐயோ[,.!…]*|அய்யோ[,.!…]*)/i;

type Chunk = { text: string; drama: boolean; pauseMs: number };

/** Splits a reply into spoken chunks: interjections get their own delivery and a pause after. */
export function toChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let rest = text.trim();
  while (rest) {
    const m = INTERJECTION.exec(rest);
    if (!m) {
      chunks.push(...trailing(rest));
      break;
    }
    const at = m.index + m[1].length;
    const before = rest.slice(0, at).trim();
    if (before) chunks.push(...trailing(before));
    chunks.push({ text: m[2].replace(/[,，]$/, ""), drama: true, pauseMs: 320 });
    rest = rest.slice(at + m[2].length).trim();
  }
  return chunks;
}

/** Plain text, split again at "…" so a trailing-off thought gets a short beat. */
function trailing(text: string): Chunk[] {
  return (text.match(/[^…]+…*|…+/g) ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ text: t, drama: false, pauseMs: t.endsWith("…") ? 220 : 0 }));
}

/** Bumped by every new speak() and hush(), so a cancelled sequence stops queueing chunks. */
let generation = 0;

export function speak(text: string, on: { start?: () => void; end?: () => void } = {}, lang: VoiceLang = "en") {
  if (!canSpeak()) {
    on.end?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const run = ++generation;
  const voice = pickVoice(lang);
  const chunks = toChunks(text);
  let started = false;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    on.end?.();
  };

  const say = (i: number) => {
    if (run !== generation) return finish();
    const c = chunks[i];
    if (!c) return finish();
    const u = new SpeechSynthesisUtterance(c.text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = { en: "en-GB", ms: "ms-MY", zh: "zh-CN", ta: "ta-IN" }[lang];
    }
    // A lively older uncle: a bit low and quick, and the interjections drawn out and up.
    u.rate = c.drama ? 0.82 : 1.08;
    u.pitch = c.drama ? 0.95 : 0.75;
    u.onstart = () => {
      if (started) return;
      started = true;
      on.start?.();
    };
    u.onend = () => {
      if (run !== generation) return finish();
      if (c.pauseMs && chunks[i + 1]) window.setTimeout(() => say(i + 1), c.pauseMs);
      else say(i + 1);
    };
    u.onerror = () => finish();
    synth.speak(u);
  };
  say(0);
}

export function hush() {
  generation++;
  if (canSpeak()) window.speechSynthesis.cancel();
}
