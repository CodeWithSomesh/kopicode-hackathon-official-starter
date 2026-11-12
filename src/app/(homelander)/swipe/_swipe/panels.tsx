"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { anchorOptions, availabilityOf, rm, townshipById, unitById } from "@/lib/homelander/data";
import { homelander, type HomeLanderState } from "@/lib/homelander/store";
import { tasteInsights } from "@/lib/homelander/taste";
import { cn } from "@/lib/utils";
import { statusTone } from "./encounter-card";
import { swipeSprites } from "./sprites";

export type StockFilter = "all" | "available" | "few";

export const filterLabels: Record<StockFilter, string> = {
  all: "All",
  available: "Available now",
  few: "Few left",
};

export function matchesFilter(unitId: string, f: StockFilter) {
  const { status } = availabilityOf(unitId);
  if (f === "available") return status !== "Sold out";
  if (f === "few") return status === "Few left" || status === "Last unit";
  return true;
}

/** Availability filter and work anchor. */
export function Controls({
  filter,
  onFilter,
  counts,
  anchorId,
  secondAnchorId,
}: {
  filter: StockFilter;
  onFilter: (f: StockFilter) => void;
  counts: Record<StockFilter, number>;
  anchorId: string;
  secondAnchorId: string;
}) {
  return (
    <PixPanel className="grid gap-4 p-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-pixel text-lg leading-none">Show me</legend>
        <div className="flex flex-wrap gap-3 p-1">
          {(Object.keys(filterLabels) as StockFilter[]).map((f) => (
            <PixButton
              key={f}
              type="button"
              size="sm"
              tone={filter === f ? "kaya" : "white"}
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
            >
              {filterLabels[f]}
              <span className="font-pixel-label text-[10px] tabular-nums">{counts[f]}</span>
            </PixButton>
          ))}
        </div>
        <p className="text-xs text-ink-soft">Counts are homes you haven&apos;t swiped yet.</p>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor="work-anchor" className="font-pixel text-lg leading-none">
          Where do you work?
        </label>
        <div className="relative">
          <select
            id="work-anchor"
            value={anchorId}
            onChange={(e) => homelander.anchors(e.target.value, secondAnchorId)}
            className="h-11 w-full appearance-none border-[3px] border-ink bg-white px-3 pr-9 text-base text-ink"
          >
            {anchorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Sprite
            art={{ rows: ["#####", ".###.", "..#.."] }}
            scale={2}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink"
          />
        </div>
        <p className="text-xs text-ink-soft">Every card shows your rush-hour commute from here.</p>
      </div>
    </PixPanel>
  );
}

/** "What your swipes say": taste insights plus a read on how scarce your likes are. */
export function Insights({ s }: { s: HomeLanderState }) {
  const lines = tasteInsights(
    s.liked,
    s.passed.map((p) => p.id),
    s.anchorId,
  );
  const scarce = s.liked.filter((id) => {
    const st = availabilityOf(id).status;
    return st === "Few left" || st === "Last unit";
  }).length;
  if (scarce >= 1 && s.liked.length + s.passed.length >= 3) {
    lines.push(
      scarce === 1
        ? "One of your likes is nearly sold out. Book a viewing soon lah."
        : `${scarce} of your likes are nearly sold out. Don't wait too long.`,
    );
  }
  const reasons = s.passed.map((p) => p.reason).filter(Boolean);
  const top = reasons.length >= 2 ? mostCommon(reasons as string[]) : null;
  if (top) lines.push(`Your top reason to say tak nak: "${top.toLowerCase()}".`);

  return (
    <PixPanel className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="taste-title" className="font-pixel text-xl leading-none">
          What your swipes say
        </h2>
        <div className="flex items-center gap-3 font-pixel text-base tabular-nums">
          <span className="flex items-center gap-1">
            <Sprite art="heart" scale={2} className="text-raya" />
            {s.liked.length}
            <span className="sr-only"> liked</span>
          </span>
          <span className="flex items-center gap-1">
            <Sprite art="cross" scale={2} className="text-ink-soft" />
            {s.passed.length}
            <span className="sr-only"> passed</span>
          </span>
        </div>
      </div>
      {lines.length ? (
        <ul className="grid gap-2.5">
          {lines.map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] leading-snug">
              <Sprite art="sparkle" scale={2} className="mt-1 shrink-0 text-kaya-deep" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          Swipe three homes and HomeLander starts reading your taste. The more you swipe, the sharper it gets.
        </p>
      )}
    </PixPanel>
  );
}

function mostCommon(xs: string[]) {
  const counts = new Map<string, number>();
  xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/** Sets the Battle line-up (up to 3 most recent likes) and goes to /homelander/compare. */
export function BattleButton({ liked, className, size = "md" }: { liked: string[]; className?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const pick = liked.slice(-3);
  return (
    <PixButton
      type="button"
      tone="kaya"
      size={size}
      className={className}
      disabled={liked.length < 2}
      onClick={() => {
        homelander.setCompare(pick);
        router.push("/battle");
      }}
    >
      <Sprite art={swipeSprites.sword} scale={2} />
      Battle them
    </PixButton>
  );
}

export function Shortlist({ liked }: { liked: string[] }) {
  return (
    <PixPanel className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-pixel text-xl leading-none">Your shortlist</h2>
        <span className="font-pixel text-base tabular-nums">{liked.length}</span>
      </div>
      {liked.length ? (
        <ul className="grid gap-2">
          {[...liked].reverse().map((id) => {
            const u = unitById[id];
            if (!u) return null;
            const a = availabilityOf(id);
            return (
              <li key={id} className="flex items-center gap-3 border-b-2 border-dashed border-ink/15 pb-2 last:border-0">
                <span className="relative size-12 shrink-0 border-[3px] border-ink bg-ink">
                  <UnitPhoto photo={u.photo} alt="" fill unoptimized sizes="48px" className="pix-img object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {townshipById[u.townshipId]?.name}, {rm(u.priceRM)}
                  </p>
                </div>
                <PixTag tone={statusTone[a.status]} className="shrink-0">
                  {a.status === "Sold out" ? "Sold out" : `${a.left} left`}
                </PixTag>
                <button
                  type="button"
                  onClick={() => homelander.unlike(id)}
                  aria-label={`Remove ${u.name} from your shortlist`}
                  className="grid size-8 shrink-0 place-items-center text-ink-soft hover:bg-raya/15 hover:text-raya-deep"
                >
                  <Sprite art="cross" scale={2} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Homes you say suka to land here. Like two and you can make them battle.</p>
      )}
      <div className="p-1 pb-2">
        <BattleButton liked={liked} className="w-full" />
        {liked.length === 1 ? (
          <p className="mt-3 text-xs text-ink-soft">One more like and the battle can start.</p>
        ) : liked.length > 3 ? (
          <p className="mt-3 text-xs text-ink-soft">Battles take three at a time, so your three latest likes go in.</p>
        ) : null}
      </div>
    </PixPanel>
  );
}

/** The deck is empty: either the filter hides the rest, or every home has been swiped. */
export function EndOfDeck({
  s,
  filtered,
  onShowAll,
}: {
  s: HomeLanderState;
  filtered: boolean;
  onShowAll: () => void;
}) {
  if (filtered) {
    return (
      <PixPanel className="grid justify-items-center gap-4 p-6 text-center sm:p-8">
        <Sprite art="house" scale={6} className="text-sky-deep" />
        <h2 className="font-pixel text-2xl leading-tight">Nothing left in this filter</h2>
        <p className="max-w-xs text-sm text-ink-soft">There are still homes you haven&apos;t seen. Show them all?</p>
        <div className="p-1">
          <PixButton type="button" tone="kaya" onClick={onShowAll}>
            Show all homes
          </PixButton>
        </div>
      </PixPanel>
    );
  }

  return (
    <PixPanel className="grid justify-items-center gap-4 p-6 text-center sm:p-10">
      <Sprite
        art={swipeSprites.trophy}
        scale={7}
        className="animate-[pix-bob_1.2s_steps(2)_infinite] text-kaya-deep"
        label="Trophy"
      />
      <h2 className="font-pixel text-3xl leading-tight font-bold sm:text-4xl">Habis! Deck cleared</h2>
      <p className="max-w-sm text-[15px]">
        You met every Gamuda Land home in the deck and said suka to{" "}
        <strong className="font-pixel text-lg">{s.liked.length}</strong>.{" "}
        {s.liked.length >= 2 ? "Time to make them fight it out." : "See where they sit on the map next."}
      </p>
      <div className="flex flex-wrap justify-center gap-4 p-1 pb-2">
        <BattleButton liked={s.liked} size="lg" />
        <PixButton asChild size="lg">
          <Link href="/">
            <Sprite art="pin" scale={2} className="text-raya" />
            See the map
          </Link>
        </PixButton>
      </div>
      {s.passed.length ? (
        <button
          type="button"
          onClick={() => homelander.demoShortlist(s.liked)}
          className={cn("text-sm text-ink underline decoration-2 underline-offset-4 hover:text-raya-deep")}
        >
          Give the {s.passed.length} tak-naks a second chance
        </button>
      ) : null}
    </PixPanel>
  );
}
