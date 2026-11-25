import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadContent } from "./content/load.ts";
import { acceptingResponses, DEFAULT_SURVEY, defaultSettings, type SurveySettings } from "./content/survey.ts";
import { makeCtx } from "./engine/path.ts";
import type { Bank, Devices } from "./engine/schema.ts";
import { createSession, currentId, localDate, validateSnapshot, type SessionState } from "./engine/session.ts";
import type { ContentResult } from "./engine/validate.ts";
import { createSessionStore, type SessionStore } from "./state/store.ts";
import { queueCompletion, retryCompletions } from "./storage/metrics.ts";
import { responseOutbox, DELIVERED_EVENT } from "./storage/responses.ts";
import { LocalSink, type ResponseSink } from "./storage/sinks.ts";
import { supabaseConfigured } from "./storage/supabase.ts";
import { Admin } from "./ui/Admin.tsx";
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
  content?: ContentResult & { slug?: string; settings?: SurveySettings };
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
  // The footer links show before and after the questionnaire, not while the respondent is answering.
  const [filling, setFilling] = useState(false);
  if (!parsed.ok) {
    return <main className="mx-auto max-w-[560px] px-4 pt-3"><ErrorScreen issues={parsed.issues} /></main>;
  }
  const slug = parsed.slug ?? DEFAULT_SURVEY;
  const settings = parsed.settings ?? defaultSettings(slug);
  const { bank, devices } = parsed;
  const isAdmin = /^\/admin\/?$/.test(window.location.pathname);
  return (
    <>
      {isAdmin ? <Admin slug={slug} bank={bank} devices={devices} settings={settings} /> : (
        <>
          <Banner text={settings.display.banner} />
          <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-3">
            <FillingContext.Provider value={setFilling}>
              <Questionnaire bank={bank} devices={devices} slug={slug} settings={settings} sink={sink} debug={debug ?? defaultDebug()} />
            </FillingContext.Provider>
          </main>
        </>
      )}
      {!(filling && !isAdmin) && <footer className="mx-auto max-w-[560px] px-4 pb-8 text-center text-sm">
        {settings.display.privacyNotice && <>
          <a className="text-primary underline" href={settings.display.privacyNotice} target="_blank" rel="noopener">Adatkezelési tájékoztató</a>
          {" · "}
        </>}
        <a className="text-primary underline" href={settings.display.sourceLink}>Forráskód (AGPL-3.0)</a>
      </footer>}
    </>
  );
}

function Questionnaire({ bank, devices, slug, settings, sink, debug }: {
  bank: Bank; devices: Devices; slug: string; settings: SurveySettings; sink?: ResponseSink; debug: DebugFlags;
}) {
  const { storage } = settings;
  const remote = useMemo(() => responseOutbox(slug, storage), [slug, storage]);
  const metrics = storage.paradata && storage.metrics;
  useEffect(() => {
    const retry = () => {
      remote.retry();
      if (metrics && acceptingResponses(storage)) retryCompletions(slug);
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [metrics, remote, slug, storage]);
  return <SurveySession bank={bank} devices={devices} slug={slug} settings={settings} sink={sink} debug={debug}
    onComplete={(state, record) => {
      if (metrics && acceptingResponses(storage)) queueCompletion(state, record, slug);
      remote.submit(record);
    }}
  />;
}

function SurveySession({ bank, devices, slug, settings, sink: sinkProp, debug, onComplete }: {
  bank: Bank; devices: Devices; slug: string; settings: SurveySettings; sink?: ResponseSink; debug: DebugFlags;
  onComplete: NonNullable<Parameters<typeof createSessionStore>[0]["onComplete"]>;
}) {
  const sink = useMemo(() => sinkProp ?? new LocalSink(bank.version, slug), [sinkProp, bank.version, slug]);

  const makeStore = (sessionId: string, state?: SessionState): SessionStore => {
    const ctx = makeCtx(bank, devices, sessionId, settings, slug);
    const initial = state ?? createSession(ctx, { sessionId, startedDate: localDate() });
    return createSessionStore({ ctx, sink, appVersion: __APP_VERSION__, initial, onComplete });
  };

  // An unfinished or completed session saved on this device that still fits the current bank.
  const [saved] = useState<SessionState | null>(() => {
    try {
      const raw = sink.load() as { sessionId?: unknown } | null;
      if (!raw || typeof raw.sessionId !== "string") return null;
      const state = validateSnapshot(makeCtx(bank, devices, raw.sessionId, settings, slug), raw);
      return state && (state.completed || state.order.length > 1) ? state : null;
    } catch {
      return null;
    }
  });
  const [store, setStore] = useState<SessionStore | null>(() => {
    if (!saved) return makeStore(newSessionId());
    return saved.completed ? makeStore(saved.sessionId, saved) : null;
  });

  // Once the server has accepted this completion, nothing of it stays on the device.
  const [forgotten, setForgotten] = useState<string | null>(null);
  useEffect(() => {
    const onDelivered = (e: Event) => {
      const receipt = (e as CustomEvent<string>).detail;
      if (!sink.forget || receipt !== store?.getState().state.sessionId) return;
      sink.forget(receipt);
      setForgotten(receipt);
    };
    window.addEventListener(DELIVERED_EVENT, onDelivered);
    return () => window.removeEventListener(DELIVERED_EVENT, onDelivered);
  }, [sink, store]);

  const restart = () => {
    sink.clear();
    setStore(makeStore(newSessionId()));
  };

  if (!store?.getState().state.completed) {
    if (!acceptingResponses(settings.storage)) {
      return <p role="status" className="card-panel">A kérdőív lezárult.</p>;
    }
    if (settings.storage.mode === "supabase" && !supabaseConfigured) {
      return <p role="status" className="card-panel">A válaszok fogadása jelenleg nem elérhető.</p>;
    }
  }
  if (!store) {
    return <ResumePrompt onResume={() => setStore(makeStore(saved!.sessionId, saved!))} onRestart={restart} />;
  }
  return (
    <StoreContext.Provider value={store}>
      <SessionScreen debug={debug} onRestart={restart} forgotten={forgotten !== null && forgotten === store.getState().state.sessionId} />
    </StoreContext.Provider>
  );
}

const FillingContext = createContext<(filling: boolean) => void>(() => {});

function SessionScreen({ debug, onRestart, forgotten }: { debug: DebugFlags; onRestart: () => void; forgotten: boolean }) {
  const store = useSessionStore();
  const registry = useRef<KeyHandlers | null>(null);
  const completed = useSel((s) => s.state.completed);
  const cur = useSel((s) => currentId(s.state));
  const setFilling = useContext(FillingContext);
  const first = store.getState().ctx.deck.order[0];
  useEffect(() => {
    setFilling(!completed && cur !== undefined && cur !== first);
    return () => setFilling(false);
  }, [setFilling, completed, cur, first]);
  useBrowserHistory(store);
  useEffect(() => {
    const visibility = () => store.getState().setTimingVisible(!document.hidden);
    const hide = () => store.getState().setTimingVisible(false);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
    };
  }, [store]);
  const card = cur ? store.getState().ctx.byId.get(cur) : undefined;

  if (completed) {
    return (
      <>
        <ThankYou download={debug.download} onRestart={onRestart} forgotten={forgotten} />
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
