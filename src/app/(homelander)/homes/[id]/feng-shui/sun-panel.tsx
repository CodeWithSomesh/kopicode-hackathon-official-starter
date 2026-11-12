"use client";

import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { useLang, useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import type { Room } from "./plans";
import { FACINGS, MONTHS, timeLabel } from "./sun";

type Props = {
  facing: number;
  onFacing: (deg: number) => void;
  time: number;
  onTime: (t: number) => void;
  month: number;
  onMonth: (m: number) => void;
  /** Living-room sun share every half hour, 7 am to 7 pm. */
  strip: { time: number; share: number }[];
  sunnyHours: number;
  /** Rooms on the current floor in direct sun right now. */
  sunnyRooms: { room: Room; share: number }[];
  windowRooms: Room[];
  curtains: ReadonlySet<string>;
  onCurtain: (roomId: string) => void;
};

/** Which way the home faces, when, and where the sun lands: the controls and their result in one card. */
export function SunPanel(p: Props) {
  const t = useT();
  const lang = useLang();
  const facing = FACINGS.find((f) => f.deg === p.facing)!;
  // Manglish leads with the Malay compass word, English leads otherwise.
  const facingName = (f: (typeof FACINGS)[number]) => (lang === "mglish" ? `${f.malay} (${f.name})` : `${f.name} (${f.malay})`);
  const month = t(MONTHS[p.month - 1]);

  return (
    <PixPanel className="grid gap-4 p-4">
      <h2 className="font-pixel text-lg font-bold">{t("Sun and facing")}</h2>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">
          {t("Front faces")}{" "}
          <span className="font-pixel">{lang === "mglish" ? facing.malay : facing.name}</span>{" "}
          <span className="font-normal text-ink-soft">({lang === "mglish" ? facing.name : facing.malay})</span>
        </legend>
        <div className="grid grid-cols-8 gap-1">
          {FACINGS.map((f) => (
            <button
              key={f.deg}
              type="button"
              aria-pressed={f.deg === p.facing}
              aria-label={facingName(f)}
              onClick={() => p.onFacing(f.deg)}
              className={cn(
                "border-2 border-ink py-1 font-pixel text-xs font-bold",
                f.deg === p.facing
                  ? "bg-ink text-white"
                  : "bg-white text-ink hover:bg-cloud",
              )}
            >
              {f.short}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          {t("The top of the plan is the front of the home.")}
        </p>
      </fieldset>

      <div className="grid gap-1.5">
        <label
          htmlFor="fs-time"
          className="flex items-baseline justify-between text-sm font-semibold"
        >
          {t("Time")} <span className="font-pixel">{timeLabel(p.time)}</span>
        </label>
        <input
          id="fs-time"
          type="range"
          min={7}
          max={19}
          step={0.25}
          value={p.time}
          onChange={(e) => p.onTime(Number(e.target.value))}
          className="w-full accent-pandan"
        />
        {/* The living room's sun across the same 7 am to 7 pm axis as the slider above. */}
        <div className="flex h-5 gap-[2px] bg-ink p-[2px]" aria-hidden="true">
          {p.strip.map((s) => (
            <span
              key={s.time}
              title={`${timeLabel(s.time)}: ${Math.round(s.share * 100)}%`}
              className={cn(
                "flex-1",
                s.share >= 0.2
                  ? "bg-raya"
                  : s.share >= 0.05
                    ? "bg-kaya"
                    : "bg-cloud",
                p.time >= s.time &&
                  p.time < s.time + 0.5 &&
                  "outline-2 outline-white",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          {p.sunnyHours === 0
            ? t("Living room: no direct sun all day in {month}.", { month })
            : p.sunnyHours === 1
              ? t("Living room: about {n} hour of direct sun in {month}.", { n: p.sunnyHours, month })
              : t("Living room: about {n} hours of direct sun in {month}.", { n: p.sunnyHours, month })}
        </p>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" id="fs-month-label">
          {t("Month")}
        </span>
        <div
          className="grid grid-cols-6 gap-1"
          role="group"
          aria-labelledby="fs-month-label"
        >
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={p.month === i + 1}
              onClick={() => p.onMonth(i + 1)}
              className={cn(
                "border-2 border-ink py-0.5 text-xs font-semibold",
                p.month === i + 1
                  ? "bg-ink text-white"
                  : "bg-white text-ink hover:bg-cloud",
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 border-t-2 border-cloud pt-3">
        <p className="text-sm">
          <span className="font-semibold">{t("In sun now:")} </span>
          {p.sunnyRooms.length ? (
            p.sunnyRooms.map(({ room, share }, i) => (
              <span key={room.id}>
                {i ? " · " : ""}
                {t(room.label)}{" "}
                <span className="font-pixel">{Math.round(share * 100)}%</span>
              </span>
            ))
          ) : (
            <span className="text-ink-soft">{t("no room on this floor")}</span>
          )}
        </p>
        {p.windowRooms.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">
              {t("Curtains:")}
            </span>
            {p.windowRooms.map((r) => (
              <PixButton
                key={r.id}
                size="sm"
                tone={p.curtains.has(r.id) ? "pandan" : "white"}
                aria-pressed={p.curtains.has(r.id)}
                onClick={() => p.onCurtain(r.id)}
              >
                {t(r.label)}
              </PixButton>
            ))}
          </div>
        ) : null}
      </div>
    </PixPanel>
  );
}
