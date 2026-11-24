import { afterEach, describe, expect, it, vi } from "vitest";
import { loadContent } from "../content/load.ts";
import { makeCtx } from "../engine/path.ts";
import { acceptConsent, buildRecord, createSession, submit } from "../engine/session.ts";
import { temperatureArm } from "../engine/temperature.ts";
import { createSessionStore } from "../state/store.ts";
import { completionMetrics } from "./metrics.ts";

function fixture(sessionId = "metrics-test") {
  const content = loadContent();
  if (!content.ok) throw new Error("Invalid test bank");
  const ctx = makeCtx(content.bank, content.devices, sessionId, content.settings);
  const start = createSession(ctx, { sessionId, startedDate: "2026-11-24" });
  const state = acceptConsent(ctx, start, "N02", { participation: true, paradata: true });
  state.history.push("I10");
  state.items.I10 = { status: "shown", changes: 0 };
  return { ctx, state };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("temperature experiment", () => {
  it("assigns both variants and reproduces the assignment on resume independently of effort", () => {
    const counts = { tap: 0, drag: 0 };
    for (let i = 0; i < 2000; i++) counts[temperatureArm(String(i))]++;
    expect(counts.tap).toBeGreaterThan(900);
    expect(counts.drag).toBeGreaterThan(900);
    const { ctx, state } = fixture();
    const resumed = { ...state, effortLevel: "rovid" as const };
    expect(buildRecord(ctx, resumed, "test").temperatureArm).toBe(temperatureArm(state.sessionId));
  });

  it("measures visible time to first answer, survives editing and sends only completed consented metrics", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { ctx, state } = fixture();
    const store = createSessionStore({ ctx, initial: state, appVersion: "test", sink: { save() {}, clear() {}, load: () => null } });
    now = 200;
    store.getState().setTimingVisible(false);
    now = 25200;
    store.getState().setTimingVisible(true);
    now = 26300;
    store.getState().commit("I10", 4, "drag");
    now = 28200;
    store.getState().commit("I10", 5, "key");
    const partial = store.getState().state;
    expect(completionMetrics(partial, buildRecord(ctx, partial, "test"))).toBeNull();
    const done = submit(ctx, partial, "Z01");
    const rec = buildRecord(ctx, done, "test");
    expect(completionMetrics(done, rec)).toEqual({
      token: state.sessionId, bank_version: ctx.bank.version, effort: "kozepes", active_seconds: 3,
      arm: temperatureArm(state.sessionId), reaction_status: "answered", first_input: "drag",
      first_answer_ms: 1300,
    });
    const withdrawn = acceptConsent(ctx, done, "N02", { participation: true, paradata: false });
    expect(completionMetrics(withdrawn, buildRecord(ctx, withdrawn, "test"))).toBeNull();
    const late = acceptConsent(ctx, withdrawn, "N02", { participation: true, paradata: true });
    expect(completionMetrics(late, buildRecord(ctx, late, "test"))?.active_seconds).toBeNull();
    expect(completionMetrics(late, buildRecord(ctx, late, "test"))?.first_input).toBeNull();
  });

  it("retries failed deliveries with the same receipt and shares a pending median read", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://survey.example");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.resetModules();
    try {
      const api = await import("./metrics.ts");
      const requests = vi.fn().mockRejectedValueOnce(Error("offline"))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(Response.json([{ effort: "rovid", median_minutes: 3.5 }]));
      vi.stubGlobal("fetch", requests);
      const { ctx, state } = fixture();
      const done = submit(ctx, state);
      api.queueCompletion(done, buildRecord(ctx, done, "test"));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(localStorage.length).toBe(1);
      api.retryCompletions();
      await vi.waitFor(() => expect(localStorage.length).toBe(0));
      expect(requests.mock.calls[0][1].body).toEqual(requests.mock.calls[1][1].body);
      const a = api.effortMedians(ctx.bank.version);
      expect(api.effortMedians(ctx.bank.version)).toBe(a);
      expect((await a).get("rovid")).toBe(3.5);
      expect(requests).toHaveBeenCalledTimes(3);
    } finally {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.resetModules();
    }
  });

  it("retries only the selected survey's metrics, including legacy default entries", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://survey.example");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.resetModules();
    try {
      const api = await import("./metrics.ts");
      const requests = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
      vi.stubGlobal("fetch", requests);
      const { ctx, state } = fixture();
      const done = submit(ctx, state);
      const record = buildRecord(ctx, done, "test");
      const sample = completionMetrics(done, record);
      const prefix = "kartya-kerdoiv:metrics:https://survey.example:";
      localStorage.setItem(prefix + "legacy-test", JSON.stringify({ ...sample, token: "legacy-test", use_again: 4 }));
      api.queueCompletion(done, record);
      api.queueCompletion(done, record, "default");
      expect(localStorage.length).toBe(3);

      // Reimport to retry the stored entries after a page reload.
      vi.resetModules();
      const reloaded = await import("./metrics.ts");
      requests.mockClear().mockImplementation(async () => new Response(null, { status: 204 }));
      reloaded.retryCompletions();
      await vi.waitFor(() => expect(localStorage.length).toBe(1));
      expect(requests.mock.calls.map(([url]) => url)).toEqual([
        "https://survey.example/rest/v1/rpc/submit_survey_completion",
        "https://survey.example/rest/v1/rpc/submit_survey_completion",
      ]);
      expect(requests.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).token)).toEqual([
        "legacy-test", record.sessionId,
      ]);
      expect(JSON.parse(String(requests.mock.calls[0][1]?.body))).toHaveProperty("use_again", 4);
      expect(JSON.parse(String(requests.mock.calls[1][1]?.body))).not.toHaveProperty("use_again");
      expect(localStorage.getItem(prefix + "default:" + record.sessionId)).not.toBeNull();

      reloaded.retryCompletions("default");
      await vi.waitFor(() => expect(localStorage.length).toBe(0));
      expect(requests).toHaveBeenCalledTimes(3);
      const [url, init] = requests.mock.calls[2];
      expect(url).toBe("https://survey.example/rest/v1/rpc/submit_survey_metrics");
      expect(JSON.parse(String(init?.body))).toMatchObject({ slug: "default", token: record.sessionId });
    } finally {
      vi.stubEnv("VITE_SUPABASE_URL", "");
      vi.resetModules();
    }
  });
});
