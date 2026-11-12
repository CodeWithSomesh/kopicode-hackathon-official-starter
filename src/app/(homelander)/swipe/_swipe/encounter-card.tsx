import { UnitPhoto } from "@/components/homelander/unit-photo";
import { PixTag } from "@/components/homelander/pixel";
import type { Pick } from "@/lib/homelander/recommend";
import { Sprite, type SpriteArt } from "@/components/homelander/sprite";
import {
  availabilityOf,
  driveMinutes,
  rm,
  townshipById,
  transitMinutes,
  type Anchor,
  type Availability,
  type Unit,
} from "@/lib/homelander/data";
import { cn } from "@/lib/utils";
import { swipeSprites } from "./sprites";

export const THRESHOLD = 110;

export const statusTone = {
  Available: "pandan",
  "Few left": "kaya",
  "Last unit": "raya",
  "Sold out": "ink",
} as const satisfies Record<Availability["status"], string>;

/** Stamp opacity in quarter steps, so it pops in like a sprite rather than fading. */
const stepped = (v: number) => Math.round(Math.min(Math.max(v, 0), 1) * 4) / 4;

/** One encounter: a unit, its availability, and the commute from the buyer's work anchor. */
export function EncounterCard({ unit, anchor, drag, pick }: { unit: Unit; anchor: Anchor; drag: number; pick?: Pick }) {
  const t = townshipById[unit.townshipId]!;
  const a = availabilityOf(unit.id);
  const sold = a.status === "Sold out";
  const drive = driveMinutes(t.pos, anchor.pos);
  const transit = transitMinutes(t.pos, anchor.pos);
  const yes = stepped(drag / THRESHOLD);
  const no = stepped(-drag / THRESHOLD);

  return (
    <>
      <div className="relative aspect-[16/11] overflow-hidden border-b-[3px] border-ink bg-ink sm:aspect-[16/10] lg:aspect-auto lg:min-h-[400px] lg:border-r-[3px] lg:border-b-0">
        <UnitPhoto
          photo={unit.photo}
          alt={unit.photoAlt}
          fill
          unoptimized
          draggable={false}
          sizes="(min-width: 1024px) 410px, 100vw"
          className={cn("pix-img pointer-events-none object-cover", sold && "grayscale-[0.7]")}
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <PixTag tone={statusTone[a.status]}>{a.status}</PixTag>
        </div>

        {sold ? (
          <div className="absolute inset-0 grid place-items-center bg-ink/35">
            <span className="-rotate-12 border-4 border-white bg-raya px-4 py-2 font-pixel text-4xl leading-none font-bold tracking-wider text-white shadow-[6px_6px_0_0_var(--color-ink)] sm:text-5xl">
              SOLD OUT
            </span>
          </div>
        ) : null}

        <Stamp side="left" opacity={yes} className="text-pandan-deep">
          {sold ? "PING ME" : "SUKA!"}
        </Stamp>
        <Stamp side="right" opacity={no} className="text-raya-deep">
          TAK NAK
        </Stamp>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 className="font-pixel text-2xl leading-tight font-bold sm:text-[1.7rem]">{unit.name}</h2>
            <p className="text-sm text-ink-soft">
              {t.name}, {t.area}
            </p>
          </div>
          <p className="font-pixel text-2xl leading-tight font-bold tabular-nums sm:text-[1.7rem]">{rm(unit.priceRM)}</p>
        </div>

        {pick ? <WhyUncle pick={pick} /> : null}

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm tabular-nums">
          <Stat art={swipeSprites.bed}>{unit.beds} bed</Stat>
          <Stat art={swipeSprites.bath}>{unit.baths} bath</Stat>
          <Stat art={swipeSprites.area}>{unit.builtUpSqft.toLocaleString("en-MY")} sq ft</Stat>
          <li className="text-ink-soft">
            {unit.type}, {unit.tenure.toLowerCase()}
          </li>
        </ul>

        <StockBlock a={a} />

        <div className="grid gap-1.5 border-t-2 border-dashed border-ink/25 pt-3 text-sm tabular-nums">
          <p className="text-ink-soft">Rush hour to {anchor.name}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <p className="flex items-center gap-2">
              <Sprite art={swipeSprites.car} scale={2} className="shrink-0 text-ink" />
              <span>
                <span className="font-pixel text-lg leading-none">{drive}</span> min drive
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Sprite art={swipeSprites.train} scale={2} className="shrink-0 text-ink" />
              <span>
                <span className="font-pixel text-lg leading-none">{transit.minutes}</span> min by rail from{" "}
                {transit.station}
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const fitTag: Record<Pick["fit"], { tone: "pandan" | "kaya" | "raya" | "white"; label: string } | null> = {
  in: { tone: "pandan", label: "In budget" },
  stretch: { tone: "kaya", label: "Stretch" },
  over: { tone: "raya", label: "Over budget" },
  unknown: null,
};

/** Why Uncle put this home here: its match score, top reasons and the main catch. */
function WhyUncle({ pick }: { pick: Pick }) {
  const tag = fitTag[pick.fit];
  return (
    <div className="grid gap-1.5 rounded-xl bg-cloud px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel text-base leading-none font-bold tabular-nums">{pick.score}% match</span>
        {tag ? <PixTag tone={tag.tone}>{tag.label}</PixTag> : null}
      </div>
      {pick.reasons.length ? <p>Uncle says: {pick.reasons.slice(0, 2).join(" · ")}</p> : null}
      {pick.catches[0] ? <p className="text-raya-deep">Catch: {pick.catches[0]}</p> : null}
    </div>
  );
}

function Stat({ art, children }: { art: SpriteArt; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Sprite art={art} scale={2} className="shrink-0 text-ink-soft" />
      {children}
    </li>
  );
}

function Stamp({
  side,
  opacity,
  className,
  children,
}: {
  side: "left" | "right";
  opacity: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      style={{ opacity }}
      className={cn(
        "pointer-events-none absolute top-6 border-4 border-current bg-white px-3 py-1 font-pixel text-3xl leading-none font-bold tracking-wider sm:text-4xl",
        side === "left" ? "left-5 -rotate-12" : "right-5 rotate-12",
        className,
      )}
    >
      {children}
    </span>
  );
}

const SEGMENTS = 12;

/** Units left as a segmented stock bar, like an item counter in a shop. */
export function StockBar({ a, className }: { a: Availability; className?: string }) {
  const on = a.left === 0 ? 0 : Math.max(1, Math.round((a.left / Math.max(a.total, 1)) * SEGMENTS));
  const fill = {
    Available: "bg-pandan",
    "Few left": "bg-kaya",
    "Last unit": "bg-raya",
    "Sold out": "bg-raya",
  }[a.status];
  return (
    <div
      role="meter"
      aria-label="Units left"
      aria-valuenow={a.left}
      aria-valuemin={0}
      aria-valuemax={a.total}
      aria-valuetext={`${a.left} of ${a.total} units left`}
      className={cn("flex gap-[3px] bg-ink p-[3px]", className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={cn("h-3.5 flex-1", i < on ? fill : "bg-ink-soft/60")} />
      ))}
    </div>
  );
}

function StockBlock({ a }: { a: Availability }) {
  const sold = a.status === "Sold out";
  return (
    <div className={cn("grid gap-2 border-[3px] border-ink p-3", sold ? "bg-cloud" : "bg-kaya/25")}>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-pixel text-4xl leading-none font-bold tabular-nums",
              a.status === "Last unit" && "text-raya-deep",
            )}
          >
            {a.left}
          </span>
          <span className="text-sm">
            {a.left === 1 ? "unit" : "units"} left of {a.total}
          </span>
        </p>
        <div className="flex flex-col items-end gap-1">
          <PixTag tone="white">{a.phase}</PixTag>
          <span className="font-pixel-label text-[10px] uppercase text-ink-soft">Sample stock</span>
        </div>
      </div>
      <StockBar a={a} />
      <p className="text-sm">
        {sold
          ? "All gone in this phase. Tap the bell and we'll tell you if one comes back."
          : a.status === "Last unit"
            ? "Only one left. Whoever books first gets it lah."
            : a.status === "Few left"
              ? "Going fast. Few left in this phase."
              : "Plenty still on the shelf. Boleh take your time."}
      </p>
    </div>
  );
}
