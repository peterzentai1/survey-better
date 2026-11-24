// Module quotas: a pure function of the current answers.
import { evaluate, type AnswerView } from "./conditions.ts";
import type { Devices, EffortLevel, Tier } from "./schema.ts";

const TIERS_LOW_TO_HIGH: Tier[] = ["C", "B", "A"];

/** Tier of a module for this respondent (tierUpgrade applied when its condition holds). */
export function effectiveTier(module: Devices["modules"][number], view: AnswerView): Tier {
  return module.tierUpgrade && evaluate(module.tierUpgrade.when, view) ? module.tierUpgrade.tier : module.tier;
}

/**
 * Quota (number of module cards) per ACTIVE module. A module is active if the respondent owns
 * any of its appliances. Start at tierCaps[tier]; while the sum exceeds globalModuleCap, take the
 * lowest tier that still has a module above tierFloors[tier] and reduce by 1 the module with the
 * largest quota there; a tie is lost by the module later in the `modules` list.
 * An effort override clamps the floors to its tier caps and reduces below the floors
 * only when needed to meet the new global module cap.
 */
export function computeQuotas(devices: Devices, view: AnswerView, override?: EffortLevel["moduleCaps"]): Record<string, number> {
  const { tierCaps, globalModuleCap } = override ?? devices;
  const active = devices.modules
    .filter((m) => m.appliances.some((a) => view.owns(a)))
    .map((m) => ({ id: m.id, tier: effectiveTier(m, view) }));
  const quota = new Map(active.map((m) => [m.id, tierCaps[m.tier]]));
  const sum = () => [...quota.values()].reduce((a, b) => a + b, 0);

  const reduce = (floors: Devices["tierFloors"]) => {
    for (const tier of TIERS_LOW_TO_HIGH) {
      const floor = Math.min(floors[tier], tierCaps[tier]);
      const candidates = active.filter((m) => m.tier === tier && quota.get(m.id)! > floor);
      if (candidates.length === 0) continue;
      // Largest current quota; among equals the one later in the modules list (iterated last, so `>=`).
      let pick = candidates[0];
      for (const c of candidates) if (quota.get(c.id)! >= quota.get(pick.id)!) pick = c;
      quota.set(pick.id, quota.get(pick.id)! - 1);
      return true;
    }
    return false;
  };
  while (sum() > globalModuleCap && reduce(devices.tierFloors)) { /* reduce to the configured floors */ }
  if (override) {
    const minimum = { A: 0, B: 0, C: 0 };
    while (sum() > globalModuleCap && reduce(minimum)) { /* meet the global cap even if floors do not fit */ }
  }
  return Object.fromEntries(quota);
}
