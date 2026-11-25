// info, consent, single and free_text cards.
import { useRef, useState } from "react";
import { DEFAULT_EFFORT_LEVEL } from "../../engine/effort.ts";
import { visibleOptions } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { metricsEnabled } from "../../storage/metrics.ts";
import { CardShell, KeyHint } from "../CardShell.tsx";
import { EffortMedian } from "../EffortMedian.tsx";
import { useCardApi, useKeyHandlers, useSel } from "../session.tsx";

type Of<T extends Card["type"]> = Extract<Card, { type: T }>;

export function InfoCard({ card }: { card: Of<"info"> }) {
  const api = useCardApi(card);
  const { ctx } = api.store.getState();
  const levels = ctx.settings.display.effortSelector && card.id === ctx.deck.order[0] ? ctx.bank.effortLevels : undefined;
  const selected = useSel((s) => s.state.effortLevel) ?? DEFAULT_EFFORT_LEVEL;
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = (index: number, focus: boolean) => {
    const level = levels?.[index];
    if (!level) return;
    api.store.getState().setEffortLevel(level.id);
    if (focus) options.current[index]?.focus();
  };
  const move = (direction: -1 | 1) => {
    if (!levels?.length) return;
    const index = levels.findIndex((level) => level.id === api.store.getState().state.effortLevel);
    choose((index + direction + levels.length) % levels.length, true);
  };
  useKeyHandlers({
    confirm: api.next,
    ...(levels && {
      arrowLeft: () => move(-1),
      arrowRight: () => move(1),
      digit: (n) => choose(n - 1, true),
    }),
  });
  return (
    <CardShell api={api} heading={card.title}>
      <p className="whitespace-pre-line">{card.text}</p>
      {levels && (
        <div className="mt-5">
          <p id={`effort-${card.id}`} className="mb-2 font-semibold">
            {card.effortLabel ?? "Mennyi ideje van a kitöltésre?"}
          </p>
          <div role="radiogroup" aria-labelledby={`effort-${card.id}`} className={`grid gap-2 ${["grid-cols-1", "grid-cols-2", "grid-cols-3"][levels.length - 1] ?? "grid-cols-3"}`}>
            {levels.map((level, index) => (
              <button
                key={level.id}
                type="button"
                role="radio"
                aria-checked={selected === level.id}
                tabIndex={selected === level.id ? 0 : -1}
                ref={(el) => { options.current[index] = el; }}
                className="opt !min-h-16 !flex-col !justify-center !px-1.5 text-center text-sm leading-snug"
                onClick={() => choose(index, false)}
                onKeyDown={(e) => {
                  if (e.metaKey || e.ctrlKey || e.altKey) return;
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    move(e.key === "ArrowUp" ? -1 : 1);
                  }
                }}
              >
                <EffortMedian level={level.id} label={level.label} />
              </button>
            ))}
          </div>
        </div>
      )}
      <button type="button" className="btn btn-primary mt-5 w-full" onClick={api.next}>
        {card.cta}
        <KeyHint>Enter</KeyHint>
      </button>
    </CardShell>
  );
}

export function ConsentCard({ card }: { card: Of<"consent"> }) {
  const api = useCardApi(card);
  const { state: { consent: initial }, ctx } = api.store.getState();
  const { paradata: allowParadata, metrics, mode } = ctx.settings.storage;
  const [participation, setParticipation] = useState(initial.participation);
  const [paradata, setParadata] = useState(initial.paradata);
  const proceed = () => api.store.getState().acceptConsent(card.id, { participation, paradata: allowParadata && paradata });
  useKeyHandlers({ confirm: proceed });
  return (
    <CardShell api={api} heading={card.title}>
      <p className="whitespace-pre-line">{card.text}</p>
      {card.figure && (
        <a className="mt-3 block" href={card.figure.src} target="_blank" rel="noopener">
          <img className="w-full rounded-lg border border-soft" src={card.figure.src} alt={card.figure.alt} width={1800} height={1000} loading="lazy" />
          <span className="mt-1 block text-sm text-muted">Nagyobb méretben (új lapon nyílik)</span>
        </a>
      )}
      {ctx.settings.display.privacyNotice && (
        <p className="mt-2">
          <a className="text-primary underline" href={ctx.settings.display.privacyNotice} target="_blank" rel="noopener">
            Részletes adatkezelési tájékoztató (új lapon nyílik)
          </a>
        </p>
      )}
      <div className="mt-4 flex flex-col gap-1">
        <label className="flex min-h-12 items-start gap-3 py-2">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-primary" checked={participation} onChange={(e) => setParticipation(e.target.checked)} />
          <span>
            {card.participationLabel} <span className="text-sm text-muted">(kötelező)</span>
          </span>
        </label>
        {allowParadata && <label className="flex min-h-12 items-start gap-3 py-2">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-primary" checked={paradata} onChange={(e) => setParadata(e.target.checked)} />
          <span>
            {card.paradataLabel} <span className="text-sm text-muted">(nem kötelező)</span>
            {allowParadata && metrics && metricsEnabled && (
              <span className="mt-2 block text-sm">
                Befejezéskor elküldjük a választott fokozatot és a kitöltés idejét.
                {ctx.settings.display.scaleInput === "ab_test" &&
                  " A hőmérsékletes kérdésnél a kapott felületet, a válaszadás módját és idejét, valamint a felület értékelését is elküldjük."}
              </span>
            )}
          </span>
        </label>}
      </div>
      {mode === "supabase" && <p className="mt-2 text-sm">A válaszokat befejezéskor a kutatás adatbázisába küldjük.</p>}
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
