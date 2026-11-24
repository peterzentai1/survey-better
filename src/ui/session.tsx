// React glue: store context, per-card hook and the registry the global key handler dispatches to.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useStore } from "zustand";
import type { Card } from "../engine/schema.ts";
import type { ItemValue } from "../engine/types.ts";
import type { SessionStore, StoreState } from "../state/store.ts";

export const AUTO_ADVANCE_MS = 350;

export const StoreContext = createContext<SessionStore | null>(null);

export function useSessionStore(): SessionStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreContext missing");
  return s;
}

export function useSel<T>(selector: (s: StoreState) => T): T {
  return useStore(useSessionStore(), selector);
}

/** Handlers a card registers for the global keyboard shortcuts. */
export interface KeyHandlers {
  yes?: () => void;
  no?: () => void;
  digit?: (n: number) => void;
  confirm?: () => void;
  skip?: () => void;
}

export const KeyRegistry = createContext<MutableRefObject<KeyHandlers | null> | null>(null);

export function useKeyHandlers(handlers: KeyHandlers) {
  const ref = useContext(KeyRegistry);
  const mine = useRef(handlers);
  useLayoutEffect(() => {
    mine.current = handlers;
    if (ref) ref.current = handlers;
  });
  useEffect(
    () => () => {
      // The next card's layout effect runs before this passive cleanup: only clear our own entry.
      if (ref && ref.current === mine.current) ref.current = null;
    },
    [ref],
  );
}

export interface CardApi {
  card: Card;
  item: StoreState["state"]["items"][string] | undefined;
  analysis: StoreState["analysis"];
  /** Card text with the matching text variant applied. */
  text: string;
  /** True while editing a card reached from the summary. */
  inJump: boolean;
  commit(value: ItemValue): void;
  /** Record the skip; moves on unless editing from the summary. */
  skip(): void;
  next(): void;
  /** Move on after 350 ms (cancelled on unmount and when not in the normal flow). */
  autoAdvance(): void;
  store: SessionStore;
}

export function cardText(card: Card, variant?: number): string {
  return (variant === undefined ? undefined : card.textVariants?.[variant]?.text) ?? card.text;
}

export function useCardApi(card: Card): CardApi {
  const store = useSessionStore();
  const item = useSel((s) => s.state.items[card.id]);
  const analysis = useSel((s) => s.analysis);
  const inJump = useSel((s) => s.state.jumpFrom !== null && s.state.history[s.state.history.length - 1] !== s.state.jumpFrom);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const text = cardText(card, item?.variant);

  const commit = useCallback((value: ItemValue) => store.getState().commit(card.id, value), [store, card.id]);
  const next = useCallback(() => store.getState().next(), [store]);
  const autoAdvance = useCallback(() => {
    if (store.getState().state.jumpFrom !== null) return;
    window.clearTimeout(timer.current);
    // Only advance if this card is still the current one when the timer fires.
    timer.current = window.setTimeout(() => store.getState().nextFrom(card.id), AUTO_ADVANCE_MS);
  }, [store, card.id]);
  const skip = useCallback(() => {
    store.getState().skipCard(card.id);
    if (store.getState().state.jumpFrom === null) store.getState().next();
  }, [store, card.id]);

  return useMemo(
    () => ({ card, item, analysis, text, inJump, commit, skip, next, autoAdvance, store }),
    [card, item, analysis, text, inJump, commit, skip, next, autoAdvance, store],
  );
}
