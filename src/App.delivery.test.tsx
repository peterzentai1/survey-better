import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeCtx } from "./engine/path.ts";
import { buildRecord, extendEffort, submit, validateSnapshot } from "./engine/session.ts";
import { simulatePath } from "./engine/simulate.ts";
import { DELIVERED_EVENT } from "./storage/responses.ts";
import { LocalSink } from "./storage/sinks.ts";
import { renderApp, screen, loadDeviceContent } from "./test-utils.tsx";

const content = loadDeviceContent();
if (!content.ok) throw new Error("Invalid test bank");
const { bank, devices, settings } = content;

describe("after the server accepts a completion", () => {
  it("deletes the completion from the device and says so, keeping the ID on screen", async () => {
    const ctx = makeCtx(bank, devices, "delivered-1", settings, "haztartasi_rugalmassag");
    const state = submit(ctx, simulatePath(bank, devices, {}, "delivered-1").state);
    expect(state.completed).toBe(true);
    const sink = new LocalSink(bank.version, "haztartasi_rugalmassag");
    sink.save(state, buildRecord(ctx, state, "test"));
    expect(localStorage.length).toBe(1);
    const key = localStorage.key(0)!;
    expect(key).toMatch(/:session$/);

    renderApp({ content, sink });
    expect(await screen.findByTestId("thank-you")).toBeTruthy();
    expect(screen.getByText(/Új kitöltés előtt mentse el/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forráskód (AGPL-3.0)" })).toBeTruthy();

    act(() => {
      window.dispatchEvent(new CustomEvent(DELIVERED_EVENT, { detail: "someone-else" }));
    });
    expect(localStorage.getItem(key)).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(DELIVERED_EVENT, { detail: state.sessionId }));
    });
    expect(localStorage.getItem(key)).toBeNull();
    expect(screen.getByText(/A válaszait erről az eszközről töröltük/)).toBeTruthy();
    expect(screen.getByText(state.sessionId, { selector: "code" })).toBeTruthy();
    expect(screen.queryByText(/Új kitöltés előtt mentse el/)).toBeNull();
  });
});

describe("snapshots", () => {
  it("restores a session extended from Rövidített to Alap at the summary", () => {
    const ctx = makeCtx(bank, devices, "ext", settings, "haztartasi_rugalmassag");
    const { state } = simulatePath(bank, devices, { effortLevel: "rovid" }, "ext");
    const extended = extendEffort(ctx, state);
    expect(extended.effortLevel).toBe("alapos");
    expect(validateSnapshot(ctx, JSON.parse(JSON.stringify(extended)))).not.toBeNull();
  });

  it("keeps the Egyéb text when a session is restored", () => {
    const ctx = makeCtx(bank, devices, "other", settings, "haztartasi_rugalmassag");
    const { state } = simulatePath(bank, devices, {}, "other");
    const withText = { ...state, items: { ...state.items, A03: { ...state.items.A03, status: "answered" as const, value: "egyeb", otherText: "közös" } } };
    expect(validateSnapshot(ctx, JSON.parse(JSON.stringify(withText)))?.items.A03.otherText).toBe("közös");
  });
});

describe("footer links", () => {
  it("show on the opening card and hide once answering starts", async () => {
    const { user } = renderApp({ content });
    expect(screen.getByRole("link", { name: "Adatkezelési tájékoztató" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Mehet/ }));
    expect(screen.queryByRole("link", { name: "Forráskód (AGPL-3.0)" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Vissza" }));
    expect(await screen.findByRole("link", { name: "Forráskód (AGPL-3.0)" })).toBeTruthy();
  });
});
