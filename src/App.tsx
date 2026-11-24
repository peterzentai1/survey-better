import { useMemo, useRef, useState } from "react";
import { loadContent } from "./content/load.ts";
import { makeCtx } from "./engine/path.ts";
import type { Bank, Devices } from "./engine/schema.ts";
import { createSession, currentId, localDate, validateSnapshot, type SessionState } from "./engine/session.ts";
import type { ContentResult } from "./engine/validate.ts";
import { createSessionStore, type SessionStore } from "./state/store.ts";
import { LocalSink, type ResponseSink } from "./storage/sinks.ts";
import { CardView } from "./ui/CardView.tsx";
import { Announcer, Banner, DebugPanel, ErrorScreen, ResumePrompt, ThankYou, Toast, TopBar } from "./ui/Chrome.tsx";
import { GlobalKeys } from "./ui/GlobalKeys.tsx";
import { KeyRegistry, StoreContext, useSel, useSessionStore, type KeyHandlers } from "./ui/session.tsx";
import { useBrowserHistory } from "./ui/useBrowserHistory.ts";

export interface DebugFlags {
  /** Show the collapsible debug panel. */
  panel: boolean;
  /** Show the "Válaszok letöltése (JSON)" button. */
  download: boolean;
}

export interface AppProps {
  /** Parsed content; defaults to the files in /content. */
  content?: ContentResult;
  sink?: ResponseSink;
  debug?: DebugFlags;
}

function defaultDebug(): DebugFlags {
  let q = false;
  try {
    q = new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    /* ignore */
  }
  return { panel: q, download: q || import.meta.env.DEV };
}

function newSessionId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join("-");
}

export function App({ content, sink, debug }: AppProps) {
  const [parsed] = useState(() => content ?? loadContent());
  return (
    <>
      <Banner />
      <main className="mx-auto w-full max-w-[560px] px-4 pb-28 pt-3">
        {parsed.ok ? (
          <Questionnaire bank={parsed.bank} devices={parsed.devices} sink={sink} debug={debug ?? defaultDebug()} />
        ) : (
          <ErrorScreen issues={parsed.issues} />
        )}
      </main>
    </>
  );
}

function Questionnaire({ bank, devices, sink: sinkProp, debug }: { bank: Bank; devices: Devices; sink?: ResponseSink; debug: DebugFlags }) {
  const sink = useMemo(() => sinkProp ?? new LocalSink(bank.version), [sinkProp, bank.version]);

  const makeStore = (sessionId: string, state?: SessionState): SessionStore => {
    const ctx = makeCtx(bank, devices, sessionId);
    const initial = state ?? createSession(ctx, { sessionId, startedDate: localDate() });
    return createSessionStore({ ctx, sink, appVersion: __APP_VERSION__, initial });
  };

  // An unfinished session saved on this device that still fits the current bank (else it is ignored).
  const [saved] = useState<SessionState | null>(() => {
    try {
      const raw = sink.load() as { sessionId?: unknown } | null;
      if (!raw || typeof raw.sessionId !== "string") return null;
      const state = validateSnapshot(makeCtx(bank, devices, raw.sessionId), raw);
      return state && state.order.length > 1 ? state : null;
    } catch {
      return null;
    }
  });
  const [store, setStore] = useState<SessionStore | null>(() => (saved ? null : makeStore(newSessionId())));

  const restart = () => {
    sink.clear();
    setStore(makeStore(newSessionId()));
  };

  if (!store) {
    return <ResumePrompt onResume={() => setStore(makeStore(saved!.sessionId, saved!))} onRestart={restart} />;
  }
  return (
    <StoreContext.Provider value={store}>
      <SessionScreen debug={debug} onRestart={restart} />
    </StoreContext.Provider>
  );
}

function SessionScreen({ debug, onRestart }: { debug: DebugFlags; onRestart: () => void }) {
  const store = useSessionStore();
  const registry = useRef<KeyHandlers | null>(null);
  const completed = useSel((s) => s.state.completed);
  const cur = useSel((s) => currentId(s.state));
  useBrowserHistory(store);
  const card = cur ? store.getState().ctx.byId.get(cur) : undefined;

  if (completed) {
    return (
      <>
        <ThankYou download={debug.download} onRestart={onRestart} />
        {debug.panel && <DebugPanel download={debug.download} />}
      </>
    );
  }
  if (!card) return null;
  return (
    <KeyRegistry.Provider value={registry}>
      <GlobalKeys />
      <TopBar />
      <Announcer />
      <CardView key={card.id} card={card} />
      <Toast />
      {debug.panel && <DebugPanel download={debug.download} />}
    </KeyRegistry.Provider>
  );
}
