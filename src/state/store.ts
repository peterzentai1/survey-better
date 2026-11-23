// zustand store around the pure engine: holds the session state, derived path analysis and the undo toast.
import { createStore, type StoreApi } from "zustand/vanilla";
import { analyze, type Analysis, type Ctx } from "../engine/path.ts";
import * as engine from "../engine/session.ts";
import type { SessionState } from "../engine/session.ts";
import type { Highlight, ItemValue } from "../engine/types.ts";
import type { ResponseSink } from "../storage/sinks.ts";

export interface Toast {
  id: number;
  message: string;
  /** State before the gesture answer; restored by undo. */
  snapshot: SessionState;
  /** Card shown after the answer; the undo is only valid while that card is current. */
  expectId: string;
}

export interface StoreState {
  ctx: Ctx;
  appVersion: string;
  state: SessionState;
  analysis: Analysis;
  toast: Toast | null;
  /** Bumps whenever a card is entered or left by navigation (used to reset per-card UI such as focus). */
  navCount: number;
  // actions
  commit(id: string, value: ItemValue): void;
  skipCard(id: string): void;
  acceptConsent(id: string, consent: { participation: boolean; paradata: boolean }): void;
  setHighlights(highlights: Highlight[]): void;
  /** Continue from the current card (in jump mode: back to the summary or the next new card). */
  next(): void;
  /** Continue only if `id` is still the current card (used by delayed auto-advance). */
  nextFrom(id: string): void;
  back(): void;
  jumpTo(id: string): void;
  /** Gesture answer: commit, advance at once, and offer an undo for a few seconds. */
  answerAndAdvanceWithUndo(id: string, value: ItemValue, message: string): void;
  undo(): void;
  dismissToast(): void;
  submit(): void;
  recordInput(kind: "tap" | "key" | "drag"): void;
}

export type SessionStore = StoreApi<StoreState>;

export function createSessionStore(opts: {
  ctx: Ctx;
  sink: ResponseSink;
  appVersion: string;
  initial: SessionState;
}): SessionStore {
  const { ctx, sink, appVersion } = opts;
  // Wall-clock-free dwell timing: a monotonic in-memory mark, never stored or exported as such.
  let shownMark = performance.now();
  let toastSeq = 0;

  const persist = (s: SessionState) => {
    try {
      sink.save(s, engine.buildRecord(ctx, s, appVersion));
    } catch {
      /* a sink failure must never break the questionnaire */
    }
  };

  return createStore<StoreState>((set, get) => {
    /** Replace the state, refresh the analysis and persist. */
    const apply = (state: SessionState, extra: Partial<StoreState> = {}) => {
      set({ state, analysis: analyze(ctx, state.items), ...extra });
      persist(state);
    };
    /** Navigation: add dwell time for the card being left, then apply the transition. */
    const navigate = (fn: (s: SessionState) => SessionState, extra: Partial<StoreState> = {}) => {
      const s = get().state;
      const left = engine.currentId(s);
      const now = performance.now();
      const withDwell = left ? engine.addParadata(s, left, { dwellMs: now - shownMark }) : s;
      const next = fn(withDwell);
      shownMark = now;
      apply(next, { navCount: get().navCount + 1, ...extra });
    };

    return {
      ctx,
      appVersion,
      state: opts.initial,
      analysis: analyze(ctx, opts.initial.items),
      toast: null,
      navCount: 0,

      commit: (id, value) => apply(engine.answer(ctx, get().state, id, value)),
      skipCard: (id) => apply(engine.skip(ctx, get().state, id)),
      acceptConsent: (id, consent) => apply(engine.acceptConsent(ctx, get().state, id, consent)),
      setHighlights: (h) => apply(engine.setHighlights(get().state, h)),

      next: () => navigate((s) => engine.advance(ctx, s), { toast: null }),
      nextFrom: (id) => {
        if (engine.currentId(get().state) === id) get().next();
      },
      back: () => navigate((s) => engine.goBack(s), { toast: null }),
      jumpTo: (id) => navigate((s) => engine.jumpTo(ctx, s, id), { toast: null }),

      answerAndAdvanceWithUndo: (id, value, message) => {
        const before = get().state;
        const answered = engine.answer(ctx, before, id, value);
        const advanced = engine.advance(ctx, engine.addParadata(answered, id, { dwellMs: performance.now() - shownMark }));
        shownMark = performance.now();
        const expectId = engine.currentId(advanced);
        apply(advanced, {
          navCount: get().navCount + 1,
          toast: expectId ? { id: ++toastSeq, message, snapshot: before, expectId } : null,
        });
      },
      undo: () => {
        const t = get().toast;
        if (!t || engine.currentId(get().state) !== t.expectId) {
          set({ toast: null });
          return;
        }
        shownMark = performance.now();
        apply(t.snapshot, { toast: null, navCount: get().navCount + 1 });
      },
      dismissToast: () => set({ toast: null }),

      submit: () => {
        const summary = ctx.summaryId;
        navigate((s) => engine.submit(ctx, s, summary), { toast: null });
      },
      recordInput: (kind) => {
        const s = get().state;
        const id = engine.currentId(s);
        if (!id || !s.consent.paradata) return;
        // Paradata only: counts are never used to derive an answer.
        set({ state: engine.addParadata(s, id, { [kind]: 1 }) });
      },
    };
  });
}
