import { describe, expect, it } from "vitest";
import { splitScenario } from "./CardShell.tsx";

describe("splitScenario", () => {
  it("keeps a single-line text as the question", () => {
    expect(splitScenario("Hol él?")).toEqual({ body: undefined, question: "Hol él?" });
  });

  it("uses the last line as the question and the rest as body", () => {
    const text = "Az ajánlat első sora.\nMásodik sor.\nElfogadná?\n";
    expect(splitScenario(text)).toEqual({ body: "Az ajánlat első sora.\nMásodik sor.", question: "Elfogadná?" });
  });

  it("ignores surrounding blank lines", () => {
    expect(splitScenario("\n\nLeírás.\nKérdés?\n\n")).toEqual({ body: "Leírás.", question: "Kérdés?" });
  });
});
