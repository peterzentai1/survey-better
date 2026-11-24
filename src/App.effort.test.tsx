import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { loadContent } from "./content/load.ts";
import { SKIP, simulatePath } from "./engine/simulate.ts";
import { expectCard, MemSink, renderApp, screen, waitFor } from "./test-utils.tsx";
import { cardText as displayedText } from "./ui/session.tsx";

const content = loadContent();
if (!content.ok) throw new Error(JSON.stringify(content.issues));
// Wording comes from the bank so that text edits do not break these tests.
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const cardText = (id: string, key: "title" | "cta") =>
  squash(String((content.bank.cards.find((c) => c.id === id) as Record<string, unknown> | undefined)?.[key] ?? ""));
const introHeading = cardText("N01", "title");
const consentHeading = cardText("N02", "title");
const startLabel = cardText("N01", "cta");
const radio = (name: RegExp) => screen.getByRole("radio", { name });
const start = () => screen.getByRole("button", { name: (n) => squash(n).startsWith(startLabel) });
const consent = () => screen.getByRole("checkbox", { name: /^Elolvastam/ });
const next = () => screen.getByRole("button", { name: /^Tovább/ });
const question = (id: string) => content.bank.cards.find((card) => card.id === id)!;
function optionLabel(id: string, value: string) {
  const card = question(id);
  if (card.type !== "single") throw new Error(`Expected a single-choice card: ${id}`);
  return card.options.find((option) => option.value === value)!.label;
}

describe("effort selector", () => {
  it("defaults to Közepes, supports keys and click, and waits for consent before saving", async () => {
    const { user, sink } = renderApp({ content });
    const save = vi.spyOn(sink, "save");
    expect(screen.getByRole("radiogroup", { name: "Mennyi ideje van a kitöltésre?" })).toBeTruthy();
    expect(radio(/^Közepes/)).toHaveProperty("ariaChecked", "true");
    const total = () => Number(screen.getByTestId("announcer").textContent?.match(/kártya (\d+) közül/)?.[1]);
    await waitFor(() => expect(total()).toBeGreaterThan(0));
    const full = total();

    await user.keyboard("{ArrowRight}");
    expect(radio(/^Alapos/)).toHaveProperty("ariaChecked", "true");
    expect(document.activeElement).toBe(radio(/^Alapos/));
    await user.keyboard("1");
    expect(radio(/^Rövid/)).toHaveProperty("ariaChecked", "true");
    await waitFor(() => expect(total()).toBeLessThan(full));
    await user.keyboard("3");
    expect(radio(/^Alapos/)).toHaveProperty("ariaChecked", "true");
    await user.click(radio(/^Rövid/));
    await user.click(start());
    await expectCard(consentHeading);
    expect(next()).toHaveProperty("disabled", true);
    expect(save).not.toHaveBeenCalled();
    await user.click(consent());
    await user.click(next());
    await expectCard(question("A01").text);
    expect(save).toHaveBeenCalledOnce();
    expect(sink.state?.effortLevel).toBe("rovid");
    expect(sink.record).toHaveProperty("effortLevel", "rovid");
    expect(sink.record).not.toHaveProperty("effortChangedFromDefault");
    expect(sink.record?.items).not.toHaveProperty("N03");
  });

  it("recalculates the path on Back while preserving a removed answer in the export", async () => {
    const { user, sink } = renderApp({ content });
    await user.click(start());
    await user.click(consent());
    await user.click(screen.getByRole("checkbox", { name: /^Hozzájárulok/ }));
    await user.click(next());
    await expectCard(question("A01").text);
    await user.click(screen.getByRole("button", { name: optionLabel("A01", "mas") }));
    await expectCard(question("A02").text);
    await user.click(screen.getByRole("button", { name: optionLabel("A02", "csaladi_haz") }));
    await expectCard(question("A03").text);
    const stored = sink.record!.items.A02;
    expect(stored).toMatchObject({ status: "answered", value: "csaladi_haz" });
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: "Vissza" }));
    await expectCard(introHeading);

    await user.click(radio(/^Rövid/));
    expect(sink.record).toHaveProperty("effortChangedFromDefault", true);
    expect(sink.record?.items.A02).toEqual({ ...stored, inactive: true });
    expect(sink.record?.order[stored.position!]).toBe("A02");
    await user.click(radio(/^Alapos/));
    expect(sink.record?.items.A02).toEqual(stored);
    expect(sink.record).toHaveProperty("effortChangedFromDefault", true);
    await user.click(radio(/^Rövid/));
    await user.click(start());
    await user.click(next());
    await user.click(await screen.findByRole("button", { name: optionLabel("A01", "mas") }));
    await expectCard(question("A03").text);
    expect(sink.record?.items.A02).toEqual({ ...stored, inactive: true });
  });

  it("offers one further level at the summary and returns there with Back or after answering", async () => {
    window.history.replaceState(null, "");
    const { state } = simulatePath(content.bank, content.devices, { effortLevel: "kozepes" });
    const { user, sink } = renderApp({ content, sink: new MemSink(state) });
    await user.click(screen.getByRole("button", { name: "Folytatom" }));
    const extend = () => screen.getByRole("button", { name: "Van még néhány perce? További kérdések" });
    const summaryDepth = state.history.length;

    await user.click(extend());
    await expectCard(/^Jobban megbíznék/);
    expect(sink.state?.history.at(-1)).toBe("B04");
    expect(sink.record?.effortLevel).toBe("alapos");
    expect(window.history.state).toEqual({ kd: summaryDepth + 1 });
    window.history.back();
    await screen.findByRole("button", { name: /További kérdések/ });
    expect(sink.record?.effortLevel).toBe("kozepes");
    expect(sink.record?.items.B04).toMatchObject({ status: "shown", inactive: true });

    await user.click(extend());
    await expectCard(/^Jobban megbíznék/);
    await user.keyboard("4");
    await screen.findByRole("button", { name: "Beküldés" });
    await waitFor(() => expect(window.history.state).toEqual({ kd: summaryDepth }));
    expect(sink.record?.effortLevel).toBe("alapos");
    expect(sink.record?.items.B04).toMatchObject({ status: "answered", value: 4 });
    expect(sink.record?.items.B04).not.toHaveProperty("inactive");
    expect(screen.queryByRole("button", { name: /További kérdések/ })).toBeNull();
  });
});

it("enlarges the first shared lead in presentation order and keeps keyboard focus on the current card", async () => {
  const example = question("I01");
  if (example.type !== "scale6" || !example.lead) throw new Error("Missing shared lead");
  const lead = example.lead;
  const { state } = simulatePath(content.bank, content.devices, {}, "simulate");
  const leadIds = state.history.filter((id) => {
    const card = question(id);
    return "lead" in card && card.lead === lead;
  });
  const [first, second] = leadIds;
  expect(first).not.toBe("I01");
  const firstText = displayedText(question(first), state.items[first]?.variant);
  const secondText = displayedText(question(second), state.items[second]?.variant);
  state.history = state.history.slice(0, state.history.indexOf(first) + 1);
  state.order = [...state.history];
  for (const id of Object.keys(state.items)) {
    if (!state.order.includes(id)) delete state.items[id];
  }
  state.items[first] = { ...state.items[first], status: "shown", value: undefined };

  const { user } = renderApp({ content, sink: new MemSink(state) });
  await user.click(screen.getByRole("button", { name: "Folytatom" }));
  const leadSize = (heading: HTMLElement) => {
    const section = heading.closest("section")!;
    return within(section).getAllByText(lead).find((node) => !node.hasAttribute("aria-hidden"))?.classList;
  };
  const firstHeading = await expectCard(firstText);
  expect(leadSize(firstHeading)?.contains("text-base")).toBe(true);
  expect(document.activeElement).toBe(firstHeading);
  await user.tab();
  expect(document.activeElement).toBe(screen.getAllByRole("radio")[0]);
  await user.keyboard("4");

  const secondHeading = await expectCard(secondText);
  expect(leadSize(secondHeading)?.contains("text-sm")).toBe(true);
  expect(document.activeElement).toBe(secondHeading);
  await user.keyboard("{Backspace}");
  expect(leadSize(await expectCard(firstText))?.contains("text-base")).toBe(true);
});

describe("B01 exclusive section", () => {
  it("separates the exclusive tile and clears the self-option together with the other answers", async () => {
    const { state } = simulatePath(content.bank, content.devices, { answers: { B01: SKIP } });
    const history = state.history.slice(0, state.history.indexOf("B01") + 1);
    const { user, sink } = renderApp({ content, sink: new MemSink({ ...state, history }) });
    await user.click(screen.getByRole("button", { name: "Folytatom" }));
    await expectCard(/^Kire bízná/);
    const two = screen.getByRole("checkbox", { name: /^Magamra is/ });
    const none = screen.getByRole("checkbox", { name: /^Senkire/ });
    const actor = screen.getByRole("checkbox", { name: /^A helyi áramhálózat/ });

    const divider = screen.getByRole("separator");
    expect(divider.classList.contains("col-span-full")).toBe(true);
    expect(divider.previousElementSibling).toBe(two);
    expect(divider.nextElementSibling).toBe(none);
    await user.click(two);
    await user.tab();
    expect(document.activeElement).toBe(none);
    await user.click(actor);
    expect(two).toHaveProperty("ariaChecked", "true");
    expect(actor).toHaveProperty("ariaChecked", "true");
    await user.keyboard(" ");
    expect(actor).toHaveProperty("ariaChecked", "false");
    await user.click(actor);
    await user.click(none);
    expect(two).toHaveProperty("ariaChecked", "false");
    expect(actor).toHaveProperty("ariaChecked", "false");
    expect(none).toHaveProperty("ariaChecked", "true");
    await user.click(two);
    expect(none).toHaveProperty("ariaChecked", "false");
    await user.click(actor);
    await user.click(next());
    expect(sink.record?.items.B01.value).toEqual(["onkent_magam", "eloszto"]);
  });
});
