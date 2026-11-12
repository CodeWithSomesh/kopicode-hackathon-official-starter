"use client";

import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, UID } from "agora-rtc-sdk-ng";
import type { Profile } from "./profile";

/**
 * Browser side of Mochi's live voice call. Loads agora-rtc-sdk-ng on demand (it touches `window`
 * at import time, so it must never be imported on the server), joins the channel the server made,
 * publishes the mic, plays Mochi's audio, reports both sides' voice levels and turns the agent's
 * data-stream messages into transcripts. Secrets never reach this file.
 *
 * SDK: https://api-ref.agora.io/en/voice-sdk/web/4.x/index.html (createClient, join, publish,
 *      user-published, stream-message, getVolumeLevel)
 * Transcripts: https://docs.agora.io/en/ai/build/transcripts — format as parsed by Agora's own toolkit
 *   (npm agora-agent-client-toolkit, RTC "stream-message" handler): each packet is
 *   "{message_id}|{part_idx}|{part_sum}|{base64 part}" (part_sum "???" = unknown yet) or plain JSON.
 *   Joined and decoded, the JSON has `object`:
 *   - "user.transcription":      { text, final, turn_id, stream_id, user_id, language, ... }
 *   - "assistant.transcription": { text, turn_id, turn_status (0 in progress, 1 end, 2 interrupted), ... }
 *   - "message.interrupt":       { turn_id, ... } (the buyer talked over Mochi)
 */

export type AgoraSession = {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  agentId: string;
  /** Mochi's uid in the channel. */
  agentUid: number;
};

export type LiveTranscript = {
  who: "agent" | "you";
  text: string;
  /** The buyer finished this sentence, or Mochi finished (or was cut off in) this turn. */
  final: boolean;
  interrupted?: boolean;
  turn: number;
};

export type LiveHandlers = {
  /** Mochi's audio level crossed the speaking threshold (or dropped below it). */
  onAgentSpeaking?: (speaking: boolean) => void;
  /** The buyer's own mic level crossed the speaking threshold (or dropped below it). */
  onUserSpeaking?: (speaking: boolean) => void;
  /** Mochi joined (true) or left (false) the channel. */
  onAgentPresent?: (present: boolean) => void;
  onTranscript?: (t: LiveTranscript) => void;
  /** The buyer interrupted Mochi's turn. */
  onInterrupt?: (turn: number) => void;
  /** The RTC connection dropped for good. */
  onDisconnected?: () => void;
};

export class MicDeniedError extends Error {}

/** Whether the live call is set up, and whether it hears mixed languages or one picked per call. */
export async function agoraStatus(): Promise<{ configured: boolean; mixedLanguages: boolean }> {
  try {
    const res = await fetch("/api/agora/status", { cache: "no-store" });
    if (!res.ok) return { configured: false, mixedLanguages: false };
    const data = (await res.json()) as { configured?: boolean; mixedLanguages?: boolean };
    return { configured: Boolean(data.configured), mixedLanguages: Boolean(data.mixedLanguages) };
  } catch {
    return { configured: false, mixedLanguages: false };
  }
}

export async function startAgoraSession(profile: Profile, lang: "en" | "ms" | "zh" | "ta"): Promise<AgoraSession> {
  const res = await fetch("/api/agora/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, lang }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Couldn't start the call with Mochi.");
  }
  return (await res.json()) as AgoraSession;
}

export function stopAgoraAgent(agentId: string) {
  // keepalive so it still goes out when the page is closing.
  return fetch("/api/agora/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
    keepalive: true,
  }).catch(() => undefined);
}

export function updateAgoraAgent(agentId: string, profile: Profile) {
  return fetch("/api/agora/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, profile }),
  }).catch(() => undefined);
}

export type LiveCall = {
  setMicMuted: (muted: boolean) => Promise<void>;
  leave: () => Promise<void>;
};

const isPermissionError = (e: unknown) => {
  const code = String((e as { code?: string }).code ?? "");
  const name = String((e as { name?: string }).name ?? "");
  return /PERMISSION_DENIED|NotAllowed|SecurityError/i.test(`${code} ${name}`) || /permission|denied/i.test(String(e));
};

/** Joins the RTC channel, publishes the mic and wires Mochi's audio, levels and transcripts. */
export async function joinLiveCall(session: AgoraSession, handlers: LiveHandlers): Promise<LiveCall> {
  const agentUid = session.agentUid;
  const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
  AgoraRTC.setLogLevel(3); // warnings and errors only

  let mic: IMicrophoneAudioTrack;
  try {
    // Echo cancellation matters: without it Mochi hears itself through the speakers and interrupts itself.
    mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true, encoderConfig: "speech_standard" });
  } catch (e) {
    if (isPermissionError(e)) throw new MicDeniedError("Microphone permission denied");
    throw e;
  }

  const client: IAgoraRTCClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  let agent: IAgoraRTCRemoteUser | null = null;
  let agentSpeaking = false;
  let userSpeaking = false;
  let muted = false;
  const isAgent = (uid: UID) => Number(uid) === agentUid;

  client.on("user-published", async (user, mediaType) => {
    if (mediaType !== "audio") return;
    await client.subscribe(user, "audio");
    user.audioTrack?.play();
    if (isAgent(user.uid)) {
      agent = user;
      handlers.onAgentPresent?.(true);
    }
  });
  client.on("user-unpublished", (user) => {
    if (!isAgent(user.uid)) return;
    agent = null;
    if (agentSpeaking) handlers.onAgentSpeaking?.((agentSpeaking = false));
  });
  client.on("user-left", (user) => {
    if (isAgent(user.uid)) handlers.onAgentPresent?.(false);
  });
  client.on("connection-state-change", (cur, _prev, reason) => {
    if (cur === "DISCONNECTED" && reason !== "LEAVE") handlers.onDisconnected?.();
  });

  const messages = new AgentMessages(handlers);
  // Only Mochi and the buyer are in the channel, and only Mochi sends data-stream messages.
  client.on("stream-message", (_uid: UID, payload: Uint8Array) => messages.push(payload));

  try {
    await client.join(session.appId, session.channel, session.token, session.uid);
    await client.publish([mic]);
  } catch (e) {
    mic.close();
    await client.leave().catch(() => undefined);
    throw e;
  }

  // The SDK's volume-indicator event fires every 2 s, too slow for a talking sprite; poll the tracks instead.
  const poll = window.setInterval(() => {
    const a = (agent?.audioTrack?.getVolumeLevel() ?? 0) > 0.05;
    if (a !== agentSpeaking) handlers.onAgentSpeaking?.((agentSpeaking = a));
    const u = !muted && mic.getVolumeLevel() > 0.12;
    if (u !== userSpeaking) handlers.onUserSpeaking?.((userSpeaking = u));
  }, 120);

  return {
    setMicMuted: async (m) => {
      muted = m;
      await mic.setMuted(m);
    },
    leave: async () => {
      window.clearInterval(poll);
      messages.clear();
      mic.stop();
      mic.close();
      client.removeAllListeners();
      await client.leave().catch(() => undefined);
    },
  };
}

type AgentMessage = {
  object?: string;
  text?: string;
  final?: boolean;
  turn_id?: number;
  turn_status?: number;
};

/** Reassembles the agent's chunked data-stream packets and hands on transcripts. Ignores anything else. */
class AgentMessages {
  private parts = new Map<string, { total: number; chunks: Map<number, string>; timer: number }>();
  private text = new TextDecoder();

  constructor(private handlers: LiveHandlers) {}

  push(payload: Uint8Array) {
    try {
      const raw = this.text.decode(payload);
      if ((raw.match(/\|/g) ?? []).length === 3) return this.chunk(raw);
      this.handle(JSON.parse(raw) as AgentMessage);
    } catch {
      // Not a message we understand.
    }
  }

  clear() {
    for (const p of this.parts.values()) window.clearTimeout(p.timer);
    this.parts.clear();
  }

  private chunk(raw: string) {
    const [id, idx, sum, data] = raw.split("|") as [string, string, string, string];
    let entry = this.parts.get(id);
    if (!entry) {
      // Drop half-received messages after 30 s.
      const timer = window.setTimeout(() => this.parts.delete(id), 30_000);
      entry = { total: -1, chunks: new Map(), timer };
      this.parts.set(id, entry);
    }
    if (sum !== "???") entry.total = Number(sum);
    entry.chunks.set(Number(idx), data);
    if (entry.total < 1 || entry.chunks.size < entry.total) return;

    window.clearTimeout(entry.timer);
    this.parts.delete(id);
    const b64 = [...entry.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d).join("");
    // base64 → bytes → UTF-8, so Mandarin and Tamil survive (atob alone would mangle them).
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    this.handle(JSON.parse(this.text.decode(bytes)) as AgentMessage);
  }

  private handle(msg: AgentMessage) {
    const turn = msg.turn_id ?? 0;
    if (msg.object === "message.interrupt") {
      this.handlers.onInterrupt?.(turn);
      return;
    }
    const text = msg.text?.trim();
    if (!text) return;
    if (msg.object === "user.transcription") {
      this.handlers.onTranscript?.({ who: "you", text, final: Boolean(msg.final), turn });
    } else if (msg.object === "assistant.transcription") {
      const status = msg.turn_status ?? 0;
      this.handlers.onTranscript?.({ who: "agent", text, final: status !== 0, interrupted: status === 2, turn });
    }
  }
}
