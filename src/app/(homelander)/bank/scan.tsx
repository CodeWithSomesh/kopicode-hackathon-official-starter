"use client";

import { useEffect, useRef, useState } from "react";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { rm, samplePayslip, type Payslip } from "@/lib/homelander/data";
import { cn } from "@/lib/utils";

const rows: { key: keyof Payslip; label: string }[] = [
  { key: "grossRM", label: "Gross salary" },
  { key: "epfRM", label: "EPF (11%)" },
  { key: "socsoRM", label: "SOCSO" },
  { key: "taxRM", label: "PCB tax" },
  { key: "carLoanRM", label: "Car loan deduction" },
  { key: "ptptnRM", label: "PTPTN" },
];

const STEP_MS = 320;

/**
 * Demo OCR: animates "reading" the sample payslip line by line, then hands the figures back.
 * Nothing is uploaded; it always reads the same sample.
 */
export function PayslipScan({ onRead }: { onRead: (p: Payslip) => void }) {
  const [phase, setPhase] = useState<"idle" | "reading" | "done">("idle");
  const [found, setFound] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function scan() {
    timers.current.forEach((t) => window.clearTimeout(t));
    setPhase("reading");
    setFound(0);
    timers.current = rows.map((_, i) => window.setTimeout(() => setFound(i + 1), 400 + i * STEP_MS));
    timers.current.push(
      window.setTimeout(
        () => {
          setPhase("done");
          onRead(samplePayslip);
        },
        400 + rows.length * STEP_MS + 250,
      ),
    );
  }

  const net = samplePayslip.grossRM - samplePayslip.epfRM - samplePayslip.socsoRM - samplePayslip.taxRM;

  return (
    <div className="grid gap-3">
      <PixButton type="button" tone="kaya" size="lg" onClick={scan} disabled={phase === "reading"} className="w-full">
        {phase === "reading" ? "Reading payslip" : phase === "done" ? "Scan again" : "Scan my payslip"}
        {phase === "reading" ? (
          <span aria-hidden className="animate-[pix-blink_0.8s_steps(1)_infinite]">
            _
          </span>
        ) : null}
      </PixButton>

      {phase !== "idle" ? (
        <PixPanel flat tone="sky" className="relative overflow-hidden px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-ink/30 pb-2">
            <p className="text-sm font-semibold">{samplePayslip.employer}</p>
            <p className="shrink-0 text-xs text-ink-soft">{samplePayslip.month}</p>
          </div>
          <dl className="grid gap-1 pt-2 text-sm">
            {rows.map((r, i) => {
              const lit = phase === "done" || i < found;
              return (
                <div
                  key={r.key}
                  className={cn("flex justify-between gap-4 px-1.5 py-0.5", lit ? "bg-kaya" : "text-ink-soft/40")}
                >
                  <dt>{r.label}</dt>
                  <dd className="tabular-nums">{lit ? rm(samplePayslip[r.key] as number) : "RM ----"}</dd>
                </div>
              );
            })}
          </dl>
          {phase === "reading" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-full animate-[homelander-scan_1.6s_steps(16)_infinite]"
            >
              <div className="h-1 w-full bg-pandan" />
              <div className="h-2 w-full bg-pandan/25" />
            </div>
          ) : null}
          <p className="pt-2 text-xs text-ink-soft" aria-live="polite">
            {phase === "done"
              ? `Read: take-home ${rm(net)} after EPF, SOCSO and PCB. Car loan and PTPTN added to what you owe.`
              : "Sample payslip. In the real app it is read on your phone and never stored."}
          </p>
        </PixPanel>
      ) : null}
    </div>
  );
}
