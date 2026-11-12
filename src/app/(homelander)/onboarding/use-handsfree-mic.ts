"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hands-free talking without Agora: tap once and the mic stays open. A small voice-activity detector
 * starts recording when the buyer speaks and sends the clip to /api/mochi/transcribe (Groq Whisper)
 * after a short silence. While `paused` (Mochi thinking or talking) nothing is recorded, so Mochi
 * never hears its own voice from the speakers.
 */

export type HandsFreeState = "off" | "waiting" | "hearing" | "transcribing";

/** Silence that ends a turn. */
const END_SILENCE_MS = 1000;
/** Voice this long starts a turn (ignores clicks and bumps). */
const ONSET_MS = 90;
const MIN_TURN_MS = 450;
const MAX_TURN_MS = 30_000;
/** Whisper invents these on breath and room noise. */
const NOISE =
  /^(thank you|thanks|thanks for watching|you|bye|okay|ok|hmm+|uh+|um+|\.+|terima kasih)[.!? ]*$/i;

function pickMime() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useHandsFreeMic({
  paused,
  onText,
  onUnavailable,
  onError,
}: {
  paused: boolean;
  onText: (text: string) => void;
  onUnavailable: () => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<HandsFreeState>("off");
  const [level, setLevel] = useState(0);
  const r = useRef({
    stream: null as MediaStream | null,
    ctx: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    raf: 0,
    rec: null as MediaRecorder | null,
    chunks: [] as Blob[],
    keep: true,
    recStart: 0,
    lastVoice: 0,
    voiceSince: 0,
    floor: 0.01,
    paused,
    busy: false,
    on: false,
    shown: 0,
  });
  const cb = useRef({ onText, onUnavailable, onError });
  useEffect(() => {
    cb.current = { onText, onUnavailable, onError };
  }, [onText, onUnavailable, onError]);

  // Pausing drops whatever was being recorded: it would be Mochi's own voice.
  useEffect(() => {
    r.current.paused = paused;
    if (paused) stopRec(false);
  }, [paused]);

  useEffect(() => () => stop(), []);

  async function transcribe(blob: Blob) {
    const x = r.current;
    x.busy = true;
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
      if (res.status === 503) {
        stop();
        return cb.current.onUnavailable();
      }
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok)
        return cb.current.onError(
          data.error ?? "Mochi couldn't hear that. Say it again?",
        );
      const text = data.text?.trim() ?? "";
      if (text.length > 1 && !NOISE.test(text)) cb.current.onText(text);
    } catch {
      cb.current.onError("Mochi couldn't hear that. Check your connection.");
    } finally {
      x.busy = false;
      if (x.on) setState("waiting");
    }
  }

  function startRec() {
    const x = r.current;
    if (!x.stream) return;
    const mime = pickMime();
    const rec = new MediaRecorder(
      x.stream,
      mime ? { mimeType: mime } : undefined,
    );
    x.chunks = [];
    x.keep = true;
    rec.ondataavailable = (e) => e.data.size && x.chunks.push(e.data);
    rec.onstop = () => {
      const long = performance.now() - x.recStart >= MIN_TURN_MS;
      const blob = new Blob(x.chunks, {
        type: rec.mimeType || mime || "audio/webm",
      });
      if (x.keep && long && blob.size > 1_500 && x.on) void transcribe(blob);
      else if (x.on && !x.busy) setState("waiting");
    };
    x.rec = rec;
    x.recStart = x.lastVoice = performance.now();
    rec.start();
    setState("hearing");
  }

  function stopRec(keep: boolean) {
    const x = r.current;
    if (x.rec?.state === "recording") {
      x.keep = keep;
      x.rec.stop();
    }
    x.rec = null;
    x.voiceSince = 0;
  }

  function tick() {
    const x = r.current;
    if (!x.on || !x.analyser) return;
    const buf = new Float32Array(x.analyser.fftSize);
    x.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    const threshold = Math.max(0.018, x.floor * 3);
    const loud = rms > threshold;
    if (!x.rec) x.floor = x.floor * 0.97 + Math.min(rms, 0.05) * 0.03; // learn the room's noise
    const lv = Math.min(1, rms / 0.12);
    if (Math.abs(lv - x.shown) > 0.08) setLevel((x.shown = lv)); // re-render only on visible change

    if (!x.paused && !x.busy) {
      if (!x.rec) {
        if (loud) {
          x.voiceSince ||= now;
          if (now - x.voiceSince >= ONSET_MS) startRec();
        } else x.voiceSince = 0;
      } else {
        if (loud) x.lastVoice = now;
        if (
          now - x.lastVoice > END_SILENCE_MS ||
          now - x.recStart > MAX_TURN_MS
        )
          stopRec(true);
      }
    }
    x.raf = requestAnimationFrame(tick);
  }

  async function start() {
    const x = r.current;
    if (x.on) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    )
      return cb.current.onUnavailable();
    try {
      x.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      return cb.current.onError(
        "Mic is blocked. Allow it in the browser, or type to Mochi.",
      );
    }
    x.ctx = new AudioContext();
    x.analyser = x.ctx.createAnalyser();
    x.analyser.fftSize = 1024;
    x.ctx.createMediaStreamSource(x.stream).connect(x.analyser);
    x.on = true;
    x.floor = 0.01;
    setState("waiting");
    x.raf = requestAnimationFrame(tick);
  }

  function stop() {
    const x = r.current;
    x.on = false;
    cancelAnimationFrame(x.raf);
    stopRec(false);
    x.stream?.getTracks().forEach((t) => t.stop());
    void x.ctx?.close().catch(() => {});
    x.stream = null;
    x.ctx = null;
    x.analyser = null;
    setState("off");
    setLevel(0);
  }

  return { state, level, start, stop, on: state !== "off" };
}
