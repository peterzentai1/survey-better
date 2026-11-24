// Page chrome and screens around the cards: banner, top bar, toast, debug panel, error / resume / thank-you screens.
import { IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { buildRecord, currentId } from "../engine/session.ts";
import { metricsEnabled } from "../storage/metrics.ts";
import type { Issue } from "../engine/validate.ts";
import { KeyHint, splitScenario } from "./CardShell.tsx";
import { cardText, useSel, useSessionStore } from "./session.tsx";

export function Banner() {
  return (
    <div className="sticky top-0 z-50 bg-[var(--banner-bg)] px-3 py-1 text-center text-sm font-medium text-[var(--banner-fg)]" role="note">
      {metricsEnabled ? "Próbakérdőív · Az időmérés és a válaszfelület értékelésének megosztása önkéntes." :
        "PROTOTÍPUS – nem gyűjt adatot; a válaszok csak ezen az eszközön maradnak."}
    </div>
  );
}

export function TopBar() {
  const store = useSessionStore();
  const { ctx } = store.getState();
  const canGoBack = useSel((s) => s.state.history.length > 1);
  const cur = useSel((s) => currentId(s.state));
  const path = useSel((s) => s.analysis.path);
  const curBlock = cur ? ctx.byId.get(cur)?.block : undefined;
  const blocksOnPath = new Set(path.map((id) => ctx.byId.get(id)?.block));
  const blocks = ctx.bank.blocks.filter((b) => blocksOnPath.has(b.id));
  const idx = cur ? path.indexOf(cur) : -1;
  const pct = path.length > 0 && idx >= 0 ? Math.round(((idx + 1) / path.length) * 100) : 0;
  return (
    <header className="mb-3">
      <div className="flex min-h-12 items-center">
        {canGoBack ? (
          <button type="button" className="btn btn-quiet !no-underline" onClick={() => store.getState().back()}>
            <IconArrowLeft size={20} aria-hidden="true" />
            Vissza
            <KeyHint>Backspace</KeyHint>
          </button>
        ) : (
          <span className="min-h-12" />
        )}
      </div>
      <nav aria-label="Haladás">
        {/* Phones: one compact line instead of the full block list (which would wrap to several lines). */}
        <p className="text-sm sm:hidden" data-testid="progress-compact">
          <span className="font-bold text-primary">{blocks.find((b) => b.id === curBlock)?.title}</span>
          <span className="text-muted">
            {" · "}
            {Math.max(1, blocks.findIndex((b) => b.id === curBlock) + 1)}/{blocks.length}
          </span>
        </p>
        <ol className="hidden flex-wrap gap-x-3 gap-y-0.5 text-sm sm:flex">
          {blocks.map((b) => (
            <li key={b.id} aria-current={b.id === curBlock ? "step" : undefined} className={b.id === curBlock ? "font-bold text-primary" : "text-muted"}>
              {b.title}
            </li>
          ))}
        </ol>
        <div
          role="progressbar"
          aria-label="Kitöltöttség"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]"
        >
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </nav>
    </header>
  );
}

/** Screen-reader announcement of the current card (polite live region). */
export function Announcer() {
  const store = useSessionStore();
  const { ctx } = store.getState();
  const cur = useSel((s) => currentId(s.state));
  const total = useSel((s) => s.analysis.path.length);
  const idx = useSel((s) => (cur ? s.analysis.path.indexOf(cur) : -1));
  const variant = useSel((s) => (cur ? s.state.items[cur]?.variant : undefined));
  const card = cur ? ctx.byId.get(cur) : undefined;
  const block = ctx.bank.blocks.find((b) => b.id === card?.block)?.title;
  const heading = card ? ("title" in card ? card.title : splitScenario(cardText(card, variant)).question) : "";
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setMsg(`${block ?? ""}, ${idx + 1}. kártya ${total} közül: ${heading.replace(/\s+/g, " ")}`);
  }, [cur, block, idx, total, heading]);
  return (
    <div aria-live="polite" className="sr-only" data-testid="announcer">
      {msg}
    </div>
  );
}

export function Toast() {
  const store = useSessionStore();
  const toast = useSel((s) => s.toast);
  const cur = useSel((s) => currentId(s.state));
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const t = window.setTimeout(() => store.getState().dismissToast(), 3000);
    return () => window.clearTimeout(t);
  }, [id, store]);
  if (!toast || toast.expectId !== cur) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-[520px] items-center justify-between gap-3 rounded-xl bg-[#1c1b19] px-4 py-2 text-white shadow-lg">
      <span>{toast.message}</span>
      <button type="button" className="btn !min-h-12 !border-white !bg-white !text-[#1c1b19]" onClick={() => store.getState().undo()}>
        Visszavonás
      </button>
    </div>
  );
}

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadButton() {
  const store = useSessionStore();
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        const { ctx, state, appVersion } = store.getState();
        downloadJson(`valaszok-${state.sessionId.slice(0, 8)}.response.json`, buildRecord(ctx, state, appVersion));
      }}
    >
      Válaszok letöltése (JSON)
    </button>
  );
}

export function DebugPanel({ download }: { download: boolean }) {
  const store = useSessionStore();
  const state = useSel((s) => s.state);
  const analysis = useSel((s) => s.analysis);
  const cur = currentId(state);
  const block = cur ? store.getState().ctx.byId.get(cur)?.block : undefined;
  const answers = Object.fromEntries(
    Object.entries(state.items)
      .filter(([, it]) => it.status === "answered" || it.status === "skipped")
      .map(([id, it]) => [id, it.status === "skipped" ? "(kihagyva)" : it.value]),
  );
  return (
    <details className="fixed bottom-2 left-2 z-30 max-h-[60vh] max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border border-line bg-surface p-2 text-xs shadow">
      <summary className="cursor-pointer font-semibold">Hibakeresés</summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt>kártya</dt>
        <dd data-testid="debug-card">{cur}</dd>
        <dt>blokk</dt>
        <dd>{block}</dd>
        <dt>keretek</dt>
        <dd>{JSON.stringify(analysis.quotas)}</dd>
        <dt>eszközök</dt>
        <dd>{[...analysis.owned].join(", ")}</dd>
        <dt>válaszok</dt>
        <dd>
          <pre className="whitespace-pre-wrap">{JSON.stringify(answers)}</pre>
        </dd>
      </dl>
      {download && <DownloadButton />}
    </details>
  );
}

export function ErrorScreen({ issues }: { issues: Issue[] }) {
  return (
    <div role="alert" className="card-panel">
      <h1 className="text-xl font-bold text-danger">A kérdőív tartalma hibás</h1>
      <p className="mt-2">A tartalmi fájlok érvényesítése {issues.length} hibát talált. A kérdőív nem indítható, amíg ezek ki nincsenek javítva.</p>
      <ol className="mt-3 flex flex-col gap-3">
        {issues.map((i, k) => (
          <li key={k} className="rounded-lg border border-soft p-2 text-sm">
            <div className="font-mono text-xs text-muted">
              {i.file} · {i.path}
            </div>
            <div>{i.message}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ResumePrompt({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <div className="card-panel" role="dialog" aria-labelledby="resume-h">
      <h1 id="resume-h" className="text-xl font-semibold">
        Folytatja a korábbi kitöltést?
      </h1>
      <p className="mt-2 text-muted">Ezen az eszközön megtaláltuk egy korábbi, félbehagyott kitöltés adatait.</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className="btn btn-primary" onClick={onResume}>
          Folytatom
        </button>
        <button type="button" className="btn" onClick={onRestart}>
          Újrakezdem
        </button>
      </div>
    </div>
  );
}

export function ThankYou({ download, onRestart }: { download: boolean; onRestart: () => void }) {
  return (
    <div className="card-panel" data-testid="thank-you">
      <h1 className="text-xl font-bold" tabIndex={-1} ref={(el) => el?.focus()}>
        Köszönjük a kitöltést!
      </h1>
      <p className="mt-2">A kitöltés befejeződött. Köszönjük, hogy megosztotta a véleményét.</p>
      <div className="mt-4 flex flex-col gap-2">
        {download && <DownloadButton />}
        <button type="button" className="btn" onClick={onRestart}>
          Új kitöltés kezdése
        </button>
      </div>
    </div>
  );
}
