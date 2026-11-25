import { fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { loadContent } from "./content/load.ts";
import { makeCtx } from "./engine/path.ts";
import { answer } from "./engine/session.ts";
import { simulatePath, type Strategy } from "./engine/simulate.ts";
import { MemSink, renderApp, screen } from "./test-utils.tsx";

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

it("pages between household sizes and saves the existing option value", async () => {
  const { user, sink } = await openCard("A04");
  const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Tovább" });
  expect(confirm.disabled).toBe(true);
  const display = screen.getByRole("status");
  const pointer = { pointerType: "touch", pointerId: 3, isPrimary: true };
  fireEvent.pointerDown(display, { ...pointer, clientX: 100 });
  fireEvent.pointerUp(display, { ...pointer, clientX: 30 });
  expect(display.textContent).toBe("1");
  await user.keyboard("{ArrowRight}{ArrowLeft}");
  expect(display.textContent).toBe("1");
  for (let i = 0; i < 7; i++) await user.click(screen.getByRole("button", { name: "Következő érték" }));
  expect(display.textContent).toBe("8 vagy több");
  await user.click(confirm);
  expect(sink.record?.items.A04.value).toBe("8+");
});

it("updates the estimate across the A1 threshold and saves the entered kWh", async () => {
  const { user, sink } = await openCard("T04");
  const slider = screen.getByRole("slider");
  const input = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Éves fogyasztás (kWh)" });
  fireEvent.change(slider, { target: { value: "2400" } });
  expect(input.value).toBe("2400");
  expect(screen.getByText(/Becsült éves fogyasztási díj/)).toBeTruthy();
  fireEvent.change(slider, { target: { value: "2523" } });
  expect(screen.getByText(/Rezsicsökkentett keret.*\+ 0\s*Ft/)).toBeTruthy();
  await user.clear(input);
  await user.type(input, "13000");
  expect(screen.getByText(/Rezsicsökkentett keret.*\+ 734\s*480\s*Ft/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Tovább" }));
  expect(sink.record?.items.T04.value).toBe(13000);
});

it("only asks for a split in the longest path and clears it when the chosen locations change", async () => {
  expect(simulatePath(bank, devices, { ...charging, effortLevel: "kozepes" }).path).not.toContain("E04B");
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
