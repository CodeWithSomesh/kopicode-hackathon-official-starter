"use client";

import { PixMeter, PixPanel, PixTag } from "@/components/homelander/pixel";
import { cn } from "@/lib/utils";
import { ongVerdict, type Note, type Tone } from "./fengshui";

type Props = {
  notes: Note[];
  score: number;
  /** Label of each floor id, shown on notes from another floor. */
  floorLabel: (id: string) => string;
  currentFloor: string;
  onPick: (note: Note) => void;
};

const toneTag: Record<
  Tone,
  { tone: "raya" | "kaya" | "pandan"; word: string }
> = {
  fix: { tone: "raya", word: "Fix" },
  watch: { tone: "kaya", word: "Watch" },
  good: { tone: "pandan", word: "Good" },
};

export function FengShuiPanel({
  notes,
  score,
  floorLabel,
  currentFloor,
  onPick,
}: Props) {
  const verdict = ongVerdict(score);
  const problems = notes.filter((n) => n.tone !== "good").length;

  return (
    <PixPanel className="grid gap-4 p-4">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-pixel text-lg font-bold">Ong meter</h2>
          <div className="flex items-center gap-2" aria-live="polite">
            <span className="font-pixel text-2xl font-bold tabular-nums">
              {score}
            </span>
            <PixTag tone={verdict.tone}>{verdict.word}</PixTag>
          </div>
        </div>
        <PixMeter
          value={score}
          tone={verdict.tone}
          label={`Ong meter ${score} out of 100`}
        />
        <p className="text-xs text-ink-soft">
          {problems === 0
            ? "Nothing to fix. Move things around and watch the score."
            : `${problems} ${problems === 1 ? "thing" : "things"} to look at. Tap a note to find it on the plan.`}
        </p>
      </div>

      <ul className="grid gap-2">
        {notes.map((n) => {
          const t = toneTag[n.tone];
          const otherFloor = n.floor !== currentFloor;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onPick(n)}
                className={cn(
                  "grid w-full gap-1 border-2 border-ink p-2.5 text-left hover:bg-cloud",
                  n.tone === "fix" ? "bg-white" : "bg-white/70",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <PixTag tone={t.tone}>{t.word}</PixTag>
                  {otherFloor ? (
                    <span className="text-xs text-ink-soft">
                      {floorLabel(n.floor)}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-semibold">{n.title}</span>
                <span className="text-xs text-ink-soft">{n.detail}</span>
                {n.fix ? (
                  <span className="text-xs">
                    <span className="font-semibold">Try: </span>
                    {n.fix}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </PixPanel>
  );
}
