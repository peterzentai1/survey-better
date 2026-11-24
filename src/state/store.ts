// zustand store around the pure engine: holds the session state, derived path analysis and the undo toast.
import { createStore, type StoreApi } from "zustand/vanilla";
import type { EffortLevelId } from "../engine/effort.ts";
import { analyze, type Analysis, type Ctx } from "../engine/path.ts";
import * as engine from "../engine/session.ts";
import type { SessionState } from "../engine/session.ts";
import { REACTION_CARD, type InputMethod } from "../engine/temperature.ts";
import type { Highlight, ItemValue, ResponseRecord } from "../engine/types.ts";
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
  commit(id: string, value: ItemValue, input?: InputMethod): void;
  setTimingVisible(visible: boolean): void;
  skipCard(id: string): void;
  /** Record consent and advance in one transition. */
  acceptConsent(id: string, consent: { participation: boolean; paradata: boolean }): void;
  setEffortLevel(level: EffortLevelId): void;
  extendEffort(): void;
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
  onComplete?: (state: SessionState, record: ResponseRecord) => void;
}): SessionStore {
  const { ctx, sink, appVersion } = opts;
  // Wall-clock-free dwell timing: a monotonic in-memory mark, never stored or exported as such.
  let shownMark = performance.now();
  let visible = typeof document === "undefined" || !document.hidden;
  function checkpoint(s: SessionState): SessionState {
    const now = performance.now();
    const elapsed = visible ? now - shownMark : 0;
    shownMark = now;
    const id = engine.currentId(s);
    return id && elapsed > 0 && !s.completed ? engine.addParadata(s, id, { dwellMs: elapsed }) : s;
  }
  let toastSeq = 0;

  const persist = (s: SessionState, justCompleted: boolean) => {
    if (!s.consent.participation) return;
    const record = engine.buildRecord(ctx, s, appVersion);
    try {
      sink.save(s, record);
    } catch {
      /* a sink failure must never break the questionnaire */
    }
    if (justCompleted) opts.onComplete?.(s, record);
  };

  return createStore<StoreState>((set, get) => {
    /** Replace the state, refresh the analysis and persist. */
    const apply = (state: SessionState, extra: Partial<StoreState> = {}) => {
      const justCompleted = state.completed && !get().state.completed;
      set({ state, analysis: analyze(ctx, state.items, state.effortLevel), ...extra });
      persist(state, justCompleted);
    };
    /** Navigation: add dwell time for the card being left, then apply the transition. */
    const navigate = (fn: (s: SessionState) => SessionState, extra: Partial<StoreState> = {}) => {
      const s = get().state;
      const next = fn(checkpoint(s));
      apply(next, { navCount: get().navCount + 1, ...extra });
    };

    return {
      ctx,
      appVersion,
      state: opts.initial,
      analysis: analyze(ctx, opts.initial.items, opts.initial.effortLevel),
      toast: null,
      navCount: 0,

      setTimingVisible: (nextVisible) => {
        if (visible === nextVisible) return;
        const previous = get().state;
        const state = checkpoint(previous);
        visible = nextVisible;
        if (state !== previous) apply(state);
      },
      commit: (id, value, input) => {
        const s = checkpoint(get().state);
        const entry = s.paradata?.[id];
        const first = ctx.settings.display.scaleInput === "ab_test" && id === REACTION_CARD && input && entry && !entry.firstAnswer
          && s.items[id]?.status === "shown";
        const timed = first ? { ...s, paradata: { ...s.paradata, [id]: {
          ...entry, firstAnswer: { input, ms: Math.round(entry.dwellMs / 100) * 100 },
        } } } : s;
        apply(engine.answer(ctx, timed, id, value));
      },
      skipCard: (id) => apply(engine.skip(ctx, get().state, id)),
      acceptConsent: (id, consent) => {
        if (!consent.participation) return;
        // Measure time on the consent card using the consent in effect while it was open.
        navigate((s) => engine.advance(ctx, engine.acceptConsent(ctx, s, id, consent)), { toast: null });
      },
      setEffortLevel: (level) => {
        const s = get().state;
        const next = engine.setEffortLevel(ctx, s, level);
        if (next !== s) apply(next);
      },
      setHighlights: (h) => apply(engine.setHighlights(get().state, h)),

      next: () => navigate((s) => engine.advance(ctx, s), { toast: null }),
      nextFrom: (id) => {
        if (engine.currentId(get().state) === id) get().next();
      },
      back: () => navigate((s) => engine.goBack(ctx, s), { toast: null }),
      jumpTo: (id) => navigate((s) => engine.jumpTo(ctx, s, id), { toast: null }),
      extendEffort: () => navigate((s) => engine.extendEffort(ctx, s), { toast: null }),

      answerAndAdvanceWithUndo: (id, value, message) => {
        const before = checkpoint(get().state);
        const answered = engine.answer(ctx, before, id, value);
        const advanced = engine.advance(ctx, answered);
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
        // Undo the answer and the navigation while retaining time actually spent on both cards.
        const { paradata } = checkpoint(get().state);
        const restored = paradata && t.snapshot.consent.paradata ? { ...t.snapshot, paradata } : t.snapshot;
        apply(restored, { toast: null, navCount: get().navCount + 1 });
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
