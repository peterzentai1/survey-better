import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMini } from "../engine/__fixtures__/mini.ts";
import { makeCtx } from "../engine/path.ts";
import { buildRecord, createSession } from "../engine/session.ts";
import { deliveryQueue } from "./delivery.ts";
import { LocalSink } from "./sinks.ts";

const { bank, devices } = loadMini();
const ctx = makeCtx(bank, devices, "s");
const state = createSession(ctx, { sessionId: "s", startedDate: "2000-01-01" });
const record = buildRecord(ctx, state, "t");

afterEach(() => vi.restoreAllMocks());

describe("LocalSink", () => {
  it("round-trips the session state under a key that includes the bank version", () => {
    const sink = new LocalSink("v1");
    expect(sink.load()).toBeNull();
    sink.save(state, record);
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe("kartya-kerdoiv:v1:session");
    expect(sink.load()).toEqual(JSON.parse(JSON.stringify(state)));
    expect(new LocalSink("v2").load()).toBeNull();
    sink.clear();
    expect(sink.load()).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const sink = new LocalSink("v1");
    expect(() => sink.save(state, record)).not.toThrow();
    expect(sink.load()).toBeNull();
    expect(() => sink.clear()).not.toThrow();
  });

  it("returns null for corrupt JSON", () => {
    localStorage.setItem("kartya-kerdoiv:v1:session", "{not json");
    expect(new LocalSink("v1").load()).toBeNull();
  });
  it("keeps progress separate for surveys that share a bank version", () => {
    const a = new LocalSink("v1", "survey_a");
    const b = new LocalSink("v1", "survey_b");
    a.save(state, record);
    expect(a.load()).toEqual(state);
    expect(b.load()).toBeNull();
    expect(new LocalSink("v1").load()).toBeNull();
  });
});

describe("forgetting a delivered completion", () => {
  it("removes the session and ignores later saves of it, but not of a new session", () => {
    const sink = new LocalSink("v1");
    sink.save(state, record);
    sink.forget("s");
    expect(sink.load()).toBeNull();
    sink.save(state, record);
    expect(sink.load()).toBeNull();
    const next = { ...state, sessionId: "n" };
    sink.save(next, record);
    expect(sink.load()).toMatchObject({ sessionId: "n" });
    sink.forget("s");
    expect(sink.load()).toMatchObject({ sessionId: "n" });
  });

  it("reports a receipt only after the server accepted it", async () => {
    const delivered: string[] = [];
    let fail = true;
    const queue = deliveryQueue<{ n: number }>("q:", async () => {
      if (fail) throw new Error("offline");
    }, undefined, (receipt) => delivered.push(receipt));
    queue.put("r1", { n: 1 });
    await vi.waitFor(() => expect(localStorage.getItem("q:r1")).not.toBeNull());
    await new Promise((r) => setTimeout(r, 0));
    expect(delivered).toEqual([]);
    fail = false;
    queue.retry();
    await vi.waitFor(() => expect(delivered).toEqual(["r1"]));
    expect(localStorage.getItem("q:r1")).toBeNull();
  });
});
