import { describe, expect, it } from "vitest";
import { loadMini } from "./__fixtures__/mini.ts";
import type { AnswerView } from "./conditions.ts";
import { impliedValues, paintHours, toggleOption, visibleOptions } from "./inputs.ts";

const { bank } = loadMini();
const multi = bank.cards.find((c) => c.id === "Q_MULTI")!;
const picker = bank.cards.find((c) => c.id === "E01")!;
if (multi.type !== "multi_tiles" || picker.type !== "multi_tiles") throw new Error("fixture");

const view = (answers: Record<string, string>): AnswerView => ({
  owns: () => false,
  item: (id) => (id in answers ? { status: "answered", value: answers[id] } : undefined),
});

describe("toggleOption", () => {
  it("adds and removes", () => {
    expect(toggleOption(multi, [], "ar")).toEqual({ next: ["ar"], blocked: false });
    expect(toggleOption(multi, ["ar"], "ar")).toEqual({ next: [], blocked: false });
  });

  it("exclusive option clears the others, and any other option clears it", () => {
    expect(toggleOption(multi, ["ar", "komfort"], "semmi").next).toEqual(["semmi"]);
    expect(toggleOption(multi, ["semmi"], "ar").next).toEqual(["ar"]);
  });

  it("enforces max and reports it", () => {
    expect(toggleOption(multi, ["ar", "komfort"], "kornyezet")).toEqual({ next: ["ar", "komfort"], blocked: true });
    expect(toggleOption(multi, ["ar", "komfort"], "semmi").blocked).toBe(false);
  });
});

describe("visibleOptions", () => {
  it("hides options whose showIf fails", () => {
    expect(visibleOptions(multi, view({ Q_TOWN: "x" })).map((o) => o.value)).not.toContain("titkos");
    expect(visibleOptions(multi, view({ Q_TOWN: "y" })).map((o) => o.value)).toContain("titkos");
  });
});

describe("impliedValues", () => {
  it("pre-selects options whose impliedBy holds", () => {
    expect(impliedValues(picker, view({ Q_HEAT: "pump" }))).toEqual(["app_a1"]);
    expect(impliedValues(picker, view({ Q_HEAT: "gas" }))).toEqual([]);
    expect(impliedValues(picker, view({}))).toEqual([]);
  });
});

describe("paintHours", () => {
  it("adds and removes hours, sorted", () => {
    expect(paintHours([5], [3, 4], "add").next).toEqual([3, 4, 5]);
    expect(paintHours([3, 4, 5], [4], "remove").next).toEqual([3, 5]);
  });

  it("enforces max and reports it", () => {
    expect(paintHours([1, 2], [3, 4], "add", 3)).toEqual({ next: [1, 2, 3], blocked: true });
    expect(paintHours([1, 2, 3], [3], "remove", 3).blocked).toBe(false);
  });
});
