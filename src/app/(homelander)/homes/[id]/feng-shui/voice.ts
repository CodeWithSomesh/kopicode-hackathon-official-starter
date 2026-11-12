"use client";

/**
 * Browser speech for the command box: SpeechRecognition to listen (Chrome, Edge, Safari)
 * and speechSynthesis to answer. Both depend on what the browser and device support, so
 * every call degrades to "not available" rather than throwing.
 */

export type SpeechLang = "en" | "ms" | "zh" | "ta";

export const SPEECH_LANGS: { id: SpeechLang; label: string; bcp47: string }[] =
  [
    { id: "en", label: "English", bcp47: "en-US" },
    { id: "ms", label: "Bahasa Melayu", bcp47: "ms-MY" },
    { id: "zh", label: "中文", bcp47: "zh-CN" },
    { id: "ta", label: "தமிழ்", bcp47: "ta-IN" },
  ];

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
};

export type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
  stop: () => void;
};

export function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export const canListen = () =>
  typeof window !== "undefined" &&
  Boolean(
    (
      window as unknown as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      }
    ).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition,
  );

export const canSpeak = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

const VOICE_PREFIX: Record<SpeechLang, string[]> = {
  en: ["en-gb", "en-au", "en-us", "en"],
  ms: ["ms-my", "ms", "id-id"],
  zh: ["zh-cn", "cmn", "zh"],
  ta: ["ta-in", "ta-my", "ta-sg", "ta"],
};

function pickVoice(lang: SpeechLang) {
  const voices = window.speechSynthesis.getVoices();
  for (const prefix of VOICE_PREFIX[lang]) {
    const v = voices.find((x) =>
      x.lang.toLowerCase().replace("_", "-").startsWith(prefix),
    );
    if (v) return v;
  }
  return undefined;
}

/** True if this device has a voice for the language (voices load async; may be false at first). */
export const hasVoice = (lang: SpeechLang) =>
  canSpeak() && Boolean(pickVoice(lang));

/** Speak `text` in `lang`. Returns false if there's no voice for it on this device. */
export function speak(text: string, lang: SpeechLang): boolean {
  if (!canSpeak() || !text.trim()) return false;
  const voice = pickVoice(lang);
  if (!voice) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * Fallback when the speech-to-text route is unavailable: the browser's own recogniser.
 * It needs Google's speech service (Chrome, Edge) and listens in one language at a time.
 */
export function listenOnce(bcp47: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = makeRecognition();
    if (!r) return reject(new Error("unsupported"));
    r.lang = bcp47;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    let text = "";
    r.onresult = (e) => {
      text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
    };
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => (text ? resolve(text) : reject(new Error("no-speech")));
    r.start();
  });
}

/** Map a transcriber's language name or code to the languages the page replies in. */
export function toSpeechLang(
  language: string | null | undefined,
): SpeechLang | undefined {
  const l = (language ?? "").toLowerCase();
  if (!l) return undefined;
  if (l.startsWith("zh") || l.includes("chinese") || l.includes("mandarin"))
    return "zh";
  if (l.startsWith("ta") || l.includes("tamil")) return "ta";
  if (
    l.startsWith("ms") ||
    l.includes("malay") ||
    l.startsWith("id") ||
    l.includes("indonesian")
  )
    return "ms";
  if (l.startsWith("en")) return "en";
  return undefined;
}
