"use client";

/**
 * Records one spoken request from the mic and stops by itself when the speaker pauses.
 * Uses MediaRecorder (Chrome, Edge, Safari, Firefox), so it doesn't depend on the browser's
 * own speech service. The audio goes to /api/feng-shui/transcribe for multilingual
 * speech-to-text.
 */

export class RecorderError extends Error {
  constructor(public code: "no-mic" | "blocked" | "no-speech" | "unsupported") {
    super(code);
  }
}

const TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export const canRecord = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

type Options = {
  /** Stop after this long without speech once someone has spoken. */
  silenceMs?: number;
  /** Give up if nobody speaks within this long. */
  waitMs?: number;
  /** Hard cap on one recording. */
  maxMs?: number;
  /** 0..1 mic level, for a live meter. */
  onLevel?: (level: number) => void;
  signal?: AbortSignal;
};

export async function recordUtterance({
  silenceMs = 1300,
  waitMs = 7000,
  maxMs = 15000,
  onLevel,
  signal,
}: Options = {}): Promise<Blob> {
  if (!canRecord()) throw new RecorderError("unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    throw new RecorderError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "blocked"
        : "no-mic",
    );
  }

  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Voice activity: watch the mic level; stop after a pause once speech has started.
  const audio = new AudioContext();
  // Some browsers start the context suspended; a suspended analyser reads pure silence.
  await audio.resume().catch(() => undefined);
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  return new Promise<Blob>((resolve, reject) => {
    const started = performance.now();
    let spokeAt = 0;
    let lastLoud = 0;
    let floor = 0.01;
    let raf = 0;
    let done = false;

    const finish = (error?: RecorderError) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      signal?.removeEventListener("abort", onAbort);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void audio.close();
        if (error) reject(error);
        else
          resolve(
            new Blob(chunks, {
              type: rec.mimeType || mimeType || "audio/webm",
            }),
          );
      };
      if (rec.state !== "inactive") rec.stop();
      else rec.onstop?.(new Event("stop"));
    };
    // Aborting means "stop now": send what was said so far, if anything was.
    const onAbort = () =>
      finish(spokeAt ? undefined : new RecorderError("no-speech"));
    signal?.addEventListener("abort", onAbort);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      // Learn the room's noise floor in the first moments, then treat clearly louder as speech.
      // Cap it: if the buyer starts talking straight away, the "floor" is their voice, and an
      // uncapped threshold would sit above it and never hear them.
      if (now - started < 300) floor = Math.min(0.012, Math.max(floor, rms));
      const loud = rms > Math.max(0.015, floor * 2.5);
      if (loud) {
        lastLoud = now;
        if (!spokeAt) spokeAt = now;
      }
      onLevel?.(Math.min(1, rms * 8));

      if (spokeAt && now - lastLoud > silenceMs) return finish();
      if (!spokeAt && now - started > waitMs)
        return finish(new RecorderError("no-speech"));
      if (now - started > maxMs) return finish();
      raf = requestAnimationFrame(tick);
    };

    rec.start(250);
    raf = requestAnimationFrame(tick);
  });
}
