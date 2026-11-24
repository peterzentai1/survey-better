import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMini } from "../engine/__fixtures__/mini.ts";
import { makeCtx } from "../engine/path.ts";
import { buildRecord, createSession } from "../engine/session.ts";
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
