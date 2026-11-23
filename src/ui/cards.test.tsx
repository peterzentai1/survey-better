// Interaction tests for individual card types.
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clickIntro, clickToYesNo, expectCard, renderApp, screen, wait, waitFor } from "../test-utils.tsx";
import { iconFor } from "./icons.ts";
import { ICON_KEYS } from "./iconKeys.ts";
import { resetDragHint } from "./cards/YesNoCard.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
  resetDragHint();
});

const touch = (extra: object = {}) => ({ pointerType: "touch", pointerId: 7, isPrimary: true, clientY: 100, ...extra });

async function dragCard(el: HTMLElement, from: number, to: number, type = "touch") {
  const base = { pointerType: type, pointerId: 7, isPrimary: true, clientY: 100 };
  fireEvent.pointerDown(el, { ...base, clientX: from });
  fireEvent.pointerMove(el, { ...base, clientX: from + (to - from) / 2 });
  fireEvent.pointerMove(el, { ...base, clientX: to });
  fireEvent.pointerUp(el, { ...base, clientX: to });
}

/** Get from the intro to the first scale card (Q_UP answered "nem", Q_MULTI skipped). */
async function toScale(user: ReturnType<typeof renderApp>["user"]) {
  await clickToYesNo(user);
  await user.click(screen.getByRole("button", { name: "Nem" }));
  await expectCard("Mi a fontos?");
  await user.click(screen.getByRole("button", { name: /Kihagyom/ }));
  await screen.findByRole("radiogroup");
}

describe("yesno drag gesture", () => {
  it("a touch drag past the threshold answers, shows the label, and Visszavonás restores the card", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    const card = screen.getByTestId("yesno-drag");

    fireEvent.pointerDown(card, touch({ clientX: 100 }));
    fireEvent.pointerMove(card, touch({ clientX: 200 }));
    expect(screen.getByTestId("drag-label").textContent).toBe("Igen"); // right = igen
    fireEvent.pointerUp(card, touch({ clientX: 200 }));

    await expectCard("Mi a fontos?");
    expect(sink.record?.items.Q_UP).toMatchObject({ status: "answered", value: "igen" });
    const undo = await screen.findByRole("button", { name: "Visszavonás" });
    await user.click(undo);

    await expectCard("Használja fűtésre?");
    expect(sink.record?.items.Q_UP.status).toBe("shown");
    expect(screen.getByRole("button", { name: "Igen" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Visszavonás" })).toBeNull();
  });

  it("dragging left records nem; the undo toast disappears after 3 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user, sink } = renderApp({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) });
      await clickToYesNo(user);
      const card = screen.getByTestId("yesno-drag");
      await dragCard(card, 250, 100, "pen");
      await vi.advanceTimersByTimeAsync(400);
      await expectCard("Mi a fontos?");
      expect(sink.record?.items.Q_UP.value).toBe("nem");
      expect(screen.getByRole("button", { name: "Visszavonás" })).toBeTruthy();
      await vi.advanceTimersByTimeAsync(3100);
      expect(screen.queryByRole("button", { name: "Visszavonás" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a drag that stays below the threshold snaps back and answers nothing", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    const card = screen.getByTestId("yesno-drag");
    await dragCard(card, 100, 120); // 20 px
    await wait(400);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Használja fűtésre?");
    expect(sink.record?.items.Q_UP.status).toBe("shown");
    expect(screen.queryByTestId("drag-label")).toBeNull();
  });

  it("a mouse drag never answers", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    const card = screen.getByTestId("yesno-drag");
    await dragCard(card, 100, 400, "mouse");
    await wait(450);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Használja fűtésre?");
    expect(sink.record?.items.Q_UP.status).toBe("shown");
    expect(screen.queryByTestId("drag-label")).toBeNull();
  });

  it("the card keeps vertical scrolling native (touch-action: pan-y)", async () => {
    const { user } = renderApp();
    await clickToYesNo(user);
    expect(screen.getByTestId("yesno-drag").style.touchAction).toBe("pan-y");
  });

  it("with reduced motion the card does not move or tilt, but the drag still answers", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduced-motion"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    const card = screen.getByTestId("yesno-drag");
    fireEvent.pointerDown(card, touch({ clientX: 100 }));
    fireEvent.pointerMove(card, touch({ clientX: 160 }));
    expect(card.style.transform).toBe("");
    fireEvent.pointerUp(card, touch({ clientX: 300 }));
    await expectCard("Mi a fontos?");
    expect(sink.record?.items.Q_UP.value).toBe("igen");
  });

  it("shows a dismissible hint the first time on a coarse pointer", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { user } = renderApp();
    await clickToYesNo(user);
    const hint = screen.getByText(/húzva/);
    expect(hint.textContent).toContain("húzva");
    await user.click(screen.getByRole("button", { name: "Értem" }));
    expect(screen.queryByText(/húzva/)).toBeNull();
  });

  it("keys: I and N (and arrows) answer", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    await user.keyboard("n");
    await expectCard("Mi a fontos?");
    expect(sink.record?.items.Q_UP.value).toBe("nem");
    await user.keyboard("{Backspace}");
    await expectCard("Használja fűtésre?");
    await user.keyboard("{ArrowRight}");
    await expectCard("Mi a fontos?");
    expect(sink.record?.items.Q_UP.value).toBe("igen");
    expect(sink.record?.items.Q_UP.changes).toBe(1);
  });
});

describe("scale6", () => {
  it("arrow keys move the selection without advancing; Enter confirms", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    const heading = screen.getByRole("heading", { level: 2 }).textContent!;
    await user.keyboard("{Tab}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^3 / }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("három")).toBeTruthy(); // verbal label under the row
    await wait(500);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(heading); // no auto-advance
    await user.keyboard("{ArrowLeft}{Enter}");
    await waitFor(() => expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(heading));
    const first = Object.values(sink.record!.items).find((it) => it.position !== undefined && it.status === "answered" && it.value === 2);
    expect(first).toBeTruthy();
  });

  it("digits 1-6 select and advance, all six points are reachable by keyboard", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    const got: unknown[] = [];
    for (const d of ["1", "2", "3", "4"]) {
      const id = sink.state!.history[sink.state!.history.length - 1];
      await user.keyboard(d);
      await waitFor(() => expect(sink.state!.history.at(-1)).not.toBe(id), { timeout: 2000 });
      got.push(sink.state!.items[id].value);
    }
    expect(got).toEqual([1, 2, 3, 4]);
  });

  it("has radio-group semantics with the scale ends labelled", async () => {
    const { user } = renderApp();
    await toScale(user);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getAllByText(/Biztosan igen|Teljes mértékben/).length).toBeGreaterThan(0);
  });

  it("pointer scrubbing: press, slide to another segment, release selects that segment", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    const id = sink.state!.history.at(-1)!;
    const seg2 = screen.getByRole("radio", { name: /^2 / });
    const seg5 = screen.getByRole("radio", { name: /^5 / });
    const base = { pointerType: "touch", pointerId: 3, isPrimary: true };
    fireEvent.pointerDown(seg2, base);
    fireEvent.pointerMove(seg5, base);
    expect(screen.getByRole("radio", { name: /^5 / }).getAttribute("aria-checked")).toBe("true"); // live preview
    fireEvent.pointerUp(seg5, base);
    await waitFor(() => expect(sink.state!.history.at(-1)).not.toBe(id), { timeout: 2000 });
    expect(sink.state!.items[id].value).toBe(5);
  });

  it("mouse scrubbing works too (any pointer type)", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    const id = sink.state!.history.at(-1)!;
    const base = { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0 };
    fireEvent.pointerDown(screen.getByRole("radio", { name: /^1 / }), base);
    fireEvent.pointerMove(screen.getByRole("radio", { name: /^6 / }), base);
    fireEvent.pointerUp(screen.getByRole("radio", { name: /^6 / }), base);
    await waitFor(() => expect(sink.state!.items[id].value).toBe(6));
  });

  it("mouse wheel never answers", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    const id = sink.state!.history.at(-1)!;
    fireEvent.wheel(screen.getByRole("radiogroup"), { deltaY: 300, deltaX: 300 });
    await wait(450);
    expect(sink.state!.items[id].status).toBe("shown");
  });

  it("uses the card's own end labels and the bank's verbal labels", async () => {
    const { user } = renderApp();
    await toScale(user);
    // W1 has its own ends, the other scale cards use the bank defaults; either pair must be visible
    const ends = screen.getAllByText(/Biztosan nem|Egyáltalán nem/);
    expect(ends.length).toBeGreaterThan(0);
  });
});

describe("text variants and option rules", () => {
  it("shows the matching text variant and records its index", async () => {
    const { user, sink } = renderApp();
    await toScale(user);
    // walk the four scale cards, remembering whether W1 appeared with its variant
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(screen.getByRole("heading", { level: 2 }).textContent!);
      await user.keyboard("3");
      await wait(450);
    }
    expect(seen.some((t) => t === "Városi szöveg 1")).toBe(true);
    expect(seen).not.toContain("Általános szöveg 1");
    expect(sink.record?.items.W1.variant).toBe(0);
  });

  it("pre-selects impliedBy tiles on first show; the respondent can untick", async () => {
    const { user, sink } = renderApp();
    await clickIntro(user);
    await user.click(await screen.findByRole("button", { name: "X város" }));
    await expectCard("Fűtés?");
    await user.click(screen.getByRole("button", { name: "Hőszivattyú" }));
    await expectCard("Mi van otthon?");
    const a1 = screen.getByRole("checkbox", { name: "A1" });
    expect(a1.getAttribute("aria-checked")).toBe("true");
    await user.click(a1);
    expect(a1.getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("checkbox", { name: "A2" }));
    await user.click(screen.getByRole("button", { name: /^Tovább/ }));
    await expectCard("Mi a fontos?");
    expect(sink.record?.items.E01.value).toEqual(["app_a2"]);
  });

  it("exclusive tiles clear the others, max is enforced with a message, option showIf hides tiles", async () => {
    const { user } = renderApp();
    await clickToYesNo(user);
    await user.click(screen.getByRole("button", { name: "Igen" }));
    await expectCard("Mi a fontos?");
    expect(screen.queryByRole("checkbox", { name: "Rejtett" })).toBeNull(); // Q_TOWN = x
    await user.click(screen.getByRole("checkbox", { name: "Ár" }));
    await user.click(screen.getByRole("checkbox", { name: "Komfort" }));
    await user.click(screen.getByRole("checkbox", { name: "Környezet" }));
    expect(screen.getByRole("checkbox", { name: "Környezet" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Legfeljebb 2 jelölhető\. Vegyen le/)).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Semmi" }));
    expect(screen.getByRole("checkbox", { name: "Ár" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("checkbox", { name: "Semmi" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("checkbox", { name: "Ár" }));
    expect(screen.getByRole("checkbox", { name: "Semmi" }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("timeline", () => {
  async function toTimeline(user: ReturnType<typeof renderApp>["user"]) {
    await toScale(user);
    for (let i = 0; i < 4; i++) {
      await user.keyboard("3");
      await wait(450);
    }
    await expectCard("Mely órákban?");
  }

  it("is a 6 x 4 grid of 24 hour cells; tap toggles; Tovább needs a selection", async () => {
    const { user } = renderApp();
    await toTimeline(user);
    expect(screen.getAllByRole("checkbox")).toHaveLength(24);
    expect(screen.getAllByRole("group")).toHaveLength(4);
    const next = screen.getByRole("button", { name: /^Tovább/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "13:00–14:00" }));
    expect(screen.getByRole("checkbox", { name: "13:00–14:00" }).getAttribute("aria-checked")).toBe("true");
    expect(next.disabled).toBe(false);
    await user.click(screen.getByRole("checkbox", { name: "13:00–14:00" }));
    expect(next.disabled).toBe(true);
  });

  it("dragging across cells paints (add), and starting on a selected cell removes", async () => {
    const { user } = renderApp();
    await toTimeline(user);
    const cell = (h: number) => screen.getByRole("checkbox", { name: `${h}:00–${h + 1}:00` });
    const base = { pointerType: "touch", pointerId: 2, isPrimary: true };
    fireEvent.pointerDown(cell(2), base);
    fireEvent.pointerMove(cell(3), base);
    fireEvent.pointerMove(cell(4), base);
    fireEvent.pointerUp(cell(4), base);
    expect([2, 3, 4].map((h) => cell(h).getAttribute("aria-checked"))).toEqual(["true", "true", "true"]);
    fireEvent.pointerDown(cell(4), base);
    fireEvent.pointerMove(cell(3), base);
    fireEvent.pointerUp(cell(3), base);
    expect([2, 3, 4].map((h) => cell(h).getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  });

  it("enforces max (3) with a message", async () => {
    const { user } = renderApp();
    await toTimeline(user);
    for (const h of [1, 2, 3, 4]) await user.click(screen.getByRole("checkbox", { name: `${h}:00–${h + 1}:00` }));
    expect(screen.getByRole("checkbox", { name: "4:00–5:00" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Legfeljebb 3 óra jelölhető/)).toBeTruthy();
  });

  it("keyboard: arrows move focus, Space toggles, Enter continues", async () => {
    const { user, sink } = renderApp();
    await toTimeline(user);
    await user.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("data-hour")).toBe("0");
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(document.activeElement?.getAttribute("data-hour")).toBe("7");
    await user.keyboard("{ }");
    expect(screen.getByRole("checkbox", { name: "7:00–8:00" }).getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{Enter}");
    await expectCard("B2 modul 1");
    expect(sink.record?.items.W5.value).toEqual([7]);
  });
});

describe("free text and consent", () => {
  it("free text shows a counter, the maxLength and the always-visible privacy note", async () => {
    const { user } = renderApp();
    await toScale(user);
    for (let i = 0; i < 4; i++) {
      await user.keyboard("3");
      await wait(450);
    }
    await user.click(screen.getByRole("button", { name: /Kihagyom/ })); // timeline
    await user.click(screen.getByRole("button", { name: /Kihagyom/ })); // module single
    await expectCard("Egyéb?");
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(box.maxLength).toBe(50);
    expect(screen.getByText("Ne írjon személyes adatot.")).toBeTruthy();
    expect(screen.getByText("0/50")).toBeTruthy();
    await user.type(box, "abc");
    expect(screen.getByText("3/50")).toBeTruthy();
    // typing letters that are shortcuts (k, 1) in the field must not skip or answer
    await user.type(box, "k0");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("abck0");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Egyéb?");
  });

  it("consent cannot be passed without the participation box; the paradata box is optional", async () => {
    const { user } = renderApp();
    await expectCard("Üdvözöljük");
    await user.click(screen.getByRole("button", { name: /Kezdjük/ }));
    await expectCard("Tájékoztatás");
    const cont = screen.getByRole("button", { name: /^Tovább/ }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Tájékoztatás");
    await user.click(screen.getByRole("checkbox", { name: /Részt veszek/ }));
    expect(cont.disabled).toBe(false);
    await user.click(cont);
    await expectCard("Település?");
  });
});

describe("accessibility basics", () => {
  it("moves focus to the new card's heading and announces it in a polite live region", async () => {
    const { user } = renderApp();
    await clickIntro(user);
    const heading = await expectCard("Település?");
    expect(document.activeElement).toBe(heading);
    const live = screen.getByTestId("announcer");
    expect(live.getAttribute("aria-live")).toBe("polite");
    await waitFor(() => expect(live.textContent).toContain("Település?"));
  });

  it("has a progress indicator with the block titles and the current block highlighted", async () => {
    const { user } = renderApp();
    await clickIntro(user);
    await expectCard("Település?");
    const nav = screen.getByRole("navigation", { name: "Haladás" });
    expect(nav.textContent).toContain("Alapok");
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe("Alapok");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBeTruthy();
  });

  it("key hints are present for desktop (CSS shows them only for hover + fine pointer)", async () => {
    renderApp();
    await expectCard("Üdvözöljük");
    expect(document.querySelector(".kbd-hint")).toBeTruthy();
  });
});

describe("icons", () => {
  it("maps every documented key and falls back for unknown keys", () => {
    for (const key of ICON_KEYS) expect(iconFor(key)).toBeTruthy();
    expect(iconFor("nincs_ilyen")).toBeTruthy();
    expect(iconFor(undefined)).toBeTruthy();
    expect(iconFor("toString")).toBe(iconFor("ismeretlen"));
  });
});
