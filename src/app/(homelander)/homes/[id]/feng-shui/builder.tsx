"use client";

import { useMemo, useState } from "react";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { cn } from "@/lib/utils";
import { PlanCanvas } from "./plan-canvas";
import { planBounds, plans, type Plan } from "./plans";
import {
  FACINGS,
  MONTHS,
  bearingLabel,
  dayStrip,
  heatOf,
  sunAt,
  sunPatches,
  sunShare,
  timeLabel,
  type Heat,
} from "./sun";

type Props = { planId: Plan["id"]; lat: number; lng: number };

const heatTag: Record<Heat["level"], { tone: "pandan" | "kaya" | "raya"; word: string }> = {
  cool: { tone: "pandan", word: "Cool" },
  warm: { tone: "kaya", word: "Warm" },
  hot: { tone: "raya", word: "Hot" },
};

export function FengShuiBuilder({ planId, lat, lng }: Props) {
  const plan = plans[planId];
  const bounds = useMemo(() => planBounds(plan), [plan]);

  const [floorIdx, setFloorIdx] = useState(0);
  // West-facing at 5 pm in June: the classic "afternoon sun bakes the living room" case.
  const [facing, setFacing] = useState(270);
  const [time, setTime] = useState(17);
  const [month, setMonth] = useState(6);
  const [curtains, setCurtains] = useState<ReadonlySet<string>>(new Set());

  const floor = plan.floors[floorIdx];
  const livingFloor = plan.floors.find((f) => f.rooms.some((r) => r.kind === "living")) ?? plan.floors[0];
  const living = livingFloor.rooms.find((r) => r.kind === "living")!;

  const sun = useMemo(() => sunAt({ lat, lng, month, time, facing }), [lat, lng, month, time, facing]);
  const patches = useMemo(() => sunPatches(floor, sun, curtains), [floor, sun, curtains]);
  const livingHeat = useMemo(
    () => heatOf(sunShare(living, sunPatches(livingFloor, sun, curtains))),
    [living, livingFloor, sun, curtains],
  );
  const strip = useMemo(
    () => dayStrip(livingFloor, living.id, { lat, lng, month, facing }, curtains),
    [livingFloor, living.id, lat, lng, month, facing, curtains],
  );

  const sunnyRooms = floor.rooms
    .filter((r) => r.kind !== "outdoor")
    .map((r) => ({ room: r, share: sunShare(r, patches) }))
    .filter((x) => x.share > 0.005)
    .sort((a, b) => b.share - a.share);

  const windowRooms = [...new Set(floor.windows.map((w) => w.room))].map(
    (id) => floor.rooms.find((r) => r.id === id)!,
  );

  const toggleCurtain = (id: string) =>
    setCurtains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const facingName = FACINGS.find((f) => f.deg === facing)!;
  const tag = heatTag[livingHeat.level];
  const sunnyHours = strip.filter((s) => s.share >= 0.05).length / 2;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <PixPanel className="grid min-w-0 gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Floor">
            {plan.floors.map((f, i) => (
              <PixButton
                key={f.id}
                size="sm"
                role="tab"
                aria-selected={i === floorIdx}
                tone={i === floorIdx ? "ink" : "white"}
                onClick={() => setFloorIdx(i)}
              >
                {f.label}
              </PixButton>
            ))}
          </div>
          <PixTag tone="lilac">{plan.label}</PixTag>
        </div>

        <PlanCanvas
          floor={floor}
          bounds={bounds}
          patches={patches}
          sun={sun}
          facing={facing}
          className="h-[58vh] min-h-[380px] w-full lg:h-[68vh]"
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Stat label="Time" value={`${timeLabel(time)}, ${MONTHS[month - 1]}`} />
          <Stat
            label="Sun"
            value={sun.up ? `${bearingLabel(sun.azimuth)}, ${Math.round(sun.elevation)}°` : "Below horizon"}
          />
          <Stat label="Living room in sun" value={`${Math.round(livingHeat.share * 100)}%`} />
          <div className="grid gap-1">
            <dt className="text-xs text-ink-soft">Feels</dt>
            <dd>
              <PixTag tone={tag.tone}>{tag.word}</PixTag>
            </dd>
          </div>
        </dl>
      </PixPanel>

      <div className="grid min-w-0 gap-4">
        <PixPanel className="grid gap-4 p-4">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">
              Front faces <span className="font-pixel">{facingName.name}</span>{" "}
              <span className="text-ink-soft">({facingName.malay})</span>
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {FACINGS.map((f) => (
                <PixButton
                  key={f.deg}
                  size="sm"
                  tone={f.deg === facing ? "ink" : "white"}
                  aria-pressed={f.deg === facing}
                  aria-label={`${f.name} (${f.malay})`}
                  onClick={() => setFacing(f.deg)}
                  className="font-pixel"
                >
                  {f.short}
                </PixButton>
              ))}
            </div>
            <p className="text-xs text-ink-soft">The top of the plan is the front of the home.</p>
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="fs-time" className="flex items-baseline justify-between text-sm font-semibold">
              Time of day <span className="font-pixel">{timeLabel(time)}</span>
            </label>
            <input
              id="fs-time"
              type="range"
              min={7}
              max={19}
              step={0.25}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="w-full accent-pandan"
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-semibold" id="fs-month-label">
              Month
            </span>
            <div className="grid grid-cols-6 gap-1.5" role="group" aria-labelledby="fs-month-label">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={month === i + 1}
                  onClick={() => setMonth(i + 1)}
                  className={cn(
                    "border-2 border-ink py-1 text-xs font-semibold",
                    month === i + 1 ? "bg-ink text-white" : "bg-white text-ink hover:bg-cloud",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </PixPanel>

        <PixPanel className="grid gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-pixel text-lg font-bold">Living room sun, 7 am to 7 pm</h2>
          </div>
          <div className="flex h-8 gap-[2px] bg-ink p-[2px]" aria-hidden="true">
            {strip.map((s) => (
              <span
                key={s.time}
                title={`${timeLabel(s.time)}: ${Math.round(s.share * 100)}%`}
                className={cn(
                  "flex-1",
                  s.share >= 0.2 ? "bg-raya" : s.share >= 0.05 ? "bg-kaya" : "bg-cloud",
                  time >= s.time && time < s.time + 0.5 && "outline-2 outline-white",
                )}
              />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-ink-soft" aria-hidden="true">
            <span>7 am</span>
            <span>1 pm</span>
            <span>7 pm</span>
          </div>
          <p className="text-sm">
            {sunnyHours === 0
              ? "No direct sun on the living room floor this month. Cool all day."
              : `About ${sunnyHours} ${sunnyHours === 1 ? "hour" : "hours"} of direct sun on the living room floor in ${MONTHS[month - 1]}.`}
          </p>
        </PixPanel>

        <PixPanel className="grid gap-3 p-4">
          <h2 className="font-pixel text-lg font-bold">{floor.label}: sun now</h2>
          {sunnyRooms.length ? (
            <ul className="grid gap-1 text-sm">
              {sunnyRooms.map(({ room, share }) => (
                <li key={room.id} className="flex justify-between">
                  <span>{room.label}</span>
                  <span className="font-pixel">{Math.round(share * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No direct sun on this floor right now.</p>
          )}
          {windowRooms.length > 0 && (
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Curtains</span>
              <div className="flex flex-wrap gap-2">
                {windowRooms.map((r) => (
                  <PixButton
                    key={r.id}
                    size="sm"
                    tone={curtains.has(r.id) ? "pandan" : "white"}
                    aria-pressed={curtains.has(r.id)}
                    onClick={() => toggleCurtain(r.id)}
                  >
                    {r.label}
                  </PixButton>
                ))}
              </div>
            </div>
          )}
        </PixPanel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-pixel text-sm font-semibold">{value}</dd>
    </div>
  );
}
