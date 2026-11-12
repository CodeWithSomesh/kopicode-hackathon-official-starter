"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { availabilityOf, rmShort, townshipById, unitById, type Anchor } from "@/lib/homelander/data";
import { BATTLE_MAX, DECK_LIKE_LIMIT, LIKES_TO_BATTLE } from "@/lib/homelander/recommend";
import { homelander, type HomeLanderState } from "@/lib/homelander/store";
import { tasteInsights } from "@/lib/homelander/taste";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { statusTone, stockLabel } from "./stock";
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

function PanelTitle({ children, aside, id }: { children: React.ReactNode; aside?: React.ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="font-pixel text-xl leading-none">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** Availability filter, and the workplace every commute is worked out from (only ever the buyer's own). */
export function Controls({
  filter,
  onFilter,
  counts,
  work,
  workSaid,
}: {
  filter: StockFilter;
  onFilter: (f: StockFilter) => void;
  counts: Record<StockFilter, number>;
  /** The workplace Mochi heard in onboarding, matched to one of our commute anchors. */
  work: { anchor: Anchor; said: string } | null;
  /** What the buyer said, even when we couldn't place it. */
  workSaid?: string;
}) {
  const t = useT();
  return (
    <PixPanel className="grid gap-4 p-4">
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 font-pixel text-xl leading-none">{t("Show me")}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(filterLabels) as StockFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-semibold transition-colors",
                filter === f ? "bg-ink text-white" : "bg-white text-ink hover:bg-cloud",
              )}
            >
              {t(filterLabels[f])}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  filter === f ? "bg-white/20" : "bg-cloud",
                )}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-soft">{t("Counts are homes you haven't swiped yet. Stock is sample data.")}</p>
      </fieldset>

      <div className="grid gap-1.5 border-t-2 border-dashed border-ink/15 pt-4">
        {work ? (
          <>
            <p className="font-pixel text-lg leading-none">{t("You work near {name}", { name: work.anchor.name })}</p>
            <p className="text-xs text-ink-soft">
              {t("Mochi heard \u201c{said}\u201d. Every commute is worked out from there.", { said: work.said })}{" "}
              <Link href="/profile" className="font-semibold text-pandan-deep underline underline-offset-2">
                {t("Change")}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="font-pixel text-lg leading-none">{t("Tell Mochi where you work")}</p>
            <p className="text-xs text-ink-soft">
              {workSaid ? `${t("Mochi heard \u201c{said}\u201d but can't place it on the map yet.", { said: workSaid })} ` : null}
              {t("Commute times and costs show up once Mochi knows your workplace. We don't guess one.")}{" "}
              <Link href="/onboarding" className="font-semibold text-pandan-deep underline underline-offset-2">
                {t("Tell Mochi")}
              </Link>
            </p>
          </>
        )}
      </div>
    </PixPanel>
  );
}

/** "What your swipes say": taste insights plus a read on how scarce your likes are. */
export function Insights({ s, anchorId }: { s: HomeLanderState; anchorId: string | null }) {
  const t = useT();
  // Commute insights need the buyer's own workplace; without one, leave them out rather than guess.
  const lines = tasteInsights(
    s.liked,
    s.passed.map((p) => p.id),
    anchorId ?? "",
  ).filter((line) => anchorId !== null || !line.includes(" min from "));
  const scarce = s.liked.filter((id) => {
    const st = availabilityOf(id).status;
    return st === "Few left" || st === "Last unit";
  }).length;
  if (scarce >= 1 && s.liked.length + s.passed.length >= 3) {
    lines.push(
      scarce === 1
        ? t("One of your likes is nearly sold out. Book a viewing soon lah.")
        : t("{n} of your likes are nearly sold out. Don't wait too long.", { n: scarce }),
    );
  }
  const reasons = s.passed.map((p) => p.reason).filter(Boolean);
  const top = reasons.length >= 2 ? mostCommon(reasons as string[]) : null;
  if (top) lines.push(t("Your top reason to say pass: \"{reason}\".", { reason: t(top).toLowerCase() }));

  return (
    <PixPanel className="grid gap-3 p-4" aria-labelledby="taste-title">
      <PanelTitle
        id="taste-title"
        aside={
          <div className="flex items-center gap-1.5 text-sm tabular-nums">
            <span className="inline-flex items-center gap-1 rounded-full bg-pandan/15 px-2 py-0.5 font-semibold text-pandan-deep">
              <Sprite art="heart" scale={1.5} />
              {s.liked.length}
              <span className="sr-only"> {t("liked")}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-raya/10 px-2 py-0.5 font-semibold text-raya-deep">
              <Sprite art="cross" scale={1.5} />
              {s.passed.length}
              <span className="sr-only"> {t("passed")}</span>
            </span>
          </div>
        }
      >
        {t("What your swipes say")}
      </PanelTitle>
      {lines.length ? (
        <ul className="grid gap-2">
          {lines.map((line) => (
            <li key={line} className="flex gap-2.5 rounded-xl bg-cloud px-3 py-2 text-[15px] leading-snug">
              <Sprite art="sparkle" scale={2} className="mt-1 shrink-0 text-kaya-deep" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          {t("Swipe three homes and HomeLander starts reading your taste. The more you swipe, the sharper it gets.")}
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

/** `liked` must be ordered best match first: Battle takes the top few. */
export function BattleButton({ liked, className, size = "md" }: { liked: string[]; className?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const t = useT();
  return (
    <PixButton
      type="button"
      tone="kaya"
      size={size}
      className={className}
      disabled={liked.length < LIKES_TO_BATTLE}
      onClick={() => {
        homelander.setCompare(liked.slice(0, BATTLE_MAX));
        router.push("/battle");
      }}
    >
      <Sprite art={swipeSprites.sword} scale={2} />
      {liked.length >= LIKES_TO_BATTLE ? t("Battle your top {n}", { n: Math.min(liked.length, BATTLE_MAX) }) : t("Battle them")}
    </PixButton>
  );
}

/** Likes so far out of the deck limit, with the Battle unlock marked. */
function LikeMeter({ count }: { count: number }) {
  const t = useT();
  return (
    <div className="grid gap-1.5">
      <div
        role="meter"
        aria-label={t("Likes")}
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={DECK_LIKE_LIMIT}
        aria-valuetext={t("{count} of {max} likes", { count, max: DECK_LIKE_LIMIT })}
        className="flex gap-[3px] bg-ink p-[3px]"
      >
        {Array.from({ length: DECK_LIKE_LIMIT }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 flex-1 transition-colors duration-300",
              i < count ? (i < LIKES_TO_BATTLE ? "bg-kaya" : "bg-pandan") : "bg-ink-soft/25",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-ink-soft">
        {count < LIKES_TO_BATTLE
          ? t(LIKES_TO_BATTLE - count === 1 ? "{n} more like to unlock Battle." : "{n} more likes to unlock Battle.", { n: LIKES_TO_BATTLE - count })
          : count >= DECK_LIKE_LIMIT
            ? t("Shortlist full. Battle them, or remove one to keep swiping.")
            : t("Battle unlocked. Room for {n} more.", { n: DECK_LIKE_LIMIT - count })}
      </p>
    </div>
  );
}

/** Liked homes, best match first; the top few are the ones that go into Battle. */
export function Shortlist({ liked, scoreOf }: { liked: string[]; scoreOf: (id: string) => number | undefined }) {
  const t = useT();
  return (
    <PixPanel className="grid gap-3 p-4">
      <PanelTitle aside={<span className="font-pixel text-lg tabular-nums">{liked.length}</span>}>{t("Your shortlist")}</PanelTitle>
      <LikeMeter count={liked.length} />
      {liked.length ? (
        <ol className="grid gap-1">
          {liked.map((id, i) => {
            const u = unitById[id];
            if (!u) return null;
            const a = availabilityOf(id);
            const score = scoreOf(id);
            const inBattle = i < BATTLE_MAX;
            return (
              <li
                key={id}
                className={cn(
                  "flex animate-in items-center gap-3 rounded-xl p-1.5 duration-300 fade-in-0 slide-in-from-right-2 motion-reduce:animate-none",
                  inBattle && liked.length >= LIKES_TO_BATTLE && "bg-kaya/15",
                )}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border-2 border-ink bg-ink">
                  <UnitPhoto photo={u.photo} alt="" fill unoptimized sizes="48px" className="pix-img object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{townshipById[u.townshipId]?.name}</p>
                  <p className="truncate text-xs text-ink-soft tabular-nums">
                    {u.product ?? u.name}, {rmShort(u.priceRM)}
                  </p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  {score !== undefined ? <span className="font-pixel text-sm leading-none tabular-nums">{score}%</span> : null}
                  <PixTag tone={statusTone[a.status]}>{stockLabel(a, t)}</PixTag>
                </div>
                <button
                  type="button"
                  onClick={() => homelander.unlike(id)}
                  aria-label={t("Remove {name} from your shortlist", { name: u.name })}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-raya/15 hover:text-raya-deep"
                >
                  <Sprite art="cross" scale={2} />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-ink-soft">{t("Homes you like land here, best match first.")}</p>
      )}
      <div className="p-1 pb-2">
        <BattleButton liked={liked} className="w-full" />
        {liked.length > BATTLE_MAX ? (
          <p className="mt-3 text-xs text-ink-soft">{t("Battle takes your top {n} by match (highlighted). You can swap them there.", { n: BATTLE_MAX })}</p>
        ) : null}
      </div>
    </PixPanel>
  );
}

/** The deck is empty: the filter hides the rest, the like limit is reached, or every home has been swiped. */
export function EndOfDeck({
  s,
  filtered,
  full,
  onShowAll,
  rankedLikes,
}: {
  s: HomeLanderState;
  filtered: boolean;
  full: boolean;
  onShowAll: () => void;
  /** Liked homes, best match first, for the Battle hand-off. */
  rankedLikes: string[];
}) {
  const t = useT();
  /** How many likes to remove to reopen the deck (more than one only for an older, longer list). */
  const over = s.liked.length - DECK_LIKE_LIMIT + 1;
  if (filtered) {
    return (
      <PixPanel className="grid h-full content-center justify-items-center gap-4 p-6 text-center sm:p-8">
        <Sprite art="house" scale={6} className="text-sky-deep" />
        <h2 className="font-pixel text-2xl leading-tight">{t("Nothing left in this filter")}</h2>
        <p className="max-w-xs text-sm text-ink-soft">{t("There are still homes you haven't seen. Show them all?")}</p>
        <div className="p-1">
          <PixButton type="button" tone="kaya" onClick={onShowAll}>
            {t("Show all homes")}
          </PixButton>
        </div>
      </PixPanel>
    );
  }

  return (
    <PixPanel className="grid h-full content-center justify-items-center gap-4 p-6 text-center sm:p-10">
      <Sprite
        art={swipeSprites.trophy}
        scale={7}
        className="animate-[pix-bob_1.2s_steps(2)_infinite] text-kaya-deep"
        label={t("Trophy")}
      />
      <h2 className="font-pixel text-3xl leading-tight sm:text-4xl">
        {full ? t("{n} liked! Deck closed", { n: DECK_LIKE_LIMIT }) : t("Deck cleared!")}
      </h2>
      {full ? (
        <p className="max-w-sm text-[15px]">
          {over > 1
            ? t("{n} is the sweet spot: a short list gives Mochi a sharper read. Battle them, or remove {over} from your shortlist to keep swiping.", { n: DECK_LIKE_LIMIT, over })
            : t("{n} is the sweet spot: a short list gives Mochi a sharper read. Battle them, or remove one to keep swiping.", { n: DECK_LIKE_LIMIT })}
        </p>
      ) : (
        <p className="max-w-sm text-[15px]">
          {t("You met every Gamuda Land home in the deck and liked")}{" "}
          <strong className="font-pixel text-lg">{s.liked.length}</strong>.{" "}
          {s.liked.length >= LIKES_TO_BATTLE ? t("Time to make them fight it out.") : t("See where they sit on the map next.")}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-4 p-1 pb-2">
        <BattleButton liked={rankedLikes} size="lg" />
        <PixButton asChild size="lg">
          <Link href="/">
            <Sprite art="pin" scale={2} className="text-raya" />
            {t("See the map")}
          </Link>
        </PixButton>
      </div>
      {s.passed.length && !full ? (
        <button
          type="button"
          onClick={() => homelander.demoShortlist(s.liked)}
          className="text-sm text-ink underline decoration-2 underline-offset-4 hover:text-raya-deep"
        >
          {t("Give the {n} passed homes a second chance", { n: s.passed.length })}
        </button>
      ) : null}
    </PixPanel>
  );
}
