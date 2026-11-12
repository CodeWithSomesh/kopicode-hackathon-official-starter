import "server-only";

import { RtcRole, RtcTokenBuilder } from "agora-token";

/**
 * Server side of Mochi's live voice call: Agora Conversational AI Engine, REST v2.
 * The engine joins an RTC channel as Mochi, listens to the buyer (ASR), asks an LLM what to say
 * and speaks it (TTS); interruptions and turn-taking are handled by the engine.
 *
 * Docs (checked Nov 2026):
 * - Join:   https://docs.agora.io/en/api-reference/api-ref/conversational-ai/join
 *           POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appid}/join
 *           200 → { agent_id, create_ts, status }; error → { detail, reason }
 * - Update: https://docs.agora.io/en/api-reference/api-ref/conversational-ai/update
 *           POST .../projects/{appid}/agents/{agentId}/update, body { properties: { llm: { system_messages } } }
 * - Leave:  https://docs.agora.io/en/api-reference/api-ref/conversational-ai/leave
 *           POST .../projects/{appid}/agents/{agentId}/leave
 * - Auth: HTTP Basic with the RESTful API Customer ID + Customer Secret.
 * - Transcripts: with the default `parameters.data_channel: "datastream"` the engine sends
 *   user.transcription / assistant.transcription messages over the RTC data stream (no RTM needed):
 *   https://docs.agora.io/en/ai/build/transcripts
 *
 * Every secret here is read from env and never leaves the server. The browser only receives the
 * App ID (public by design), the channel name, its own uid and an RTC token for that uid.
 */

const API = "https://api.agora.io/api/conversational-ai-agent/v2/projects";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Fixed uid for Mochi in every channel; the buyer gets a random one. */
export const AGENT_UID = 8888;
/** RTC tokens live for an hour; onboarding takes a few minutes. */
const TOKEN_TTL_S = 3600;

export type AsrVendor = "speechmatics" | "ares" | "microsoft";
export type TtsVendor = "elevenlabs" | "openai" | "microsoft" | "camb" | "minimax";

const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

function read() {
  const e = process.env;
  const azureKey = e.AZURE_SPEECH_KEY ?? "";
  const publicBase = (e.AGORA_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

  // ASR: Speechmatics' cmn_en_ms_ta pack transcribes English, Malay, Mandarin and Tamil mixed in
  // one sentence, which is how Malaysians talk. Without its key, Agora's own ARES (no key).
  const asrVendor: AsrVendor =
    pick(e.AGORA_ASR_VENDOR, ["speechmatics", "ares", "microsoft"] as const) ??
    (e.SPEECHMATICS_API_KEY ? "speechmatics" : "ares");

  // TTS: the first vendor with a key, unless AGORA_TTS_VENDOR says otherwise.
  const ttsVendor: TtsVendor =
    pick(e.AGORA_TTS_VENDOR, ["elevenlabs", "openai", "microsoft", "camb", "minimax"] as const) ??
    (e.ELEVENLABS_API_KEY
      ? "elevenlabs"
      : e.CAMB_API_KEY && publicBase && e.AGORA_TTS_PROXY_SECRET
        ? "camb"
        : e.OPENAI_API_KEY
          ? "openai"
          : e.AZURE_SPEECH_KEY
            ? "microsoft"
            : "minimax");

  return {
    appId: e.AGORA_APP_ID ?? "",
    appCertificate: e.AGORA_APP_CERTIFICATE ?? "",
    customerId: e.AGORA_CUSTOMER_ID ?? "",
    customerSecret: e.AGORA_CUSTOMER_SECRET ?? "",
    // LLM: Agora's own hosted OpenAI model by default (no key, no Groq free-tier daily cap, which
    // ran out mid-demo and made every reply fail). AGORA_LLM_VENDOR=groq uses Groq with GROQ_API_KEY;
    // AGORA_LLM_URL + AGORA_LLM_API_KEY use any other OpenAI-compatible endpoint.
    llmManaged: !e.AGORA_LLM_URL && e.AGORA_LLM_VENDOR !== "groq",
    llmUrl: e.AGORA_LLM_URL || (e.AGORA_LLM_VENDOR === "groq" ? GROQ_CHAT_URL : OPENAI_CHAT_URL),
    llmApiKey: e.AGORA_LLM_API_KEY || (e.AGORA_LLM_VENDOR === "groq" ? (e.GROQ_API_KEY ?? "") : ""),
    llmModel:
      e.AGORA_LLM_MODEL ||
      (e.AGORA_LLM_URL || e.AGORA_LLM_VENDOR === "groq" ? "openai/gpt-oss-120b" : "gpt-4.1-mini"),
    asrVendor,
    asrLanguage: e.AGORA_ASR_LANGUAGE || (asrVendor === "speechmatics" ? "cmn_en_ms_ta" : asrVendor === "microsoft" ? "ms-MY" : "en-US"),
    speechmaticsKey: e.SPEECHMATICS_API_KEY ?? "",
    speechmaticsUri: e.SPEECHMATICS_RT_URL ?? "",
    azureKey,
    azureRegion: e.AZURE_SPEECH_REGION || "southeastasia",
    ttsVendor,
    elevenKey: e.ELEVENLABS_API_KEY ?? "",
    elevenVoice: e.ELEVENLABS_VOICE_ID ?? "",
    elevenModel: e.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
    openaiKey: e.OPENAI_API_KEY ?? "",
    openaiVoice: e.OPENAI_TTS_VOICE || "coral",
    openaiInstructions:
      e.OPENAI_TTS_INSTRUCTIONS ||
      "Voice of Mochi, a small, cute, friendly robot helper: bright, youthful and high-pitched, bubbly and warm, with a light playful robotic lilt. Speak clearly at a lively pace. Use the accent natural to the language of the text (Malaysian English, Bahasa Melayu, Mandarin or Tamil).",
    // Azure has child voices but no cute Malay one: en-US-AnaNeural (English), zh-CN-XiaoyouNeural (Mandarin).
    azureVoice: e.AZURE_TTS_VOICE || "en-US-AnaNeural",
    cambKey: e.CAMB_API_KEY ?? "",
    publicBase,
    ttsProxySecret: e.AGORA_TTS_PROXY_SECRET ?? "",
  };
}

/** True when every value the chosen ASR/TTS/LLM needs is present. Says nothing about which is missing. */
export function agoraConfigured() {
  const c = read();
  const base = [c.appId, c.appCertificate, c.customerId, c.customerSecret, c.llmUrl].every(Boolean) && (c.llmManaged || Boolean(c.llmApiKey));
  const asr = c.asrVendor === "speechmatics" ? Boolean(c.speechmaticsKey) : c.asrVendor === "microsoft" ? Boolean(c.azureKey) : true;
  const tts =
    c.ttsVendor === "elevenlabs"
      ? Boolean(c.elevenKey && c.elevenVoice)
      : c.ttsVendor === "openai"
        ? Boolean(c.openaiKey)
        : c.ttsVendor === "camb"
          ? Boolean(c.cambKey && c.publicBase.startsWith("https://") && c.ttsProxySecret)
          : c.ttsVendor === "minimax"
            ? true // Agora-managed: billed in Agora's per-minute price, no key of ours
            : Boolean(c.azureKey);
  return base && asr && tts;
}

/** Which engines a call would use (no secrets): for logs and the status route. */
export function agoraSetup() {
  const c = read();
  return { asr: c.asrVendor, asrLanguage: c.asrLanguage, tts: c.ttsVendor, llm: c.llmModel };
}

export function agoraAppId() {
  return read().appId;
}

/** The secret Agora sends to our CAMB proxy (/api/agora/tts) as a Bearer token. */
export function ttsProxySecret() {
  return read().ttsProxySecret;
}

/** RTC token (publisher) for one uid in one channel, built with the agora-token package. */
export function rtcToken(channel: string, uid: number) {
  const c = read();
  return RtcTokenBuilder.buildTokenWithUid(c.appId, c.appCertificate, channel, uid, RtcRole.PUBLISHER, TOKEN_TTL_S, TOKEN_TTL_S);
}

function basicAuth() {
  const c = read();
  return `Basic ${Buffer.from(`${c.customerId}:${c.customerSecret}`).toString("base64")}`;
}

/** Agora's ARES hears one language per call; these are the codes for Mochi's four. */
const ARES_LANG = { en: "en-US", ms: "ms-MY", zh: "zh-CN", ta: "ta-IN" } as const;
export type CallLang = keyof typeof ARES_LANG;

/** True when the recogniser hears English, Malay, Mandarin and Tamil mixed in one call (Speechmatics). */
export function agoraMixedLanguages() {
  const c = read();
  return c.asrVendor === "speechmatics" && c.asrLanguage === "cmn_en_ms_ta";
}

/** Words the recognisers should expect. */
const KEYWORDS = ["Mochi", "Gamuda", "Gamuda Land", "HomeLander", "LRT", "MRT", "KTM", "PTPTN", "CCRIS", "Kajang", "Cyberjaya", "Puchong", "Semenyih", "Rawang", "Shah Alam"];

/**
 * ASR block. Vendor pages:
 * - Speechmatics: https://docs.agora.io/en/ai/models/asr/speechmatics (params.key, params.language, optional params.uri;
 *   extra params pass through). Language pack cmn_en_ms_ta = Mandarin, Malay, Tamil & English with code-switching:
 *   https://docs.speechmatics.com/speech-to-text/languages
 * - ARES (Agora's own, no key): https://docs.agora.io/en/ai/models/asr/ares
 * - Microsoft: https://docs.agora.io/en/ai/models/asr/microsoft
 */
function asrConfig(lang: CallLang) {
  const c = read();
  if (c.asrVendor === "speechmatics") {
    return {
      vendor: "speechmatics",
      language: "en-US",
      params: {
        key: c.speechmaticsKey,
        language: c.asrLanguage,
        ...(c.speechmaticsUri ? { uri: c.speechmaticsUri } : {}),
      },
    };
  }
  if (c.asrVendor === "microsoft") {
    return {
      vendor: "microsoft",
      language: c.asrLanguage,
      params: { key: c.azureKey, region: c.azureRegion, language: c.asrLanguage, phrase_list: KEYWORDS },
    };
  }
  // AGORA_ASR_LANGUAGE pins one language; otherwise the language the buyer picked for this call.
  return { vendor: "ares", language: process.env.AGORA_ASR_LANGUAGE || ARES_LANG[lang], keywords: KEYWORDS };
}

/**
 * TTS block. Vendor pages:
 * - ElevenLabs: https://docs.agora.io/en/ai/models/tts/elevenlabs (base_url, key, model_id, voice_id, sample_rate,
 *   speed 0.7-1.2, stability, similarity_boost, style, use_speaker_boost)
 * - OpenAI: https://docs.agora.io/en/ai/models/tts/openai (url, api_key, model, voice, instructions, speed; 24 kHz)
 * - Microsoft: https://docs.agora.io/en/ai/models/tts/microsoft (key, region, voice_name, speed, volume, sample_rate)
 * - Custom (CAMB via our proxy): https://docs.agora.io/en/ai/models/tts/generic-http and
 *   https://docs.agora.io/en/ai/build/custom-model-integration/custom-tts (OpenAI /audio/speech protocol,
 *   response = chunked raw PCM at params.sample_rate).
 */
function ttsConfig() {
  const c = read();
  switch (c.ttsVendor) {
    case "elevenlabs":
      return {
        vendor: "elevenlabs",
        params: {
          base_url: "wss://api.elevenlabs.io/v1",
          key: c.elevenKey,
          model_id: c.elevenModel,
          voice_id: c.elevenVoice,
          sample_rate: 24000,
          speed: Number(process.env.ELEVENLABS_SPEED) || 1.08,
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      };
    case "openai":
      return {
        vendor: "openai",
        params: {
          url: "https://api.openai.com/v1/audio/speech",
          api_key: c.openaiKey,
          model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
          voice: c.openaiVoice,
          instructions: c.openaiInstructions,
          speed: 1.05,
        },
      };
    case "camb":
      return {
        vendor: "generic_http",
        url: `${c.publicBase}/api/agora/tts`,
        headers: { Authorization: `Bearer ${c.ttsProxySecret}` },
        params: { model: "camb", voice: "mochi", sample_rate: 16000, response_format: "pcm", speed: 1 },
      };
    case "minimax":
      // Agora-managed MiniMax: no key (credential_mode "managed"), included in Agora's minute price.
      // https://docs.agora.io/en/ai/reference/pricing. A raised pitch makes Mochi small and cute.
      return {
        vendor: "minimax",
        credential_mode: "managed",
        params: {
          url: "wss://api.minimax.io/ws/v1/t2a_v2",
          model: process.env.MINIMAX_TTS_MODEL || "speech-2.8-turbo",
          voice_setting: {
            voice_id: process.env.MINIMAX_VOICE_ID || "English_captivating_female1",
            speed: 1.05,
            pitch: Number(process.env.MINIMAX_PITCH ?? 3),
          },
          audio_setting: { sample_rate: 24000 },
        },
      };
    default:
      return {
        vendor: "microsoft",
        params: { key: c.azureKey, region: c.azureRegion, voice_name: c.azureVoice, speed: 1.0, volume: 70, sample_rate: 24000 },
      };
  }
}

/**
 * LLM params. Agora passes `params` through to the chat completions request; Groq accepts
 * `reasoning_effort` for gpt-oss models (think briefly, answer fast). max_tokens covers reasoning too.
 * https://console.groq.com/docs/reasoning
 */
function llmParams() {
  const c = read();
  return {
    model: c.llmModel,
    max_tokens: 600,
    temperature: 0.7,
    ...(c.llmModel.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
  };
}

export type JoinInput = { channel: string; userUid: number; systemPrompt: string; greeting: string; lang: CallLang };

/** What Mochi says when a reply fails, in the call's language (it used to be English on every call). */
const FAILURE: Record<CallLang, string> = {
  en: "Oops, Mochi missed that. Could you say it once more?",
  ms: "Maaf, Mochi terlepas tadi. Boleh ulang sekali lagi?",
  zh: "哎呀，Mochi没听清楚。可以再说一遍吗？",
  ta: "மன்னிக்கவும், Mochi அதைக் கேட்கவில்லை. மீண்டும் ஒருமுறை சொல்ல முடியுமா?",
};

/** LLM block: Agora-managed (no api_key) or bring-your-own-key. */
function llmConfig() {
  const c = read();
  return c.llmManaged
    ? { credential_mode: "managed", vendor: "openai", style: "openai", url: c.llmUrl }
    : { url: c.llmUrl, api_key: c.llmApiKey };
}

export class AgoraError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(path: string, body?: unknown) {
  const c = read();
  const res = await fetch(`${API}/${encodeURIComponent(c.appId)}${path}`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return res;
}

async function failure(res: Response, what: string) {
  // Agora's error body is { detail, reason }; pass on the reason only, never the request (it holds keys).
  const err = (await res.json().catch(() => ({}))) as { reason?: string; detail?: string };
  return new AgoraError(`Agora ${what} failed (${res.status}${err.reason ? `: ${err.reason}` : ""})`, res.status);
}

/** Starts Mochi in the channel. Returns the agent id needed to update or stop it. */
export async function joinAgent({ channel, userUid, systemPrompt, greeting, lang }: JoinInput) {
  const body = {
    name: `mochi-${channel}`,
    properties: {
      channel,
      token: rtcToken(channel, AGENT_UID),
      agent_rtc_uid: String(AGENT_UID),
      remote_rtc_uids: [String(userUid)],
      enable_string_uid: false,
      // Leave the channel 30 s after the buyer does (the page also calls /api/agora/stop).
      idle_timeout: 30,
      advanced_features: { enable_rtm: false },
      llm: {
        ...llmConfig(),
        system_messages: [{ role: "system", content: systemPrompt }],
        greeting_message: greeting,
        failure_message: FAILURE[lang],
        // Short memory keeps each turn small for Groq's tokens-per-minute limit; the profile in the
        // system prompt (refreshed through /update) carries everything older.
        max_history: 12,
        params: llmParams(),
      },
      asr: asrConfig(lang),
      tts: { ...ttsConfig(), skip_patterns: [3, 4] },
      // Turn-taking and barge-in use the engine defaults: Agora VAD, 640 ms of silence ends the buyer's
      // turn, and talking over Mochi interrupts it (properties.interruption.enable defaults to true).
      // Transcripts arrive in the browser over the RTC data stream.
      parameters: { data_channel: "datastream" },
    },
  };

  const res = await call("/join", body);
  if (!res.ok) throw await failure(res, "join");
  const data = (await res.json()) as { agent_id?: string; status?: string };
  if (!data.agent_id) throw new AgoraError("Agora join returned no agent_id", 502);
  return { agentId: data.agent_id, status: data.status ?? "RUNNING" };
}

/** Refreshes Mochi's system prompt mid-call (the profile it knows and what's still missing). */
export async function updateAgentPrompt(agentId: string, systemPrompt: string) {
  const res = await call(`/agents/${encodeURIComponent(agentId)}/update`, {
    properties: { llm: { system_messages: [{ role: "system", content: systemPrompt }] } },
  });
  if (!res.ok && res.status !== 404) throw await failure(res, "update");
}

export async function leaveAgent(agentId: string) {
  const res = await call(`/agents/${encodeURIComponent(agentId)}/leave`);
  // 404 means the agent already left (idle timeout); that's fine.
  if (!res.ok && res.status !== 404) throw await failure(res, "leave");
}
