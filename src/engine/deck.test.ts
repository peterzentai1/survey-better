import { describe, expect, it } from "vitest";
import { loadMini } from "./__fixtures__/mini.ts";
import { buildDeck } from "./deck.ts";

const { bank, devices } = loadMini();
const GROUP = ["W1", "W2", "W3", "W4"];

describe("buildDeck", () => {
  it("follows block order, then YAML order, and contains every card once", () => {
    const { order } = buildDeck(bank, devices, "s1");
    expect(order).toHaveLength(bank.cards.length);
    expect(new Set(order).size).toBe(order.length);
    expect(order.slice(0, 6)).toEqual(["N01", "N02", "Q_TOWN", "Q_HEAT", "E01", "Q_UP"]);
    expect(order.indexOf("Q_MULTI")).toBe(6);
    expect(order[order.length - 1]).toBe("Z02");
  });

  it("is deterministic per session id", () => {
    expect(buildDeck(bank, devices, "same")).toEqual(buildDeck(bank, devices, "same"));
  });

  it("shuffles a randomize group among its own positions only, and differs between sessions", () => {
    const base = buildDeck(bank, devices, "a").order;
    const slots = GROUP.map((id) => base.indexOf(id)).sort((x, y) => x - y);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const d = buildDeck(bank, devices, `session-${i}`);
      const inSlots = slots.map((s) => d.order[s]);
      expect([...inSlots].sort()).toEqual([...GROUP].sort());
      expect(d.randomization.g).toEqual(inSlots);
      // cards outside the group do not move
      expect(d.order.filter((id) => !GROUP.includes(id))).toEqual(base.filter((id) => !GROUP.includes(id)));
      seen.add(inSlots.join());
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("orders module cards by modules-list order, then priority, inside their slots", () => {
    const order = buildDeck(bank, devices, "x").order;
    const modCards = order.filter((id) => id.startsWith("M_"));
    expect(modCards).toEqual([
      "M_A1_1", "M_A1_2", "M_A1_3", "M_A1_4", "M_A1_5", "M_A2_1",
      "M_B1_1", "M_B1_2", "M_B1_3", "M_B2_1", "M_C_1", "M_C_2",
    ]);
    // they stay contiguous in the "mods" block, before the closing block
    const first = order.indexOf("M_A1_1");
    expect(order.slice(first, first + 12)).toEqual(modCards);
  });
});
