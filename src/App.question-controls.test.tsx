import { fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { loadContent } from "./content/load.ts";
import { makeCtx } from "./engine/path.ts";
import { answer } from "./engine/session.ts";
import { simulatePath, type Strategy } from "./engine/simulate.ts";
import { temperatureArm } from "./engine/temperature.ts";
import { MemSink, renderApp, screen, waitFor } from "./test-utils.tsx";

const content = loadContent();
if (!content.ok) throw new Error("Invalid test bank");
const { bank, devices, settings } = content;
const charging = {
  effortLevel: "alapos",
  owned: ["villanyauto"],
  answers: { E04: ["otthon", "munkahely"] },
} satisfies Strategy;

async function openCard(id: string, strategy: Strategy = {}) {
  const { state } = simulatePath(bank, devices, strategy);
  const index = state.history.indexOf(id);
  expect(index).toBeGreaterThan(0);
  state.history = state.history.slice(0, index + 1);
  state.items[id] = { ...state.items[id], status: "shown", value: undefined };
  const result = renderApp({ content, sink: new MemSink(state) });
  await result.user.click(screen.getByRole("button", { name: "Folytatom" }));
  return result;
}

it.each(["tap", "drag"] as const)("shows household size as the %s arm's surface and saves the option value", async (arm) => {
  let id = "household";
  while (temperatureArm(id) !== arm) id += "a";
  const { state } = simulatePath(bank, devices, {}, id);
  state.history = state.history.slice(0, state.history.indexOf("A04") + 1);
  state.items.A04 = { ...state.items.A04, status: "shown", value: undefined };
  const sink = new MemSink(state);
  const { user } = renderApp({ content, sink });
  await user.click(screen.getByRole("button", { name: "Folytatom" }));
  const radios = screen.getAllByRole("radio");
  expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["1", "2", "3", "4", "5", "6", "7", "8+ – 8 vagy több"]);
  expect(Boolean(screen.queryByText("Húzza oldalra vagy koppintson"))).toBe(arm === "drag");
  if (arm === "drag") {
    const pointer = { pointerType: "touch", pointerId: 4, isPrimary: true, button: 0 };
    fireEvent.pointerDown(radios[0], pointer);
    fireEvent.pointerMove(radios[7], { ...pointer, clientX: 90 });
    fireEvent.pointerUp(radios[7], { ...pointer, clientX: 90 });
  } else {
    await user.keyboard("8");
  }
  await waitFor(() => expect(sink.record?.items.A04.value).toBe("8+"));
  expect(sink.record?.temperatureArm).toBe(arm);
});

it("asks for the monthly bill in forints and saves the entered amount", async () => {
  const { user, sink } = await openCard("T04");
  const slider = screen.getByRole("slider", { name: "Havi villanyszámla (Ft)" });
  const input = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Havi villanyszámla (Ft)" });
  fireEvent.change(slider, { target: { value: "12500" } });
  expect(input.value).toBe("12500");
  expect(screen.queryByText(/Rezsicsökkentett keret/)).toBeNull();
  await user.clear(input);
  await user.type(input, "18000");
  await user.click(screen.getByRole("button", { name: "Tovább" }));
  expect(sink.record?.items.T04.value).toBe(18000);
});

it("opens the Egyéb option into a text field and stores the typed text with the answer", async () => {
  const { user, sink } = await openCard("A03");
  await user.click(screen.getByRole("button", { name: "Egyéb" }));
  const field = screen.getByRole<HTMLInputElement>("textbox", { name: /Egyéb: írja le röviden/ });
  expect(document.activeElement).toBe(field);
  expect(screen.queryByRole("button", { name: "Egyéb" })).toBeNull();
  await user.type(field, "Közös tulajdon, együtt döntünk{Enter}");
  expect(sink.record?.items.A03).toMatchObject({ status: "answered", value: "egyeb", otherText: "Közös tulajdon, együtt döntünk" });
  expect(sink.state?.history.at(-1)).not.toBe("A03");
});

it("drops the Egyéb text when another option is chosen later", async () => {
  const { user, sink } = await openCard("A03");
  await user.click(screen.getByRole("button", { name: "Egyéb" }));
  await user.type(screen.getByRole("textbox"), "valami{Enter}");
  await user.click(screen.getByRole("button", { name: "Vissza" }));
  await user.click(await screen.findByRole("button", { name: /^Bérelt, a bérbeadó dönt/ }));
  await waitFor(() => expect(sink.record?.items.A03.value).toBe("berelt_berbeado"));
  expect(sink.record?.items.A03).not.toHaveProperty("otherText");
});

it("only asks for a split in the longest path and clears it when the chosen locations change", async () => {
  expect(simulatePath(bank, devices, { ...charging, effortLevel: "rovid" }).path).not.toContain("E04B");
  expect(simulatePath(bank, devices, { ...charging, answers: { E04: ["otthon"] } }).path).not.toContain("E04B");
  expect(simulatePath(bank, devices, { ...charging, answers: { E04: ["munkahely", "nyilvanos"] } }).path).not.toContain("M_EV_1");

  const { user, sink } = await openCard("E04B", charging);
  const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Tovább" });
  expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  await user.type(screen.getByRole("spinbutton", { name: "Otthon" }), "70");
  expect(confirm.disabled).toBe(true);
  await user.type(screen.getByRole("spinbutton", { name: "A munkahelyen" }), "30");
  await user.click(confirm);
  expect(sink.record?.items.E04B.value).toEqual({ otthon: 70, munkahely: 30 });

  const ctx = makeCtx(bank, devices, sink.state!.sessionId, settings);
  const edited = answer(ctx, sink.state!, "E04", ["otthon", "nyilvanos"]);
  expect(edited.items.E04B.status).toBe("shown");
  expect(edited.items.E04B.value).toBeUndefined();
});
