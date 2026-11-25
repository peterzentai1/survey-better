import { useRef, useState } from "react";
import { visibleOptions } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

export function PagedChoiceCard({ card }: { card: Extract<Card, { type: "single" }> }) {
  const api = useCardApi(card);
  const options = visibleOptions(card, api.analysis.view);
  const [index, setIndex] = useState(() =>
    options.findIndex(({ value }) => api.item?.status === "answered" && api.item.value === value),
  );
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const option = options[index];
  const move = (delta: number) => setIndex((current) => Math.max(-1, Math.min(current + delta, options.length - 1)));
  const proceed = () => {
    if (!option) return;
    api.commit(option.value);
    api.next();
  };
  const previous = () => { if (index > 0) move(-1); };
  const next = () => move(1);
  useKeyHandlers({ arrowLeft: previous, arrowRight: next, confirm: proceed, skip: card.skip ? api.skip : undefined });

  return (
    <CardShell api={api}>
      <div
        className="grid touch-pan-y select-none grid-cols-[auto_1fr_auto] items-stretch gap-3 rounded-xl border border-line p-2"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.pointerType === "mouse" || (event.target as Element).closest("button")) return;
          start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          const pointer = start.current;
          if (pointer?.id !== event.pointerId) return;
          start.current = null;
          const dx = event.clientX - pointer.x;
          const dy = event.clientY - pointer.y;
          if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
          api.store.getState().recordInput("drag");
          if (dx < 0) next();
          else previous();
        }}
        onPointerCancel={() => { start.current = null; }}
      >
        <button type="button" className="btn" aria-label="Előző érték" onClick={previous} disabled={index <= 0}>‹</button>
        <output className="grid min-h-14 place-items-center text-center text-lg font-semibold">
          {option?.label ?? "Válasszon"}
        </output>
        <button type="button" className="btn" aria-label="Következő érték" onClick={next} disabled={index >= options.length - 1}>›</button>
      </div>
      <button type="button" className="btn btn-primary mt-3 w-full" disabled={!option} onClick={proceed}>
        Tovább <KeyHint>Enter</KeyHint>
      </button>
    </CardShell>
  );
}
