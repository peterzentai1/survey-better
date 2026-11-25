import { fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { withThreeLevelContent } from "./engine/__fixtures__/threeLevels.ts";
import { simulatePath } from "./engine/simulate.ts";
import { temperatureArm } from "./engine/temperature.ts";
import { MemSink, renderApp, screen, loadDeviceContent } from "./test-utils.tsx";

vi.mock("./storage/metrics.ts", async (original) => ({
  ...await original<typeof import("./storage/metrics.ts")>(),
  metricsEnabled: true,
  effortMedians: async () => new Map([["kozepes", 10.5]]),
}));

const loaded = loadDeviceContent();
if (!loaded.ok) throw new Error("Invalid test bank");
const content = withThreeLevelContent(loaded);

describe("survey metrics UI", () => {
  it("shows an existing median without requiring new metrics uploads", async () => {
    renderApp({ content });
    expect((await screen.findByRole("radio", { name: /Közepes.*Medián 10,5 perc/ })).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Rövid.*kb\. 5 perc/})).toBeTruthy();
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
    const start = screen.getByRole("radio", { name: "1 – Egyáltalán nem kellemetlen" });
    const end = screen.getByRole("radio", { name: "6 – Rendkívül kellemetlen" });
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

describe("survey display settings", () => {
  it("uses the configured effort, hides optional chrome and links to the configured source", () => {
    const settings = {
      ...content.settings,
      display: { ...content.settings.display, defaultEffort: "alapos" as const, showMedianTimes: false, banner: null, sourceLink: "https://example.test/source" },
    };
    renderApp({ content: { ...content, settings } });
    expect(screen.getByRole("radio", { name: "Alapos" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("link", { name: /Forráskód/ }).getAttribute("href")).toBe("https://example.test/source");
  });

  it("can hide the effort selector and disable optional paradata", async () => {
    const intro = content.bank.cards.find((card) => card.id === "N01");
    if (intro?.type !== "info") throw new Error("Missing N01 intro card");
    const startLabel = intro.cta.replace(/\s+/g, " ").trim();
    const settings = {
      display: { ...content.settings.display, effortSelector: false, banner: "Tesztkérdőív" },
      storage: { ...content.settings.storage, paradata: false },
    };
    const { user, sink } = renderApp({ content: { ...content, settings } });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("note").textContent).toBe("Tesztkérdőív");
    await user.click(screen.getByRole("button", { name: (name) => name.startsWith(startLabel) }));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(1);
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: "Tovább" }));
    expect(sink.record?.consent.paradata).toBe(false);
    expect(sink.record?.paradata).toBeUndefined();
  });

  it.each(["buttons", "drag_reveal"] as const)("renders %s for a scale outside the experiment", async (scaleInput) => {
    const { state } = simulatePath(content.bank, content.devices, {}, "scale-settings-test");
    state.history = state.history.slice(0, state.history.indexOf("I11") + 1);
    state.items.I11 = { status: "shown", changes: 0 };
    const settings = { ...content.settings, display: { ...content.settings.display, scaleInput } };
    const sink = new MemSink(state);
    const { user } = renderApp({ content: { ...content, settings }, sink });
    await user.click(screen.getByRole("button", { name: "Folytatom" }));
    const label = screen.getByRole("radio", { name: "6 – Biztosan igen" });
    expect(Boolean(screen.queryByText("Húzza oldalra vagy koppintson"))).toBe(scaleInput === "drag_reveal");
    expect(screen.getByText("Biztosan igen")).toBeTruthy();
    label.focus();
    await user.keyboard("{Enter}");
    expect(sink.record?.items.I11.value).toBe(6);
    expect(sink.record?.temperatureArm).toBeUndefined();
  });
});
