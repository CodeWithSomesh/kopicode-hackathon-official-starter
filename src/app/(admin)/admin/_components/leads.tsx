"use client";

import { useState, useSyncExternalStore } from "react";
import { DownloadIcon } from "lucide-react";
import { townshipById } from "@/lib/homelander/data";
import { leadStatuses, SAMPLE_NOW_MS, type LeadStatus } from "@/lib/homelander/demand";
import { householdGross, incomeBandOf, leadsCsv, num, pct, pipelineCounts, rmCompact, type LeadRow } from "@/lib/homelander/admin-metrics";
import { painPointShort, worriesOf } from "@/lib/homelander/profile";
import { realUnits } from "@/lib/homelander/recommend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Empty, LiveBadge, Section } from "./kit";

/* ---------------------------------------------------------------- status changes (this browser only) */

const KEY = "homelander:admin:lead-status";
const empty: Record<string, LeadStatus> = {};
let cached: { raw: string | null; value: Record<string, LeadStatus> } = { raw: null, value: empty };
const listeners = new Set<() => void>();

function read(): Record<string, LeadStatus> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cached.value;
  }
  if (raw === cached.raw) return cached.value;
  let value = empty;
  try {
    value = raw ? (JSON.parse(raw) as Record<string, LeadStatus>) : empty;
  } catch {
    value = empty;
  }
  cached = { raw, value };
  return value;
}

export function useLeadStatus() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => empty,
  );
  const set = (id: string, status: LeadStatus) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: status }));
    } catch {
      // Storage blocked: the change lasts until reload.
      cached = { raw: cached.raw, value: { ...cached.value, [id]: status } };
    }
    listeners.forEach((l) => l());
  };
  return [value, set] as const;
}

/* ---------------------------------------------------------------- CSV */

export function downloadLeadsCsv(rows: LeadRow[]) {
  const blob = new Blob(["﻿" + leadsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `homelander-leads-${new Date().toLocaleDateString("en-CA")}.csv`; // local date, YYYY-MM-DD
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- UI */

const statusTone: Record<LeadStatus, string> = {
  New: "bg-[color-mix(in_oklch,var(--chart-1)_14%,transparent)] text-[var(--chart-1)]",
  Contacted: "bg-[color-mix(in_oklch,var(--chart-3)_18%,transparent)] text-foreground",
  Viewing: "bg-[color-mix(in_oklch,var(--chart-2)_18%,transparent)] text-foreground",
  Booked: "bg-[color-mix(in_oklch,var(--good)_16%,transparent)] text-[var(--good)]",
};

function VerdictBadge({ v }: { v: string | undefined }) {
  if (v === "likely") return <Badge variant="success">Likely</Badge>;
  if (v === "borderline") return <Badge variant="warning">Borderline</Badge>;
  if (v === "unlikely") return <Badge className="border-transparent bg-[color-mix(in_oklch,var(--bad)_14%,transparent)] text-[var(--bad)]">Unlikely</Badge>;
  return <Badge variant="outline">Not checked</Badge>;
}

function ago(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function Leads({ rows, now, onStatus }: { rows: LeadRow[]; now: number; onStatus: (id: string, s: LeadStatus) => void }) {
  const [all, setAll] = useState(false);
  const counts = pipelineCounts(rows);
  const total = rows.length;
  const visible = all ? rows : rows.slice(0, 12);
  const fresh = rows.filter((r) => r.status === "New" && (r.session.bank?.bestVerdict === "likely" || r.session.live));
  const hot = fresh.filter((r) => r.lead.score >= 75).length;
  return (
    <Section
      id="leads"
      title="Leads"
      purpose="Buyers who asked for a viewing, best first for follow-up, with their bank verdict so sales can see who is pre-qualified. Live leads from this browser sit on top."
      audience="sales"
      actions={
        <Button variant="outline" size="sm" onClick={() => downloadLeadsCsv(rows)} disabled={!total}>
          <DownloadIcon aria-hidden />
          Export CSV
        </Button>
      }
      takeaway={
        total ? (
          <>
            <strong>{num(fresh.length)}</strong> bank-likely or live {fresh.length === 1 ? "lead is" : "leads are"} still <strong>New</strong>
            {hot ? <>, {hot} of them scoring 75+</> : null}. Call them within 24 hours: {pct(counts[3]!.n / (total || 1))} of leads in this view have already booked.
          </>
        ) : undefined
      }
    >
      {!total ? (
        <Empty>No leads for this filter yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4" aria-label="Lead pipeline">
            {counts.map((c, i) => (
              <li key={c.status} className="grid gap-1 bg-card p-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">{i + 1}</span>
                  {c.status}
                </span>
                <span className="text-xl font-semibold tabular-nums">{num(c.n)}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(c.n / total) * 100}%`, opacity: 0.45 + i * 0.18 }} />
                </span>
              </li>
            ))}
          </ol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Household</TableHead>
                <TableHead>Best bank verdict</TableHead>
                <TableHead className="text-right">Max loan</TableHead>
                <TableHead>Target home</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const u = realUnits.find((x) => x.id === r.lead.targetUnitId);
                const s = r.session;
                const loan = s.bank?.maxLoanRM || s.maxLoanRM || 0;
                return (
                  <TableRow key={`${s.id}-${r.lead.id}`} className={cn(s.live && "bg-[color-mix(in_oklch,var(--live)_7%,transparent)]")}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {r.lead.name}
                        {s.live ? <LiveBadge /> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.lead.id}</div>
                    </TableCell>
                    <TableCell>
                      <div>{s.household}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.buyerType} · {incomeBandOf(householdGross(s))}
                      </div>
                      {worriesOf(s.profile)[0] ? <div className="text-xs text-muted-foreground">Worried about {painPointShort[worriesOf(s.profile)[0]!].toLowerCase()}</div> : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <VerdictBadge v={s.bank?.bestVerdict} />
                        <span className="text-xs text-muted-foreground">{s.bank?.bestBank && s.bank.bestBank !== "—" ? s.bank.bestBank : ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{loan ? rmCompact(loan) : "–"}</TableCell>
                    <TableCell>
                      <div className="max-w-[15rem] truncate">{u?.name ?? r.lead.targetUnitId}</div>
                      <div className="text-xs text-muted-foreground">{u ? `${townshipById[u.townshipId]!.name} · ${rmCompact(u.priceRM)}` : ""}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                          r.lead.score >= 75 ? "bg-[color-mix(in_oklch,var(--good)_16%,transparent)] text-[var(--good)]" : r.lead.score >= 55 ? "bg-muted" : "text-muted-foreground",
                        )}
                      >
                        {r.lead.score}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{ago((s.live ? now : SAMPLE_NOW_MS) - r.lead.at)}</TableCell>
                    <TableCell>
                      <label className="sr-only" htmlFor={`st-${s.id}-${r.lead.id}`}>
                        Status for {r.lead.name}
                      </label>
                      <select
                        id={`st-${s.id}-${r.lead.id}`}
                        value={r.status}
                        onChange={(e) => onStatus(r.lead.id, e.target.value as LeadStatus)}
                        className={cn("h-7 cursor-pointer rounded-md border-0 px-2 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", statusTone[r.status])}
                      >
                        {leadStatuses.map((st) => (
                          <option key={st} value={st} className="bg-popover text-popover-foreground">
                            {st}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length > 12 ? (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setAll((x) => !x)}>
                {all ? "Show fewer" : `Show all ${num(rows.length)} leads`}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Lead score (0–100): best bank verdict 40, match score 30, buying timeline 20, savings 10. Status changes are saved in this browser only. Sample buyer names are fictional.
          </p>
        </div>
      )}
    </Section>
  );
}
