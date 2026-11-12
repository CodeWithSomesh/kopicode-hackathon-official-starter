"use client";

import { Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecorderError, canRecord, recordUtterance } from "./recorder";
import {
  canListen,
  listenOnce,
  stopSpeaking,
  toSpeechLang,
  type SpeechLang,
} from "./voice";

const RECORDER_ERRORS: Record<RecorderError["code"], string> = {
  "no-speech": "Didn't hear anything. Tap the mic, then start speaking.",
  "no-mic": "No microphone found, or another app (Zoom, Meet) is using it.",
  blocked:
    "Microphone is blocked. Allow it from the icon in the address bar, then try again.",
  unsupported:
    "This browser can't record audio. Try Chrome, Edge or Safari, or type instead.",
};

const BROWSER_ERRORS: Record<string, string> = {
  "no-speech": "Didn't hear anything. Tap the mic, then start speaking.",
  "audio-capture":
    "No microphone found, or another app (Zoom, Meet) is using it.",
  "not-allowed":
    "Microphone is blocked. Allow it from the icon in the address bar, then try again.",
  "service-not-allowed":
    "This browser won't allow speech input here. Try Chrome, or type instead.",
  network:
    "The browser's speech service couldn't be reached (blocked network, or Brave / Arc / Opera). Type instead.",
};

type State = "idle" | "listening" | "thinking";

/**
 * Tap once and speak in any language, or several in one sentence. It stops on a pause (or
 * tap again to stop), sends the audio to /api/feng-shui/transcribe, and hands back the
 * transcript with the language the model detected.
 */
export function MicButton({
  disabled,
  onHeard,
}: {
  disabled?: boolean;
  onHeard: (text: string, lang?: SpeechLang) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [supported, setSupported] = useState(true);
  const stop = useRef<AbortController | null>(null);
  /** After the speech-to-text route fails once, use the browser's recogniser directly. */
  const sttDown = useRef(false);

  useEffect(() => {
    // Feature detection has to wait for the browser; the server always renders the button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(canRecord() || canListen());
    return () => stop.current?.abort();
  }, []);

  const viaBrowser = async () => {
    setState("listening");
    try {
      // Malaysian Malay copes with English loanwords better than English copes with Malay.
      const text = await listenOnce("ms-MY");
      onHeard(text);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code !== "aborted")
        toast.error(
          BROWSER_ERRORS[code] ?? `Voice failed (${code}). Type instead.`,
          { id: "fs-mic" },
        );
    } finally {
      setState("idle");
    }
  };

  const start = async () => {
    stopSpeaking();
    if (sttDown.current || !canRecord()) return viaBrowser();

    const ctrl = new AbortController();
    stop.current = ctrl;
    setState("listening");
    let audio: Blob;
    try {
      audio = await recordUtterance({ onLevel: setLevel, signal: ctrl.signal });
    } catch (err) {
      setState("idle");
      setLevel(0);
      const code = err instanceof RecorderError ? err.code : "no-mic";
      toast.error(RECORDER_ERRORS[code], { id: "fs-mic" });
      return;
    }
    setLevel(0);
    setState("thinking");

    try {
      const body = new FormData();
      body.append("audio", audio, "speech");
      const res = await fetch("/api/feng-shui/transcribe", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        text: string;
        language: string | null;
      };
      if (!data.text) {
        toast.error(
          "Couldn't make out the words. Try again a bit closer to the mic.",
          { id: "fs-mic" },
        );
        return;
      }
      onHeard(data.text, toSpeechLang(data.language));
    } catch (err) {
      sttDown.current = true;
      const signin = err instanceof Error && err.message === "401";
      if (canListen()) {
        toast(
          signin
            ? "Log in for multilingual voice. Using the browser's speech for now: one language at a time, tap the mic again."
            : "Multilingual voice isn't reachable. Using the browser's speech instead: one language at a time, tap the mic again.",
          { id: "fs-mic", duration: 6000 },
        );
      } else {
        toast.error(
          signin
            ? "Log in to use voice, or type instead."
            : "Voice isn't reachable right now. Type instead.",
          {
            id: "fs-mic",
          },
        );
      }
    } finally {
      setState("idle");
    }
  };

  const onClick = () => {
    if (state === "listening") stop.current?.abort();
    else if (state === "idle") void start();
  };

  const label =
    state === "listening"
      ? "Stop and send"
      : state === "thinking"
        ? "Working out what you said"
        : "Speak a command";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !supported || state === "thinking"}
      aria-pressed={state === "listening"}
      aria-label={label}
      title={supported ? label : "Voice isn't available in this browser"}
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden border-2 border-white disabled:opacity-60",
        state === "listening"
          ? "bg-raya text-white"
          : "bg-white text-ink hover:bg-cloud",
      )}
    >
      {/* Live mic level, so it's obvious it can hear you. */}
      {state === "listening" ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-white/40 transition-[height] duration-75"
          style={{ height: `${Math.round(level * 100)}%` }}
        />
      ) : null}
      {!supported ? (
        <MicOff className="relative size-5" aria-hidden="true" />
      ) : state === "thinking" ? (
        <Loader2 className="relative size-5 animate-spin" aria-hidden="true" />
      ) : (
        <Mic className="relative size-5" aria-hidden="true" />
      )}
    </button>
  );
}

/** Hint line and the "read replies aloud" switch, shown above the command input. */
export function SpeechToolbar({
  speakOn,
  onSpeakOn,
}: {
  speakOn: boolean;
  onSpeakOn: (on: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <p className="text-white/80">
        Tap the mic to speak in English, BM, 中文 or தமிழ்.
      </p>
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
