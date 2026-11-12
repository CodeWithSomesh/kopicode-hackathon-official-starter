"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { ADDABLE, CATALOG, type Item, type Kind } from "./furniture";
import type { Floor } from "./plans";

type Props = {
  floor: Floor;
  /** Furniture on this floor. */
  items: Item[];
  selected: Item | null;
  onSelect: (uid: string | null) => void;
  onAdd: (kind: Kind, roomId?: string) => void;
  onNudge: (dx: number, dy: number) => void;
  onRotate: () => void;
  onRemove: () => void;
  onReset: () => void;
};

const STEP = 0.1;

export function FurniturePanel({
  floor,
  items,
  selected,
  onSelect,
  onAdd,
  onNudge,
  onRotate,
  onRemove,
  onReset,
}: Props) {
  const [room, setRoom] = useState("");
  const [kind, setKind] = useState<Kind>(ADDABLE[0]);
  const rooms = floor.rooms.filter((r) => r.kind !== "stairs");
  const roomLabel = (id: string) =>
    floor.rooms.find((r) => r.id === id)?.label ?? id;
  // A room picked on another floor doesn't exist here; fall back to "best spot".
  const target = rooms.some((r) => r.id === room) ? room : "";

  const fixed = selected ? CATALOG[selected.kind].fixed : false;

  return (
    <PixPanel className="grid gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-pixel text-lg font-bold">Furniture</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-ink-soft underline decoration-2 underline-offset-4 hover:text-ink"
        >
          Reset layout
        </button>
      </div>

      {selected ? (
        <div
          className="grid gap-3 border-2 border-ink bg-cloud p-3"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {CATALOG[selected.kind].label}
              <span className="font-normal text-ink-soft">
                {" "}
                · {roomLabel(selected.room)}
              </span>
            </p>
          </div>
          {fixed ? (
            <p className="text-sm text-ink-soft">
              The stove and sink come with the kitchen, so they stay put.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="grid grid-cols-3 gap-1"
                role="group"
                aria-label="Move 10 cm"
              >
                <span />
                <NudgeButton
                  label="Move up"
                  onClick={() => onNudge(0, -STEP)}
                  icon={<ArrowUp className="size-4" />}
                />
                <span />
                <NudgeButton
                  label="Move left"
                  onClick={() => onNudge(-STEP, 0)}
                  icon={<ArrowLeft className="size-4" />}
                />
                <NudgeButton
                  label="Move down"
                  onClick={() => onNudge(0, STEP)}
                  icon={<ArrowDown className="size-4" />}
                />
                <NudgeButton
                  label="Move right"
                  onClick={() => onNudge(STEP, 0)}
                  icon={<ArrowRight className="size-4" />}
                />
              </div>
              <div className="grid gap-2">
                <PixButton size="sm" onClick={onRotate}>
                  <RotateCw className="size-4" aria-hidden="true" /> Turn
                </PixButton>
                <PixButton size="sm" tone="raya" onClick={onRemove}>
                  <Trash2 className="size-4" aria-hidden="true" /> Remove
                </PixButton>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="justify-self-start text-xs font-semibold underline decoration-2 underline-offset-4"
          >
            Done
          </button>
        </div>
      ) : null}

      <div className="grid gap-1">
        <label htmlFor="fs-pick" className="text-sm font-semibold">
          Pick a piece
        </label>
        <select
          id="fs-pick"
          value={selected?.uid ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="border-2 border-ink bg-white px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Or tap one on the plan</option>
          {items.map((it) => (
            <option key={it.uid} value={it.uid}>
              {CATALOG[it.kind].label} · {roomLabel(it.room)}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-soft">
          Drag to move. Keys: arrows move, R turns, Delete removes.
        </p>
      </div>

      <div className="grid gap-1">
        <span id="fs-add-label" className="text-sm font-semibold">
          Add
        </span>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-labelledby="fs-add-label"
        >
          <select
            aria-label="Piece to add"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="min-w-0 flex-1 border-2 border-ink bg-white px-2 py-1.5 text-sm text-ink"
          >
            {ADDABLE.map((k) => (
              <option key={k} value={k}>
                {CATALOG[k].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Room to add it to"
            value={target}
            onChange={(e) => setRoom(e.target.value)}
            className="min-w-0 flex-1 border-2 border-ink bg-white px-2 py-1.5 text-sm text-ink"
          >
            <option value="">Best spot</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <PixButton size="sm" onClick={() => onAdd(kind, target || undefined)}>
            Add
          </PixButton>
        </div>
      </div>
    </PixPanel>
  );
}

function NudgeButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center border-2 border-ink bg-white hover:bg-sky"
    >
      {icon}
    </button>
  );
}
