"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tap to record, tap again to send: the clip goes to /api/mochi/transcribe (Groq Whisper), which
 * auto-detects English, Malay, Mandarin or Tamil, mixed mid-sentence included.
 * Calls onUnavailable when the server has no Groq key, so the page can fall back to browser listening.
 */

export type MicState = "idle" | "recording" | "transcribing";

const MAX_MS = 30_000;

function pickMime() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useWhisperMic({
  onText,
  onUnavailable,
  onError,
}: {
  onText: (text: string) => void;
  onUnavailable: () => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<MicState>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  function release() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [],
  );

  async function transcribe(blob: Blob) {
    setState("transcribing");
    try {
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const form = new FormData();
      form.append("audio", blob, `speech.${ext}`);
      const res = await fetch("/api/mochi/transcribe", {
        method: "POST",
        body: form,
      });
      if (res.status === 503) return onUnavailable();
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok)
        return onError(
          data.error ?? "Mochi couldn't hear that. Try again, or type.",
        );
      if (!data.text)
        return onError(
          "Mochi didn't catch anything. Try again a bit closer to the mic.",
        );
      onText(data.text);
    } catch {
      onError("Mochi couldn't hear that. Check your connection, or type.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    if (state !== "idle") return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    )
      return onUnavailable();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      return onError(
        "Mic is blocked. Allow it in the browser, or type to Mochi.",
      );
    }
    const mime = pickMime();
    const rec = new MediaRecorder(
      stream.current,
      mime ? { mimeType: mime } : undefined,
    );
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      release();
      const blob = new Blob(chunks, {
        type: rec.mimeType || mime || "audio/webm",
      });
      if (blob.size < 1_500) {
        setState("idle");
        onError("That was too short. Tap, speak, then tap again to send.");
        return;
      }
      void transcribe(blob);
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    timer.current = window.setTimeout(() => stop(), MAX_MS);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return { state, start, stop };
}
