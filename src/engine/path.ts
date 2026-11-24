// The respondent's path: a pure function of the stored items and selected effort.
// Walk the deck in order; a card is on the path when its showIf holds (seeing only answers of cards
// already on the path) and, for module cards, its module is active and still has quota left.
// Next card = successor on the path; "inactive" = stored but not on the path.
import { DEFAULT_SURVEY, defaultSettings, type SurveySettings } from "../content/survey.ts";
import type { AnswerView } from "./conditions.ts";
import { evaluate } from "./conditions.ts";
import { buildDeck, type Deck } from "./deck.ts";
import { DEFAULT_EFFORT_LEVEL, EFFORT_LEVEL_IDS, type EffortLevelId } from "./effort.ts";
import { computeQuotas } from "./quotas.ts";
import type { Bank, Card, Devices } from "./schema.ts";
import type { ItemRecord } from "./types.ts";

export interface Ctx {
  slug: string;
  settings: SurveySettings;
  bank: Bank;
  devices: Devices;
  deck: Deck;
  byId: Map<string, Card>;
  pickerId: string | undefined;
  summaryId: string | undefined;
}

export function makeCtx(bank: Bank, devices: Devices, sessionId: string, settings = defaultSettings(), slug = DEFAULT_SURVEY): Ctx {
  return {
    bank,
    devices,
    settings,
    slug,
    deck: buildDeck(bank, devices, sessionId),
    byId: new Map(bank.cards.map((c) => [c.id, c])),
    pickerId: bank.cards.find((c) => c.type === "multi_tiles" && c.devicePicker)?.id,
    summaryId: bank.cards.find((c) => c.type === "summary_highlight")?.id,
  };
}

export interface Analysis {
  /** Card ids on the path, in deck order (includes cards not shown yet). */
  path: string[];
  pathSet: Set<string>;
  /** View over the answers of cards on the path. */
  view: AnswerView;
  owned: Set<string>;
  quotas: Record<string, number>;
}

export function analyze(ctx: Ctx, items: Record<string, ItemRecord>, effortLevel: EffortLevelId = DEFAULT_EFFORT_LEVEL): Analysis {
  const level = ctx.bank.effortLevels?.find((e) => e.id === effortLevel);
  // Banks without effortLevels show every card, whatever the default level is.
  const maxEffort = level ? EFFORT_LEVEL_IDS.indexOf(level.id) + 1 : EFFORT_LEVEL_IDS.length;
  const path: string[] = [];
  const pathSet = new Set<string>();
  const used: Record<string, number> = {};
  let owned = new Set<string>();
  const view: AnswerView = {
    item: (id) => (pathSet.has(id) ? items[id] : undefined),
    owns: (id) => owned.has(id),
  };
  for (const id of ctx.deck.order) {
    const card = ctx.byId.get(id);
    if (!card || card.effort > maxEffort) continue;
    if (!evaluate(card.showIf, view)) continue;
    if (card.module !== undefined) {
      const quota = computeQuotas(ctx.devices, view, level?.moduleCaps)[card.module];
      if (quota === undefined || (used[card.module] ?? 0) >= quota) continue;
      used[card.module] = (used[card.module] ?? 0) + 1;
    }
    path.push(id);
    pathSet.add(id);
    if (card.type === "multi_tiles" && card.devicePicker) {
      const it = items[id];
      owned = new Set(it?.status === "answered" && Array.isArray(it.value) ? (it.value as string[]).map(String) : []);
    }
  }
  return { path, pathSet, view, owned, quotas: computeQuotas(ctx.devices, view, level?.moduleCaps) };
}
