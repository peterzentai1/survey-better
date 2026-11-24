// End-to-end flows through the whole UI, on the engine fixture (not the real content files).
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SKIP, simulatePath } from "./engine/simulate.ts";
import { parseContent } from "./engine/validate.ts";
import { MINI_BANK_YAML, MINI_DEVICES_YAML } from "./engine/__fixtures__/mini.ts";
import { clickIntro, clickToYesNo, expectCard, MemSink, renderApp, screen, wait, waitFor } from "./test-utils.tsx";

const SCALE_HEADINGS = /^(Általános szöveg 1|Városi szöveg 1|Szöveg 2|Szöveg 3|Szöveg 4)$/;

describe("complete the questionnaire with the keyboard only", () => {
  it("reaches the thank-you screen without any pointer", async () => {
    const { user, sink } = renderApp();

    await expectCard("Üdvözöljük");
    await user.keyboard("{Enter}"); // cta

    await expectCard("Tájékoztatás");
    await user.keyboard("{Tab}{ }"); // participation checkbox
    await user.keyboard("{Enter}"); // Enter on the checkbox continues

    await expectCard("Település?");
    await user.keyboard("{Tab}{Enter}"); // first option
    await expectCard("Fűtés?");
    await user.keyboard("{Tab}{Enter}");

    await expectCard("Mi van otthon?");
    await user.keyboard("{Tab}{Tab}{Tab}{Tab}{ }"); // 4th tile = B2
    expect(screen.getByRole("checkbox", { name: /B2/ })).toHaveProperty("ariaChecked", "true");
    await user.keyboard("{Enter}"); // Enter continues from a tile

    await expectCard("Használja fűtésre?");
    await user.keyboard("i"); // yes

    await expectCard("Mi a fontos?");
    await user.keyboard("{Tab}{ }{Enter}"); // first option, continue

    // four scale cards in random order: digits select and move on
    for (const digit of ["1", "6", "3", "5"]) {
      await expectCard(SCALE_HEADINGS);
      await user.keyboard(digit);
      await waitFor(() => expect(screen.queryByRole("radiogroup")).toBeTruthy());
      await wait(450);
    }

    await expectCard("Mely órákban?");
    await user.keyboard("{Tab}{ }{Enter}"); // hour 0, continue

    await expectCard("B2 modul 1");
    await user.keyboard("{Tab}{Enter}");

    await expectCard("Egyéb?");
    await user.keyboard("{Tab}köszönöm{Tab}{Enter}");

    await expectCard("Mi fontos?");
    for (let i = 0; i < 30 && document.activeElement?.textContent !== "Beküldés"; i++) await user.tab();
    expect(document.activeElement?.textContent).toBe("Beküldés");
    await user.keyboard("{Enter}");

    expect(await screen.findByTestId("thank-you")).toBeTruthy();
    expect(sink.state?.completed).toBe(true);
    expect(sink.record?.items.Q_UP).toMatchObject({ status: "answered", value: "igen" });
    expect(sink.record?.items.Z01.value).toBe("köszönöm");
    expect(sink.record?.items.W5.value).toEqual([0]);
    expect("paradata" in sink.record!).toBe(false);
  });
});

describe("complete the questionnaire with clicks only", () => {
  it("reaches the thank-you screen", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    await user.click(screen.getByRole("button", { name: "Nem" }));

    await expectCard("Mi a fontos?");
    await user.click(screen.getByRole("checkbox", { name: "Ár" }));
    await user.click(screen.getByRole("checkbox", { name: "Komfort" }));
    await user.click(screen.getByRole("button", { name: /^Tovább/ }));

    for (let i = 0; i < 4; i++) {
      await expectCard(SCALE_HEADINGS);
      await user.click(screen.getByRole("radio", { name: /^4 / }));
      expect(screen.getByText("négy")).toBeTruthy(); // verbal label of the selected point
      await wait(450);
    }
    await expectCard("Mely órákban?");
    await user.click(screen.getByRole("checkbox", { name: "9:00–10:00" }));
    await user.click(screen.getByRole("checkbox", { name: "10:00–11:00" }));
    await user.click(screen.getByRole("button", { name: /^Tovább/ }));

    await expectCard("B2 modul 1");
    await user.click(screen.getByRole("button", { name: "b" }));

    await expectCard("Egyéb?");
    await user.type(screen.getByRole("textbox"), "kész");
    await user.click(screen.getByRole("button", { name: /^Tovább/ }));

    await expectCard("Mi fontos?");
    await user.click(screen.getByRole("button", { name: /Első téma/ }));
    await user.click(screen.getByRole("radio", { name: "Állítás B" }));
    await user.click(screen.getByRole("button", { name: "Beküldés" }));

    expect(await screen.findByTestId("thank-you")).toBeTruthy();
    expect(sink.record?.completed).toBe(true);
    expect(sink.record?.items.Q_MULTI.value).toEqual(["ar", "komfort"]);
    expect(sink.record?.items.W5.value).toEqual([9, 10]);
    expect(sink.record?.highlights).toEqual([{ topic: "t1", statement: "Állítás B" }]);
    expect(sink.record?.items.Q_UP.value).toBe("nem");
  });
});

describe("skip", () => {
  it("works on every skippable card type, by button and by key", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    const skip = () => screen.getByRole("button", { name: /Kihagyom/ });

    await user.click(skip()); // yesno
    await expectCard("Mi a fontos?");
    await user.click(skip()); // multi_tiles
    for (let i = 0; i < 4; i++) {
      await expectCard(SCALE_HEADINGS);
      await user.click(skip()); // scale6
    }
    await expectCard("Mely órákban?");
    await user.click(skip()); // timeline
    await expectCard("B2 modul 1");
    await user.keyboard("k"); // single, by key
    await expectCard("Egyéb?");
    await user.click(skip()); // free_text
    await expectCard("Mi fontos?");

    const items = sink.record!.items;
    for (const id of ["Q_UP", "Q_MULTI", "W1", "W2", "W3", "W4", "W5", "M_B2_1", "Z01"]) expect(items[id].status, id).toBe("skipped");
    // the mandatory question has no skip button
    expect(items.Q_TOWN.status).toBe("answered");
  });

  it("is not offered on info, consent and mandatory cards", async () => {
    const { user } = renderApp();
    await expectCard("Üdvözöljük");
    expect(screen.queryByRole("button", { name: /Kihagyom/ })).toBeNull();
    await clickIntro(user);
    await expectCard("Település?");
    expect(screen.queryByRole("button", { name: /Kihagyom/ })).toBeNull();
  });
});

describe("summary: jump back to a skipped card and return", () => {
  it("lists skipped cards as links and returns to the summary", async () => {
    const { user, sink } = renderApp();
    await clickIntro(user);
    await user.click(await screen.findByRole("button", { name: "X város" }));
    await expectCard("Fűtés?");
    await user.click(screen.getByRole("button", { name: /Kihagyom/ })); // skip Q_HEAT
    await expectCard("Mi van otthon?");
    await user.click(screen.getByRole("checkbox", { name: "Egyik sem" }));
    await user.click(screen.getByRole("button", { name: /^Tovább/ }));
    await expectCard("Mi a fontos?");
    await user.click(screen.getByRole("button", { name: /Kihagyom/ }));
    for (let i = 0; i < 4; i++) {
      await expectCard(SCALE_HEADINGS);
      await user.click(screen.getByRole("radio", { name: /^2 / }));
      await wait(450);
    }
    await expectCard("Mely órákban?");
    await user.click(screen.getByRole("button", { name: /Kihagyom/ }));
    await expectCard("Egyéb?");
    await user.click(screen.getByRole("button", { name: /Kihagyom/ }));

    await expectCard("Mi fontos?");
    expect(screen.getByText("Kihagyott kérdések")).toBeTruthy();
    const link = screen.getByRole("button", { name: "Fűtés?" });
    await user.click(link);

    await expectCard("Fűtés?");
    expect(screen.getByRole("button", { name: "Vissza az összegzéshez" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Gáz" }));
    await wait(500); // no auto-advance while editing from the summary
    expect(screen.getByRole("heading", { level: 2, name: "Fűtés?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Vissza az összegzéshez" }));

    await expectCard("Mi fontos?");
    expect(screen.queryByRole("button", { name: "Fűtés?" })).toBeNull();
    expect(sink.record?.items.Q_HEAT).toMatchObject({ status: "answered", value: "gas", changes: 1 });
  });

  it("labels and announces a skipped scenario using the question the respondent saw", async () => {
    const bankYaml = MINI_BANK_YAML.replace(
      '"Városi szöveg 1"',
      JSON.stringify("Városi helyzetleírás.\nVárosi szöveg 1"),
    );
    const content = parseContent(bankYaml, MINI_DEVICES_YAML);
    if (!content.ok) throw new Error(JSON.stringify(content.issues));
    const { state } = simulatePath(content.bank, content.devices, { answers: { Q_TOWN: "x", W1: SKIP } });
    const { user } = renderApp({ content, sink: new MemSink(state) });
    await user.click(screen.getByRole("button", { name: "Folytatom" }));
    await user.click(screen.getByRole("button", { name: "Városi szöveg 1" }));
    await expectCard("Városi szöveg 1");
    expect(screen.getByTestId("announcer").textContent).toMatch(/: Városi szöveg 1$/);
  });
});

describe("back navigation", () => {
  it("Vissza button and Backspace step back one card; no Vissza on the first card", async () => {
    const { user } = renderApp();
    await expectCard("Üdvözöljük");
    expect(screen.queryByRole("button", { name: /Vissza/ })).toBeNull();
    await user.keyboard("{Enter}");
    await expectCard("Tájékoztatás");
    await user.click(screen.getByRole("button", { name: /Vissza/ }));
    await expectCard("Üdvözöljük");
    await user.keyboard("{Enter}");
    await expectCard("Tájékoztatás");
    await user.keyboard("{Backspace}");
    await expectCard("Üdvözöljük");
  });

  it("the browser Back button steps back one card instead of leaving the page", async () => {
    const { user } = renderApp();
    await clickIntro(user);
    await expectCard("Település?");
    window.history.back();
    await expectCard("Tájékoztatás");
    await user.click(screen.getByRole("button", { name: /Vissza/ }));
    await expectCard("Üdvözöljük");
    // the app's own Back did not double-step through a stray popstate
    await wait(100);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Üdvözöljük");
  });

  it("waits for the browser to finish each traversal when Back is clicked twice quickly", async () => {
    window.history.replaceState(null, "");
    const { user } = renderApp();
    await clickIntro(user);
    await expectCard("Település?");
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByRole("button", { name: "Vissza" }));
      fireEvent.click(screen.getByRole("button", { name: "Vissza" }));
      await expectCard("Üdvözöljük");
      expect(go.mock.calls).toEqual([[-1]]);

      window.history.replaceState({ kd: 2 }, "");
      fireEvent.popState(window, { state: window.history.state });
      expect(go.mock.calls).toEqual([[-1], [-1]]);
      window.history.replaceState({ kd: 1 }, "");
      fireEvent.popState(window, { state: window.history.state });
      expect(go).toHaveBeenCalledTimes(2);
    } finally {
      go.mockRestore();
    }
  });

  it("resumes history synchronization after a traversal without popstate", async () => {
    window.history.replaceState(null, "");
    const { user } = renderApp();
    await clickIntro(user);
    await expectCard("Település?");
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    try {
      await user.click(screen.getByRole("button", { name: "Vissza" }));
      await expectCard("Tájékoztatás");
      expect(go).toHaveBeenCalledOnce();
      await waitFor(() => expect(window.history.state).toEqual({ kd: 2 }));
      await user.click(screen.getByRole("button", { name: /^Tovább/ }));
      await expectCard("Település?");
      expect(window.history.state).toEqual({ kd: 3 });
      expect(go).toHaveBeenCalledOnce();
    } finally {
      go.mockRestore();
    }
  });

  it("a pending auto-advance is cancelled by going back", async () => {
    const { user } = renderApp();
    await clickIntro(user);
    await expectCard("Település?");
    await user.click(screen.getByRole("button", { name: "X város" }));
    await user.click(screen.getByRole("button", { name: /Vissza/ }));
    await wait(500);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Tájékoztatás");
  });
});

describe("start-up, resume and errors", () => {
  it("shows every validation issue in Hungarian with its path", () => {
    const bad = parseContent(MINI_BANK_YAML.replace("{ id: W2, block: why", "{ id: W2, block: nincs"), MINI_DEVICES_YAML);
    renderApp({ content: bad });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("A kérdőív tartalma hibás");
    expect(alert.textContent).toContain("kerdesbank.hu.yaml");
    expect(alert.textContent).toMatch(/cards\[\d+\] \(W2\)\.block/);
    expect(alert.textContent).toContain("Ismeretlen blokk");
  });

  it("offers to resume an unfinished session, and can start over", async () => {
    const first = renderApp();
    await clickIntro(first.user);
    await expectCard("Település?");
    await first.user.click(screen.getByRole("button", { name: "Y falu" }));
    await expectCard("Fűtés?");
    const saved = JSON.parse(JSON.stringify(first.sink.state));
    first.unmount();

    const second = renderApp({ sink: new MemSink(saved) });
    expect(screen.getByText("Folytatja a korábbi kitöltést?")).toBeTruthy();
    await second.user.click(screen.getByRole("button", { name: "Folytatom" }));
    await expectCard("Fűtés?");
    second.unmount();

    const third = renderApp({ sink: new MemSink(saved) });
    await third.user.click(screen.getByRole("button", { name: "Újrakezdem" }));
    await expectCard("Üdvözöljük");
  });

  it("resumes saved answers even after going back to the welcome card", async () => {
    const first = renderApp();
    await clickIntro(first.user);
    await first.user.click(screen.getByRole("button", { name: "X város" }));
    await expectCard("Fűtés?");
    for (let i = 0; i < 3; i++) {
      await first.user.click(screen.getByRole("button", { name: "Vissza" }));
    }
    await expectCard("Üdvözöljük");
    await waitFor(() => expect(window.history.state).toEqual({ kd: 1 }));
    const saved = JSON.parse(JSON.stringify(first.sink.state));
    first.unmount();

    const resumed = renderApp({ sink: new MemSink(saved) });
    await resumed.user.click(screen.getByRole("button", { name: "Folytatom" }));
    await resumed.user.click(screen.getByRole("button", { name: /Kezdjük/ }));
    await resumed.user.click(screen.getByRole("button", { name: /^Tovább/ }));
    expect(screen.getByRole("button", { name: "X város", pressed: true })).toBeTruthy();
  });

  it("ignores a stored session that does not fit the bank", async () => {
    const first = renderApp();
    await clickIntro(first.user);
    await expectCard("Település?");
    const stale = JSON.parse(JSON.stringify(first.sink.state));
    first.unmount();
    stale.history = ["NOT_A_CARD", "N01"];
    renderApp({ sink: new MemSink(stale) });
    await expectCard("Üdvözöljük");
  });

  it("works end to end when localStorage throws (default LocalSink)", async () => {
    const { LocalSink } = await import("./storage/sinks.ts");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { user } = renderApp({ sink: new LocalSink("x") });
    await clickIntro(user);
    await expectCard("Település?");
    vi.restoreAllMocks();
  });

  it("shows the prototype banner, and the download button only in debug mode", async () => {
    const hidden = renderApp({ debug: { panel: false, download: false } });
    expect(screen.getByText("PROTOTÍPUS – nem gyűjt adatot; a válaszok csak ezen az eszközön maradnak.")).toBeTruthy();
    expect(screen.queryByText("Hibakeresés")).toBeNull();
    hidden.unmount();
    renderApp({ debug: { panel: true, download: true } });
    expect(screen.getByText("Hibakeresés")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Válaszok letöltése (JSON)" })).toBeTruthy();
    expect(screen.getByTestId("debug-card").textContent).toBe("N01");
  });
});

describe("real content", () => {
  it("the app loads content/*.yaml without errors and shows the first card", async () => {
    const { loadContent } = await import("./content/load.ts");
    renderApp({ content: loadContent() });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByRole("heading", { level: 2 })).toBeTruthy();
  });
});

describe("paradata", () => {
  it("is collected only after the paradata box was ticked", async () => {
    const withConsent = renderApp();
    await clickToYesNo(withConsent.user, true);
    await wait(150);
    await withConsent.user.click(screen.getByRole("button", { name: "Igen" }));
    await expectCard("Mi a fontos?");
    const rec = withConsent.sink.record!;
    expect(rec.consent).toEqual({ participation: true, paradata: true });
    expect(rec.paradata?.N02).toBeUndefined();
    expect(rec.paradata?.Q_UP.inputs.tap).toBeGreaterThan(0);
    expect((rec.paradata?.Q_UP.dwellMs ?? 1) % 100).toBe(0);
    expect(rec.paradata?.Q_TOWN).toBeTruthy();
    withConsent.unmount();

    const without = renderApp();
    await clickToYesNo(without.user, false);
    expect("paradata" in without.sink.record!).toBe(false);
    expect(JSON.stringify(without.sink.state)).not.toContain("dwellMs");
  });

  it("does not store an answer derived from a repeated gesture: unrelated pointer events never answer", async () => {
    const { user, sink } = renderApp();
    await clickToYesNo(user);
    fireEvent.wheel(document.body, { deltaY: 400 });
    fireEvent.wheel(document.body, { deltaX: 400 });
    await wait(450);
    expect(sink.record?.items.Q_UP.status).toBe("shown");
  });
});
