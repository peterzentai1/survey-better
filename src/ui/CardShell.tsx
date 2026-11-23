// Common frame of every card: lead line, heading (receives focus), help text, controls, skip button.
import { useEffect, useRef, type ReactNode } from "react";
import type { CardApi } from "./session.tsx";

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="kbd-hint" aria-hidden="true">
      {children}
    </kbd>
  );
}

export function ReturnToSummary({ api }: { api: CardApi }) {
  const answered = api.item?.status === "answered" || api.item?.status === "skipped";
  return (
    <div className="mb-3">
      <button type="button" className={`btn w-full ${answered ? "btn-primary" : ""}`} onClick={api.next}>
        Vissza az összegzéshez
      </button>
    </div>
  );
}

/** Splits a card text into scenario body (all lines but the last) and the question (last non-empty line). */
export function splitScenario(text: string): { body: string | undefined; question: string } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { body: undefined, question: text.trim() };
  const question = lines.pop()!.trim();
  return { body: lines.join("\n").trim(), question };
}

export function CardShell({
  api,
  heading,
  children,
  skippable = true,
}: {
  api: CardApi;
  /** Overrides the heading (info and consent cards use their title). */
  heading?: string;
  children: ReactNode;
  skippable?: boolean;
}) {
  const { card } = api;
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // New card: focus its heading so screen readers and keyboard users start here.
    ref.current?.focus();
    window.scrollTo?.(0, 0);
  }, []);
  const lead = "lead" in card ? card.lead : undefined;
  const help = "help" in card ? card.help : undefined;
  const skipped = api.item?.status === "skipped";
  // A multi-line text is a scenario: everything but the last line is body copy,
  // and only the last line (the question) is the heading. Keeps answers above the fold on phones.
  const { body, question } = heading !== undefined ? { body: undefined, question: heading } : splitScenario(api.text);
  const bodyId = `b-${card.id}`;
  return (
    <section aria-labelledby={`h-${card.id}`} data-card={card.id}>
      {api.inJump && <ReturnToSummary api={api} />}
      <div className="card-panel">
        {lead && <p className="mb-2 text-sm text-muted whitespace-pre-line">{lead}</p>}
        {body && (
          <p id={bodyId} className="mb-3 leading-relaxed whitespace-pre-line">
            {body}
          </p>
        )}
        <h2
          id={`h-${card.id}`}
          ref={ref}
          tabIndex={-1}
          aria-describedby={body ? bodyId : undefined}
          className="text-xl font-semibold leading-snug whitespace-pre-line"
        >
          {question}
        </h2>
        {help && <p className="mt-2 text-sm text-muted">{help}</p>}
        {skipped && <p className="mt-2 text-sm text-muted">Ezt a kérdést korábban kihagyta.</p>}
        <div className="mt-4">{children}</div>
      </div>
      {skippable && card.skip && (
        <div className="mt-3">
          <button type="button" className="btn btn-quiet w-full" onClick={api.skip}>
            {card.skipLabel}
            <KeyHint>K</KeyHint>
          </button>
        </div>
      )}
    </section>
  );
}
