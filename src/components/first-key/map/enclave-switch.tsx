"use client";

/** Towers / landed enclave: the enclave is 580 m from the tower row, so the township view does not show it. */
export function EnclaveSwitch({ onTowers, onEnclave }: { onTowers: () => void; onEnclave: () => void }) {
  return (
    <div className="absolute bottom-[120px] left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-card p-1 text-xs font-semibold text-card-foreground shadow-md ring-1 ring-border lg:bottom-6">
      <button type="button" onClick={onTowers} className="rounded-full px-3 py-1.5 hover:bg-muted">
        Towers
      </button>
      <button type="button" onClick={onEnclave} className="rounded-full px-3 py-1.5 hover:bg-muted">
        Landed enclave (illustrative)
      </button>
    </div>
  );
}
