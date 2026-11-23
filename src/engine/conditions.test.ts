import { describe, expect, it } from "vitest";
import { checkConditionShape, evaluate, type AnswerView } from "./conditions.ts";
import type { Condition, ItemRecord } from "./types.ts";

function view(items: Record<string, Partial<ItemRecord>>, owned: string[] = []): AnswerView {
  return {
    item: (id) => (items[id] ? ({ changes: 0, ...items[id] } as ItemRecord) : undefined),
    owns: (id) => owned.includes(id),
  };
}

const answered = (value: ItemRecord["value"]): Partial<ItemRecord> => ({ status: "answered", value });

describe("evaluate", () => {
  it("treats a missing condition as true", () => {
    expect(evaluate(undefined, view({}))).toBe(true);
  });

  it("owns and ownsAny read the owned set", () => {
    const v = view({}, ["klima"]);
    expect(evaluate({ owns: "klima" }, v)).toBe(true);
    expect(evaluate({ owns: "bojler" }, v)).toBe(false);
    expect(evaluate({ ownsAny: ["bojler", "klima"] }, v)).toBe(true);
    expect(evaluate({ ownsAny: ["bojler", "auto"] }, v)).toBe(false);
  });

  it("answer.in matches single values, also across string/number types", () => {
    const v = view({ A: answered("gaz"), B: answered("3"), C: answered(3) });
    expect(evaluate({ answer: "A", in: ["gaz", "klima"] }, v)).toBe(true);
    expect(evaluate({ answer: "A", in: ["klima"] }, v)).toBe(false);
    expect(evaluate({ answer: "B", in: [3] }, v)).toBe(true);
    expect(evaluate({ answer: "C", in: ["3"] }, v)).toBe(true);
  });

  it("answer.in on lists means a common element", () => {
    const v = view({ M: answered(["a", "b"]), T: answered([7, 8]) });
    expect(evaluate({ answer: "M", in: ["b", "z"] }, v)).toBe(true);
    expect(evaluate({ answer: "M", in: ["z"] }, v)).toBe(false);
    expect(evaluate({ answer: "T", in: [8] }, v)).toBe(true);
    expect(evaluate({ answer: "T", in: [9] }, v)).toBe(false);
  });

  it("gte and lte work on scale values and numeric strings, never on lists", () => {
    const v = view({ S: answered(4), N: answered("50"), L: answered(["1"]) });
    expect(evaluate({ answer: "S", gte: 4 }, v)).toBe(true);
    expect(evaluate({ answer: "S", gte: 5 }, v)).toBe(false);
    expect(evaluate({ answer: "S", lte: 4 }, v)).toBe(true);
    expect(evaluate({ answer: "S", lte: 3 }, v)).toBe(false);
    expect(evaluate({ answer: "N", gte: 50, lte: 60 }, v)).toBe(true);
    expect(evaluate({ answer: "L", gte: 0 }, v)).toBe(false);
  });

  it("missing, shown-only and skipped references make in/gte/lte false", () => {
    const v = view({ SK: { status: "skipped" }, SH: { status: "shown", value: "gaz" } });
    for (const id of ["NOPE", "SK", "SH"]) {
      expect(evaluate({ answer: id, in: ["gaz"] }, v)).toBe(false);
      expect(evaluate({ answer: id, gte: 0 }, v)).toBe(false);
      expect(evaluate({ answer: id, lte: 9 }, v)).toBe(false);
    }
  });

  it("answered and skipped", () => {
    const v = view({ A: answered("x"), SK: { status: "skipped" }, SH: { status: "shown" } });
    expect(evaluate({ answer: "A", answered: true }, v)).toBe(true);
    expect(evaluate({ answer: "SK", answered: true }, v)).toBe(false);
    expect(evaluate({ answer: "SH", answered: true }, v)).toBe(false);
    expect(evaluate({ answer: "NOPE", answered: true }, v)).toBe(false);
    expect(evaluate({ answer: "SK", skipped: true }, v)).toBe(true);
    expect(evaluate({ answer: "A", skipped: true }, v)).toBe(false);
    expect(evaluate({ answer: "NOPE", skipped: true }, v)).toBe(false);
    expect(evaluate({ answer: "NOPE", answered: false }, v)).toBe(true);
  });

  it("all, any, not combine", () => {
    const v = view({ A: answered("x") }, ["klima"]);
    const yes: Condition = { owns: "klima" };
    const no: Condition = { owns: "auto" };
    expect(evaluate({ all: [yes, { answer: "A", in: ["x"] }] }, v)).toBe(true);
    expect(evaluate({ all: [yes, no] }, v)).toBe(false);
    expect(evaluate({ any: [no, yes] }, v)).toBe(true);
    expect(evaluate({ any: [no, no] }, v)).toBe(false);
    expect(evaluate({ not: no }, v)).toBe(true);
    expect(evaluate({ not: { all: [yes, { not: no }] } }, v)).toBe(false);
  });
});

describe("checkConditionShape", () => {
  it("accepts valid conditions", () => {
    expect(checkConditionShape({ all: [{ owns: "a" }, { not: { answer: "A", in: ["x"] } }] })).toEqual([]);
    expect(checkConditionShape({ any: [{ answer: "E03", in: ["igen"] }, { answer: "A06", in: ["klima"] }] })).toEqual([]);
  });

  it("reports unknown keys, missing operators and wrong types with a path", () => {
    expect(checkConditionShape({ owns: "a", foo: 1 }, "x")[0].message).toMatch(/Ismeretlen kulcs/);
    expect(checkConditionShape({ answer: "A" }, "x")[0].message).toMatch(/operátor/);
    expect(checkConditionShape({ all: [{ owns: 3 }] }, "x").map((i) => i.path)).toEqual(["x.all[0]"]);
    expect(checkConditionShape("nope")).toHaveLength(1);
    expect(checkConditionShape({})).toHaveLength(1);
  });
});
