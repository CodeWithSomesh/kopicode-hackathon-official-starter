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
import { UnclePortrait, moodOf } from "./uncle-portrait";
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
 * The speech bubble's pixel tail, pointing left at Uncle ("#" is the bubble fill, "k" its outline).
 * Rotated a quarter turn it points up, for the stacked phone layout.
 */
const bubbleTail = defineSprite(
  [".....kk", "...kk##", ".kk####", "k######", ".kk####", "...kk##", ".....kk"],
  { k: "#2b1d3f" },
);

const moodTag = {
  haiyaa: { tone: "raya", text: "Haiyaa" },
  happy: { tone: "pandan", text: "Steady lah" },
} as const;

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
  /** Uncle's face follows his latest line: "Haiyaa…" gets the facepalm, "Wah" the grin. */
  const mood = line ? moodOf(line.text) : "neutral";
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
        const res = await fetch("/api/uncle/turn", {
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
            data.error ?? "Uncle lost his train of thought. Try that again.",
          );

        homelander.patchProfile(data.patch);
        const keys = filledKeys(data.patch);
        if (keys.length) {
          setFresh(new Set(keys));
          window.setTimeout(() => setFresh(new Set()), 2600);
        }
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
            : "Uncle lost his train of thought. Try that again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [soundOn],
  );

  // Uncle opens the conversation.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ask([]);
  }, [ask]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [messages]);

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
    setMessages(history); // show it right away; Uncle's reply is appended when it arrives
    void ask(history);
  }

  const mic = useWhisperMic({
    onText: (t) => send(t),
    onUnavailable: () => {
      setWhisper(false);
      toast("Uncle's using the browser's own ears for now.", {
        description: "Add GROQ_API_KEY to use Whisper.",
      });
    },
    onError: (m) => toast.error(m),
  });

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
          "Mic is blocked. Allow it in the browser, or type to Uncle.",
        );
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function finish() {
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="grid min-w-0 content-start gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-pixel text-3xl leading-tight font-bold sm:text-4xl">
              Sit with Uncle
            </h1>
            <p className="text-ink-soft">
              A few minutes of kopi talk about your life, so we only show homes
              that fit. Speak or type, in any language.
            </p>
          </div>
          <PixTag tone="lilac">{whisper ? "Whisper voice" : "Browser voice"}</PixTag>
        </div>

        <PixPanel className="grid gap-7 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-5">
          <div className="grid justify-items-center gap-2">
            <div className="rounded-xl bg-cloud p-3">
              <UnclePortrait speaking={speaking} mood={mood} scale={6} />
            </div>
            <div className="flex items-center gap-1.5">
              <PixTag tone="ink">Uncle</PixTag>
              {mood !== "neutral" ? (
                <PixTag tone={moodTag[mood].tone}>{moodTag[mood].text}</PixTag>
              ) : (
                <PixTag>{speaking ? "Talking" : busy ? "Thinking" : "Listening"}</PixTag>
              )}
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
              className="min-h-[5.5rem] font-pixel text-lg leading-snug"
              aria-live="polite"
            >
              {line ? (
                <Typewriter key={line.n} text={line.text} />
              ) : busy ? (
                <span className="text-ink-soft">
                  Uncle is pulling up a chair…
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

        <PixPanel className="grid gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <PixButton
              tone={listening || mic.state === "recording" ? "raya" : "pandan"}
              size="lg"
              disabled={
                (whisper ? mic.state === "transcribing" : !canListen) || busy
              }
              onClick={talk}
              aria-pressed={listening || mic.state === "recording"}
            >
              <Sprite art="mic" scale={3} />
              {mic.state === "recording"
                ? "Recording… tap to send"
                : mic.state === "transcribing"
                  ? "Uncle is listening…"
                  : listening
                    ? "Listening… tap to stop"
                    : busy
                      ? "Uncle is thinking"
                      : "Talk to Uncle"}
            </PixButton>
            {whisper ? (
              <p className="text-sm text-ink-soft">
                Speak any mix of English, BM, 中文 or தமிழ். Uncle follows.
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
              This browser can&apos;t listen. Type to Uncle instead; Chrome or
              Edge can listen.
            </p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="say" className="sr-only">
              Type to Uncle
            </label>
            <input
              id="say"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or type here, e.g. My wife and I, planning a kid next year"
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
        </PixPanel>

        {messages.length ? (
          <PixPanel className="grid gap-2 p-4 sm:p-5">
            <h2 className="font-pixel text-lg font-bold">Conversation</h2>
            <ol
              ref={logRef}
              className="grid max-h-72 gap-2 overflow-y-auto text-sm"
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
                    {m.role === "assistant" ? "Uncle: " : "You: "}
                  </span>
                  {m.content}
                </li>
              ))}
            </ol>
          </PixPanel>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-24">
        <ProfilePanel profile={profile} fresh={fresh} onDone={finish} />
      </div>
    </div>
  );
}
