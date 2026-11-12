"use client";

import { useT } from "@/lib/homelander/i18n/client";
import { PixPanel } from "@/components/homelander/pixel";
import { essentials, missingEssentials, type Profile, type ProfileKey } from "@/lib/homelander/profile";
import { homelander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";

/** i18n marker: the scanner (npm run i18n:check) sees tr(text) literals; the render sites below call t(value). */
const tr = (s: string) => s;

type Option = { value: string; label: string };
type Field =
  | { key: ProfileKey; label: string; kind: "choice"; options: Option[] }
  | { key: ProfileKey; label: string; kind: "yesno" }
  | { key: ProfileKey; label: string; kind: "number"; prefix?: string; suffix?: string; hint?: string }
  | { key: ProfileKey; label: string; kind: "text"; placeholder?: string }
  | { key: ProfileKey; label: string; kind: "tags"; placeholder?: string };

const sections: { title: string; fields: Field[]; show?: (p: Profile) => boolean }[] = [
  {
    title: tr("Household"),
    fields: [
      {
        key: "livingWith",
        label: tr("Living with"),
        kind: "choice",
        options: [
          { value: "alone", label: tr("Alone") },
          { value: "partner", label: tr("Partner") },
          { value: "partner_kids", label: tr("Partner + kids") },
          { value: "parents", label: tr("Parents") },
          { value: "friends", label: tr("Friends") },
          { value: "other", label: tr("Other") },
        ],
      },
      { key: "kidsNow", label: tr("Kids now"), kind: "number" },
      {
        key: "kidsPlanned",
        label: tr("Kids in the next few years"),
        kind: "choice",
        options: [
          { value: "yes", label: tr("Yes") },
          { value: "maybe", label: tr("Maybe") },
          { value: "no", label: tr("No") },
        ],
      },
      { key: "parentsMovingIn", label: tr("Parents moving in"), kind: "yesno" },
      { key: "pets", label: tr("Pets"), kind: "yesno" },
    ],
  },
  {
    title: tr("School run"),
    show: (p) => p.kidsPlanned !== "no" || (p.kidsNow ?? 0) > 0,
    fields: [
      { key: "schoolMatters", label: tr("Distance to school matters"), kind: "yesno" },
      { key: "schoolMaxKm", label: tr("Furthest OK"), kind: "number", suffix: "km" },
      {
        key: "schoolTransport",
        label: tr("Getting there"),
        kind: "choice",
        options: [
          { value: "drop_off", label: tr("Drop-off") },
          { value: "school_bus", label: tr("School bus") },
          { value: "walk", label: tr("Walk") },
          { value: "other", label: tr("Other") },
        ],
      },
    ],
  },
  {
    title: tr("Work and places"),
    fields: [
      { key: "workArea", label: tr("Work is in"), kind: "text", placeholder: tr("e.g. Bangsar South") },
      { key: "officeDays", label: tr("Office days a week"), kind: "number" },
      { key: "partnerWorkArea", label: tr("Partner works in"), kind: "text", placeholder: tr("Optional") },
      {
        key: "commuteMode",
        label: tr("Gets around by"),
        kind: "choice",
        options: [
          { value: "car", label: tr("Car") },
          { value: "train", label: tr("Train") },
          { value: "mixed", label: tr("Both") },
        ],
      },
      { key: "preferredAreas", label: tr("Areas you like"), kind: "tags", placeholder: tr("Kajang, Shah Alam") },
      { key: "mustBeNear", label: tr("Must be near"), kind: "tags", placeholder: tr("MRT, my parents") },
    ],
  },
  {
    title: tr("The home"),
    fields: [
      {
        key: "homeType",
        label: tr("Type"),
        kind: "choice",
        options: [
          { value: "landed", label: tr("Landed") },
          { value: "high_rise", label: tr("High-rise") },
          { value: "either", label: tr("Either") },
        ],
      },
      { key: "minBedrooms", label: tr("Bedrooms at least"), kind: "number" },
      { key: "mustHaves", label: tr("Must-haves"), kind: "tags", placeholder: tr("Gated, park") },
      { key: "dealBreakers", label: tr("Deal-breakers"), kind: "tags", placeholder: tr("Leasehold") },
      {
        key: "buyWithin",
        label: tr("Buying within"),
        kind: "choice",
        options: [
          { value: "3m", label: tr("3 months") },
          { value: "6m", label: tr("6 months") },
          { value: "1y", label: tr("A year") },
          { value: "2y_plus", label: tr("2 years+") },
        ],
      },
      { key: "underConstructionOk", label: tr("Can wait for a new build"), kind: "yesno" },
    ],
  },
  {
    title: tr("Money"),
    fields: [
      { key: "grossRM", label: tr("Gross salary"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "takeHomeRM", label: tr("Take-home"), kind: "number", prefix: "RM", suffix: "/mo", hint: tr("Optional, we can estimate it") },
      { key: "otherIncomeRM", label: tr("Other income"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "joint", label: tr("Buying with someone"), kind: "yesno" },
      { key: "jointGrossRM", label: tr("Their gross salary"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "carRM", label: tr("Car loan"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "ptptnRM", label: tr("PTPTN"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "personalRM", label: tr("Personal loan"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "housingRM", label: tr("Other home loan"), kind: "number", prefix: "RM", suffix: "/mo" },
      { key: "cardBalanceRM", label: tr("Credit card balance"), kind: "number", prefix: "RM" },
      { key: "savingsRM", label: tr("Savings for down payment"), kind: "number", prefix: "RM" },
      { key: "firstHome", label: tr("First home"), kind: "yesno" },
      { key: "age", label: tr("Age"), kind: "number" },
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
  /** Keys Uncle filled on his latest turn, highlighted for a moment. */
  fresh: Set<ProfileKey>;
  onDone: () => void;
}) {
  const t = useT();
  const missing = missingEssentials(profile);
  const needed = essentials.filter((e) => (e.when ? e.when(profile) : true));
  const done = needed.length - missing.length;

  return (
    <PixPanel className="flex flex-col lg:max-h-[calc(100svh-7.5rem)]">
      <div className="grid gap-2 border-b-2 border-ink/10 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-pixel text-xl font-bold">{t("What Uncle knows")}</h2>
          <span className="text-sm text-ink-soft tabular-nums">
            {t("{done} of {total}", { done, total: needed.length })}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-cloud" aria-hidden>
          <div className="h-full bg-pandan transition-[width] duration-500" style={{ width: `${(done / needed.length) * 100}%` }} />
        </div>
        <p className="text-xs text-ink-soft">{t("Uncle fills this in as you talk. Tap any answer to fix it.")}</p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4">

      {sections
        .filter((s) => (s.show ? s.show(profile) : true))
        .map((s) => (
          <fieldset key={s.title} className="grid gap-2.5 pt-3">
            <legend className="font-pixel-label text-[11px] text-ink-soft uppercase">{t(s.title)}</legend>
            {s.fields.map((f) => (
              <Row key={f.key} field={f} profile={profile} fresh={fresh.has(f.key)} />
            ))}
          </fieldset>
        ))}
      </div>

      <div className="grid gap-2 border-t-2 border-ink/10 p-4">
        {missing.length ? (
          <p className="text-xs text-ink-soft">
            {t("Uncle still needs {n}:", { n: missing.length })} {missing.slice(0, 3).map((m) => t(m.label).toLowerCase()).join(", ")}
            {missing.length > 3 ? "…" : "."}
          </p>
        ) : (
          <p className="text-sm font-medium text-pandan-deep">{t("Uncle has everything. Shiok!")}</p>
        )}
        <button
          type="button"
          onClick={onDone}
          className={cn("pix-btn min-h-11 px-4 text-base", missing.length ? "text-ink" : "text-white")}
          style={{ "--pix-fill": missing.length ? "var(--j-surface, #fff)" : "var(--color-pandan-deep)" } as React.CSSProperties}
        >
          {missing.length ? t("Continue with what I have") : t("See my homes")}
        </button>
      </div>
    </PixPanel>
  );
}

function Row({ field: f, profile, fresh }: { field: Field; profile: Profile; fresh: boolean }) {
  const t = useT();
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
        {t(f.label)}
      </label>
      <div className="min-w-0">
        {f.kind === "choice" ? (
          <div id={id} role="radiogroup" aria-label={t(f.label)} className="flex flex-wrap gap-1.5">
            {f.options.map((o) => (
              <Pill key={o.value} on={value === o.value} onClick={() => set(value === o.value ? undefined : (o.value as never))}>
                {t(o.label)}
              </Pill>
            ))}
          </div>
        ) : f.kind === "yesno" ? (
          <div id={id} role="radiogroup" aria-label={t(f.label)} className="flex gap-1.5">
            <Pill on={value === true} onClick={() => set(value === true ? undefined : (true as never))}>
              {t("Yes")}
            </Pill>
            <Pill on={value === false} onClick={() => set(value === false ? undefined : (false as never))}>
              {t("No")}
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
              placeholder={f.hint ? t(f.hint) : ""}
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
            placeholder={f.placeholder ? t(f.placeholder) : undefined}
            onBlur={(e) => set(e.target.value.trim() ? (e.target.value.trim() as never) : undefined)}
            className={inputCls}
          />
        ) : (
          <input
            id={id}
            key={Array.isArray(value) ? value.join("|") : ""}
            defaultValue={Array.isArray(value) ? value.join(", ") : ""}
            placeholder={f.placeholder ? t(f.placeholder) : undefined}
            onBlur={(e) => {
              const tags = e.target.value
                .split(",")
                .map((x) => x.trim())
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
