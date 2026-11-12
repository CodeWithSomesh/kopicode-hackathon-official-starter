"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { MochiBot, type MochiState } from "@/components/homelander/mochi-bot";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite, defineSprite } from "@/components/homelander/sprite";
import { eligibility } from "@/lib/homelander/bank";
import {
  filledKeys,
  toIncomeInput,
  type Profile,
  type ProfileKey,
} from "@/lib/homelander/profile";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import {
  hush,
  listenLocale,
  recognitionCtor,
  speak,
  type Recognition,
  type VoiceLang,
} from "./browser-voice";
import { ProfilePanel } from "./profile-panel";
import { Typewriter } from "./typewriter";
import { useAgoraCall } from "./use-agora-call";
import { useWhisperMic } from "./use-whisper-mic";

type Msg = { role: "user" | "assistant"; content: string };
type Turn = {
  reply: string;
  lang: VoiceLang;
  patch: Partial<Profile>;
  complete: boolean;
};

const langs: { id: VoiceLang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "ms", label: "BM", name: "Bahasa Melayu" },
  { id: "zh", label: "中文", name: "Mandarin" },
  { id: "ta", label: "தமிழ்", name: "Tamil" },
];

/**
 * The speech bubble's pixel tail, pointing left at Mochi ("#" is the bubble fill, "k" its outline).
 * Rotated a quarter turn it points up, for the stacked phone layout.
 */
const bubbleTail = defineSprite(
  [".....kk", "...kk##", ".kk####", "k######", ".kk####", "...kk##", ".....kk"],
  { k: "#2b1d3f" },
);

/** A pixel handset for the call button. */
const phoneSprite = defineSprite([
  "##.....",
  "###....",
  "###....",
  ".##....",
  "..##...",
  "...##.#",
  "....###",
  ".....##",
]);

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const stateTag: Record<
  MochiState,
  { tone?: "pandan" | "kaya" | "lilac"; text: string }
> = {
  idle: { text: "Ready" },
  listening: { tone: "lilac", text: "Listening" },
  thinking: { tone: "kaya", text: "Thinking" },
  speaking: { tone: "pandan", text: "Talking" },
  happy: { tone: "pandan", text: "Got it" },
};

export function OnboardingView() {
  const router = useRouter();
  const { profile } = useHomeLander();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [line, setLine] = useState<{ text: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [listenLang, setListenLang] = useState<VoiceLang>("en");
  const [soundOn, setSoundOn] = useState(true);
  const [fresh, setFresh] = useState<Set<ProfileKey>>(new Set());
  const [draft, setDraft] = useState("");
  const recRef = useRef<Recognition | null>(null);
  /** Groq Whisper is the mic; false once the server says it has no Groq key (then browser listening). */
  const [whisper, setWhisper] = useState(true);
  const started = useRef(false);
  const logRef = useRef<HTMLOListElement>(null);
  const [complete, setComplete] = useState(false);
  const flash = useCallback((patch: Partial<Profile>) => {
    const keys = filledKeys(patch);
    if (!keys.length) return;
    setFresh(new Set(keys));
    window.setTimeout(() => setFresh(new Set()), 2600);
  }, []);
  /** Live, hands-free call on Agora when the server has the keys; tap-to-talk is the fallback. */
  const live = useAgoraCall({
    onPatch: (patch) => {
      homelander.patchProfile(patch);
      flash(patch);
    },
  });
  const inCall =
    live.status === "connecting" ||
    live.status === "live" ||
    live.status === "ending";
  const liveReady = live.status !== "checking" && live.status !== "unavailable";
  const canListen = useSyncExternalStore(
    () => () => {},
    () => recognitionCtor() !== null,
    () => true,
  );

  const ask = useCallback(
    async (history: Msg[]) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/mochi/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            profile: homelander.snapshot().profile,
          }),
        });
        const data = (await res.json()) as Turn & { error?: string };
        if (!res.ok || data.error)
          throw new Error(
            data.error ??
              "Mochi lost its train of thought. Please try that again.",
          );

        homelander.patchProfile(data.patch);
        if (data.complete) setComplete(true);
        flash(data.patch);
        setMessages([...history, { role: "assistant", content: data.reply }]);
        setLine((l) => ({ text: data.reply, n: (l?.n ?? 0) + 1 }));
        if (soundOn)
          speak(
            data.reply,
            { start: () => setSpeaking(true), end: () => setSpeaking(false) },
            data.lang,
          );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Mochi lost its train of thought. Please try that again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [soundOn, flash],
  );

  // Mochi opens the conversation in the tap-to-talk fallback. With live voice, Mochi greets on the call.
  useEffect(() => {
    if (started.current || live.status !== "unavailable") return;
    started.current = true;
    void ask([]);
  }, [ask, live.status]);

  useEffect(() => {
    // Keep the newest line in view, inside the transcript only (never scrolls the page).
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, live.lines]);

  useEffect(
    () => () => {
      hush();
      recRef.current?.abort();
    },
    [],
  );

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    hush();
    setSpeaking(false);
    setDraft("");
    const history: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(history); // show it right away; Mochi's reply is appended when it arrives
    void ask(history);
  }

  const mic = useWhisperMic({
    onText: (t) => send(t),
    onUnavailable: () => {
      setWhisper(false);
      toast("Mochi is using the browser's own ears for now.", {
        description: "Add GROQ_API_KEY to use Whisper.",
      });
    },
    onError: (m) => toast.error(m),
  });

  /** Mochi's face: talking > listening > thinking > pleased (just saved answers, or done) > idle. */
  const mochiState: MochiState = inCall
    ? live.agentSpeaking
      ? "speaking"
      : live.userSpeaking
        ? "listening"
        : live.status === "connecting" || live.thinking
          ? "thinking"
          : fresh.size
            ? "happy"
            : "listening"
    : speaking
      ? "speaking"
      : listening || mic.state !== "idle"
        ? "listening"
        : busy
          ? "thinking"
          : complete || fresh.size
            ? "happy"
            : "idle";

  function talk() {
    if (!whisper) return listen();
    if (mic.state === "recording") return mic.stop();
    hush();
    setSpeaking(false);
    void mic.start();
  }

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.abort();
      return;
    }
    hush();
    const rec = new Ctor();
    rec.lang = listenLocale[listenLang];
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => send(e.results[0]?.[0]?.transcript ?? "");
    rec.onerror = (e) => {
      if (e.error === "not-allowed")
        toast.error(
          "Mic is blocked. Allow it in the browser, or type to Mochi.",
        );
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function call() {
    hush();
    setSpeaking(false);
    recRef.current?.abort();
    void live.start();
  }

  /** Mochi's latest words on the call, as they stream in. */
  const liveLine = live.lines.findLast((l) => l.who === "agent")?.text;
  /** The transcript shown under the call: the call's lines while (or after) calling, else the chat. */
  const showCallLog =
    inCall || (live.lines.length > 0 && messages.length === 0);

  function finish() {
    if (inCall) void live.hangUp();
    const p = homelander.snapshot().profile;
    const input = toIncomeInput(p);
    if (input) {
      const e = eligibility(input);
      homelander.setBudget({
        grossRM: e.grossRM,
        netRM: e.netRM,
        commitmentsRM: e.commitmentsRM,
        maxLoanRM: e.maxLoanRM,
        maxPriceRM: e.maxPriceRM,
      });
    }
    homelander.finishOnboarding(new Date().toISOString());
    hush();
    router.push("/swipe");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start">
      <div className="flex flex-wrap items-end justify-between gap-3 lg:col-start-1 lg:row-start-1">
        <div className="grid gap-1">
          <h1 className="font-pixel text-3xl leading-tight font-bold sm:text-4xl">
            Chat with Mochi
          </h1>
          <p className="text-ink-soft">
            {liveReady
              ? "A few minutes about your life, so we only show homes that fit. Call Mochi and just talk, in any language."
              : "A few minutes about your life, so we only show homes that fit. Speak or type, in any language."}
          </p>
        </div>
        <PixTag tone="lilac">
          {liveReady
            ? "Live voice call"
            : whisper
              ? "Tap to talk (fallback)"
              : "Browser voice (fallback)"}
        </PixTag>
      </div>

      {/* Mochi, the talk controls and the transcript: right on desktop, first on phones. */}
      <div className="grid min-w-0 content-start gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:h-[calc(100svh-7.5rem)] lg:flex-col">
        <PixPanel className="grid shrink-0 gap-7 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
          <div className="grid justify-items-center gap-2">
            <div className="rounded-xl bg-cloud p-3">
              <MochiBot state={mochiState} size={120} />
            </div>
            <div className="flex items-center gap-1.5">
              <PixTag tone="ink">Mochi</PixTag>
              <PixTag tone={stateTag[mochiState].tone}>
                {stateTag[mochiState].text}
              </PixTag>
            </div>
          </div>
          <div
            className="pix-frame pix-flat relative grid gap-3 px-4 py-3.5 sm:px-5 sm:py-4"
            style={{ "--pix-fill": "var(--color-cloud)" } as CSSProperties}
          >
            <Sprite
              art={bubbleTail}
              scale={3}
              className="absolute -top-[21px] left-1/2 -ml-[10px] rotate-90 text-cloud sm:top-1/2 sm:-left-[21px] sm:ml-0 sm:-mt-[10px] sm:rotate-0"
            />
            <p
              className="min-h-[4.5rem] font-pixel text-base leading-snug"
              aria-live="polite"
            >
              {inCall ? (
                liveLine ? (
                  liveLine
                ) : (
                  <span className="text-ink-soft">
                    {live.status === "connecting"
                      ? "Calling Mochi…"
                      : live.agentHere
                        ? "Mochi is saying hello…"
                        : "Mochi is joining the call…"}
                  </span>
                )
              ) : line ? (
                <Typewriter key={line.n} text={line.text} />
              ) : busy ? (
                <span className="text-ink-soft">Mochi is saying hello…</span>
              ) : liveReady ? (
                <span className="text-ink-soft">
                  Hi! Tap Call Mochi and just talk. No buttons to hold, and you
                  can cut in any time.
                </span>
              ) : null}
            </p>
            {error ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-raya/10 px-3 py-2 text-sm text-raya-deep">
                <span className="min-w-0 flex-1">{error}</span>
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => void ask(messages)}
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </PixPanel>

        <PixPanel className="grid shrink-0 gap-4 p-4 sm:p-5 lg:order-last">
          {liveReady ? (
            <div className="grid gap-3">
              {inCall ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5" aria-live="polite">
                    <PixTag tone="raya">
                      {live.status === "connecting"
                        ? "Connecting"
                        : `Live ${clock(live.seconds)}`}
                    </PixTag>
                    <PixTag
                      tone={
                        live.agentSpeaking
                          ? "pandan"
                          : live.muted
                            ? "white"
                            : "lilac"
                      }
                    >
                      {live.agentSpeaking
                        ? "Mochi talking"
                        : live.muted
                          ? "Muted"
                          : live.userSpeaking
                            ? "Hearing you"
                            : live.thinking
                              ? "Thinking"
                              : "Listening"}
                    </PixTag>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <PixButton
                      tone={live.muted ? "kaya" : "white"}
                      disabled={live.status !== "live"}
                      onClick={() => void live.toggleMute()}
                      aria-pressed={live.muted}
                    >
                      <Sprite art="mic" scale={2} />
                      {live.muted ? "Unmute" : "Mute"}
                    </PixButton>
                    <PixButton
                      tone="raya"
                      disabled={live.status === "ending"}
                      onClick={() => void live.hangUp()}
                    >
                      <Sprite art={phoneSprite} scale={2} />
                      {live.status === "ending" ? "Hanging up…" : "Hang up"}
                    </PixButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <PixButton tone="pandan" size="lg" onClick={call}>
                    <Sprite art={phoneSprite} scale={3} />
                    {live.lines.length ? "Call Mochi again" : "Call Mochi"}
                  </PixButton>
                  <p className="min-w-0 flex-1 text-sm text-ink-soft">
                    Hands-free: just talk, in English, BM, 中文 or தமிழ். Mochi
                    answers on the spot and fills in your profile as you go.
                  </p>
                </div>
              )}
              {live.error ? (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-raya/10 px-3 py-2 text-sm text-raya-deep"
                  role="alert"
                >
                  <span className="min-w-0 flex-1">{live.error}</span>
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={live.clearError}
                  >
                    OK
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <PixButton
                  tone={
                    listening || mic.state === "recording" ? "raya" : "pandan"
                  }
                  size="lg"
                  disabled={
                    (whisper ? mic.state === "transcribing" : !canListen) ||
                    busy
                  }
                  onClick={talk}
                  aria-pressed={listening || mic.state === "recording"}
                >
                  <Sprite art="mic" scale={3} />
                  {mic.state === "recording"
                    ? "Recording… tap to send"
                    : mic.state === "transcribing"
                      ? "Mochi is listening…"
                      : listening
                        ? "Listening… tap to stop"
                        : busy
                          ? "Mochi is thinking"
                          : "Talk to Mochi"}
                </PixButton>
                {whisper ? (
                  <p className="text-sm text-ink-soft">
                    Speak any mix of English, BM, 中文 or தமிழ். Mochi follows
                    along.
                  </p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Language you'll speak"
                    className="flex gap-1.5"
                  >
                    {langs.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        role="radio"
                        aria-checked={listenLang === l.id}
                        aria-label={l.name}
                        onClick={() => setListenLang(l.id)}
                        className={cn(
                          "min-w-11 rounded-full border-[1.5px] px-2.5 py-1.5 text-sm font-medium",
                          listenLang === l.id
                            ? "border-ink bg-ink text-white"
                            : "border-ink/25 hover:border-ink/60",
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (soundOn) hush();
                    setSoundOn((s) => !s);
                  }}
                  className="ml-auto flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:underline"
                >
                  <Sprite art="speaker" scale={2} />
                  {soundOn ? "Sound on" : "Sound off"}
                </button>
              </div>
              {whisper || canListen ? null : (
                <p className="text-sm text-ink-soft">
                  This browser can&apos;t listen. Type to Mochi instead; Chrome
                  or Edge can listen.
                </p>
              )}
            </>
          )}
          {inCall ? null : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <label htmlFor="say" className="sr-only">
                Type to Mochi
              </label>
              <input
                id="say"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Or type here, e.g. My wife and I, worried about the down payment"
                className="pix-frame pix-flat h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] placeholder:text-ink-soft/60 focus-visible:outline-none"
              />
              <PixButton
                type="submit"
                tone="ink"
                disabled={busy || !draft.trim()}
              >
                Send
              </PixButton>
            </form>
          )}
        </PixPanel>

        {showCallLog ? (
          <PixPanel className="flex min-h-0 flex-col gap-2 p-4 sm:p-5 lg:flex-1">
            <h2 className="font-pixel text-lg font-bold">
              {inCall ? "Live transcript" : "Call transcript"}
            </h2>
            {live.lines.length ? (
              <ol
                ref={logRef}
                className="grid max-h-72 min-h-0 content-start gap-2 overflow-y-auto scroll-smooth pr-1 text-sm lg:max-h-none lg:flex-1"
              >
                {live.lines.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2",
                      l.who === "agent"
                        ? "bg-cloud"
                        : "justify-self-end bg-pandan/15",
                      !l.final && "opacity-70",
                    )}
                  >
                    <span className="sr-only">
                      {l.who === "agent" ? "Mochi: " : "You: "}
                    </span>
                    {l.text}
                    {l.interrupted ? (
                      <span className="text-ink-soft"> (cut off)</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">
                What you and Mochi say shows up here.
              </p>
            )}
          </PixPanel>
        ) : (
          <PixPanel className="flex min-h-0 flex-col gap-2 p-4 sm:p-5 lg:flex-1">
            <h2 className="font-pixel text-lg font-bold">Conversation</h2>
            {messages.length ? (
              <ol
                ref={logRef}
                className="grid max-h-72 min-h-0 content-start gap-2 overflow-y-auto scroll-smooth pr-1 text-sm lg:max-h-none lg:flex-1"
              >
                {messages.map((m, i) => (
                  <li
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2",
                      m.role === "assistant"
                        ? "bg-cloud"
                        : "justify-self-end bg-pandan/15",
                    )}
                  >
                    <span className="sr-only">
                      {m.role === "assistant" ? "Mochi: " : "You: "}
                    </span>
                    {m.content}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">
                What you and Mochi say shows up here.
              </p>
            )}
          </PixPanel>
        )}
      </div>

      {/* What Mochi knows: fills in live as the buyer talks. Left on desktop, below the chat on phones. */}
      <div className="min-w-0 lg:sticky lg:top-24 lg:col-start-1 lg:row-start-2">
        <ProfilePanel profile={profile} fresh={fresh} onDone={finish} />
      </div>
    </div>
  );
}
