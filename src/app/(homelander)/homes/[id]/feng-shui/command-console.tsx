"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PixPanel } from "@/components/homelander/pixel";
import { cn } from "@/lib/utils";
import type { Lang, Reply } from "./commands";

/** One language run of what the buyer said; Chinese runs carry pinyin. */
export type SaidSegment = { text: string; lang: string; pinyin: string | null };

export type LogEntry = {
  id: number;
  said: string;
  /** What they said split by language, when it has Chinese in it: shown with pinyin. */
  display?: SaidSegment[];
  replies: Reply[];
  /** Commands the AI turned the request into, when the quick parser couldn't read it. */
  heard?: string[];
  /** The AI's own reply, shown when it's in a language the toggle doesn't cover (中文, தமிழ்). */
  aiReply?: { text: string; lang: string };
  /** A notice about the AI or voice, e.g. "log in to use AI". */
  note?: { en: string; mg: string };
};

type Props = {
  log: LogEntry[];
  lang: Lang;
  onLang: (l: Lang) => void;
  onRun: (text: string) => void;
  /** Extra control inside the input row, e.g. the mic button. */
  extra?: ReactNode;
  /** A row above the input, e.g. spoken language and read-aloud. */
  toolbar?: ReactNode;
  busy?: boolean;
};

const CHIPS = [
  "panas tak?",
  "letak pokok kat ruang tamu",
  "alih sofa kiri 1",
  "turn the bed",
  "buang cermin",
  "hadap utara",
  "pukul 9 pagi",
  "tutup langsir",
  "ong tak?",
  "show bagua",
  "mula semula",
];

export function CommandConsole({
  log,
  lang,
  onLang,
  onRun,
  extra,
  toolbar,
  busy,
}: Props) {
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [log]);

  const submit = (value: string) => {
    if (!value.trim() || busy) return;
    onRun(value.trim());
    setText("");
  };

  return (
    <PixPanel tone="ink" className="grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-pixel text-lg font-bold">Cakap je</h2>
        <div
          className="flex items-center gap-1 text-xs"
          role="group"
          aria-label="Reply language"
        >
          <span className="mr-1 text-white/70">Reply in</span>
          {(
            [
              ["mg", "Manglish"],
              ["en", "English"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={lang === v}
              onClick={() => onLang(v)}
              className={cn(
                "border-2 border-white/80 px-2 py-0.5 font-semibold",
                lang === v
                  ? "bg-white text-ink"
                  : "text-white hover:bg-white/10",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={box}
        className="grid max-h-56 min-h-24 content-start gap-2 overflow-y-auto border-2 border-white/30 p-3 text-sm"
        aria-live="polite"
        aria-label="Conversation"
      >
        {log.length === 0 ? (
          <p className="text-white/70">
            {lang === "mg"
              ? "Taip arahan, atau tekan contoh di bawah."
              : "Type a command, or tap an example below."}
          </p>
        ) : (
          log.map((e) => (
            <div key={e.id} className="grid gap-0.5">
              <p className="font-semibold">
                <span className="text-white/60" aria-hidden="true">
                  &gt;{" "}
                </span>
                {e.display ? (
                  <Said segments={e.display} raw={e.said} />
                ) : (
                  e.said
                )}
              </p>
              {e.heard?.length ? (
                <p className="pl-4 text-xs text-white/60">
                  {lang === "mg" ? "Faham sebagai" : "Understood as"}:{" "}
                  {e.heard.join(" · ")}
                </p>
              ) : null}
              {e.aiReply ? (
                <p className="pl-4 text-white" lang={e.aiReply.lang}>
                  {e.aiReply.text}
                </p>
              ) : null}
              {e.replies.map((r, i) => (
                <p
                  key={i}
                  className={cn("pl-4", r.ok ? "text-white/85" : "text-kaya")}
                >
                  {r[lang]}
                </p>
              ))}
              {e.note ? (
                <p className="pl-4 text-xs text-kaya">{e.note[lang]}</p>
              ) : null}
            </div>
          ))
        )}
      </div>

      {toolbar}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="fs-cmd" className="sr-only">
          Command
        </label>
        <input
          id="fs-cmd"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          maxLength={400}
          placeholder={
            lang === "mg"
              ? "alih sofa kiri 1 lepas tu pusing dia"
              : "move the sofa left 1 m then turn it"
          }
          className="min-w-0 flex-1 border-2 border-white bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70"
        />
        {extra}
        <button
          type="submit"
          disabled={busy}
          className="border-2 border-white bg-kaya px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
        >
          {busy ? "..." : "Jalan"}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => submit(c)}
            className="border-2 border-white/50 px-2 py-0.5 text-xs text-white hover:border-white hover:bg-white/10"
          >
            {c}
          </button>
        ))}
      </div>
    </PixPanel>
  );
}

/**
 * The buyer's words with Chinese written in characters and its pinyin above, e.g. a mixed
 * "tolong move the 沙发 to the left". The raw transcript stays available to screen readers.
 */
function Said({ segments, raw }: { segments: SaidSegment[]; raw: string }) {
  return (
    <span title={raw}>
      {segments.map((seg, i) => (
        <span key={i}>
          {i > 0 ? " " : null}
          {seg.lang === "zh" && seg.pinyin ? (
            <ruby lang="zh-Hans" className="text-base">
              {seg.text}
              <rp>(</rp>
              <rt
                lang="zh-Latn-pinyin"
                className="text-[10px] font-normal text-white/70"
              >
                {seg.pinyin}
              </rt>
              <rp>)</rp>
            </ruby>
          ) : (
            <span
              lang={
                seg.lang === "ms"
                  ? "ms"
                  : seg.lang === "ta"
                    ? "ta"
                    : seg.lang === "zh"
                      ? "zh-Hans"
                      : "en"
              }
            >
              {seg.text}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
