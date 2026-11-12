"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  agoraStatus,
  joinLiveCall,
  MicDeniedError,
  startAgoraSession,
  stopAgoraAgent,
  updateAgoraAgent,
  type LiveCall,
  type LiveTranscript,
} from "@/lib/homelander/agora-client";
import { filledKeys, type Profile } from "@/lib/homelander/profile";
import { homelander } from "@/lib/homelander/store";

/**
 * A live, hands-free voice call with Mochi on Agora's Conversational AI Engine. The engine does the
 * listening, thinking, speaking and barge-in; this hook joins the call, tracks who's talking, keeps
 * the live transcript, and turns the buyer's answers into profile fields through /api/mochi/extract
 * (serialised and throttled, so Groq's free tier of 8k tokens a minute per model isn't hammered).
 */

export type CallStatus =
  "checking" | "unavailable" | "ready" | "connecting" | "live" | "ending";

export type CallLine = {
  id: number;
  who: "agent" | "you";
  text: string;
  final: boolean;
  interrupted?: boolean;
  turn: number;
};

/** Wait this long after the buyer's last finished sentence before taking notes. */
const EXTRACT_DEBOUNCE_MS = 1_200;
/** At most one note-taking call every this often. */
const EXTRACT_MIN_GAP_MS = 4_000;
/** Lines sent to the note-taker; the profile carries everything older. */
const EXTRACT_LINES = 6;

export function useAgoraCall({
  onPatch,
}: {
  onPatch: (patch: Partial<Profile>) => void;
}) {
  const [status, setStatus] = useState<CallStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentHere, setAgentHere] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const call = useRef<LiveCall | null>(null);
  const agentId = useRef<string | null>(null);
  const linesRef = useRef<CallLine[]>([]);
  const nextId = useRef(1);
  const onPatchRef = useRef(onPatch);
  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);

  // Is Agora set up on the server?
  useEffect(() => {
    let alive = true;
    void agoraStatus().then((ok) => {
      if (alive) setStatus(ok ? "ready" : "unavailable");
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ------------------------------------------------------------ note-taking (profile extract) */

  const extract = useRef({
    timer: 0,
    inFlight: false,
    again: false,
    lastStart: 0,
    doneUpTo: 0,
  });
  /** Lets runExtract re-queue itself. */
  const rerun = useRef(() => {});

  const runExtract = useCallback(async () => {
    const x = extract.current;
    if (x.inFlight) {
      x.again = true;
      return;
    }
    const wait = x.lastStart + EXTRACT_MIN_GAP_MS - Date.now();
    if (wait > 0) {
      window.clearTimeout(x.timer);
      x.timer = window.setTimeout(() => rerun.current(), wait);
      return;
    }
    const finals = linesRef.current.filter((l) => l.final && l.text);
    const lastUser = finals.findLast((l) => l.who === "you");
    if (!lastUser || lastUser.id <= x.doneUpTo) return;

    x.inFlight = true;
    x.again = false;
    x.lastStart = Date.now();
    x.doneUpTo = lastUser.id;
    try {
      const messages = finals.slice(-EXTRACT_LINES).map((l) => ({
        role: l.who === "you" ? ("user" as const) : ("assistant" as const),
        content: l.text.slice(0, 2_000),
      }));
      const res = await fetch("/api/mochi/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          profile: homelander.snapshot().profile,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        patch?: Partial<Profile>;
      };
      const patch = data.patch ?? {};
      if (filledKeys(patch).length) {
        onPatchRef.current(patch);
        // Tell Mochi what the form now knows, so it doesn't ask again.
        if (agentId.current)
          void updateAgoraAgent(agentId.current, homelander.snapshot().profile);
      }
    } catch {
      // Missing one note is fine: the next answer carries the context again.
    } finally {
      x.inFlight = false;
      if (x.again) rerun.current();
    }
  }, []);
  useEffect(() => {
    rerun.current = () => void runExtract();
  }, [runExtract]);

  const scheduleExtract = useCallback(() => {
    const x = extract.current;
    window.clearTimeout(x.timer);
    x.timer = window.setTimeout(() => void runExtract(), EXTRACT_DEBOUNCE_MS);
  }, [runExtract]);

  /* ------------------------------------------------------------ transcript */

  const onTranscript = useCallback(
    (t: LiveTranscript) => {
      const list = [...linesRef.current];
      // The buyer: keep updating the open sentence until it's final. Mochi: one line per turn.
      const i =
        t.who === "you"
          ? list.findLastIndex((l) => l.who === "you" && !l.final)
          : list.findLastIndex((l) => l.who === "agent" && l.turn === t.turn);
      if (
        i >= 0 &&
        !(t.who === "agent" && list[i]!.final && list[i]!.interrupted)
      ) {
        list[i] = {
          ...list[i]!,
          text: t.text,
          final: t.final,
          interrupted: t.interrupted,
          turn: t.turn,
        };
      } else if (i < 0) {
        list.push({ id: nextId.current++, ...t });
      }
      linesRef.current = list.slice(-80);
      setLines(linesRef.current);
      if (t.who === "you" && t.final) scheduleExtract();
    },
    [scheduleExtract],
  );

  const onInterrupt = useCallback((turn: number) => {
    linesRef.current = linesRef.current.map((l) =>
      l.who === "agent" && l.turn === turn
        ? { ...l, final: true, interrupted: true }
        : l,
    );
    setLines(linesRef.current);
  }, []);

  /* ------------------------------------------------------------ call lifecycle */

  const teardown = useCallback(async () => {
    const c = call.current;
    const id = agentId.current;
    call.current = null;
    agentId.current = null;
    window.clearTimeout(extract.current.timer);
    if (id) void stopAgoraAgent(id);
    await c?.leave();
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setAgentHere(false);
    setMuted(false);
  }, []);

  const start = useCallback(async () => {
    if (call.current || status === "connecting") return;
    setError(null);
    setStatus("connecting");
    setSeconds(0);
    linesRef.current = [];
    setLines([]);
    extract.current = {
      timer: 0,
      inFlight: false,
      again: false,
      lastStart: 0,
      doneUpTo: 0,
    };
    try {
      const session = await startAgoraSession(homelander.snapshot().profile);
      agentId.current = session.agentId;
      call.current = await joinLiveCall(session, {
        onAgentSpeaking: setAgentSpeaking,
        onUserSpeaking: setUserSpeaking,
        onAgentPresent: setAgentHere,
        onTranscript,
        onInterrupt,
        onDisconnected: () => {
          setError("The call dropped. Tap Call Mochi to reconnect.");
          void teardown().then(() => setStatus("ready"));
        },
      });
      setStatus("live");
    } catch (e) {
      await teardown();
      setStatus("ready");
      setError(
        e instanceof MicDeniedError
          ? "Mochi can't hear you: the microphone is blocked. Allow the mic for this site (the icon in the address bar), then call again. You can also type below."
          : e instanceof Error
            ? e.message
            : "Couldn't start the call with Mochi.",
      );
    }
  }, [status, onTranscript, onInterrupt, teardown]);

  const hangUp = useCallback(async () => {
    if (!call.current && !agentId.current) return;
    setStatus("ending");
    // Take notes on the last answer before leaving.
    window.clearTimeout(extract.current.timer);
    extract.current.lastStart = 0;
    void runExtract();
    await teardown();
    setStatus("ready");
  }, [runExtract, teardown]);

  const toggleMute = useCallback(async () => {
    if (!call.current) return;
    const next = !muted;
    await call.current.setMicMuted(next);
    setMuted(next);
  }, [muted]);

  // Call timer.
  useEffect(() => {
    if (status !== "live") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1_000);
    return () => window.clearInterval(t);
  }, [status]);

  // Leaving the page ends the call: pagehide covers tab close and bfcache, unmount covers navigation.
  useEffect(() => {
    const bye = () => {
      if (agentId.current) void stopAgoraAgent(agentId.current);
      void call.current?.leave();
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      void teardown();
    };
  }, [teardown]);

  const last = lines.at(-1);
  /** Mochi is working out a reply: the buyer just finished and Mochi hasn't started talking. */
  const thinking =
    status === "live" && !agentSpeaking && last?.who === "you" && last.final;

  return {
    status,
    error,
    clearError: () => setError(null),
    lines,
    agentSpeaking,
    userSpeaking,
    agentHere,
    thinking,
    muted,
    seconds,
    start,
    hangUp,
    toggleMute,
  };
}
