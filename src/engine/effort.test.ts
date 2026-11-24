import { describe, expect, it } from "vitest";
import bankText from "../../content/kerdesbank.hu.yaml?raw";
import devicesText from "../../content/eszkozok.yaml?raw";
import { makeCtx } from "./path.ts";
import { acceptConsent, advance, answer, buildRecord, createSession, currentId, extendEffort, goBack, setEffortLevel, validateSnapshot } from "./session.ts";
import { simulatePath } from "./simulate.ts";
import { parseContent } from "./validate.ts";

const content = parseContent(bankText, devicesText);
if (!content.ok) throw new Error(JSON.stringify(content.issues));
const { bank, devices } = content;

describe("effort levels", () => {
  it("filters the tagged cards and keeps the entire randomized core at every level", () => {
    const answers = { J04: "nem", F01: "nem", A03: "berelt_berbeado" };
    const short = simulatePath(bank, devices, { effortLevel: "rovid", answers });
    const medium = simulatePath(bank, devices, { effortLevel: "kozepes", answers });
    const long = simulatePath(bank, devices, { effortLevel: "alapos", answers });
    const level2 = ["A02", "A04", "A05", "T02", "T03", "T04", "I08", "I09", "J01", "J03", "J05", "F02", "F04", "F05", "B03"];
    expect(short.path).toEqual(expect.arrayContaining(["N01", "N02", "N03", "A01", "A03", "A06", "T01", "J02", "J04", "B01", "D04", "Z01"]));
    expect(short.path.filter((id) => [...level2, "B04"].includes(id))).toEqual([]);
    expect(medium.path).toEqual(expect.arrayContaining(level2));
    expect(medium.path).not.toContain("B04");
    expect(long.path).toEqual(expect.arrayContaining([...level2, "B04"]));
    const core = (path: string[]) => path.filter((id) => /^I0[1-7]$/.test(id));
    expect(core(short.path)).toHaveLength(7);
    expect(core(short.path)).toEqual(core(medium.path));
    expect(core(short.path)).toEqual(core(long.path));
    expect(short.state.items.J04).toMatchObject({ status: "answered", value: "nem", variant: 0 });
    expect(medium.path.slice(medium.path.indexOf("J02"), medium.path.indexOf("J02") + 3)).toEqual(["J02", "J04", "J05"]);
    expect(simulatePath(bank, devices, { answers: { J04: "igen" } }).path).not.toContain("J05");
  });

  it.each([
    { effortLevel: "rovid", cap: 3, caps: { hoszivattyu: 1, napelem: 1, haztartasi_gepek: 0 } },
    { effortLevel: "kozepes", cap: 6, caps: { hoszivattyu: 2, napelem: 1, haztartasi_gepek: 1 } },
    { effortLevel: "alapos", cap: 9, caps: { hoszivattyu: 3, napelem: 2, haztartasi_gepek: 1 } },
  ] as const)("applies the tier caps and a global ceiling of $cap at $effortLevel", ({ effortLevel, cap, caps }) => {
    const some = simulatePath(bank, devices, { effortLevel, owned: ["hoszivattyu", "napelem", "mosogep"] });
    expect(some.quotas).toEqual(caps);
    const all = simulatePath(bank, devices, { effortLevel, owned: devices.appliances.map((a) => a.id) });
    expect(Object.values(all.quotas).reduce((sum, quota) => sum + quota, 0)).toBe(cap);
    expect(all.path.filter((id) => id.startsWith("M_"))).toHaveLength(cap);
  });

  it("exports the level after participation consent and the deviation only with paradata consent", () => {
    const ctx = makeCtx(bank, devices, "effort");
    const initial = createSession(ctx, { sessionId: "effort", startedDate: "2000-01-01" });
    expect(initial.effortLevel).toBe("alapos");
    const selected = setEffortLevel(ctx, initial, "rovid");
    expect(selected.effortLevel).toBe("rovid");
    const beforeConsent = advance(ctx, selected);
    const denied = acceptConsent(ctx, beforeConsent, "N02", { participation: false, paradata: true });
    expect(buildRecord(ctx, denied, "test")).not.toHaveProperty("effortLevel");
    expect(buildRecord(ctx, denied, "test")).not.toHaveProperty("effortChangedFromDefault");

    const participationOnly = acceptConsent(ctx, beforeConsent, "N02", { participation: true, paradata: false });
    expect(buildRecord(ctx, participationOnly, "test")).toHaveProperty("effortLevel", "rovid");
    expect(buildRecord(ctx, participationOnly, "test")).not.toHaveProperty("effortChangedFromDefault");
    expect(validateSnapshot(ctx, JSON.parse(JSON.stringify(participationOnly)))?.effortLevel).toBe("rovid");
    expect(validateSnapshot(ctx, { ...participationOnly, effortLevel: "invalid" })).toBeNull();
    expect(validateSnapshot(ctx, { ...participationOnly, effortLevel: undefined })?.effortLevel).toBe("alapos");

    const accepted = acceptConsent(ctx, beforeConsent, "N02", { participation: true, paradata: true });
    expect(buildRecord(ctx, accepted, "test")).toHaveProperty("effortChangedFromDefault", true);
    const unchanged = acceptConsent(ctx, advance(ctx, initial), "N02", { participation: true, paradata: true });
    expect(buildRecord(ctx, unchanged, "test")).toHaveProperty("effortChangedFromDefault", false);
    const revoked = acceptConsent(ctx, accepted, "N02", { participation: true, paradata: false });
    expect(revoked).not.toHaveProperty("effortChangedFromDefault");
    expect(buildRecord(ctx, revoked, "test")).not.toHaveProperty("effortChangedFromDefault");
  });

  it("continues with the earliest unanswered addition after leaving a partial extension", () => {
    const ctx = makeCtx(bank, devices, "simulate");
    const { state } = simulatePath(bank, devices, { effortLevel: "rovid" });
    const first = extendEffort(ctx, state);
    expect(currentId(first)).toBe("A02");
    const second = advance(ctx, answer(ctx, first, "A02", "csaladi_haz"));
    expect(currentId(second)).toBe("A04");
    const cancelled = goBack(ctx, goBack(ctx, second));
    expect(currentId(cancelled)).toBe("Z01");
    expect(cancelled.items.A02).toMatchObject({ status: "answered", value: "csaladi_haz", inactive: true });
    const resumed = extendEffort(ctx, cancelled);
    expect(currentId(resumed)).toBe("A04");
    expect(resumed.items.A02.inactive).toBeUndefined();
    expect(validateSnapshot(ctx, JSON.parse(JSON.stringify(resumed)))).toEqual(resumed);
  });
});
