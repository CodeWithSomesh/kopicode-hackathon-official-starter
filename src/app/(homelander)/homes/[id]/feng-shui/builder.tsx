"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { useLang, useT } from "@/lib/homelander/i18n/client";
import { CATALOG, defaultItems, type Item, type Kind } from "./furniture";
import { CommandConsole, type LogEntry } from "./command-console";
import {
  describeItems,
  describeProblem,
  ROOM_PHRASE,
  runText,
  unreadable,
  type Ctx,
  type Lang,
  type Reply,
  type World,
} from "./commands";
import { noteText, ongScore, readFengShui, type Note } from "./fengshui";
import { FengShuiPanel } from "./fengshui-panel";
import { FurniturePanel } from "./furniture-panel";
import { SunPanel } from "./sun-panel";
import { fixOne, type FixState } from "./autofix";
import {
  moveBy,
  moveTo,
  place,
  remove,
  rotate,
  type Result,
} from "./layout-ops";
import dynamic from "next/dynamic";
import { PlanCanvas } from "./plan-canvas";
import { planBounds, plans, type Plan } from "./plans";
import {
  FACINGS,
  MONTHS,
  dayStrip,
  heatOf,
  sunAt,
  sunPatches,
  sunShare,
  timeLabel,
  type Heat,
} from "./sun";
import { clearLayout, loadLayout, saveLayout } from "./saved";
import { speak, type SpeechLang } from "./voice";
import { MicButton, SpeechToolbar } from "./voice-controls";

function Loading3D() {
  const t = useT();
  return <>{t("Loading 3D view…")}</>;
}

/** three.js only loads when someone opens the 3D view. */
const Plan3D = dynamic(() => import("./plan-3d").then((m) => m.Plan3D), {
  ssr: false,
  loading: () => (
    <div className="grid h-[62vh] min-h-[420px] w-full place-items-center text-sm text-ink-soft lg:h-[80vh]">
      <Loading3D />
    </div>
  ),
});

type Props = { unitId: string; planId: Plan["id"]; lat: number; lng: number };

/** i18n marker: npm run i18n:check sees tr(text) literals; the render site calls t(word). */
const tr = (s: string) => s;

const heatTag: Record<
  Heat["level"],
  { tone: "pandan" | "kaya" | "raya"; word: string }
> = {
  cool: { tone: "pandan", word: tr("Cool") },
  warm: { tone: "kaya", word: tr("Warm") },
  hot: { tone: "raya", word: tr("Hot") },
};

export function FengShuiBuilder({ unitId, planId, lat, lng }: Props) {
  const t = useT();
  const plan = plans[planId];
  const bounds = useMemo(() => planBounds(plan), [plan]);

  const [floorIdx, setFloorIdx] = useState(0);
  // West-facing at 5 pm in June: the classic "afternoon sun bakes the living room" case.
  const [facing, setFacing] = useState(270);
  const [time, setTime] = useState(17);
  const [month, setMonth] = useState(6);
  const [curtains, setCurtains] = useState<ReadonlySet<string>>(new Set());
  const [items, setItems] = useState<Item[]>(() => defaultItems(planId));
  const [selected, setSelected] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"plan" | "3d">("plan");
  // Replies follow the site-wide EN | Manglish switch in the header.
  const siteLang = useLang();
  const lang: Lang = siteLang === "mglish" ? "mg" : "en";
  const [log, setLog] = useState<LogEntry[]>([]);
  const [speakOn, setSpeakOn] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Set once the AI route fails, so later requests skip straight to the quick parser. */
  const [aiDown, setAiDown] = useState<{ en: string; mg: string } | null>(null);

  // The server renders the default layout; the buyer's saved one loads after hydration.
  useEffect(() => {
    const saved = loadLayout(unitId, plan);
    /* eslint-disable react-hooks/set-state-in-effect -- one-off sync from localStorage after mount */
    if (saved) {
      setFacing(saved.facing);
      setTime(saved.time);
      setMonth(saved.month);
      setCurtains(new Set(saved.curtains));
      setItems(saved.items);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [unitId, plan]);

  useEffect(() => {
    if (!hydrated) return;
    saveLayout(unitId, { facing, time, month, curtains: [...curtains], items });
  }, [hydrated, unitId, facing, time, month, curtains, items]);

  const floor = plan.floors[floorIdx];
  const floorItems = items.filter((i) => i.floor === floor.id);
  const selectedItem = floorItems.find((i) => i.uid === selected) ?? null;
  const roomLabel = (id: string) =>
    floor.rooms.find((r) => r.id === id)?.label ?? id;

  /** Apply a layout result; on failure say why, unless `quiet` (dragging into a wall). */
  const apply = (r: Result, quiet = false) => {
    if (r.ok) setItems(r.items);
    else if (!quiet)
      toast.error(describeProblem(r.problem)[lang], { id: "feng-shui-layout" });
    return r.ok;
  };

  const dragTo = (uid: string, cx: number, cy: number) => {
    const it = items.find((i) => i.uid === uid);
    if (!it) return;
    // Slide along whatever is in the way instead of sticking: try both axes, then each alone.
    for (const [x, y] of [
      [cx, cy],
      [cx, it.cy],
      [it.cx, cy],
    ]) {
      const r = moveTo(uid, x, y, floor, items);
      if (r.ok) {
        setItems(r.items);
        return;
      }
    }
  };

  const nudge = (dx: number, dy: number) =>
    selected && apply(moveBy(selected, dx, dy, floor, items));
  const turn = () => selected && apply(rotate(selected, floor, items));
  const drop = () => {
    if (!selected) return;
    const label = t(selectedItem ? CATALOG[selectedItem.kind].label : "Piece");
    if (apply(remove(selected, items))) {
      setSelected(null);
      toast(t("{piece} removed.", { piece: label }), { id: "feng-shui-layout" });
    }
  };
  const add = (kind: Kind, roomId?: string) => {
    const r = place(kind, floor, items, roomId);
    if (apply(r) && r.ok) {
      setSelected(r.item.uid);
      toast.success(
        t("{piece} added to the {room}.", {
          piece: t(CATALOG[kind].label),
          room: t(roomLabel(r.item.room)).toLowerCase(),
        }),
        {
          id: "feng-shui-layout",
        },
      );
    }
  };
  const reset = () => {
    if (!window.confirm(t("Put all the furniture back where it started?"))) return;
    clearLayout(unitId);
    setItems(defaultItems(planId));
    setSelected(null);
  };

  const onPlanKey = (e: KeyboardEvent<HTMLElement>) => {
    if (!selected) return;
    const step = e.shiftKey ? 0.5 : 0.1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      nudge(...moves[e.key]);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      turn();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      drop();
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };
  const livingFloor =
    plan.floors.find((f) => f.rooms.some((r) => r.kind === "living")) ??
    plan.floors[0];
  const living = livingFloor.rooms.find((r) => r.kind === "living")!;

  const sun = useMemo(
    () => sunAt({ lat, lng, month, time, facing }),
    [lat, lng, month, time, facing],
  );
  const patches = useMemo(
    () => sunPatches(floor, sun, curtains),
    [floor, sun, curtains],
  );
  const livingHeat = useMemo(
    () => heatOf(sunShare(living, sunPatches(livingFloor, sun, curtains))),
    [living, livingFloor, sun, curtains],
  );
  const strip = useMemo(
    () =>
      dayStrip(livingFloor, living.id, { lat, lng, month, facing }, curtains),
    [livingFloor, living.id, lat, lng, month, facing, curtains],
  );

  const sunnyRooms = floor.rooms
    .filter((r) => r.kind !== "outdoor")
    .map((r) => ({ room: r, share: sunShare(r, patches) }))
    .filter((x) => x.share > 0.005)
    .sort((a, b) => b.share - a.share);

  const windowRooms = [...new Set(floor.windows.map((w) => w.room))].map((id) =>
    floor.rooms.find((r) => r.id === id)!,
  );

  const toggleCurtain = (id: string) =>
    setCurtains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const tag = heatTag[livingHeat.level];
  const sunnyHours = strip.filter((s) => s.share >= 0.05).length / 2;

  const notes = useMemo(
    () =>
      readFengShui({
        plan,
        items,
        facing,
        livingSunHours: sunnyHours,
        livingCurtains: curtains.has(living.id),
      }),
    [plan, items, facing, sunnyHours, curtains, living.id],
  );
  const score = ongScore(notes);
  const floorNotes = useMemo(
    () => notes.filter((n) => n.floor === floor.id),
    [notes, floor.id],
  );
  const flagged = useMemo(
    () =>
      new Set(
        floorNotes.filter((n) => n.tone !== "good").flatMap((n) => n.uids),
      ),
    [floorNotes],
  );
  const strips = useMemo(
    () =>
      floorNotes.flatMap((n) => (n.strip && n.tone === "fix" ? [n.strip] : [])),
    [floorNotes],
  );
  // Commands run against a snapshot of the page state and hand back the next one.
  const world: World = {
    items,
    facing,
    time,
    month,
    curtains,
    floorIdx,
    selected,
  };
  const ctx: Ctx = {
    plan,
    heat: (w) => {
      const s = sunAt({
        lat,
        lng,
        month: w.month,
        time: w.time,
        facing: w.facing,
      });
      const share = sunShare(living, sunPatches(livingFloor, s, w.curtains));
      const day = dayStrip(
        livingFloor,
        living.id,
        { lat, lng, month: w.month, facing: w.facing },
        w.curtains,
      );
      return { share, hours: day.filter((d) => d.share >= 0.05).length / 2 };
    },
    notes: (w) => {
      const hours =
        dayStrip(
          livingFloor,
          living.id,
          { lat, lng, month: w.month, facing: w.facing },
          w.curtains,
        ).filter((d) => d.share >= 0.05).length / 2;
      return readFengShui({
        plan,
        items: w.items,
        facing: w.facing,
        livingSunHours: hours,
        livingCurtains: w.curtains.has(living.id),
      });
    },
    ong: (w) => {
      const hours =
        dayStrip(
          livingFloor,
          living.id,
          { lat, lng, month: w.month, facing: w.facing },
          w.curtains,
        ).filter((d) => d.share >= 0.05).length / 2;
      const ns = readFengShui({
        plan,
        items: w.items,
        facing: w.facing,
        livingSunHours: hours,
        livingCurtains: w.curtains.has(living.id),
      });
      return {
        score: ongScore(ns),
        top: ns.find((n) => n.tone === "fix")?.title.toLowerCase(),
      };
    },
  };

  const applyWorld = (w: World) => {
    setItems(w.items);
    setFacing(w.facing);
    setTime(w.time);
    setMonth(w.month);
    setCurtains(w.curtains);
    setFloorIdx(w.floorIdx);
    setSelected(w.selected);
  };

  const addLog = (e: Omit<LogEntry, "id">) =>
    setLog((prev) => [
      ...prev.slice(-30),
      { ...e, id: Date.now() + Math.random() },
    ]);

  /** Read the outcome aloud: the AI's reply for 中文 / தமிழ், otherwise the local replies. */
  const voiceOut = (
    replies: Reply[],
    ai?: { text: string; lang: SpeechLang },
  ) => {
    if (!speakOn) return undefined;
    const said = ai
      ? speak(ai.text, ai.lang)
      : speak(
          replies.map((r) => r[lang]).join(" "),
          lang === "mg" ? "ms" : "en",
        );
    if (!said && ai) {
      const en =
        ai.lang === "ta"
          ? "Tamil"
          : ai.lang === "zh"
            ? "Mandarin"
            : "that language";
      const mg =
        ai.lang === "ta"
          ? "Tamil"
          : ai.lang === "zh"
            ? "Mandarin"
            : "bahasa tu";
      return {
        en: `No ${en} voice on this device, so the reply is text only.`,
        mg: `Device ni takde suara ${mg}, so jawapan dalam tulisan je.`,
      };
    }
    return undefined;
  };

  /**
   * Quick commands run locally and instantly. Anything the parser can't read, and anything
   * in Mandarin or Tamil, goes to the AI route, which hands back commands in the parser's own
   * words. If the AI isn't available, the local parser's answer stands.
   */
  const runCommand = async (text: string, spoken?: SpeechLang) => {
    const script: SpeechLang | undefined = /[\u3400-\u9fff]/.test(text)
      ? "zh"
      : /[\u0b80-\u0bff]/.test(text)
        ? "ta"
        : undefined;
    const speech = script ?? spoken ?? (lang === "mg" ? "ms" : "en");
    const needsAI =
      speech === "zh" || speech === "ta" || unreadable(text).length > 0;

    if (!needsAI) {
      const r = runText(text, world, ctx);
      applyWorld(r.world);
      addLog({ said: text, replies: r.replies, note: voiceOut(r.replies) });
      return;
    }

    if (aiDown) {
      const r = runText(text, world, ctx);
      applyWorld(r.world);
      addLog({ said: text, replies: r.replies, note: aiDown });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/feng-shui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          text,
          speech,
          replyStyle: lang,
          rooms: plan.floors
            .flatMap((f) => f.rooms.map((r) => ROOM_PHRASE[r.id]))
            .filter(Boolean),
          items: describeItems(plan, items),
          selected: selectedItem
            ? describeItems(plan, [selectedItem])[0]
            : null,
        }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "signin" : "down");
      const data = (await res.json()) as {
        commands: string[];
        reply: string;
        said: LogEntry["display"] | null;
      };
      const display = data.said ?? undefined;
      const foreign = speech === "zh" || speech === "ta";
      const ai =
        foreign || !data.commands.length
          ? { text: data.reply, lang: speech }
          : undefined;
      if (!data.commands.length) {
        addLog({
          said: text,
          display,
          replies: [],
          aiReply: ai,
          note: voiceOut([], ai),
        });
        return;
      }
      const r = runText(data.commands.join(" then "), world, ctx);
      applyWorld(r.world);
      addLog({
        said: text,
        display,
        heard: data.commands,
        aiReply: ai,
        replies: r.replies,
        note: voiceOut(r.replies, ai),
      });
    } catch (err) {
      // Fall back to the quick parser so the buyer still gets an answer.
      const r = runText(text, world, ctx);
      applyWorld(r.world);
      const why =
        err instanceof Error && err.message === "signin"
          ? {
              en: "Log in to let the AI handle free-form requests. The quick commands still work.",
              mg: "Log in dulu baru AI boleh tolong ayat bebas. Arahan cepat masih jalan.",
            }
          : {
              en: "The AI isn't reachable right now, so only the quick commands work.",
              mg: "AI tak dapat sambung sekarang, arahan cepat je jalan.",
            };
      setAiDown(why);
      addLog({ said: text, replies: r.replies, note: why });
    } finally {
      setBusy(false);
    }
  };

  /** "Fix it for me" on one Ong meter note: same search as the "fix" command, logged in the console. */
  const fixNote = (n: Note) => {
    const evaluate = (st: FixState) =>
      ctx.notes({ ...world, items: st.items, curtains: st.curtains });
    const r = fixOne(plan, { items, curtains }, evaluate, n);
    if (!r.ok) {
      addLog({ said: `${t("Fix")}: ${noteText(n, t, "title")}`, replies: [{ ok: false, ...r.why }] });
      toast.error(r.why[lang], { id: "feng-shui-layout" });
      return;
    }
    const moved = r.uid
      ? r.state.items.find((i) => i.uid === r.uid)
      : undefined;
    const fi = moved ? plan.floors.findIndex((f) => f.id === moved.floor) : -1;
    applyWorld({
      ...world,
      items: r.state.items,
      curtains: r.state.curtains,
      selected: r.uid ?? selected,
      floorIdx: fi >= 0 ? fi : floorIdx,
    });
    const s = ongScore(evaluate(r.state));
    addLog({
      said: `${t("Fix")}: ${noteText(n, t, "title")}`,
      replies: [
        {
          ok: true,
          en: `${r.did.en[0].toUpperCase()}${r.did.en.slice(1)}. Ong meter now ${s}.`,
          mg: `${r.did.mg[0].toUpperCase()}${r.did.mg.slice(1)}. Ong meter sekarang ${s}.`,
        },
      ],
    });
  };

  const pickNote = (n: Note) => {
    const idx = plan.floors.findIndex((f) => f.id === n.floor);
    if (idx >= 0 && idx !== floorIdx) setFloorIdx(idx);
    setSelected(n.uids[0] ?? null);
    document
      .getElementById("fs-plan")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <PixPanel
          id="fs-plan"
          className="grid min-w-0 scroll-mt-4 gap-3 p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            {plan.floors.length > 1 ? (
              <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label={t("Floor")}
              >
                {plan.floors.map((f, i) => (
                  <PixButton
                    key={f.id}
                    size="sm"
                    role="tab"
                    aria-selected={i === floorIdx}
                    tone={i === floorIdx ? "ink" : "white"}
                    onClick={() => {
                      setFloorIdx(i);
                      setSelected(null);
                    }}
                  >
                    {t(f.label)}
                  </PixButton>
                ))}
              </div>
            ) : null}
            <div className="ml-auto flex gap-1" role="group" aria-label={t("View")}>
              {(
                [
                  ["plan", tr("Plan")],
                  ["3d", "3D"],
                ] as const
              ).map(([v, label]) => (
                <PixButton
                  key={v}
                  size="sm"
                  tone={view === v ? "ink" : "white"}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {t(label)}
                </PixButton>
              ))}
            </div>
          </div>

          {view === "3d" ? (
            <Plan3D
              floor={floor}
              bounds={bounds}
              sun={sun}
              items={floorItems}
              selected={selected}
              flagged={flagged}
              onSelect={setSelected}
              onDrag={dragTo}
              onKeyDown={onPlanKey}
              className="h-[62vh] min-h-[420px] w-full lg:h-[80vh]"
            />
          ) : (
            <PlanCanvas
              floor={floor}
              bounds={bounds}
              patches={patches}
              sun={sun}
              facing={facing}
              items={floorItems}
              selected={selected}
              onSelect={setSelected}
              onDrag={dragTo}
              onKeyDown={onPlanKey}
              flagged={flagged}
              strips={strips}
              className="h-[62vh] min-h-[420px] w-full lg:h-[80vh]"
            />
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Stat
              label={t("Time")}
              value={`${timeLabel(time)}, ${t(MONTHS[month - 1])}`}
            />
            <Stat
              label={t("Sun")}
              value={
                sun.up
                  ? `${bearingName(sun.azimuth, siteLang)}, ${Math.round(sun.elevation)}°`
                  : t("Below horizon")
              }
            />
            <Stat
              label={t("Living room in sun")}
              value={`${Math.round(livingHeat.share * 100)}%`}
            />
            <div className="grid gap-1">
              <dt className="text-xs text-ink-soft">{t("Feels")}</dt>
              <dd>
                <PixTag tone={tag.tone}>{t(tag.word)}</PixTag>
              </dd>
            </div>
          </dl>
        </PixPanel>

        <CommandConsole
          log={log}
          lang={lang}
          onRun={(t) => void runCommand(t)}
          busy={busy}
          toolbar={<SpeechToolbar speakOn={speakOn} onSpeakOn={setSpeakOn} />}
          extra={
            <MicButton
              disabled={busy}
              onHeard={(said, l) => void runCommand(said, l)}
            />
          }
        />
      </div>

      <div className="grid min-w-0 gap-4">
        <FengShuiPanel
          notes={notes}
          score={score}
          floorLabel={(id) => plan.floors.find((f) => f.id === id)?.label ?? id}
          currentFloor={floor.id}
          onPick={pickNote}
          onFix={fixNote}
          onFixAll={() => void runCommand("fix all")}
        />

        <FurniturePanel
          floor={floor}
          items={floorItems}
          selected={selectedItem}
          onSelect={setSelected}
          onAdd={add}
          onNudge={nudge}
          onRotate={turn}
          onRemove={drop}
          onReset={reset}
        />

        <SunPanel
          facing={facing}
          onFacing={setFacing}
          time={time}
          onTime={setTime}
          month={month}
          onMonth={setMonth}
          strip={strip}
          sunnyHours={sunnyHours}
          sunnyRooms={sunnyRooms}
          windowRooms={windowRooms}
          curtains={curtains}
          onCurtain={toggleCurtain}
        />
      </div>
    </div>
  );
}

/** The sun's compass direction in lower case: the Malay word under Manglish. */
function bearingName(az: number, site: "en" | "mglish") {
  const f = FACINGS[Math.round(az / 45) % 8];
  return (site === "mglish" ? f.malay : f.name).toLowerCase();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-pixel text-sm font-semibold">{value}</dd>
    </div>
  );
}
