import "server-only";

import { RtcRole, RtcTokenBuilder } from "agora-token";

/**
 * Server side of Mochi's live voice: Agora Conversational AI Engine (REST v2).
 * Docs: https://docs.agora.io/en/api-reference/api-ref/conversational-ai/join
 *       https://docs.agora.io/en/api-reference/api-ref/conversational-ai/leave
 *
 * Every secret here is read from env and never leaves the server. The browser only ever
 * receives the App ID (public by design), the channel name, its own uid and an RTC token.
 */

const API = "https://api.agora.io/api/conversational-ai-agent/v2/projects";

/** Fixed uid for Mochi in every channel; the buyer gets a random one. */
export const AGENT_UID = 8888;
/** RTC tokens live for an hour; a Regret Test takes two minutes. */
const TOKEN_TTL_S = 3600;

type TtsVendor = "microsoft" | "elevenlabs";

function read() {
  const e = process.env;
  const ttsVendor: TtsVendor = e.AGORA_TTS_VENDOR === "elevenlabs" ? "elevenlabs" : "microsoft";
  return {
    appId: e.AGORA_APP_ID ?? "",
    appCertificate: e.AGORA_APP_CERTIFICATE ?? "",
    customerId: e.AGORA_CUSTOMER_ID ?? "",
    customerSecret: e.AGORA_CUSTOMER_SECRET ?? "",
    llmUrl: e.AGORA_LLM_URL ?? "",
    llmApiKey: e.AGORA_LLM_API_KEY ?? "",
    llmModel: e.AGORA_LLM_MODEL || "gpt-4o-mini",
    ttsVendor,
    ttsKey: e.AGORA_TTS_KEY ?? "",
    // Microsoft: an Azure neural voice. ms-MY-OsmanNeural is a Malaysian male voice that reads mixed BM/English.
    // ElevenLabs: a voice_id.
    ttsVoice: e.AGORA_TTS_VOICE || (ttsVendor === "microsoft" ? "ms-MY-OsmanNeural" : ""),
    ttsRegion: e.AGORA_TTS_REGION || "southeastasia",
    ttsModel: e.AGORA_TTS_MODEL || "eleven_flash_v2_5",
    // ARES is Agora's built-in ASR (no extra key). Set "microsoft" to use Azure STT with the TTS key and region.
    asrVendor: e.AGORA_ASR_VENDOR === "microsoft" ? ("microsoft" as const) : ("ares" as const),
    asrLanguage: e.AGORA_ASR_LANGUAGE || "en-US",
  };
}

/** True when every value the live agent needs is present. Says nothing about which one is missing. */
export function agoraConfigured() {
  const c = read();
  const base = [c.appId, c.appCertificate, c.customerId, c.customerSecret, c.llmUrl, c.llmApiKey, c.ttsKey];
  if (c.ttsVendor === "elevenlabs" && !c.ttsVoice) return false;
  return base.every(Boolean);
}

export function agoraAppId() {
  return read().appId;
}

export function rtcToken(channel: string, uid: number) {
  const c = read();
  return RtcTokenBuilder.buildTokenWithUid(
    c.appId,
    c.appCertificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_S,
    TOKEN_TTL_S,
  );
}

function basicAuth() {
  const c = read();
  return `Basic ${Buffer.from(`${c.customerId}:${c.customerSecret}`).toString("base64")}`;
}

function ttsConfig() {
  const c = read();
  if (c.ttsVendor === "elevenlabs") {
    return {
      vendor: "elevenlabs",
      params: { key: c.ttsKey, model_id: c.ttsModel, voice_id: c.ttsVoice, sample_rate: 24000 },
    };
  }
  return {
    vendor: "microsoft",
    params: { key: c.ttsKey, region: c.ttsRegion, voice_name: c.ttsVoice, speed: 1.0, volume: 70, sample_rate: 24000 },
  };
}

function asrConfig() {
  const c = read();
  if (c.asrVendor === "microsoft") {
    return {
      vendor: "microsoft",
      language: c.asrLanguage,
      params: {
        key: c.ttsKey,
        region: c.ttsRegion,
        language: c.asrLanguage,
        phrase_list: ["Gamuda", "HomeLander", "lah", "boleh", "kereta", "anak", "mak ayah", "LRT", "MRT", "KTM"],
      },
    };
  }
  return {
    vendor: "ares",
    language: c.asrLanguage,
    keywords: ["Gamuda", "HomeLander", "Mochi", "LRT", "MRT", "KTM"],
  };
}

export type JoinInput = {
  channel: string;
  userUid: number;
  systemPrompt: string;
  greeting: string;
};

export class AgoraError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Starts Mochi in the channel. Returns the agent id needed to stop it. */
export async function joinAgent({ channel, userUid, systemPrompt, greeting }: JoinInput) {
  const c = read();
  const body = {
    name: `mochi-${channel}`,
    properties: {
      channel,
      token: rtcToken(channel, AGENT_UID),
      agent_rtc_uid: String(AGENT_UID),
      remote_rtc_uids: [String(userUid)],
      enable_string_uid: false,
      // Leave the channel 60 s after the buyer does.
      idle_timeout: 60,
      advanced_features: { enable_rtm: false },
      llm: {
        url: c.llmUrl,
        api_key: c.llmApiKey,
        system_messages: [{ role: "system", content: systemPrompt }],
        greeting_message: greeting,
        failure_message: "Sorry, Mochi missed that. Could you say it again?",
        max_history: 24,
        params: { model: c.llmModel, max_tokens: 160, temperature: 0.7 },
      },
      asr: asrConfig(),
      tts: ttsConfig(),
    },
  };

  const res = await fetch(`${API}/${encodeURIComponent(c.appId)}/join`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    // Agora's error body has `detail` and `reason`; pass on the reason only, never the request.
    const err = (await res.json().catch(() => ({}))) as { reason?: string };
    throw new AgoraError(`Agora join failed (${res.status}${err.reason ? `: ${err.reason}` : ""})`, res.status);
  }
  const data = (await res.json()) as { agent_id?: string; status?: string };
  if (!data.agent_id) throw new AgoraError("Agora join returned no agent_id", 502);
  return { agentId: data.agent_id, status: data.status ?? "RUNNING" };
}

export async function leaveAgent(agentId: string) {
  const c = read();
  const res = await fetch(
    `${API}/${encodeURIComponent(c.appId)}/agents/${encodeURIComponent(agentId)}/leave`,
    { method: "POST", headers: { Authorization: basicAuth() }, cache: "no-store" },
  );
  // 404 means the agent already left (idle timeout); that's fine.
  if (!res.ok && res.status !== 404) throw new AgoraError(`Agora leave failed (${res.status})`, res.status);
}
