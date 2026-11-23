import { describe, expect, it } from "vitest";
import { loadMini } from "./__fixtures__/mini.ts";
import { analyze, makeCtx } from "./path.ts";
import {
  acceptConsent,
  addParadata,
  advance,
  answer,
  buildRecord,
  createSession,
  currentId,
  goBack,
  jumpTo,
  localDate,
  skip,
  submit,
  summaryStats,
  validateSnapshot,
  type SessionState,
} from "./session.ts";
import { SKIP, simulatePath } from "./simulate.ts";

const { bank, devices } = loadMini();
const ctx = makeCtx(bank, devices, "simulate");

/** Answer the current card, then advance. */
function step(s: SessionState, value: Parameters<typeof answer>[3]): SessionState {
  return advance(ctx, answer(ctx, s, currentId(s)!, value));
}

/** Start and pass the info + consent cards. */
function started(paradata = false): SessionState {
  let s = createSession(ctx, { sessionId: "simulate", startedDate: localDate() });
  s = advance(ctx, s); // N01
  s = advance(ctx, acceptConsent(ctx, s, "N02", { participation: true, paradata }));
  return s;
}

describe("sequencing and quotas", () => {
  it("module cards come only for owned appliances, up to the quota", () => {
    const none = simulatePath(bank, devices, { owned: [] }).path;
    expect(none.some((id) => id.startsWith("M_"))).toBe(false);
    const a1 = simulatePath(bank, devices, { owned: ["app_a1"], answers: { Q_TOWN: "y" } });
    expect(a1.path.filter((id) => id.startsWith("M_"))).toEqual(["M_A1_1", "M_A1_2", "M_A1_3", "M_A1_4"]);
    expect(a1.quotas).toEqual({ m_a1: 4 });
  });

  it("a module card whose showIf fails consumes no quota", () => {
    const a1 = simulatePath(bank, devices, { owned: ["app_a1"], answers: { Q_TOWN: "x" } });
    expect(a1.path.filter((id) => id.startsWith("M_"))).toEqual(["M_A1_1", "M_A1_2", "M_A1_4", "M_A1_5"]);
  });

  it("tierUpgrade changes the quota from the answer to the upgrade question", () => {
    const base = simulatePath(bank, devices, { owned: ["app_b1", "app_b2"], answers: { Q_UP: "nem" } });
    expect(base.quotas).toEqual({ m_b1: 2, m_b2: 2 });
    const up = simulatePath(bank, devices, { owned: ["app_b1", "app_b2"], answers: { Q_UP: "igen" } });
    expect(up.quotas).toEqual({ m_b1: 2, m_b2: 4 });
    expect(up.path).toContain("M_B2_1");
  });

  it("info and consent cards always show when their showIf passes", () => {
    expect(simulatePath(bank, devices).path.slice(0, 2)).toEqual(["N01", "N02"]);
  });

  it("the global cap shrinks quotas, lowest tier first", () => {
    const tight = loadMini(MINI_DEVICES_TIGHT);
    const r = simulatePath(tight.bank, tight.devices, { owned: ["app_a1", "app_b1", "app_c1"] });
    expect(r.quotas).toEqual({ m_a1: 4, m_b1: 1, m_c: 0 });
    expect(r.path.filter((id) => id.startsWith("M_"))).toEqual(["M_A1_1", "M_A1_2", "M_A1_4", "M_A1_5", "M_B1_1"]);
  });
});

const MINI_DEVICES_TIGHT = `
version: "wtight"
tierCaps: { A: 4, B: 2, C: 1 }
tierFloors: { A: 2, B: 1, C: 0 }
globalModuleCap: 5
appliances:
  - { id: app_a1, label: "A1" }
  - { id: app_a2, label: "A2" }
  - { id: app_b1, label: "B1" }
  - { id: app_b2, label: "B2" }
  - { id: app_c1, label: "C1" }
  - { id: app_c2, label: "C2" }
modules:
  - { id: m_a1, tier: A, appliances: [app_a1] }
  - { id: m_a2, tier: A, appliances: [app_a2] }
  - { id: m_b1, tier: B, appliances: [app_b1] }
  - id: m_b2
    tier: B
    appliances: [app_b2]
    tierUpgrade: { when: { answer: Q_UP, in: [igen] }, tier: A }
  - { id: m_c, tier: C, appliances: [app_c1, app_c2] }
`;

describe("text variants, implied options, option rules", () => {
  it("records the index of the text variant shown", () => {
    expect(simulatePath(bank, devices, { answers: { Q_TOWN: "x" } }).state.items.W1.variant).toBe(0);
    expect(simulatePath(bank, devices, { answers: { Q_TOWN: "y" } }).state.items.W1.variant).toBeUndefined();
  });

  it("pre-selects impliedBy options on first show only", () => {
    let s = started();
    s = step(s, "x");
    s = step(s, "pump"); // now on E01
    expect(currentId(s)).toBe("E01");
    expect(s.items.E01).toMatchObject({ status: "shown", value: ["app_a1"] });
    // respondent unticks, answers, goes back and forth: not pre-selected again
    s = step(s, ["app_a2"]);
    s = goBack(s);
    expect(s.items.E01.value).toEqual(["app_a2"]);
  });
});

describe("back navigation and inactive marking", () => {
  it("keeps stored values but marks cards off the path inactive, and clears the mark again", () => {
    let s = started();
    s = step(s, "x"); // Q_TOWN
    s = step(s, "gas"); // Q_HEAT
    s = step(s, ["app_b2"]); // E01
    expect(currentId(s)).toBe("Q_UP");
    s = step(s, "igen");
    expect(currentId(s)).toBe("Q_MULTI");
    expect(analyze(ctx, s.items).quotas).toEqual({ m_b2: 4 });
    s = goBack(s);
    expect(currentId(s)).toBe("Q_UP");
    s = goBack(s);
    expect(currentId(s)).toBe("E01");

    s = answer(ctx, s, "E01", ["app_a1"]);
    expect(s.items.E01.changes).toBe(1);
    expect(s.items.Q_UP).toMatchObject({ status: "answered", value: "igen", inactive: true });
    expect(analyze(ctx, s.items).quotas).toEqual({ m_a1: 4 });
    s = advance(ctx, s);
    expect(currentId(s)).toBe("Q_MULTI"); // forward path recomputed: Q_UP is skipped

    s = goBack(s);
    s = answer(ctx, s, "E01", ["app_b2"]);
    expect(s.items.Q_UP.inactive).toBeUndefined();
    expect(s.items.Q_UP.value).toBe("igen");
    s = advance(ctx, s);
    expect(currentId(s)).toBe("Q_UP");
  });

  it("does not go back before the first card", () => {
    const s = createSession(ctx, { sessionId: "simulate", startedDate: "2000-01-01" });
    expect(goBack(s)).toBe(s);
  });

  it("re-answering with the same value does not count as a change; skip then answer does", () => {
    let s = started();
    s = answer(ctx, s, "Q_TOWN", "x");
    s = answer(ctx, s, "Q_TOWN", "x");
    expect(s.items.Q_TOWN.changes).toBe(0);
    s = answer(ctx, s, "Q_TOWN", "y");
    expect(s.items.Q_TOWN.changes).toBe(1);
    s = advance(ctx, s);
    s = skip(ctx, s, "Q_HEAT");
    expect(s.items.Q_HEAT).toMatchObject({ status: "skipped", changes: 0 });
    s = answer(ctx, s, "Q_HEAT", "gas");
    expect(s.items.Q_HEAT).toMatchObject({ status: "answered", changes: 1 });
  });
});

describe("summary jump-back", () => {
  function atSummary() {
    const r = simulatePath(bank, devices, { answers: { E01: SKIP, Q_TOWN: "x" } });
    expect(currentId(r.state)).toBe("Z02");
    return r.state;
  }

  it("lists skipped cards and counts per block", () => {
    const stats = summaryStats(ctx, atSummary());
    expect(stats.skippedIds).toEqual(["E01"]);
    expect(stats.blocks.find((b) => b.id === "devs")).toMatchObject({ answered: 1, skipped: 1 });
    expect(stats.blocks.find((b) => b.id === "base")).toMatchObject({ answered: 2, skipped: 0 });
  });

  it("returns to the summary after editing, via cards that became eligible", () => {
    let s = atSummary();
    const historyBefore = s.history.length;
    s = jumpTo(ctx, s, "E01");
    expect(currentId(s)).toBe("E01");
    expect(s.jumpFrom).toBe("Z02");
    s = answer(ctx, s, "E01", ["app_b2"]);
    s = advance(ctx, s);
    expect(currentId(s)).toBe("Q_UP"); // never shown before, now eligible
    s = advance(ctx, answer(ctx, s, "Q_UP", "nem"));
    expect(currentId(s)).toBe("M_B2_1"); // module card of the newly owned appliance
    s = advance(ctx, answer(ctx, s, "M_B2_1", "a"));
    expect(currentId(s)).toBe("Z02"); // the m_b2 quota is 2 but the fixture has only one such card
    expect(s.jumpFrom).toBeNull();
    expect(s.history.length).toBe(historyBefore);
  });

  it("goes straight back when nothing new became eligible", () => {
    let s = atSummary();
    s = jumpTo(ctx, s, "E01");
    s = advance(ctx, answer(ctx, s, "E01", ["none"]));
    expect(currentId(s)).toBe("Z02");
  });

  it("Back from a jumped-to card returns to the summary", () => {
    let s = jumpTo(ctx, atSummary(), "E01");
    s = goBack(s);
    expect(currentId(s)).toBe("Z02");
    expect(s.jumpFrom).toBeNull();
  });
});

describe("simulatePath", () => {
  it("answers with defaults and respects explicit answers and SKIP", () => {
    const r = simulatePath(bank, devices, { answers: { Q_HEAT: "pump", W2: SKIP }, scaleValue: 6 });
    expect(r.state.items.Q_HEAT.value).toBe("pump");
    expect(r.state.items.W2.status).toBe("skipped");
    expect(r.state.items.W3).toMatchObject({ status: "answered", value: 6 });
    expect(r.state.items.Q_TOWN.value).toBe("x"); // first option
  });

  it("defaultPolicy skip skips skippable cards but not mandatory ones", () => {
    const r = simulatePath(bank, devices, { defaultPolicy: "skip" });
    expect(r.state.items.Q_TOWN.status).toBe("answered"); // skip: false
    expect(r.state.items.Q_HEAT.status).toBe("skipped");
  });
});

describe("response record", () => {
  it("has the documented shape", () => {
    const r = simulatePath(bank, devices, { owned: ["app_a1"] });
    const rec = buildRecord(ctx, submit(ctx, r.state, "Z02"), "9.9.9");
    expect(rec).toMatchObject({
      schema: "kartya-kerdoiv-response/0.1",
      sessionId: "simulate",
      bankVersion: "0.0.1-test",
      weightsVersion: "wtest",
      appVersion: "9.9.9",
      completed: true,
      consent: { participation: true, paradata: false },
      quotas: { m_a1: 4 },
      highlights: [],
    });
    expect(rec.startedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(rec.items).sort()).toEqual(bank.cards.map((c) => c.id).sort());
    expect(rec.items.M_A2_1.status).toBe("not_shown");
    expect(rec.items.N01).toMatchObject({ status: "shown", position: 0, changes: 0 });
    expect(rec.order).toEqual(r.path);
    expect(rec.randomization.g.sort()).toEqual(["W1", "W2", "W3", "W4"]);
    expect(JSON.stringify(rec)).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no timestamps
  });

  it("has no paradata key without the paradata consent, and ignores paradata calls", () => {
    let s = started(false);
    s = addParadata(s, "Q_TOWN", { dwellMs: 1234, tap: 1 });
    expect("paradata" in buildRecord(ctx, s, "t")).toBe(false);
    expect(s.paradata).toBeUndefined();
  });

  it("collects rounded paradata after consent and drops it when the box is unticked", () => {
    let s = started(true);
    s = addParadata(s, "Q_TOWN", { dwellMs: 1240, tap: 1 });
    s = addParadata(s, "Q_TOWN", { dwellMs: 300, key: 2, drag: 1, backNavs: 1 });
    const rec = buildRecord(ctx, s, "t");
    expect(rec.paradata?.Q_TOWN).toEqual({ dwellMs: 1500, inputs: { tap: 1, key: 2, drag: 1 }, backNavs: 1 });
    s = acceptConsent(ctx, s, "N02", { participation: true, paradata: false });
    expect("paradata" in buildRecord(ctx, s, "t")).toBe(false);
  });

  it("consent needs participation", () => {
    const s = createSession(ctx, { sessionId: "simulate", startedDate: "2000-01-01" });
    expect(acceptConsent(ctx, s, "N02", { participation: false, paradata: true })).toBe(s);
  });
});

describe("validateSnapshot", () => {
  it("accepts a JSON round trip and rejects stale or broken snapshots", () => {
    const s = started();
    const copy = JSON.parse(JSON.stringify(s));
    expect(validateSnapshot(ctx, copy)).toEqual(s);
    expect(validateSnapshot(ctx, { ...copy, bankVersion: "other" })).toBeNull();
    expect(validateSnapshot(ctx, { ...copy, history: ["GONE"] })).toBeNull();
    expect(validateSnapshot(ctx, { ...copy, items: { GONE: { status: "shown", changes: 0 } } })).toBeNull();
    expect(validateSnapshot(ctx, { ...copy, completed: true })).toBeNull();
    expect(validateSnapshot(ctx, null)).toBeNull();
    expect(validateSnapshot(ctx, "x")).toBeNull();
  });
});
