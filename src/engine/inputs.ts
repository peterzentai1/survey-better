// Pure helpers for the selection rules of multi_tiles and timeline cards.
import { evaluate, type AnswerView } from "./conditions.ts";
import type { Card, CardOption } from "./schema.ts";

type MultiCard = Extract<Card, { type: "multi_tiles" }>;

/** Options of a card that pass their own showIf. */
export function visibleOptions(card: Card, view: AnswerView): CardOption[] {
  if (card.type !== "single" && card.type !== "multi_tiles") return [];
  return card.options.filter((o) => evaluate(o.showIf, view));
}

/** Options pre-selected the first time a multi_tiles card is shown. */
export function impliedValues(card: MultiCard, view: AnswerView): string[] {
  const implied = visibleOptions(card, view)
    .filter((o) => o.impliedBy !== undefined && evaluate(o.impliedBy, view))
    .map((o) => o.value);
  const exclusive = new Set(card.exclusive ?? []);
  // An exclusive option never combines with others; keep the others in that case.
  const withoutExclusive = implied.filter((v) => !exclusive.has(v));
  const result = withoutExclusive.length > 0 ? withoutExclusive : implied.slice(0, 1);
  return card.max ? result.slice(0, card.max) : result;
}

/**
 * Toggle one option. Exclusive options clear all others and are cleared by any other option.
 * `blocked` is true when `max` prevented a new selection.
 */
export function toggleOption(card: MultiCard, current: string[], value: string): { next: string[]; blocked: boolean } {
  const exclusive = new Set(card.exclusive ?? []);
  if (current.includes(value)) return { next: current.filter((v) => v !== value), blocked: false };
  if (exclusive.has(value)) return { next: [value], blocked: false };
  const base = current.filter((v) => !exclusive.has(v));
  if (card.max !== undefined && base.length >= card.max) return { next: current, blocked: true };
  return { next: [...base, value], blocked: false };
}

/** Add (mode "add") or remove (mode "remove") hours; `max` caps the number of selected hours. */
export function paintHours(
  current: number[],
  hours: number[],
  mode: "add" | "remove",
  max?: number,
): { next: number[]; blocked: boolean } {
  const set = new Set(current);
  let blocked = false;
  for (const h of hours) {
    if (mode === "remove") set.delete(h);
    else if (!set.has(h)) {
      if (max !== undefined && set.size >= max) blocked = true;
      else set.add(h);
    }
  }
  return { next: [...set].sort((a, b) => a - b), blocked };
}
