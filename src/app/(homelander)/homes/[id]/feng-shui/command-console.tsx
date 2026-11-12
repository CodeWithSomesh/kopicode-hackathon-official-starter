"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PixPanel } from "@/components/homelander/pixel";
import { translate } from "@/lib/homelander/i18n/translate";
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
  /** The AI's own reply, shown when it's in a language the header switch doesn't cover (中文, தமிழ்). */
  aiReply?: { text: string; lang: string };
  /** A notice about the AI or voice, e.g. "log in to use AI". */
  note?: { en: string; mg: string };
};

type Props = {
  log: LogEntry[];
  /** Reply language, from the header's EN | Manglish switch. */
  lang: Lang;
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
  "betulkan",
  "fix all",
  "mula semula",
];

export function CommandConsole({
  log,
  lang,
  onRun,
  extra,
  toolbar,
  busy,
}: Props) {
  // Replies follow the EN | Manglish switch in the header (lang comes from useLang in builder.tsx).
  const t = (en: string) => translate(lang === "mg" ? "mglish" : "en", en);
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
    <PixPanel
      tone="ink"
      // A dark board in every theme. Dark themes flip ink to cream, so take their near-black
      // "on light" colour there instead; light themes don't define it and keep the ink fill.
      style={
        { "--pix-fill": "var(--j-on-light, var(--color-ink))" } as CSSProperties
      }
      className="grid gap-3 p-4"
    >
      <h2 className="font-pixel text-lg font-bold">{t("Talk to it")}</h2>

      <div
        ref={box}
        className="grid max-h-56 min-h-24 content-start gap-2 overflow-y-auto border-2 border-current/30 p-3 text-sm"
        aria-live="polite"
        aria-label={t("Conversation")}
      >
        {log.length === 0 ? (
          <p className="text-white opacity-75">
            {t("Type a command, or tap an example below.")}
          </p>
        ) : (
          log.map((e) => (
            <div key={e.id} className="grid gap-0.5">
              <p className="font-semibold">
                <span className="text-white opacity-75" aria-hidden="true">
                  &gt;{" "}
                </span>
                {e.display ? (
                  <Said segments={e.display} raw={e.said} />
                ) : (
                  e.said
                )}
              </p>
              {e.heard?.length ? (
                <p className="pl-4 text-xs text-white opacity-75">
                  {t("Understood as")}:{" "}
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
                  className={cn("pl-4", r.ok ? "text-white" : "text-kaya")}
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
          {t("Command")}
        </label>
        <input
          id="fs-cmd"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          maxLength={400}
          placeholder={t("move the sofa left 1 m then turn it")}
          className="min-w-0 flex-1 border-2 border-current bg-white px-3 py-2 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-soft)]"
        />
        {extra}
        <button
          type="submit"
          disabled={busy}
          className="border-2 border-white bg-kaya px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
        >
          {busy ? "..." : t("Go")}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => submit(c)}
            className="border-2 border-current/50 px-2 py-0.5 text-xs text-white hover:border-current hover:bg-current/10"
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
                className="text-[10px] font-normal text-white opacity-75"
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
