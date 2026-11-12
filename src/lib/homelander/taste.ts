import { anchorOptions, driveMinutes, nearestStation, rmShort, townshipById, unitById, type Unit } from "./data";

/** Plain-language read of what the swipes say. Needs at least 3 swipes to say anything. */
export function tasteInsights(likedIds: string[], passedIds: string[], anchorId: string) {
  const liked = likedIds.map((id) => unitById[id]).filter(Boolean) as Unit[];
  const passed = passedIds.map((id) => unitById[id]).filter(Boolean) as Unit[];
  const out: string[] = [];
  if (liked.length + passed.length < 3) return out;

  const landedLiked = liked.filter((u) => u.landed).length;
  const landedPassed = passed.filter((u) => u.landed).length;
  if (liked.length >= 2 && landedLiked === liked.length && landedPassed < passed.length) {
    out.push("You only say yes to landed homes. Condos and serviced apartments keep getting a no.");
  } else if (liked.length >= 2 && landedLiked === 0) {
    out.push("You're a high-rise person: every yes so far is a condo or serviced apartment.");
  }

  if (liked.length >= 2) {
    const prices = liked.map((u) => u.priceRM).sort((a, b) => a - b);
    out.push(`Your yeses sit between ${rmShort(prices[0]!)} and ${rmShort(prices.at(-1)!)}.`);
  }

  const anchor = anchorOptions.find((a) => a.id === anchorId) ?? anchorOptions[0]!;
  const minutes = (u: Unit) => driveMinutes(townshipById[u.townshipId]!.pos, anchor.pos);
  if (liked.length >= 1 && passed.length >= 1) {
    const maxLiked = Math.max(...liked.map(minutes));
    const farPasses = passed.filter((u) => minutes(u) > maxLiked).length;
    if (farPasses >= 2) {
      out.push(
        `Nothing over ${maxLiked} min from ${anchor.name} by car got a yes. ${farPasses} homes further out got a no.`,
      );
    }
  }

  const railLiked = liked.filter((u) => nearestStation(townshipById[u.townshipId]!.pos).km <= 2.5).length;
  if (liked.length >= 2 && railLiked / liked.length >= 0.75) {
    out.push("Rail matters to you: most of your yeses are within 2.5 km of a station.");
  }

  return out;
}
