import { useState } from "react";
import { splitOptions, validSplit } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

export function PercentSplitCard({ card }: { card: Extract<Card, { type: "percent_split" }> }) {
  const api = useCardApi(card);
  const source = api.store.getState().ctx.byId.get(card.optionsFrom);
  const options = splitOptions(source, api.analysis.view);
  const stored = api.item?.value;
  const [draft, setDraft] = useState<Record<string, string>>(() => validSplit(stored, options)
    ? Object.fromEntries(Object.entries(stored).map(([id, value]) => [id, String(value)]))
    : {});
  const value = Object.fromEntries(options.map(({ value: id }) => [id, draft[id] ? Number(draft[id]) : NaN]));
  const total = Object.values(value).reduce((sum, percent) => sum + (percent || 0), 0);
  const ready = validSplit(value, options);
  const proceed = () => {
    if (!ready) return;
    api.commit(value);
    api.next();
  };
  useKeyHandlers({ confirm: proceed, skip: card.skip ? api.skip : undefined });

  return (
    <CardShell api={api}>
      <form
        onSubmit={(event) => { event.preventDefault(); proceed(); }}
        className="space-y-3"
      >
        {options.map(({ value: id, label }) => (
          <label key={id} className="flex min-h-12 items-center justify-between gap-3">
            <span>{label}</span>
            <span className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={draft[id] ?? ""}
                onChange={(event) => {
                  const percent = event.target.value;
                  setDraft((previous) => ({ ...previous, [id]: percent }));
                }}
                className="min-h-12 w-20 rounded-lg border border-line bg-surface px-2 text-right"
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
        ))}
        <output className="block text-sm text-muted">Összesen {total} / 100%</output>
        <button type="submit" className="btn btn-primary w-full" disabled={!ready}>
          Tovább <KeyHint>Enter</KeyHint>
        </button>
      </form>
    </CardShell>
  );
}
