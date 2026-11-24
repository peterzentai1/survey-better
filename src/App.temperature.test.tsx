import { fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { loadContent } from "./content/load.ts";
import { simulatePath } from "./engine/simulate.ts";
import { temperatureArm } from "./engine/temperature.ts";
import { MemSink, renderApp, screen } from "./test-utils.tsx";

vi.mock("./storage/metrics.ts", async (original) => ({
  ...await original<typeof import("./storage/metrics.ts")>(),
  metricsEnabled: true,
  effortMedians: async () => new Map([["alapos", 10.5]]),
}));

const content = loadContent();
if (!content.ok) throw new Error("Invalid test bank");

describe("survey metrics UI", () => {
  it("shows a measured median only for a level with data", async () => {
    renderApp({ content });
    expect((await screen.findByRole("radio", { name: /Alapos.*Medián 10,5 perc/ })).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Rövid.*kb\. \[5\] perc/ })).toBeTruthy();
  });

  it.each(["tap", "drag"] as const)("displays the %s first-reaction arm and keeps the intention scale common", async (arm) => {
    if (!content.ok) throw new Error("Invalid test bank");
    let id = "test";
    while (temperatureArm(id) !== arm) id += "a";
    const { state } = simulatePath(content.bank, content.devices, {}, id);
    state.history = state.history.slice(0, state.history.indexOf("I10") + 1);
    state.items.I10 = { status: "shown", changes: 0 };
    state.consent.paradata = true;
    state.paradata = {};
    const sink = new MemSink(state);
    const { user } = renderApp({ content, sink });
    await user.click(screen.getByRole("button", { name: "Folytatom" }));
    const start = screen.getByRole("radio", { name: "1 – Nagyon kellemetlen" });
    const end = screen.getByRole("radio", { name: "6 – Nagyon kellemes" });
    if (arm === "drag") {
      expect(screen.getByText("Húzza oldalra vagy koppintson")).toBeTruthy();
      const pointer = { pointerType: "touch", pointerId: 2, isPrimary: true, button: 0 };
      fireEvent.pointerDown(start, pointer);
      fireEvent.pointerMove(end, { ...pointer, clientX: 90 });
      fireEvent.pointerCancel(end, pointer);
      expect(end.getAttribute("aria-checked")).toBe("false");
      fireEvent.pointerDown(start, pointer);
      fireEvent.pointerMove(end, { ...pointer, clientX: 90 });
      fireEvent.pointerUp(end, { ...pointer, clientX: 90 });
    } else {
      expect(screen.queryByText("Húzza oldalra vagy koppintson")).toBeNull();
      await user.click(end);
    }
    await waitFor(() => expect(sink.state?.history.at(-1)).toBe("I11"));
    expect(sink.record?.items.I10.value).toBe(6);
    expect(sink.record?.paradata?.I10.firstAnswer?.input).toBe(arm);
    expect(screen.getByRole("radio", { name: "6 – Biztosan igen" })).toBeTruthy();
    expect(screen.queryByText("Húzza oldalra vagy koppintson")).toBeNull();
  });
});
