"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
import {
  PixButton,
  PixMeter,
  PixPanel,
  PixTag,
} from "@/components/homelander/pixel";
import { cn } from "@/lib/utils";
import { isFixable } from "./autofix";
import { ongVerdict, type Note } from "./fengshui";

type Props = {
  notes: Note[];
  score: number;
  /** Label of each floor id, shown on notes from another floor. */
  floorLabel: (id: string) => string;
  currentFloor: string;
  onPick: (note: Note) => void;
  onFix: (note: Note) => void;
  onFixAll: () => void;
};

/**
 * The Ong meter and what to do about it. Problems show their title and suggestion; tapping
 * one finds it on the plan and opens the reason and a Fix button. Good notes fold into one
 * line, since they need no action.
 */
export function FengShuiPanel({
  notes,
  score,
  floorLabel,
  currentFloor,
  onPick,
  onFix,
  onFixAll,
}: Props) {
  const verdict = ongVerdict(score);
  const [open, setOpen] = useState<string | null>(null);
  const problems = notes.filter((n) => n.tone !== "good");
  const good = notes.filter((n) => n.tone === "good");
  const fixable = problems.filter(isFixable).length;

  return (
    <PixPanel className="grid gap-3 p-4">
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

      {problems.length ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-soft">
            {problems.length} {problems.length === 1 ? "thing" : "things"} to
            look at
          </p>
          {fixable > 0 ? (
            <PixButton size="sm" onClick={onFixAll}>
              <Wand2 className="size-4" aria-hidden="true" /> Fix all
            </PixButton>
          ) : null}
        </div>
      ) : (
        <p className="text-sm">
          Nothing to fix. Move things around and watch the score.
        </p>
      )}

      {problems.length ? (
        <ul className="grid gap-1.5">
          {problems.map((n) => {
            const isOpen = open === n.id;
            return (
              <li
                key={n.id}
                className={cn(
                  "border-2 border-ink",
                  isOpen ? "bg-cloud" : "bg-white",
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : n.id);
                    if (!isOpen) onPick(n);
                  }}
                  className="grid w-full gap-1 p-2.5 text-left hover:bg-cloud"
                >
                  <span className="flex items-start gap-2">
                    <PixTag
                      tone={n.tone === "fix" ? "raya" : "kaya"}
                      className="mt-0.5 shrink-0"
                    >
                      {n.tone === "fix" ? "Fix" : "Watch"}
                    </PixTag>
                    <span className="text-sm font-semibold">
                      {n.title}
                      {n.floor !== currentFloor ? (
                        <span className="font-normal text-ink-soft">
                          {" "}
                          · {floorLabel(n.floor)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {n.fix ? (
                    <span className="text-xs text-ink-soft">{n.fix}</span>
                  ) : null}
                </button>
                {isOpen ? (
                  <div className="grid gap-2 px-2.5 pb-2.5">
                    <p className="text-xs">{n.detail}</p>
                    {isFixable(n) ? (
                      <PixButton
                        size="sm"
                        tone="ink"
                        className="justify-self-start"
                        onClick={() => onFix(n)}
                      >
                        <Wand2 className="size-4" aria-hidden="true" /> Fix it
                        for me
                      </PixButton>
                    ) : (
                      <p className="text-xs text-ink-soft">
                        Built into the plan, so moving furniture can&apos;t fix
                        it.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {good.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-ink">
            {good.length} {good.length === 1 ? "thing is" : "things are"} good
          </summary>
          <ul className="mt-2 grid gap-1">
            {good.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onPick(n)}
                  className="flex w-full items-start gap-2 text-left text-xs hover:underline"
                >
                  <PixTag tone="pandan" className="shrink-0">
                    Good
                  </PixTag>
                  <span>{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </PixPanel>
  );
}
