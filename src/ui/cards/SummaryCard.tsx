// summary_highlight: counts per block, jump back to skipped cards, highlight up to `max` topics, submit.
import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { useState } from "react";
import { nextEffortLevel } from "../../engine/effort.ts";
import { summaryStats } from "../../engine/session.ts";
import type { Card } from "../../engine/schema.ts";
import type { Highlight } from "../../engine/types.ts";
import { CardShell, splitScenario } from "../CardShell.tsx";
import { cardText, useCardApi, useKeyHandlers, useSel } from "../session.tsx";

function excerpt(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 90 ? `${one.slice(0, 87)}…` : one;
}

export function SummaryCard({ card }: { card: Extract<Card, { type: "summary_highlight" }> }) {
  const api = useCardApi(card);
  const { ctx } = api.store.getState();
  const state = useSel((s) => s.state);
  const stats = summaryStats(ctx, state);
  const visibleBlocks = stats.blocks.filter((b) => b.answered + b.skipped > 0);
  const [highlights, setHighlights] = useState<Highlight[]>(state.highlights);
  const [note, setNote] = useState("");

  const save = (next: Highlight[]) => {
    setHighlights(next);
    api.store.getState().setHighlights(next);
  };
  const starred = (id: string) => highlights.find((h) => h.topic === id);
  const toggleTopic = (id: string) => {
    if (starred(id)) {
      setNote("");
      save(highlights.filter((h) => h.topic !== id));
    } else if (highlights.length >= card.max) {
      setNote(`Legfeljebb ${card.max} téma emelhető ki. Vegyen le egy csillagot, ha másikat jelölne.`);
    } else {
      setNote("");
      save([...highlights, { topic: id }]);
    }
  };
  const patch = (id: string, change: Partial<Highlight>) =>
    save(
      highlights.map((h) => {
        if (h.topic !== id) return h;
        const next = { ...h, ...change };
        if (next.statement === undefined) delete next.statement;
        if (!next.text) delete next.text;
        return next;
      }),
    );

  const skippedLabel = (id: string) => {
    const c = ctx.byId.get(id);
    return c ? excerpt(splitScenario(cardText(c, state.items[id]?.variant)).question) : id;
  };
  useKeyHandlers({});

  return (
    <CardShell api={api} skippable={false}>
      <h3 className="text-lg font-semibold">Összegzés</h3>
      <ul className="mt-1 divide-y divide-soft">
        {visibleBlocks.map((b) => (
          <li key={b.id} className="flex justify-between gap-3 py-1.5">
            <span>{b.title}</span>
            <span className="text-muted">
              {b.answered} megválaszolva{b.skipped > 0 ? `, ${b.skipped} kihagyva` : ""}
            </span>
          </li>
        ))}
      </ul>

      {ctx.settings.display.effortSelector && nextEffortLevel(state.effortLevel) !== undefined && (
        <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => api.store.getState().extendEffort()}>
          Van még néhány perce? További kérdések
        </button>
      )}

      {stats.skippedIds.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Kihagyott kérdések</h3>
          <p className="text-sm text-muted">Ha szeretné, válaszoljon rájuk most.</p>
          <ul className="mt-1 flex flex-col gap-1">
            {stats.skippedIds.map((id) => (
              <li key={id}>
                <button type="button" className="btn btn-quiet !min-h-12 w-full !justify-start !text-left !text-primary" onClick={() => api.store.getState().jumpTo(id)}>
                  {skippedLabel(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-lg font-semibold">Kiemelés</h3>
        <ul className="mt-2 flex flex-col gap-3">
          {card.topics.map((t) => {
            const h = starred(t.id);
            return (
              <li key={t.id} className="rounded-xl border-2 border-soft p-2">
                <button type="button" className="opt" aria-pressed={!!h} onClick={() => toggleTopic(t.id)}>
                  {h ? <IconStarFilled size={24} aria-hidden="true" className="mr-3 shrink-0 text-primary" /> : <IconStar size={24} aria-hidden="true" className="mr-3 shrink-0" />}
                  <span>{t.label}</span>
                </button>
                {h && (
                  <div className="mt-2 flex flex-col gap-2 px-1">
                    {t.statements && t.statements.length > 0 && (
                      <div role="radiogroup" aria-label={`${t.label}: kész állítások`} className="flex flex-col gap-2">
                        {t.statements.map((st) => (
                          <button
                            key={st}
                            type="button"
                            role="radio"
                            aria-checked={h.statement === st}
                            className="opt"
                            onClick={() => patch(t.id, { statement: h.statement === st ? undefined : st })}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="text-sm text-muted" htmlFor={`own-${t.id}`}>
                      Saját szavaival (nem kötelező)
                    </label>
                    <textarea
                      id={`own-${t.id}`}
                      className="min-h-24 w-full rounded-xl border-2 border-line bg-surface p-3"
                      maxLength={card.maxLength}
                      value={h.text ?? ""}
                      onChange={(e) => patch(t.id, { text: e.target.value })}
                      aria-describedby={`pn-${t.id}`}
                    />
                    <div className="flex justify-between gap-3 text-sm text-muted">
                      <span id={`pn-${t.id}`}>{card.privacyNote}</span>
                      <span className="shrink-0">
                        {(h.text ?? "").length}/{card.maxLength}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p role="status" className="mt-2 min-h-5 text-sm text-danger">
          {note}
        </p>
      </div>

      <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => api.store.getState().submit()}>
        Beküldés
      </button>
    </CardShell>
  );
}
