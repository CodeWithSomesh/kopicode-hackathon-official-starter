"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite, defineSprite } from "@/components/homelander/sprite";
import {
  MicDeniedError,
  agoraStatus,
  joinLiveCall,
  startAgoraSession,
  stopAgoraAgent,
  type LiveCall,
  type LiveTranscript,
} from "@/lib/homelander/agora-client";
import {
  matchOption,
  uncleAcks,
  uncleIntro,
  uncleQuestions,
  uncleVerdictLine,
  type UncleOption,
} from "@/lib/homelander/agora-uncle";
import { unitById, type Unit } from "@/lib/homelander/data";
import { homelander, useHomeLander, type Answers } from "@/lib/homelander/store";
import { scoreShortlist, verdictReasons } from "@/lib/homelander/verdict";
import { cn } from "@/lib/utils";
import { hush, recognitionCtor, speak, type Recognition } from "./browser-voice";
import { Typewriter } from "./typewriter";
import { UnclePortrait } from "./uncle-portrait";
import { VerdictPanel } from "./verdict-panel";

const SAMPLE_SHORTLIST = ["gardens-t1", "highpark-c", "jade-t1"];

type Engine = "checking" | "agora" | "browser";
type LiveState = "off" | "connecting" | "live";
type Line = { id: string; who: "agent" | "you" | "note"; text: string };

const caret = defineSprite(["#####", ".###.", "..#.."]);

/** Which homes Uncle judges: the Battle picks, else the liked homes, else a labelled sample. */
function useShortlist() {
  const s = useHomeLander();
  return useMemo(() => {
    const known = (ids: string[]) => ids.filter((id) => unitById[id]);
    const compare = known(s.compare);
    if (compare.length) return { ids: compare, source: "Your Battle picks" };
    const liked = known(s.liked).slice(-5);
    if (liked.length) return { ids: liked, source: "Your liked homes" };
    return { ids: SAMPLE_SHORTLIST, source: "Sample shortlist (like some homes to use yours)" };
  }, [s.compare, s.liked]);
}

export function RegretTest() {
  const s = useHomeLander();
  const router = useRouter();
  const shortlist = useShortlist();
  const list = useMemo(() => shortlist.ids.map((id) => unitById[id]!) as Unit[], [shortlist.ids]);

  const [engine, setEngine] = useState<Engine>("checking");
  const [live, setLive] = useState<LiveState>("off");
  const [micMuted, setMicMuted] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Answers>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [dialog, setDialog] = useState<{ id: string; text: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);

  const callRef = useRef<LiveCall | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const counter = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Which engine: the live Agora agent when the server has keys, else the browser's own voice.
  useEffect(() => {
    let alive = true;
    agoraStatus().then((ok) => {
      if (!alive) return;
      setEngine(ok ? "agora" : "browser");
      setCanListen(Boolean(recognitionCtor()));
    });
    return () => {
      alive = false;
    };
  }, []);

  const hangUp = useCallback(() => {
    const call = callRef.current;
    const agentId = agentIdRef.current;
    callRef.current = null;
    agentIdRef.current = null;
    if (call) void call.leave();
    if (agentId) void stopAgoraAgent(agentId);
    setLive("off");
    setSpeaking(false);
  }, []);

  // Leaving the page: stop talking, stop listening, take Uncle out of the channel.
  useEffect(() => {
    const onHide = () => {
      if (agentIdRef.current) void stopAgoraAgent(agentIdRef.current);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      hush();
      recRef.current?.abort();
      hangUp();
    };
  }, [hangUp]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const nextId = () => `l${++counter.current}`;

  const addLine = useCallback((line: Omit<Line, "id">) => {
    setLines((prev) => [...prev, { ...line, id: `l${++counter.current}` }]);
  }, []);

  /** Uncle says a line: dialog box + transcript, and out loud in the demo voice. */
  const say = useCallback(
    (text: string, opts: { aloud: boolean }) => {
      const id = `d${++counter.current}`;
      setDialog({ id, text });
      setLines((prev) => [...prev, { id, who: "agent", text }]);
      if (opts.aloud) {
        speak(text, { start: () => setSpeaking(true), end: () => setSpeaking(false) });
      }
    },
    [],
  );

  const onTranscript = useCallback((t: LiveTranscript) => {
    const id = `live-${t.who}-${t.turn}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const line: Line = { id, who: t.who, text: t.text };
      if (i === -1) return [...prev, line];
      const next = prev.slice();
      next[i] = line;
      return next;
    });
    if (t.who === "agent") setDialog({ id: `${id}-d`, text: t.text });
  }, []);

  async function goLive() {
    setLive("connecting");
    let agentId: string | null = null;
    try {
      const session = await startAgoraSession(shortlist.ids, s.anchorId);
      agentId = session.agentId;
      agentIdRef.current = agentId;
      callRef.current = await joinLiveCall(session, {
        onAgentSpeaking: setSpeaking,
        onAgentPresent: (present) => {
          if (!present) addLine({ who: "note", text: "Uncle left the call." });
        },
        onTranscript,
      });
      setMicMuted(false);
      setLive("live");
      addLine({ who: "note", text: "Live call with Uncle. Talk to him, and tap your answer so the scores keep up." });
      return true;
    } catch (e) {
      if (agentId) void stopAgoraAgent(agentId);
      agentIdRef.current = null;
      callRef.current = null;
      setLive("off");
      setEngine("browser");
      toast.error(
        e instanceof MicDeniedError
          ? "Uncle can't hear you: the mic is blocked. Using the demo voice; tap your answers or allow the mic and reload."
          : "Couldn't reach live Uncle. Using the demo voice for now.",
      );
      return false;
    }
  }

  async function start() {
    hush();
    recRef.current?.abort();
    setDraft({});
    setStep(0);
    setLines([]);
    const opening = `${uncleIntro(list.length)} ${uncleQuestions[0]!.line}`;

    if (engine === "agora" && live === "off") {
      setDialog({ id: nextId(), text: "Calling Uncle..." });
      const ok = await goLive();
      if (ok) {
        // Live Uncle greets and asks out loud; the dialog box keeps the question on screen.
        setDialog({ id: nextId(), text: uncleQuestions[0]!.line });
        return;
      }
    } else if (engine === "agora" && live === "live") {
      setDialog({ id: nextId(), text: uncleQuestions[0]!.line });
      addLine({ who: "note", text: "Starting over. Tell Uncle, and tap your answers." });
      return;
    }
    say(opening, { aloud: true });
  }

  function choose(option: UncleOption, heard?: string) {
    if (step === null) return;
    const q = uncleQuestions[step]!;
    const next = { ...draft, [q.key]: option.value } as Partial<Answers>;
    setDraft(next);
    addLine({ who: "you", text: heard ? `"${heard}"` : option.label });
    const isLive = live === "live";

    if (step + 1 < uncleQuestions.length) {
      setStep(step + 1);
      const line = `${uncleAcks[step % uncleAcks.length]} ${uncleQuestions[step + 1]!.line}`;
      if (isLive) setDialog({ id: nextId(), text: uncleQuestions[step + 1]!.line });
      else say(line, { aloud: true });
      return;
    }

    const final = next as Answers;
    homelander.answer(final);
    setStep(null);
    const scored = scoreShortlist(list, final, s.anchorId, Boolean(s.budget));
    const line = uncleVerdictLine(scored[0]!.unit.name, verdictReasons(scored)[0]);
    if (isLive) setDialog({ id: nextId(), text: line });
    else say(line, { aloud: true });
  }

  function listen() {
    if (step === null) return;
    const Ctor = recognitionCtor();
    if (!Ctor) {
      toast("Voice input isn't available in this browser. Tap an answer instead.");
      return;
    }
    if (listening) {
      recRef.current?.abort();
      return;
    }
    hush();
    setSpeaking(false);
    const rec = new Ctor();
    recRef.current = rec;
    // en-MY copes with Manglish; BM words are matched from the transcript.
    rec.lang = "en-MY";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    const q = uncleQuestions[step]!;
    rec.onresult = (e) => {
      const alts = Array.from(e.results[0] ?? []).map((a) => a.transcript);
      const said = alts[0] ?? "";
      const hit = alts.map((a) => matchOption(q, a)).find(Boolean);
      if (hit) choose(hit, said);
      else toast(`Uncle heard "${said}". Try again, or tap an answer.`);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("The mic is blocked. Tap your answers instead, or allow the mic in your browser.");
        setCanListen(false);
      }
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function toggleMic() {
    const call = callRef.current;
    if (!call) return;
    await call.setMicMuted(!micMuted);
    setMicMuted(!micMuted);
  }

  const running = step !== null;
  const q = running ? uncleQuestions[step] : null;
  const answeredKeys = running ? Object.keys(draft) : s.answers ? uncleQuestions.map((x) => x.key) : [];
  const verdictAnswers = running ? null : s.answers;
  const isLive = live === "live";

  const micLabel = isLive
    ? micMuted
      ? "Unmute your mic"
      : "Mute your mic"
    : listening
      ? "Stop listening"
      : "Answer Uncle by voice";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
      {/* Left: Uncle, dialog, controls */}
      <section aria-labelledby="uncle-title" className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="uncle-title" className="font-pixel text-3xl leading-none font-bold lg:text-4xl">
            The Regret Test
          </h1>
          <EngineTag engine={engine} live={live} />
        </div>

        <PixPanel tone="sky" className="relative grid gap-0 overflow-hidden p-0">
          <div className="relative flex items-end justify-center bg-sky-deep px-4 pt-6 pb-0">
            <div className="absolute inset-x-0 bottom-0 h-6 bg-pandan" aria-hidden />
            <div className="absolute inset-x-0 bottom-6 h-[3px] bg-pandan-deep" aria-hidden />
            <UnclePortrait speaking={speaking} scale={9} className="relative mb-3 lg:hidden" />
            <UnclePortrait speaking={speaking} scale={12} className="relative mb-3 hidden lg:block" />
          </div>

          {/* RPG dialog box */}
          <div className="relative m-3 mt-4 border-[3px] border-ink bg-white p-4 pt-5">
            <PixTag tone="ink" className="absolute -top-3 left-3">
              Uncle
            </PixTag>
            <p className="min-h-[4.5rem] font-pixel text-lg leading-snug lg:min-h-[5.5rem] lg:text-xl" aria-live="polite">
              {dialog ? (
                <Typewriter key={dialog.id} text={dialog.text} />
              ) : (
                <>
                  Eh, you came! Sit, sit. Uncle got five questions about the next five years of your life. Answer
                  honestly ah, then I tell you which rumah you won&apos;t regret.
                </>
              )}
            </p>
            {!running && dialog === null ? null : (
              <Sprite
                art={caret}
                scale={3}
                className="absolute right-3 bottom-2 animate-[pix-blink_0.9s_steps(1)_infinite] text-ink"
              />
            )}
          </div>
        </PixPanel>

        <Pips step={step} answered={answeredKeys} />

        {/* Controls */}
        {running && q ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <PixButton
                tone={(isLive && !micMuted) || listening ? "raya" : "white"}
                aria-label={micLabel}
                aria-pressed={isLive ? !micMuted : listening}
                disabled={live === "connecting" || (!isLive && !canListen)}
                onClick={isLive ? toggleMic : listen}
                className={cn("size-20 shrink-0", listening && "animate-[pix-bob_0.6s_steps(2)_infinite]")}
              >
                <Sprite art="mic" scale={5} />
              </PixButton>
              <p className="text-sm leading-snug text-ink-soft">
                {isLive
                  ? micMuted
                    ? "Your mic is muted. Tap to talk to Uncle again."
                    : "Uncle can hear you. Talk normally, then tap your answer below."
                  : live === "connecting"
                    ? "Calling Uncle..."
                    : canListen
                      ? listening
                        ? "Listening. Say it in English or BM."
                        : "Tap the mic and answer out loud, or tap a chip."
                      : "Voice input isn't available here. Tap your answer."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3" role="group" aria-label={`Answers: ${q.short}`}>
              {q.options.map((o) => (
                <PixButton key={String(o.value)} tone="kaya" onClick={() => choose(o)} disabled={live === "connecting"}>
                  {o.label}
                </PixButton>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <PixButton tone="pandan" size="lg" onClick={start} disabled={engine === "checking" || live === "connecting"}>
              <Sprite art="speaker" scale={3} />
              {s.answers ? "Ask Uncle again" : engine === "agora" ? "Call Uncle" : "Sit with Uncle"}
            </PixButton>
            {isLive ? (
              <PixButton tone="white" onClick={hangUp}>
                Hang up
              </PixButton>
            ) : (
              <p className="text-sm text-ink-soft">Five questions, about a minute. Sound on.</p>
            )}
          </div>
        )}
        {running && isLive ? (
          <div>
            <PixButton tone="white" size="sm" onClick={hangUp}>
              Hang up
            </PixButton>
          </div>
        ) : null}
      </section>

      {/* Right: shortlist, verdict, transcript */}
      <div className="grid gap-6">
        <PixPanel flat className="grid gap-2 p-4">
          <h2 className="font-pixel text-lg leading-none">Homes on the table</h2>
          <p className="text-sm text-ink-soft">{shortlist.source}. Sample data.</p>
          <ul className="flex flex-wrap gap-2">
            {list.map((u) => (
              <li key={u.id} className="flex items-center gap-1.5 border-2 border-ink bg-cloud px-2 py-1 text-sm">
                <Sprite art="house" scale={2} className="text-ink-soft" />
                {u.name}
              </li>
            ))}
          </ul>
        </PixPanel>

        <VerdictPanel
          list={list}
          answers={verdictAnswers}
          answeredCount={answeredKeys.length}
          onBooked={() => router.push("/admin")}
        />

        <PixPanel className="grid gap-3 p-4">
          <h2 className="font-pixel text-lg leading-none">Transcript</h2>
          <div
            ref={logRef}
            role="log"
            aria-label="Conversation with Uncle"
            className="grid max-h-72 content-start gap-2 overflow-y-auto pr-1"
          >
            {lines.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing yet. Start the test and the chat shows up here.</p>
            ) : (
              lines.map((l) =>
                l.who === "note" ? (
                  <p key={l.id} className="text-xs text-ink-soft">
                    {l.text}
                  </p>
                ) : (
                  <p
                    key={l.id}
                    className={cn(
                      "max-w-[88%] border-2 border-ink px-3 py-2 text-[15px] leading-snug",
                      l.who === "agent" ? "justify-self-start bg-cloud" : "justify-self-end bg-kaya",
                    )}
                  >
                    <span className="sr-only">{l.who === "agent" ? "Uncle: " : "You: "}</span>
                    {l.text}
                  </p>
                ),
              )
            )}
          </div>
        </PixPanel>
      </div>
    </div>
  );
}

function EngineTag({ engine, live }: { engine: Engine; live: LiveState }) {
  if (engine === "checking") return <PixTag tone="white">Checking voice</PixTag>;
  if (engine === "agora")
    return (
      <PixTag tone="pandan" title="Agora Conversational AI Engine">
        <Sprite art="speaker" scale={1.5} />
        {live === "live" ? "Live Agora agent: on call" : "Live Agora agent"}
      </PixTag>
    );
  return (
    <PixTag tone="kaya" title="Agora isn't configured, so Uncle uses your browser's voice">
      <Sprite art="speaker" scale={1.5} />
      Demo voice (browser)
    </PixTag>
  );
}

function Pips({ step, answered }: { step: number | null; answered: string[] }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`${answered.length} of 5 questions answered`}>
      {uncleQuestions.map((q, i) => {
        const done = answered.includes(q.key);
        const current = step === i;
        return (
          <li key={q.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "h-4 w-full border-[3px] border-ink",
                done ? "bg-pandan" : current ? "bg-kaya" : "bg-white",
              )}
            />
            <span className={cn("font-pixel-label text-[10px] uppercase", current ? "text-ink" : "text-ink-soft")}>
              {q.short}
              <span className="sr-only">{done ? ", answered" : current ? ", now" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
