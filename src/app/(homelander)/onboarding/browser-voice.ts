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

/** A Malaysian voice reads the BM words best; fall back to any English voice. */
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const by = (prefix: string) => voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
  return by("ms-my") ?? by("ms") ?? by("en-gb") ?? by("en");
}

export function speak(text: string, on: { start?: () => void; end?: () => void } = {}) {
  if (!canSpeak()) {
    on.end?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "en-GB";
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
