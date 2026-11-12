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

/** Pick a voice for the reply's language; English replies prefer a Malaysian voice for the BM words. */
function pickVoice(lang: VoiceLang) {
  const voices = window.speechSynthesis.getVoices();
  const by = (prefix: string) => voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
  if (lang === "zh") return by("zh-cn") ?? by("zh");
  if (lang === "ta") return by("ta-my") ?? by("ta");
  if (lang === "ms") return by("ms-my") ?? by("ms") ?? by("id");
  return by("en-my") ?? by("en-gb") ?? by("en");
}

export function speak(text: string, on: { start?: () => void; end?: () => void } = {}, lang: VoiceLang = "en") {
  if (!canSpeak()) {
    on.end?.();
    return;
  }
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
  u.pitch = 0.85;
  u.onstart = () => on.start?.();
  u.onend = () => on.end?.();
  u.onerror = () => on.end?.();
  synth.speak(u);
}

export function hush() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
