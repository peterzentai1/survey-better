// Session state transitions. Pure and immutable: every function returns a new state.
import { REACTION_CARD, temperatureArm } from "./temperature.ts";
import { evaluate } from "./conditions.ts";
import { nextEffortLevel, type EffortLevelId } from "./effort.ts";
import { impliedValues } from "./inputs.ts";
import { analyze, type Ctx } from "./path.ts";
import { isAnswerable } from "./schema.ts";
import type { Highlight, ItemRecord, ItemValue, ParadataEntry, ResponseRecord } from "./types.ts";

export interface SessionState {
  sessionId: string;
  startedDate: string;
  bankVersion: string;
  items: Record<string, ItemRecord>;
  /** Presentation order: card ids in the order they were first shown. */
  order: string[];
  /** Stack of visited cards; the last one is the current card. */
  history: string[];
  /** Set while the respondent edits a card reached from the summary: the summary card id. */
  jumpFrom: string | null;
  consent: { participation: boolean; paradata: boolean };
  effortLevel?: EffortLevelId;
  effortChangedFromDefault?: true;
  /** Original effort while answering extra questions opened from the summary. */
  extensionFrom?: EffortLevelId;
  highlights: Highlight[];
  completed: boolean;
  /** Raw accumulated paradata; only ever present after the paradata consent box was ticked. */
  paradata?: Record<string, ParadataEntry>;
  /** True when timing consent was continuous from the first consent screen. */
  fullTiming?: true;
}

export function currentId(s: SessionState): string | undefined {
  return s.history[s.history.length - 1];
}

function sameValue(a: ItemValue | undefined, b: ItemValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Local calendar date as YYYY-MM-DD (date only, no time). */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mark stored-but-off-path items `inactive`; clear the mark on items back on the path. */
export function reconcile(ctx: Ctx, s: SessionState): SessionState {
  const { pathSet } = analyze(ctx, s.items, s.effortLevel);
  let changed = false;
  const items: Record<string, ItemRecord> = {};
  for (const [id, it] of Object.entries(s.items)) {
    const shouldBeInactive = !pathSet.has(id);
    if (shouldBeInactive && !it.inactive) {
      items[id] = { ...it, inactive: true };
      changed = true;
    } else if (!shouldBeInactive && it.inactive) {
      const { inactive: _drop, ...rest } = it;
      void _drop;
      items[id] = rest;
      changed = true;
    } else items[id] = it;
  }
  return changed ? { ...s, items } : s;
}

/** Make a card current-visible: create its item on first show, record the text variant. */
function show(ctx: Ctx, s: SessionState, id: string): SessionState {
  const card = ctx.byId.get(id);
  if (!card) return s;
  const { view } = analyze(ctx, s.items, s.effortLevel);
  const existing = s.items[id];
  let item: ItemRecord = existing ?? { status: "shown", changes: 0, position: s.order.length };
  if (!existing && card.type === "multi_tiles") {
    const implied = impliedValues(card, view);
    if (implied.length > 0) item = { ...item, value: implied };
  }
  const idx = card.textVariants?.findIndex((v) => evaluate(v.when, view)) ?? -1;
  if (idx >= 0) item = { ...item, variant: idx };
  else if (item.variant !== undefined) {
    const { variant: _v, ...rest } = item;
    void _v;
    item = rest;
  }
  return {
    ...s,
    items: { ...s.items, [id]: item },
    order: existing ? s.order : [...s.order, id],
  };
}

export function createSession(ctx: Ctx, init: { sessionId: string; startedDate: string }): SessionState {
  const base: SessionState = {
    sessionId: init.sessionId,
    startedDate: init.startedDate,
    bankVersion: ctx.bank.version,
    items: {},
    order: [],
    history: [],
    jumpFrom: null,
    consent: { participation: false, paradata: false },
    ...(ctx.bank.effortLevels ? { effortLevel: ctx.settings.display.defaultEffort } : {}),
    highlights: [],
    completed: false,
  };
  const first = analyze(ctx, base.items, base.effortLevel).path[0];
  if (!first) return base;
  return show(ctx, { ...base, history: [first] }, first);
}

export function setEffortLevel(ctx: Ctx, s: SessionState, level: EffortLevelId): SessionState {
  const first = ctx.deck.order[0];
  if (currentId(s) !== first || ctx.byId.get(first)?.type !== "info") return s;
  if (level === s.effortLevel || !ctx.bank.effortLevels?.some((e) => e.id === level)) return s;
  const changed = s.consent.paradata && level !== ctx.settings.display.defaultEffort;
  return reconcile(ctx, { ...s, effortLevel: level, ...(changed ? { effortChangedFromDefault: true as const } : {}) });
}

function ensureItem(s: SessionState, id: string): ItemRecord {
  return s.items[id] ?? { status: "shown", changes: 0 };
}

export function answer(ctx: Ctx, s: SessionState, id: string, value: ItemValue): SessionState {
  const prev = ensureItem(s, id);
  const had = prev.status === "answered" || prev.status === "skipped";
  const same = prev.status === "answered" && sameValue(prev.value, value);
  const { inactive: _i, ...rest } = prev;
  void _i;
  const item: ItemRecord = { ...rest, status: "answered", value, changes: prev.changes + (had && !same ? 1 : 0) };
  return reconcile(ctx, { ...s, items: { ...s.items, [id]: item } });
}

export function skip(ctx: Ctx, s: SessionState, id: string): SessionState {
  const prev = ensureItem(s, id);
  const had = prev.status === "answered" || prev.status === "skipped";
  const { inactive: _i, value: _v, ...rest } = prev;
  void _i;
  void _v;
  const item: ItemRecord = { ...rest, status: "skipped", changes: prev.changes + (had && prev.status !== "skipped" ? 1 : 0) };
  return reconcile(ctx, { ...s, items: { ...s.items, [id]: item } });
}

/** Consent card: participation is required; paradata is optional and removed again when unticked. */
export function acceptConsent(
  ctx: Ctx,
  s: SessionState,
  id: string,
  consent: { participation: boolean; paradata: boolean },
): SessionState {
  if (!consent.participation) return s;
  const paradata = consent.paradata && ctx.settings.storage.paradata;
  const next = answer(ctx, { ...s, consent: { participation: true, paradata } }, id, true);
  if (paradata) {
    return {
      ...next,
      paradata: next.paradata ?? {},
      ...(!s.consent.participation ? { fullTiming: true as const } : {}),
      ...(s.effortLevel && s.effortLevel !== ctx.settings.display.defaultEffort ? { effortChangedFromDefault: true as const } : {}),
    };
  }
  return withoutParadata(next);
}

function withoutParadata(state: SessionState): SessionState {
  const { paradata: _p, fullTiming: _timing, effortChangedFromDefault: _changed, ...rest } = state;
  void _changed;
  void _timing;
  void _p;
  return { ...rest, consent: { ...rest.consent, paradata: false } };
}

export function setHighlights(s: SessionState, highlights: Highlight[]): SessionState {
  return { ...s, highlights };
}

export function submit(ctx: Ctx, s: SessionState, summaryId?: string): SessionState {
  const withItem = summaryId ? answer(ctx, s, summaryId, true) : s;
  return { ...withItem, completed: true };
}

function additionalQuestion(ctx: Ctx, s: SessionState, previousLevel: EffortLevelId, candidates: string[]) {
  const { pathSet } = analyze(ctx, s.items, previousLevel);
  return candidates.find((id) => {
    const status = s.items[id]?.status;
    return !pathSet.has(id) && status !== "answered" && status !== "skipped";
  });
}

/** Move up one level from the summary and open the first unanswered addition in deck order. */
export function extendEffort(ctx: Ctx, s: SessionState): SessionState {
  const current = s.effortLevel;
  const next = nextEffortLevel(current);
  if (current === undefined || next === undefined || ctx.summaryId === undefined || currentId(s) !== ctx.summaryId) return s;
  const raised = reconcile(ctx, { ...s, effortLevel: next });
  const first = additionalQuestion(ctx, raised, current, analyze(ctx, raised.items, next).path);
  return first === undefined ? raised : jumpTo(ctx, { ...raised, extensionFrom: current }, first);
}

/** Next card: successor on the path, or the next new card when working from the summary. */
export function advance(ctx: Ctx, s: SessionState): SessionState {
  const cur = currentId(s);
  if (cur === undefined) return s;
  const { path } = analyze(ctx, s.items, s.effortLevel);
  const after = path.slice(path.indexOf(cur) + 1);
  if (s.jumpFrom !== null && cur !== s.jumpFrom) {
    const unseen = s.extensionFrom === undefined
      ? after.find((id) => !s.items[id] && id !== s.jumpFrom)
      : additionalQuestion(ctx, s, s.extensionFrom, after);
    if (unseen !== undefined) return show(ctx, { ...s, history: [...s.history, unseen] }, unseen);
    const at = s.history.indexOf(s.jumpFrom);
    return { ...s, history: s.history.slice(0, at + 1), jumpFrom: null, extensionFrom: undefined };
  }
  const next = after[0];
  if (next === undefined) return { ...s, completed: true };
  return show(ctx, { ...s, history: [...s.history, next] }, next);
}

export function goBack(ctx: Ctx, s: SessionState): SessionState {
  if (s.history.length <= 1) return s;
  const history = s.history.slice(0, -1);
  const left = s.history[s.history.length - 1];
  const jumpFrom = history[history.length - 1] === s.jumpFrom ? null : s.jumpFrom;
  const previous = addParadata({ ...s, history, jumpFrom }, left, { backNavs: 1 });
  if (jumpFrom === null && s.extensionFrom !== undefined)
    return reconcile(ctx, { ...previous, effortLevel: s.extensionFrom, extensionFrom: undefined });
  return previous;
}

/** From the summary: open an earlier card for editing. */
export function jumpTo(ctx: Ctx, s: SessionState, id: string): SessionState {
  const cur = currentId(s);
  if (cur === undefined) return s;
  return show(ctx, { ...s, history: [...s.history, id], jumpFrom: cur }, id);
}

export function addParadata(
  s: SessionState,
  id: string,
  delta: { dwellMs?: number; tap?: number; key?: number; drag?: number; backNavs?: number },
): SessionState {
  // Collected only with the explicit paradata consent.
  if (!s.consent.paradata || !s.paradata) return s;
  const prev = s.paradata[id] ?? { dwellMs: 0, inputs: { tap: 0, key: 0, drag: 0 }, backNavs: 0 };
  const entry: ParadataEntry = {
    ...prev,
    dwellMs: prev.dwellMs + (delta.dwellMs ?? 0),
    inputs: {
      tap: prev.inputs.tap + (delta.tap ?? 0),
      key: prev.inputs.key + (delta.key ?? 0),
      drag: prev.inputs.drag + (delta.drag ?? 0),
    },
    backNavs: prev.backNavs + (delta.backNavs ?? 0),
  };
  return { ...s, paradata: { ...s.paradata, [id]: entry } };
}

export interface SummaryStats {
  blocks: { id: string; title: string; answered: number; skipped: number }[];
  skippedIds: string[];
}

/** Answered and skipped counts per block, over answerable cards on the current path. */
export function summaryStats(ctx: Ctx, s: SessionState): SummaryStats {
  const { path } = analyze(ctx, s.items, s.effortLevel);
  const blocks = ctx.bank.blocks.map((b) => ({ id: b.id, title: b.title, answered: 0, skipped: 0 }));
  const skippedIds: string[] = [];
  for (const id of path) {
    const card = ctx.byId.get(id)!;
    if (!isAnswerable(card)) continue;
    const st = s.items[id]?.status;
    const b = blocks.find((x) => x.id === card.block);
    if (st === "answered" && b) b.answered++;
    if (st === "skipped" && b) {
      b.skipped++;
      skippedIds.push(id);
    }
  }
  return { blocks, skippedIds };
}

export const RESPONSE_SCHEMA = "kartya-kerdoiv-response/0.1" as const;

export function buildRecord(ctx: Ctx, s: SessionState, appVersion: string): ResponseRecord {
  const items: Record<string, ItemRecord> = {};
  for (const id of ctx.deck.order) items[id] = s.items[id] ?? { status: "not_shown", changes: 0 };
  const record: ResponseRecord = {
    schema: RESPONSE_SCHEMA,
    sessionId: s.sessionId,
    bankVersion: s.bankVersion,
    weightsVersion: ctx.devices.version,
    appVersion,
    startedDate: s.startedDate,
    completed: s.completed,
    consent: { ...s.consent },
    items,
    order: [...s.order],
    randomization: ctx.deck.randomization,
    quotas: analyze(ctx, s.items, s.effortLevel).quotas,
    highlights: s.highlights,
  };
  if (s.consent.participation && s.effortLevel !== undefined) {
    record.effortLevel = s.effortLevel;
    if (s.consent.paradata) record.effortChangedFromDefault = s.effortChangedFromDefault ?? (s.effortLevel !== ctx.settings.display.defaultEffort);
  }
  if (s.consent.participation && ctx.settings.display.scaleInput === "ab_test" &&
      ctx.byId.get(REACTION_CARD)?.type === "scale6") record.temperatureArm = temperatureArm(s.sessionId);
  if (s.consent.paradata && s.paradata) {
    record.paradata = Object.fromEntries(
      Object.entries(s.paradata).map(([id, p]) => [id, { ...p, dwellMs: Math.round(p.dwellMs / 100) * 100 }]),
    );
  }
  return record;
}

/** Check a stored snapshot against the current bank; null when it does not fit (stale or corrupt). */
export function validateSnapshot(ctx: Ctx, raw: unknown): SessionState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<SessionState>;
  const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string" && ctx.byId.has(x));
  if (typeof s.sessionId !== "string" || typeof s.startedDate !== "string") return null;
  if (s.bankVersion !== ctx.bank.version || s.completed === true) return null;
  if (!ids(s.history) || s.history.length === 0 || !ids(s.order)) return null;
  if (typeof s.items !== "object" || s.items === null) return null;
  if (!Object.keys(s.items).every((id) => ctx.byId.has(id))) return null;
  if (typeof s.consent?.participation !== "boolean" || typeof s.consent?.paradata !== "boolean") return null;
  if (!Array.isArray(s.highlights)) return null;
  if (s.jumpFrom !== null && s.jumpFrom !== undefined && !ctx.byId.has(s.jumpFrom)) return null;
  if (s.effortLevel !== undefined && !ctx.bank.effortLevels?.some((e) => e.id === s.effortLevel)) return null;
  if (s.extensionFrom !== undefined &&
      (s.jumpFrom !== ctx.summaryId || s.effortLevel === undefined ||
        !ctx.bank.effortLevels?.some((e) => e.id === s.extensionFrom) ||
        nextEffortLevel(s.extensionFrom) !== s.effortLevel)) return null;
  const effortLevel = s.effortLevel ?? (ctx.bank.effortLevels ? ctx.settings.display.defaultEffort : undefined);
  const restored = { ...(s as SessionState), jumpFrom: s.jumpFrom ?? null, effortLevel };
  return ctx.settings.storage.paradata ? restored : withoutParadata(restored);
}
