// multi_tiles: grid of pictogram tiles with checkbox semantics.
import { useState } from "react";
import { toggleOption, visibleOptions } from "../../engine/inputs.ts";
import type { Card, CardOption } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { iconFor } from "../icons.ts";
import { useCardApi, useKeyHandlers } from "../session.tsx";

/** Tile grid whose last, shorter row is centred: 2 tiles per row on phones, 3 on wider screens (the card stays 560 px). */
export const TILE_GRID = "flex flex-wrap justify-center gap-3";
export const TILE_WIDTH = "w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)]";
export const TILE_CLASS = `opt ${TILE_WIDTH} !flex-col !justify-start gap-2 !px-2 !py-3 text-center hyphens-auto break-words`;

export function MultiTilesCard({ card }: { card: Extract<Card, { type: "multi_tiles" }> }) {
  const api = useCardApi(card);
  const options = visibleOptions(card, api.analysis.view);
  const exclusiveValues = new Set(card.exclusive);
  const combinable = options.filter((o) => !exclusiveValues.has(o.value));
  const exclusive = options.filter((o) => exclusiveValues.has(o.value));
  const visible = new Set(options.map((o) => o.value));
  // Stored answer, or the pre-selection written when the card was first shown.
  const stored = Array.isArray(api.item?.value) ? (api.item.value as string[]) : [];
  const [selected, setSelected] = useState<string[]>(stored.filter((v) => visible.has(v)));
  const [note, setNote] = useState("");

  const toggle = (value: string) => {
    const { next, blocked } = toggleOption(card, selected, value);
    setSelected(next);
    setNote(blocked ? `Legfeljebb ${card.max} jelölhető. Vegyen le egyet, ha mást választana.` : "");
  };
  const proceed = () => {
    if (selected.length === 0) return;
    api.commit(selected);
    api.next();
  };
  useKeyHandlers({ confirm: proceed, skip: card.skip ? api.skip : undefined });

  const renderTile = (o: CardOption) => {
    const Icon = iconFor(o.icon);
    const on = selected.includes(o.value);
    return (
      <button
        key={o.value}
        type="button"
        role="checkbox"
        aria-checked={on}
        className={TILE_CLASS}
        onClick={() => toggle(o.value)}
        onKeyDown={(e) => {
          // Enter continues (Space toggles natively).
          if (e.key === "Enter") {
            e.preventDefault();
            proceed();
          }
        }}
      >
        <Icon size={32} stroke={1.6} aria-hidden="true" />
        <span className="text-sm leading-tight">{o.label}</span>
        <span aria-hidden="true" className={`text-lg font-bold leading-none ${on ? "text-primary" : "text-transparent"}`}>
          ✓
        </span>
      </button>
    );
  };

  return (
    <CardShell api={api}>
      <div className={TILE_GRID}>
        {combinable.map(renderTile)}
        {combinable.length > 0 && exclusive.length > 0 && <hr className="h-px w-full rounded-full border-0 bg-soft" />}
        {exclusive.map(renderTile)}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-danger">
        {note}
      </p>
      {card.max !== undefined && !note && <p className="text-sm text-muted">Legfeljebb {card.max} jelölhető.</p>}
      <button type="button" className="btn btn-primary mt-3 w-full" disabled={selected.length === 0} onClick={proceed}>
        Tovább
        <KeyHint>Enter</KeyHint>
      </button>
      {selected.length === 0 && <p className="mt-2 text-sm text-muted">Jelöljön meg legalább egyet{card.skip ? `, vagy válassza ezt: „${card.skipLabel}”` : ""}.</p>}
    </CardShell>
  );
}
