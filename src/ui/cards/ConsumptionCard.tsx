import { useState } from "react";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

const number = new Intl.NumberFormat("hu-HU");
const forint = new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 });

export function ConsumptionCard({ card }: { card: Extract<Card, { type: "consumption" }> }) {
  const api = useCardApi(card);
  const stored = api.item?.status === "answered" ? api.item.value : undefined;
  const [draft, setDraft] = useState(typeof stored === "number" ? String(stored) : "");
  const kwh = Number(draft);
  const ready = draft !== "" && Number.isSafeInteger(kwh) && kwh >= 0;
  const { thresholdKwh, withinFtPerKwh, aboveFtPerKwh, label } = card.tariff;
  const within = Math.min(kwh, thresholdKwh) * withinFtPerKwh;
  const above = Math.max(0, kwh - thresholdKwh) * aboveFtPerKwh;
  const proceed = () => {
    if (!ready) return;
    api.commit(kwh);
    api.next();
  };
  const unknown = () => {
    api.commit("nem_tudom");
    api.next();
  };
  useKeyHandlers({ confirm: proceed, skip: card.skip ? api.skip : undefined });

  return (
    <CardShell api={api}>
      <form onSubmit={(event) => { event.preventDefault(); proceed(); }}>
        <input
          className="h-10 w-full cursor-pointer accent-primary"
          type="range"
          min={0}
          max={card.sliderMax}
          value={ready ? Math.min(kwh, card.sliderMax) : 0}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Becsült éves fogyasztás"
        />
        <div
          className="relative mb-4 h-12 border-t border-line text-sm text-muted"
          aria-hidden="true"
        >
          <span className="absolute left-0 top-1">0</span>
          <span className="absolute right-0 top-1">{number.format(card.sliderMax)} kWh</span>
          <span className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${100 * thresholdKwh / card.sliderMax}%` }}>
            <span className="mx-auto block h-2 w-px bg-muted" />
            {number.format(thresholdKwh)} kWh
          </span>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span>Éves fogyasztás (kWh)</span>
          <input
            className="min-h-12 w-28 shrink-0 rounded-lg border border-line bg-surface px-2 text-right"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <output className="mt-3 block min-h-12">
          {ready && (kwh >= thresholdKwh ? (
            <>Rezsicsökkentett keret ({forint.format(within)}) + {forint.format(above)} a keret felett évente</>
          ) : <>Becsült éves fogyasztási díj: {forint.format(within)}</>)}
        </output>
        <p className="text-sm text-muted">{label}</p>
        <button type="submit" className="btn btn-primary mt-3 w-full" disabled={!ready}>
          Tovább <KeyHint>Enter</KeyHint>
        </button>
      </form>
      <button
        type="button"
        className="btn mt-2 w-full"
        aria-pressed={stored === "nem_tudom" && draft === ""}
        onClick={unknown}
      >
        {card.unknownLabel}
      </button>
    </CardShell>
  );
}
