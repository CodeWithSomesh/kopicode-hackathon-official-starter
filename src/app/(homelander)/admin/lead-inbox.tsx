"use client";

import { PixPanel, PixTag } from "@/components/homelander/pixel";
import { rm, townshipById, unitById } from "@/lib/homelander/data";
import { sampleLeads } from "@/lib/homelander/demand";
import { useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";

const when = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Sample leads plus any viewing requests booked from /homelander in this browser (shown first, marked Live). */
export function LeadInbox() {
  const { leads: live } = useHomeLander();
  const rows = [
    ...live.map((l) => ({ ...l, status: "New" as const, live: true })),
    ...sampleLeads.map((l) => ({ ...l, live: false })),
  ].slice(0, 6);

  return (
    <PixPanel asChild>
      <section aria-labelledby="leads-title" className="grid gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="leads-title" className="font-pixel text-xl font-bold">
            Pre-qualified viewing requests
          </h2>
          <p className="text-xs text-ink-soft tabular-nums">
            {live.length + sampleLeads.length} total · newest first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="py-2 pr-3 font-normal">Buyer</th>
                <th className="py-2 pr-3 font-normal">HomeLander&apos;s pick</th>
                <th className="py-2 pr-3 text-right font-normal">Bank limit</th>
                <th className="py-2 pr-3 font-normal">Why this home</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const u = unitById[l.unitId];
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      "border-t-2 border-ink/15 align-top",
                      l.live && "bg-kaya/40",
                    )}
                  >
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-ink-soft tabular-nums">
                        {when.format(new Date(l.createdAt))}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p>{u?.name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">
                        {u
                          ? `${townshipById[u.townshipId]?.name} · ${rm(u.priceRM)}`
                          : ""}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {l.maxPriceRM ? (
                        rm(l.maxPriceRM)
                      ) : (
                        <span className="text-ink-soft">Not scanned</span>
                      )}
                    </td>
                    <td className="max-w-[22rem] py-2.5 pr-3 text-ink-soft">
                      {l.reasons.slice(0, 2).join(" · ") || "—"}
                    </td>
                    <td className="py-2.5">
                      <PixTag
                        tone={
                          l.live
                            ? "kaya"
                            : l.status === "Viewing booked"
                              ? "pandan"
                              : l.status === "Contacted"
                                ? "lilac"
                                : "white"
                        }
                      >
                        {l.live ? "Live · New" : l.status}
                      </PixTag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PixPanel>
  );
}
