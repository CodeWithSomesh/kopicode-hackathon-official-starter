"use client";

import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

/**
 * Browser side of Mochi's live voice. Loads agora-rtc-sdk-ng on demand (it touches `window`
 * at import time, so it must never be imported on the server), joins the channel the server
 * made, publishes the mic and plays Mochi's audio. Secrets never reach this file.
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

export type LiveTranscript = { who: "agent" | "you"; text: string; final: boolean; turn: number };

export type LiveHandlers = {
  /** Mochi's audio level crossed the speaking threshold (or dropped below it). */
  onAgentSpeaking?: (speaking: boolean) => void;
  /** Mochi joined (true) or left (false) the channel. */
  onAgentPresent?: (present: boolean) => void;
  /** Captions the engine sends over the RTC data stream, when it sends them. */
  onTranscript?: (t: LiveTranscript) => void;
};

export class MicDeniedError extends Error {}

export async function agoraStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/agora/status", { cache: "no-store" });
    if (!res.ok) return false;
    return Boolean(((await res.json()) as { configured?: boolean }).configured);
  } catch {
    return false;
  }
}

export async function startAgoraSession(ids: string[], anchorId: string): Promise<AgoraSession> {
  const res = await fetch("/api/agora/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, anchorId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Couldn't start Mochi's live voice");
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

export type LiveCall = {
  setMicMuted: (muted: boolean) => Promise<void>;
  leave: () => Promise<void>;
};

/** Joins the RTC channel, publishes the mic and wires Mochi's audio, level and captions. */
export async function joinLiveCall(session: AgoraSession, handlers: LiveHandlers): Promise<LiveCall> {
  const agentUid = session.agentUid;
  const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
  AgoraRTC.setLogLevel(3); // warnings and errors only

  let mic: IMicrophoneAudioTrack;
  try {
    mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
  } catch (e) {
    const code = (e as { code?: string; name?: string }).code ?? (e as { name?: string }).name ?? "";
    if (/PERMISSION_DENIED|NotAllowed|SecurityError/i.test(String(code)) || /permission/i.test(String(e))) {
      throw new MicDeniedError("Microphone permission denied");
    }
    throw e;
  }

  const client: IAgoraRTCClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  let agent: IAgoraRTCRemoteUser | null = null;
  let speaking = false;

  client.on("user-published", async (user, mediaType) => {
    if (mediaType !== "audio") return;
    await client.subscribe(user, "audio");
    user.audioTrack?.play();
    if (Number(user.uid) === agentUid) {
      agent = user;
      handlers.onAgentPresent?.(true);
    }
  });
  client.on("user-unpublished", (user) => {
    if (Number(user.uid) === agentUid) {
      agent = null;
      if (speaking) handlers.onAgentSpeaking?.((speaking = false));
    }
  });
  client.on("user-left", (user) => {
    if (Number(user.uid) === agentUid) handlers.onAgentPresent?.(false);
  });

  const captions = new CaptionAssembler(handlers.onTranscript);
  client.on("stream-message", (_uid, payload) => captions.push(payload));

  await client.join(session.appId, session.channel, session.token, session.uid);
  await client.publish([mic]);

  // The SDK's volume-indicator event fires every 2 s, too slow for a talking sprite; poll the track instead.
  const poll = window.setInterval(() => {
    const level = agent?.audioTrack?.getVolumeLevel() ?? 0;
    const now = level > 0.06;
    if (now !== speaking) handlers.onAgentSpeaking?.((speaking = now));
  }, 150);

  return {
    setMicMuted: (muted) => mic.setMuted(muted),
    leave: async () => {
      window.clearInterval(poll);
      mic.stop();
      mic.close();
      client.removeAllListeners();
      await client.leave().catch(() => undefined);
    },
  };
}

/**
 * The Conversational AI Engine can send captions over the RTC data stream as chunks shaped
 * "messageId|partIndex|partCount|base64(json)". This is best-effort: anything that doesn't
 * parse is ignored, and the page works the same without captions.
 */
class CaptionAssembler {
  private parts = new Map<string, string[]>();
  private decoder = new TextDecoder();

  constructor(private onTranscript?: (t: LiveTranscript) => void) {}

  push(payload: Uint8Array) {
    if (!this.onTranscript) return;
    try {
      const [id, idx, sum, data] = this.decoder.decode(payload).split("|");
      if (!id || !idx || !sum || data === undefined) return;
      const total = Number(sum);
      const list = this.parts.get(id) ?? new Array<string>(total).fill("");
      list[Number(idx) - 1] = data;
      this.parts.set(id, list);
      if (list.some((p) => !p)) return;
      this.parts.delete(id);

      const bytes = Uint8Array.from(atob(list.join("")), (c) => c.charCodeAt(0));
      const msg = JSON.parse(new TextDecoder().decode(bytes)) as {
        object?: string;
        text?: string;
        final?: boolean;
        turn_id?: number;
        turn_status?: number;
      };
      if (!msg.text) return;
      const who = msg.object === "user.transcription" ? "you" : msg.object === "assistant.transcription" ? "agent" : null;
      if (!who) return;
      this.onTranscript?.({
        who,
        text: msg.text,
        final: Boolean(msg.final) || (msg.turn_status !== undefined && msg.turn_status !== 0),
        turn: msg.turn_id ?? 0,
      });
    } catch {
      // Not a caption chunk.
    }
  }
}
