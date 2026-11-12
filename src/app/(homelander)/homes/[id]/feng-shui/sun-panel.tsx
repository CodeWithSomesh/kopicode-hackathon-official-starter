"use client";

import { PixButton, PixPanel } from "@/components/homelander/pixel";
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
  const facing = FACINGS.find((f) => f.deg === p.facing)!;

  return (
    <PixPanel className="grid gap-4 p-4">
      <h2 className="font-pixel text-lg font-bold">Sun and facing</h2>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">
          Front faces <span className="font-pixel">{facing.name}</span>{" "}
          <span className="font-normal text-ink-soft">({facing.malay})</span>
        </legend>
        <div className="grid grid-cols-8 gap-1">
          {FACINGS.map((f) => (
            <button
              key={f.deg}
              type="button"
              aria-pressed={f.deg === p.facing}
              aria-label={`${f.name} (${f.malay})`}
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
          The top of the plan is the front of the home.
        </p>
      </fieldset>

      <div className="grid gap-1.5">
        <label
          htmlFor="fs-time"
          className="flex items-baseline justify-between text-sm font-semibold"
        >
          Time <span className="font-pixel">{timeLabel(p.time)}</span>
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
            ? `Living room: no direct sun all day in ${MONTHS[p.month - 1]}.`
            : `Living room: about ${p.sunnyHours} ${p.sunnyHours === 1 ? "hour" : "hours"} of direct sun in ${MONTHS[p.month - 1]}.`}
        </p>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold" id="fs-month-label">
          Month
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
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 border-t-2 border-cloud pt-3">
        <p className="text-sm">
          <span className="font-semibold">In sun now: </span>
          {p.sunnyRooms.length ? (
            p.sunnyRooms.map(({ room, share }, i) => (
              <span key={room.id}>
                {i ? " · " : ""}
                {room.label}{" "}
                <span className="font-pixel">{Math.round(share * 100)}%</span>
              </span>
            ))
          ) : (
            <span className="text-ink-soft">no room on this floor</span>
          )}
        </p>
        {p.windowRooms.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">
              Curtains:
            </span>
            {p.windowRooms.map((r) => (
              <PixButton
                key={r.id}
                size="sm"
                tone={p.curtains.has(r.id) ? "pandan" : "white"}
                aria-pressed={p.curtains.has(r.id)}
                onClick={() => p.onCurtain(r.id)}
              >
                {r.label}
              </PixButton>
            ))}
          </div>
        ) : null}
      </div>
    </PixPanel>
  );
}
