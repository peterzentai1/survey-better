// Deck order: blocks in order, YAML order inside a block, module cards sorted, randomize groups shuffled.
import { hashString, mulberry32, shuffled } from "./prng.ts";
import type { Bank, Card, Devices } from "./schema.ts";

export interface Deck {
  /** Card ids in presentation order. */
  order: string[];
  /** Presentation order of each randomizeGroup. */
  randomization: Record<string, string[]>;
}

/**
 * Within a block, module cards keep the slots module cards occupy in the YAML,
 * but those slots are refilled in (modules list order, priority, YAML order).
 */
export function sortModuleCards(cards: Card[], devices: Devices): Card[] {
  const moduleIndex = new Map(devices.modules.map((m, i) => [m.id, i]));
  const slots: number[] = [];
  const moduleCards: { card: Card; yamlIndex: number }[] = [];
  cards.forEach((card, i) => {
    if (card.module !== undefined) {
      slots.push(i);
      moduleCards.push({ card, yamlIndex: i });
    }
  });
  moduleCards.sort(
    (a, b) =>
      (moduleIndex.get(a.card.module!) ?? 1e6) - (moduleIndex.get(b.card.module!) ?? 1e6) ||
      (a.card.priority ?? 1e6) - (b.card.priority ?? 1e6) ||
      a.yamlIndex - b.yamlIndex,
  );
  const out = [...cards];
  slots.forEach((slot, k) => (out[slot] = moduleCards[k].card));
  return out;
}

export function buildDeck(bank: Bank, devices: Devices, sessionId: string): Deck {
  const order: string[] = [];
  const randomization: Record<string, string[]> = {};
  for (const block of bank.blocks) {
    const cards = sortModuleCards(
      bank.cards.filter((c) => c.block === block.id),
      devices,
    );
    const ids = cards.map((c) => c.id);
    const groups = new Map<string, number[]>(); // group -> slots in this block
    cards.forEach((c, i) => {
      if (c.randomizeGroup !== undefined) groups.set(c.randomizeGroup, [...(groups.get(c.randomizeGroup) ?? []), i]);
    });
    for (const [group, slots] of groups) {
      // One independent stream per group, so adding a group does not reshuffle the others.
      const rng = mulberry32(hashString(`${sessionId}|${group}`));
      const perm = shuffled(
        slots.map((s) => ids[s]),
        rng,
      );
      slots.forEach((slot, k) => (ids[slot] = perm[k]));
      randomization[group] = perm;
    }
    order.push(...ids);
  }
  return { order, randomization };
}
