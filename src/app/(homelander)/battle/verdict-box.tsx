import Link from "next/link";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import type { Battle } from "@/lib/homelander/analysis";
import { caret } from "./bits";

/** RPG dialog box: HomeLander announces the winner, says why, and owns up to the catches. */
export function VerdictBox({ battle }: { battle: Battle }) {
  const { winner, runnerUp, reasons, caveats, closeCall } = battle;
  return (
    <section aria-labelledby="verdict-title" aria-live="polite" className="relative pt-4">
      <PixTag tone="ink" className="absolute top-0 left-4 z-10 px-2 py-1 text-xs">
        HomeLander says
      </PixTag>
      <PixPanel className="grid gap-4 p-5 pt-6 sm:grid-cols-[auto_1fr] sm:gap-5">
        <div className="hidden size-20 items-center justify-center bg-raya/15 sm:flex" aria-hidden>
          <Sprite art="heart" scale={7} className="animate-[pix-bob_1s_steps(2)_infinite] text-raya" />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="verdict-title" className="font-pixel text-2xl leading-tight lg:text-3xl">
              {winner.unit.name} wins!
            </h2>
            {runnerUp ? (
              <p className="text-ink-soft tabular-nums">
                {closeCall
                  ? `Close fight: ${winner.overall} vs ${runnerUp.overall} over ${runnerUp.unit.name}. Nudge the weights and it could flip.`
                  : `${winner.overall} vs ${runnerUp.overall} over ${runnerUp.unit.name}, on the weights you picked.`}
              </p>
            ) : null}
          </div>

          <ul className="grid gap-2">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-2.5">
                <Sprite art="star" scale={2} className="mt-1 shrink-0 text-kaya-deep" />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          {caveats.length ? (
            <div className="grid gap-2 border-t-[3px] border-dotted border-ink/30 pt-3">
              <h3 className="font-pixel text-lg leading-none">But check this first</h3>
              <ul className="grid gap-1.5 text-sm">
                {caveats.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-raya" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PixButton asChild tone="kaya">
              <Link href="/onboarding">
                <Sprite art="uncle" scale={2} />
                Ask Uncle
              </Link>
            </PixButton>
            <PixButton asChild>
              <Link href="/bank">
                <Sprite art="bank" scale={2} />
                Check bank
              </Link>
            </PixButton>
            <p className="text-xs text-ink-soft">Estimates on sample units, not a loan offer.</p>
            <Sprite
              art={caret}
              scale={2}
              className="ml-auto hidden animate-[pix-blink_1s_steps(1)_infinite] text-ink sm:block"
            />
          </div>
        </div>
      </PixPanel>
    </section>
  );
}
