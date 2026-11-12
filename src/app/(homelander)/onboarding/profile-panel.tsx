"use client";

import { PixPanel } from "@/components/homelander/pixel";
import { essentials, missingEssentials, type Profile, type ProfileKey } from "@/lib/homelander/profile";
import { homelander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
type Field =
  | { key: ProfileKey; label: string; kind: "choice"; options: Option[] }
  | { key: ProfileKey; label: string; kind: "yesno" }
  | { key: ProfileKey; label: string; kind: "number"; prefix?: string; suffix?: string; hint?: string }
  | { key: ProfileKey; label: string; kind: "text"; placeholder?: string }
  | { key: ProfileKey; label: string; kind: "tags"; placeholder?: string };

const sections: { title: string; fields: Field[]; show?: (p: Profile) => boolean }[] = [
  {
    title: "Household",
    fields: [
      {
        key: "livingWith",
        label: "Living with",
        kind: "choice",
        options: [
          { value: "alone", label: "Alone" },
          { value: "partner", label: "Partner" },
          { value: "partner_kids", label: "Partner + kids" },
          { value: "parents", label: "Parents" },
          { value: "friends", label: "Friends" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "kidsNow", label: "Kids now", kind: "number" },
      {
        key: "kidsPlanned",
        label: "Kids in the next few years",
        kind: "choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "no", label: "No" },
        ],
      },
      { key: "parentsMovingIn", label: "Parents moving in", kind: "yesno" },
      { key: "pets", label: "Pets", kind: "yesno" },
    ],
  },
  {
    title: "School run",
    show: (p) => p.kidsPlanned !== "no" || (p.kidsNow ?? 0) > 0,
    fields: [
      { key: "schoolMatters", label: "Distance to school matters", kind: "yesno" },
      { key: "schoolMaxKm", label: "Furthest OK", kind: "number", suffix: "km" },
      {
        key: "schoolTransport",
        label: "Getting there",
        kind: "choice",
        options: [
          { value: "drop_off", label: "Drop-off" },
          { value: "school_bus", label: "School bus" },
          { value: "walk", label: "Walk" },
          { value: "other", label: "Other" },
        ],
      },
    ],
  },
  {
    title: "Work and places",
    fields: [
      { key: "workArea", label: "Work is in", kind: "text", placeholder: "e.g. Bangsar South" },
      { key: "officeDays", label: "Office days a week", kind: "number" },
      { key: "partnerWorkArea", label: "Partner works in", kind: "text", placeholder: "Optional" },
      {
        key: "commuteMode",
        label: "Gets around by",
        kind: "choice",
        options: [
          { value: "car", label: "Car" },
          { value: "train", label: "Train" },
          { value: "mixed", label: "Both" },
        ],
      },
      { key: "preferredAreas", label: "Areas you like", kind: "tags", placeholder: "Kajang, Shah Alam" },
      { key: "mustBeNear", label: "Must be near", kind: "tags", placeholder: "MRT, my parents" },
    ],
  },
  {
    title: "The home",
    fields: [
      {
        key: "homeType",
        label: "Type",
        kind: "choice",
        options: [
          { value: "landed", label: "Landed" },
          { value: "high_rise", label: "High-rise" },
          { value: "either", label: "Either" },
        ],
      },
      { key: "minBedrooms", label: "Bedrooms at least", kind: "number" },
      { key: "mustHaves", label: "Must-haves", kind: "tags", placeholder: "Gated, park" },
      { key: "dealBreakers", label: "Deal-breakers", kind: "tags", placeholder: "Leasehold" },
      {
        key: "buyWithin",
        label: "Buying within",
        kind: "choice",
        options: [
          { value: "3m", label: "3 months" },
          { value: "6m", label: "6 months" },
          { value: "1y", label: "A year" },
          { value: "2y_plus", label: "2 years+" },
        ],
      },
      { key: "underConstructionOk", label: "Can wait for a new build", kind: "yesno" },
    ],
  },
  {
    title: "Money",
    fields: [
      { key: "grossRM", label: "Gross salary", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "takeHomeRM", label: "Take-home", kind: "number", prefix: "RM", suffix: "/mo", hint: "Optional, we can estimate it" },
      { key: "otherIncomeRM", label: "Other income", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "joint", label: "Buying with someone", kind: "yesno" },
      { key: "jointGrossRM", label: "Their gross salary", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "carRM", label: "Car loan", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "ptptnRM", label: "PTPTN", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "personalRM", label: "Personal loan", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "housingRM", label: "Other home loan", kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "cardBalanceRM", label: "Credit card balance", kind: "number", prefix: "RM" },
      { key: "savingsRM", label: "Savings for down payment", kind: "number", prefix: "RM" },
      { key: "firstHome", label: "First home", kind: "yesno" },
      { key: "age", label: "Age", kind: "number" },
    ],
  },
];

const inputCls =
  "pix-frame pix-flat h-9 w-full min-w-0 bg-transparent px-2.5 text-sm text-ink tabular-nums placeholder:text-ink-soft/60 focus-visible:outline-none";

export function ProfilePanel({
  profile,
  fresh,
  onDone,
}: {
  profile: Profile;
  /** Keys Mochi filled on its latest turn, highlighted for a moment. */
  fresh: Set<ProfileKey>;
  onDone: () => void;
}) {
  const missing = missingEssentials(profile);
  const needed = essentials.filter((e) => (e.when ? e.when(profile) : true));
  const done = needed.length - missing.length;

  return (
    <PixPanel className="flex flex-col lg:max-h-[calc(100svh-7.5rem)]">
      <div className="grid gap-2 border-b-2 border-ink/10 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-pixel text-xl font-bold">What Mochi knows</h2>
          <span className="text-sm text-ink-soft tabular-nums">
            {done} of {needed.length}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-cloud" aria-hidden>
          <div className="h-full bg-pandan transition-[width] duration-500" style={{ width: `${(done / needed.length) * 100}%` }} />
        </div>
        <p className="text-xs text-ink-soft">Mochi fills this in as you talk. Tap any answer to fix it.</p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4">

      {sections
        .filter((s) => (s.show ? s.show(profile) : true))
        .map((s) => (
          <fieldset key={s.title} className="grid gap-2.5 pt-3">
            <legend className="font-pixel-label text-[11px] text-ink-soft uppercase">{s.title}</legend>
            {s.fields.map((f) => (
              <Row key={f.key} field={f} profile={profile} fresh={fresh.has(f.key)} />
            ))}
          </fieldset>
        ))}
      </div>

      <div className="grid gap-2 border-t-2 border-ink/10 p-4">
        {missing.length ? (
          <p className="text-xs text-ink-soft">
            Mochi still needs {missing.length}: {missing.slice(0, 3).map((m) => m.label.toLowerCase()).join(", ")}
            {missing.length > 3 ? "…" : "."}
          </p>
        ) : (
          <p className="text-sm font-medium text-pandan-deep">Mochi has everything it needs. Thank you!</p>
        )}
        <button
          type="button"
          onClick={onDone}
          className={cn("pix-btn min-h-11 px-4 text-base", missing.length ? "text-ink" : "text-white")}
          style={{ "--pix-fill": missing.length ? "var(--j-surface, #fff)" : "var(--color-pandan-deep)" } as React.CSSProperties}
        >
          {missing.length ? "Continue with what I have" : "See my homes"}
        </button>
      </div>
    </PixPanel>
  );
}

function Row({ field: f, profile, fresh }: { field: Field; profile: Profile; fresh: boolean }) {
  const value = profile[f.key];
  const id = `pf-${f.key}`;
  const set = (v: Profile[ProfileKey] | undefined) => homelander.setProfileField(f.key, v as never);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-lg px-1.5 py-1 transition-colors duration-700",
        fresh && "bg-kaya/35",
      )}
    >
      <label htmlFor={id} className="text-sm text-ink-soft">
        {f.label}
      </label>
      <div className="min-w-0">
        {f.kind === "choice" ? (
          <div id={id} role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-1.5">
            {f.options.map((o) => (
              <Pill key={o.value} on={value === o.value} onClick={() => set(value === o.value ? undefined : (o.value as never))}>
                {o.label}
              </Pill>
            ))}
          </div>
        ) : f.kind === "yesno" ? (
          <div id={id} role="radiogroup" aria-label={f.label} className="flex gap-1.5">
            <Pill on={value === true} onClick={() => set(value === true ? undefined : (true as never))}>
              Yes
            </Pill>
            <Pill on={value === false} onClick={() => set(value === false ? undefined : (false as never))}>
              No
            </Pill>
          </div>
        ) : f.kind === "number" ? (
          <div className="flex items-center gap-1.5">
            {f.prefix ? <span className="text-xs text-ink-soft">{f.prefix}</span> : null}
            <input
              id={id}
              key={String(value ?? "")}
              inputMode="numeric"
              defaultValue={typeof value === "number" ? value.toLocaleString("en-MY") : ""}
              placeholder={f.hint ?? ""}
              onBlur={(e) => {
                const n = Number(e.target.value.replace(/[^\d.]/g, ""));
                set(e.target.value.trim() === "" || Number.isNaN(n) ? undefined : (n as never));
              }}
              className={inputCls}
            />
            {f.suffix ? <span className="text-xs text-ink-soft">{f.suffix}</span> : null}
          </div>
        ) : f.kind === "text" ? (
          <input
            id={id}
            key={String(value ?? "")}
            defaultValue={typeof value === "string" ? value : ""}
            placeholder={f.placeholder}
            onBlur={(e) => set(e.target.value.trim() ? (e.target.value.trim() as never) : undefined)}
            className={inputCls}
          />
        ) : (
          <input
            id={id}
            key={Array.isArray(value) ? value.join("|") : ""}
            defaultValue={Array.isArray(value) ? value.join(", ") : ""}
            placeholder={f.placeholder}
            onBlur={(e) => {
              const tags = e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              set(tags.length ? (tags as never) : undefined);
            }}
            className={inputCls}
          />
        )}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "rounded-full border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "border-pandan-deep bg-pandan-deep text-white" : "border-ink/25 text-ink hover:border-ink/60",
      )}
    >
      {children}
    </button>
  );
}
