// Scripted respondent: which cards would be shown for a given set of answers.
// Used by validate-content and by the content author.
import type { EffortLevelId } from "./effort.ts";
import { visibleOptions } from "./inputs.ts";
import { analyze, makeCtx } from "./path.ts";
import type { Bank, Card, Devices } from "./schema.ts";
import { acceptConsent, advance, answer, createSession, currentId, setEffortLevel, skip, type SessionState } from "./session.ts";
import type { ItemValue } from "./types.ts";

export const SKIP = "skip" as const;

export interface Strategy {
  effortLevel?: EffortLevelId;
  /** Explicit answers by card id; SKIP skips the card (if it is skippable). */
  answers?: Record<string, ItemValue | typeof SKIP>;
  /** Appliance ids the respondent owns: answers the devicePicker card with those it offers. */
  owned?: string[];
  /** For cards without an explicit answer: "first" answers with a default, "skip" skips skippable cards. */
  defaultPolicy?: "first" | "skip";
  /** Value used for scale6 cards by the default policy (1-6, default 4). */
  scaleValue?: number;
}

export interface SimResult {
  /** Card ids shown, in presentation order. */
  path: string[];
  quotas: Record<string, number>;
  owned: string[];
  state: SessionState;
}

function defaultValue(card: Card, state: SessionState, ctx: ReturnType<typeof makeCtx>, st: Strategy): ItemValue | typeof SKIP {
  const view = analyze(ctx, state.items, state.effortLevel).view;
  switch (card.type) {
    case "single":
      return visibleOptions(card, view)[0]?.value ?? SKIP;
    case "multi_tiles": {
      const offered = visibleOptions(card, view).map((o) => o.value);
      if (card.devicePicker) {
        const own = (st.owned ?? []).filter((v) => offered.includes(v));
        if (own.length > 0) return own;
        const none = (card.exclusive ?? []).find((v) => offered.includes(v));
        return none ? [none] : [];
      }
      const prefilled = state.items[card.id]?.value;
      if (Array.isArray(prefilled) && prefilled.length > 0) return prefilled;
      return offered.length ? [offered[0]] : [];
    }
    case "yesno":
      return "igen";
    case "scale6":
      return st.scaleValue ?? 4;
    case "timeline":
      return [12];
    case "free_text":
      return "x";
    default:
      return SKIP;
  }
}

export function simulatePath(bank: Bank, devices: Devices, strategy: Strategy = {}, sessionId = "simulate"): SimResult {
  const ctx = makeCtx(bank, devices, sessionId);
  let s = createSession(ctx, { sessionId, startedDate: "2000-01-01" });
  if (strategy.effortLevel) s = setEffortLevel(ctx, s, strategy.effortLevel);
  for (let guard = 0; guard < ctx.deck.order.length * 2 + 5; guard++) {
    const id = currentId(s);
    if (id === undefined) break;
    const card = ctx.byId.get(id)!;
    if (card.type === "summary_highlight") break;
    if (card.type === "consent") s = acceptConsent(ctx, s, id, { participation: true, paradata: false });
    else if (card.type !== "info") {
      const explicit = strategy.answers?.[id];
      let v: ItemValue | typeof SKIP | undefined = explicit;
      if (v === undefined) {
        const picker = card.type === "multi_tiles" && card.devicePicker;
        v = strategy.defaultPolicy === "skip" && card.skip && !picker ? SKIP : defaultValue(card, s, ctx, strategy);
      }
      s = v === SKIP ? (card.skip ? skip(ctx, s, id) : answer(ctx, s, id, defaultValue(card, s, ctx, strategy) as ItemValue)) : answer(ctx, s, id, v);
    }
    s = advance(ctx, s);
    if (s.completed) break;
  }
  const a = analyze(ctx, s.items, s.effortLevel);
  return { path: [...s.order], quotas: a.quotas, owned: [...a.owned], state: s };
}
