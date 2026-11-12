"use client";

import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SPEECH_LANGS,
  canListen,
  makeRecognition,
  stopSpeaking,
  type Recognition,
  type SpeechLang,
} from "./voice";

/** What each SpeechRecognition error code means for the buyer. */
const MIC_ERRORS: Record<string, string> = {
  "no-speech":
    "Didn't hear anything. Tap the mic, then start speaking straight away.",
  "audio-capture":
    "No microphone found, or another app (Zoom, Meet) is using it.",
  "not-allowed":
    "Microphone is blocked. Allow it from the icon in the address bar, then try again.",
  "service-not-allowed":
    "This browser won't allow speech input here. In Safari, turn on Siri / Dictation; otherwise try Chrome.",
  network:
    "The browser's speech service couldn't be reached. Chrome needs internet for this, and Brave, Arc, Opera and Chromium block it. Try Google Chrome or Edge.",
  "language-not-supported":
    "This browser can't listen in that language. Try Chrome, or type instead.",
};

/** Mic button: tap once, speak, and it stops on a pause; hands back the final transcript. */
export function MicButton({
  lang,
  disabled,
  onHeard,
}: {
  lang: SpeechLang;
  disabled?: boolean;
  onHeard: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    // Feature detection has to wait for the browser; the server always renders the button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(canListen());
    return () => rec.current?.abort();
  }, []);

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = makeRecognition();
    if (!r) {
      toast.error(
        "This browser can't listen. Try Chrome, Edge or Safari, or type instead.",
      );
      return;
    }
    stopSpeaking();
    r.lang = SPEECH_LANGS.find((l) => l.id === lang)!.bcp47;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onHeard(text);
    };
    r.onerror = (e) => {
      // Name the real cause: the browser's error code is the only clue we get.
      console.warn("[feng-shui mic]", e.error);
      const msg = MIC_ERRORS[e.error];
      if (e.error === "aborted") return;
      toast.error(
        msg ?? `Voice failed (${e.error}). Try again, or type instead.`,
        { id: "fs-mic" },
      );
    };
    r.onend = () => {
      setListening(false);
      toast.dismiss("fs-mic-listening");
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
      toast("Listening… speak now. It stops when you pause.", {
        id: "fs-mic-listening",
        duration: 8000,
      });
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Speak a command"}
      title={supported ? undefined : "Voice needs Chrome, Edge or Safari"}
      className={cn(
        "grid size-10 shrink-0 place-items-center border-2 border-white disabled:opacity-50",
        listening
          ? "animate-pulse bg-raya text-white"
          : "bg-white text-ink hover:bg-cloud",
      )}
    >
      {supported ? (
        <Mic className="size-5" aria-hidden="true" />
      ) : (
        <MicOff className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}

/** Spoken language and the "read replies aloud" switch, shown above the command input. */
export function SpeechToolbar({
  lang,
  onLang,
  speakOn,
  onSpeakOn,
}: {
  lang: SpeechLang;
  onLang: (l: SpeechLang) => void;
  speakOn: boolean;
  onSpeakOn: (on: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <label className="flex items-center gap-2 text-white/80">
        Speak in
        <select
          value={lang}
          onChange={(e) => onLang(e.target.value as SpeechLang)}
          className="border-2 border-white bg-white px-2 py-1 text-sm text-ink"
        >
          {SPEECH_LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-pressed={speakOn}
        onClick={() => {
          if (speakOn) stopSpeaking();
          onSpeakOn(!speakOn);
        }}
        className={cn(
          "flex items-center gap-1.5 border-2 border-white/80 px-2 py-1 font-semibold",
          speakOn ? "bg-white text-ink" : "text-white hover:bg-white/10",
        )}
      >
        {speakOn ? (
          <Volume2 className="size-4" aria-hidden="true" />
        ) : (
          <VolumeX className="size-4" aria-hidden="true" />
        )}
        Read replies aloud
      </button>
    </div>
  );
}
