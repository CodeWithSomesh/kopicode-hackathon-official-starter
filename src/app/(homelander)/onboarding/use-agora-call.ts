"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  agoraStatus,
  joinLiveCall,
  MicDeniedError,
  sayGoodbye,
  startAgoraSession,
  stopAgoraAgent,
  updateAgoraAgent,
  type LiveCall,
  type LiveTranscript,
} from "@/lib/homelander/agora-client";
import { filledKeys, missingEssentials, type Profile } from "@/lib/homelander/profile";
import { homelander } from "@/lib/homelander/store";
import type { MochiLang } from "@/lib/homelander/mochi-brain";

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

/** After the form is complete: how long Mochi gets to say goodbye before the call ends anyway. */
const WRAP_UP_MAX_MS = 15_000;

export function useAgoraCall({
  onPatch,
  onComplete,
}: {
  onPatch: (patch: Partial<Profile>) => void;
  /** Every essential is filled and Mochi has said goodbye: the call is over, move on. */
  onComplete: () => void;
}) {
  const [status, setStatus] = useState<CallStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentHere, setAgentHere] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  /** The recogniser hears mixed languages; otherwise the buyer picks one before calling. */
  const [mixedLanguages, setMixedLanguages] = useState(false);

  const call = useRef<LiveCall | null>(null);
  const agentId = useRef<string | null>(null);
  const linesRef = useRef<CallLine[]>([]);
  const nextId = useRef(1);
  const onPatchRef = useRef(onPatch);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onPatchRef.current = onPatch;
    onCompleteRef.current = onComplete;
  }, [onPatch, onComplete]);
  /** Language picked for this call (undefined on a mixed-language call), so updates keep it. */
  const callLang = useRef<MochiLang | undefined>(undefined);
  /** off → waiting (form complete, Mochi about to say goodbye) → speaking → done. */
  const wrap = useRef<{ stage: "off" | "waiting" | "speaking" | "done"; timer: number; at: number }>({ stage: "off", timer: 0, at: 0 });
  const finishCall = useRef(() => {});

  // Is Agora set up on the server?
  useEffect(() => {
    let alive = true;
    void agoraStatus().then((s) => {
      if (!alive) return;
      setMixedLanguages(s.mixedLanguages);
      setStatus(s.configured ? "ready" : "unavailable");
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
        const profile = homelander.snapshot().profile;
        // Tell Mochi what the form now knows, so it doesn't ask again (and, once nothing is missing, to say goodbye).
        if (agentId.current) void updateAgoraAgent(agentId.current, profile, callLang.current);
        if (!missingEssentials(profile).length && wrap.current.stage === "off") {
          wrap.current = { stage: "waiting", at: Date.now(), timer: window.setTimeout(() => finishCall.current(), WRAP_UP_MAX_MS) };
          // Cut off any next question and say goodbye in the buyer's language.
          if (agentId.current) void sayGoodbye(agentId.current, lastUser.text);
        }
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

  const start = useCallback(async (lang: MochiLang = "en") => {
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
      callLang.current = mixedLanguages ? undefined : lang;
      window.clearTimeout(wrap.current.timer);
      wrap.current = { stage: "off", timer: 0, at: 0 };
      const session = await startAgoraSession(homelander.snapshot().profile, lang);
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
  }, [status, mixedLanguages, onTranscript, onInterrupt, teardown]);

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

  // Form complete: let Mochi finish its goodbye line, then end the call and hand over.
  useEffect(() => {
    finishCall.current = () => {
      if (wrap.current.stage === "done") return;
      wrap.current.stage = "done";
      window.clearTimeout(wrap.current.timer);
      void hangUp().then(() => onCompleteRef.current());
    };
  }, [hangUp]);
  useEffect(() => {
    const w = wrap.current;
    if (agentSpeaking && w.stage === "waiting") w.stage = "speaking";
    else if (!agentSpeaking && w.stage === "speaking") {
      // A line that stops within 2.5 s of the goodbye request is the one it cut off: keep waiting.
      if (Date.now() - w.at < 2_500) {
        w.stage = "waiting";
        return;
      }
      // A short pause so the last word isn't cut off.
      window.clearTimeout(w.timer);
      w.timer = window.setTimeout(() => finishCall.current(), 1_200);
    }
  }, [agentSpeaking]);

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
    mixedLanguages,
    start,
    hangUp,
    toggleMute,
  };
}
