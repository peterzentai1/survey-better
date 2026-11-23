// Shared helpers for component tests.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadMini } from "./engine/__fixtures__/mini.ts";
import type { SessionState } from "./engine/session.ts";
import { parseContent, type ContentResult } from "./engine/validate.ts";
import { App, type DebugFlags } from "./App.tsx";
import type { ResponseSink } from "./storage/sinks.ts";
import type { ResponseRecord } from "./engine/types.ts";
import { MINI_BANK_YAML, MINI_DEVICES_YAML } from "./engine/__fixtures__/mini.ts";

/** In-memory sink that remembers the last saved state and record. */
export class MemSink implements ResponseSink {
  state: SessionState | null = null;
  record: ResponseRecord | null = null;
  private preloaded: unknown;
  constructor(preloaded: unknown = null) {
    this.preloaded = preloaded;
  }
  load() {
    return this.preloaded;
  }
  save(state: SessionState, record: ResponseRecord) {
    this.state = state;
    this.record = record;
  }
  clear() {
    this.preloaded = null;
  }
}

export function miniContent(): ContentResult {
  loadMini(); // fail early with a readable message if the fixture is broken
  return parseContent(MINI_BANK_YAML, MINI_DEVICES_YAML);
}

export function renderApp(opts: { sink?: ResponseSink; debug?: DebugFlags; content?: ContentResult; advanceTimers?: (ms: number) => void | Promise<void> } = {}) {
  const sink = opts.sink ?? new MemSink();
  const user = userEvent.setup(opts.advanceTimers ? { advanceTimers: opts.advanceTimers } : {});
  const utils = render(<App content={opts.content ?? miniContent()} sink={sink} debug={opts.debug ?? { panel: false, download: false }} />);
  return { user, sink: sink as MemSink, ...utils };
}

export async function expectCard(heading: string | RegExp) {
  return screen.findByRole("heading", { level: 2, name: heading }, { timeout: 2000 });
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Click through the info and consent cards. */
export async function clickIntro(user: ReturnType<typeof userEvent.setup>, paradata = false) {
  await expectCard("Üdvözöljük");
  await user.click(screen.getByRole("button", { name: /Kezdjük/ }));
  await expectCard("Tájékoztatás");
  await user.click(screen.getByRole("checkbox", { name: /Részt veszek/ }));
  if (paradata) await user.click(screen.getByRole("checkbox", { name: /Technikai adatok/ }));
  await user.click(screen.getByRole("button", { name: /^Tovább/ }));
}

/** Answer Q_TOWN and Q_HEAT, own app_b2, and stop on the yes/no card. */
export async function clickToYesNo(user: ReturnType<typeof userEvent.setup>, paradata = false) {
  await clickIntro(user, paradata);
  await expectCard("Település?");
  await user.click(screen.getByRole("button", { name: "X város" }));
  await expectCard("Fűtés?");
  await user.click(screen.getByRole("button", { name: "Gáz" }));
  await expectCard("Mi van otthon?");
  await user.click(screen.getByRole("checkbox", { name: /B2/ }));
  await user.click(screen.getByRole("button", { name: /^Tovább/ }));
  await expectCard("Használja fűtésre?");
}

export { screen, waitFor };
