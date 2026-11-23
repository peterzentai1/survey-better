// info, consent, single and free_text cards.
import { useState } from "react";
import { visibleOptions } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { useCardApi, useKeyHandlers } from "../session.tsx";

type Of<T extends Card["type"]> = Extract<Card, { type: T }>;

export function InfoCard({ card }: { card: Of<"info"> }) {
  const api = useCardApi(card);
  useKeyHandlers({ confirm: api.next });
  return (
    <CardShell api={api} heading={card.title}>
      <p className="whitespace-pre-line">{card.text}</p>
      <button type="button" className="btn btn-primary mt-5 w-full" onClick={api.next}>
        {card.cta}
        <KeyHint>Enter</KeyHint>
      </button>
    </CardShell>
  );
}

export function ConsentCard({ card }: { card: Of<"consent"> }) {
  const api = useCardApi(card);
  const initial = api.store.getState().state.consent;
  const [participation, setParticipation] = useState(initial.participation);
  const [paradata, setParadata] = useState(initial.paradata);
  const proceed = () => {
    if (!participation) return;
    api.store.getState().acceptConsent(card.id, { participation, paradata });
    api.next();
  };
  useKeyHandlers({ confirm: proceed });
  return (
    <CardShell api={api} heading={card.title}>
      <p className="whitespace-pre-line">{card.text}</p>
      <div className="mt-4 flex flex-col gap-1">
        <label className="flex min-h-12 items-start gap-3 py-2">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-primary" checked={participation} onChange={(e) => setParticipation(e.target.checked)} />
          <span>
            {card.participationLabel} <span className="text-sm text-muted">(kötelező)</span>
          </span>
        </label>
        <label className="flex min-h-12 items-start gap-3 py-2">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-primary" checked={paradata} onChange={(e) => setParadata(e.target.checked)} />
          <span>
            {card.paradataLabel} <span className="text-sm text-muted">(nem kötelező)</span>
          </span>
        </label>
      </div>
      <button type="button" className="btn btn-primary mt-4 w-full" disabled={!participation} onClick={proceed}>
        Tovább
        <KeyHint>Enter</KeyHint>
      </button>
      {!participation && <p className="mt-2 text-sm text-muted">A továbblépéshez jelölje be a részvételi hozzájárulást.</p>}
    </CardShell>
  );
}

export function SingleCard({ card }: { card: Of<"single"> }) {
  const api = useCardApi(card);
  const options = visibleOptions(card, api.analysis.view);
  const selected = api.item?.status === "answered" ? api.item.value : undefined;
  useKeyHandlers({ skip: card.skip ? api.skip : undefined });
  const choose = (value: string) => {
    api.commit(value);
    api.autoAdvance();
  };
  const chips = card.layout === "chips";
  return (
    <CardShell api={api}>
      <div className={chips ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`opt ${chips ? "!w-auto min-w-14 justify-center" : ""}`}
            aria-pressed={selected === o.value}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </CardShell>
  );
}

export function FreeTextCard({ card }: { card: Of<"free_text"> }) {
  const api = useCardApi(card);
  const stored = api.item?.status === "answered" && typeof api.item.value === "string" ? api.item.value : "";
  const [text, setText] = useState(stored);
  const proceed = () => {
    if (text.trim() === "") return;
    api.commit(text.trim());
    api.next();
  };
  useKeyHandlers({ skip: card.skip ? api.skip : undefined });
  return (
    <CardShell api={api}>
      <label className="sr-only" htmlFor={`t-${card.id}`}>
        {api.text}
      </label>
      <textarea
        id={`t-${card.id}`}
        className="min-h-32 w-full rounded-xl border-2 border-line bg-surface p-3"
        value={text}
        maxLength={card.maxLength}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={`n-${card.id}`}
      />
      <div className="mt-1 flex justify-between gap-3 text-sm text-muted">
        <span id={`n-${card.id}`}>{card.privacyNote}</span>
        <span aria-live="off" className="shrink-0">
          {text.length}/{card.maxLength}
        </span>
      </div>
      <button type="button" className="btn btn-primary mt-4 w-full" disabled={text.trim() === ""} onClick={proceed}>
        Tovább
      </button>
    </CardShell>
  );
}
