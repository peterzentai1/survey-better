import { describe, expect, it } from "vitest";
import type { AnswerView } from "./conditions.ts";
import { computeQuotas } from "./quotas.ts";
import type { Devices } from "./schema.ts";

function devices(over: Partial<Devices> = {}): Devices {
  return {
    version: "t",
    tierCaps: { A: 4, B: 2, C: 1 },
    tierFloors: { A: 2, B: 1, C: 0 },
    globalModuleCap: 99,
    appliances: ["a1", "a2", "b1", "b2", "c1"].map((id) => ({ id, label: id })),
    modules: [
      { id: "m_a1", tier: "A", appliances: ["a1"] },
      { id: "m_a2", tier: "A", appliances: ["a2"] },
      { id: "m_b1", tier: "B", appliances: ["b1"] },
      { id: "m_b2", tier: "B", appliances: ["b2"], tierUpgrade: { when: { answer: "UP", in: ["igen"] }, tier: "A" } },
      { id: "m_c", tier: "C", appliances: ["c1"] },
    ],
    ...over,
  };
}

function view(owned: string[], answers: Record<string, string> = {}): AnswerView {
  return {
    owns: (id) => owned.includes(id),
    item: (id) => (id in answers ? { status: "answered", value: answers[id] } : undefined),
  };
}

describe("computeQuotas", () => {
  it("has no entry for modules the respondent has no appliance for", () => {
    expect(computeQuotas(devices(), view([]))).toEqual({});
    expect(computeQuotas(devices(), view(["a1"]))).toEqual({ m_a1: 4 });
  });

  it("starts at the tier cap and keeps it while within the global cap", () => {
    expect(computeQuotas(devices(), view(["a1", "b1", "c1"]))).toEqual({ m_a1: 4, m_b1: 2, m_c: 1 });
  });

  it("reduces the lowest tier first (C, then B, then A) down to the floors", () => {
    const owned = ["a1", "b1", "c1"]; // 4 + 2 + 1 = 7
    expect(computeQuotas(devices({ globalModuleCap: 6 }), view(owned))).toEqual({ m_a1: 4, m_b1: 2, m_c: 0 });
    expect(computeQuotas(devices({ globalModuleCap: 5 }), view(owned))).toEqual({ m_a1: 4, m_b1: 1, m_c: 0 });
    expect(computeQuotas(devices({ globalModuleCap: 4 }), view(owned))).toEqual({ m_a1: 3, m_b1: 1, m_c: 0 });
  });

  it("stops when nothing can be reduced any more (all at floors)", () => {
    expect(computeQuotas(devices({ globalModuleCap: 1 }), view(["a1", "b1", "c1"]))).toEqual({ m_a1: 2, m_b1: 1, m_c: 0 });
  });

  it("takes from the module with the largest quota; a tie is lost by the later module in the list", () => {
    const owned = ["a1", "a2"]; // 4 + 4
    expect(computeQuotas(devices({ globalModuleCap: 7 }), view(owned))).toEqual({ m_a1: 4, m_a2: 3 });
    expect(computeQuotas(devices({ globalModuleCap: 6 }), view(owned))).toEqual({ m_a1: 3, m_a2: 3 });
    expect(computeQuotas(devices({ globalModuleCap: 5 }), view(owned))).toEqual({ m_a1: 3, m_a2: 2 });
  });

  it("applies tierUpgrade: the module counts as the upgraded tier", () => {
    expect(computeQuotas(devices(), view(["b2"]))).toEqual({ m_b2: 2 });
    expect(computeQuotas(devices(), view(["b2"], { UP: "igen" }))).toEqual({ m_b2: 4 });
    expect(computeQuotas(devices(), view(["b2"], { UP: "nem" }))).toEqual({ m_b2: 2 });
  });

  it("an upgraded module is reduced as tier A, after the real B modules", () => {
    const d = devices({ globalModuleCap: 5 });
    // m_b2 upgraded to A (4) + m_b1 (2) = 6 -> reduce lowest tier (B: m_b1 2 -> 1)
    expect(computeQuotas(d, view(["b1", "b2"], { UP: "igen" }))).toEqual({ m_b1: 1, m_b2: 4 });
  });

  it("one module with several appliances is a single module", () => {
    expect(computeQuotas(devices({ modules: [{ id: "m_c", tier: "C", appliances: ["c1", "a1"] }] }), view(["c1", "a1"]))).toEqual({ m_c: 1 });
  });
});
