import { useEffect, useState } from "react";
import { countCards } from "../content/counts.ts";
import { acceptingResponses, type SurveySettings } from "../content/survey.ts";
import type { Bank, Devices } from "../engine/schema.ts";
import { responseCount } from "../storage/responses.ts";
import { supabaseConfigured } from "../storage/supabase.ts";

function Settings({ title, values }: { title: string; values: object }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <dl className="divide-y divide-soft">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="grid grid-cols-[1fr_1fr] gap-2 py-2 text-sm">
            <dt className="min-w-0 break-words font-mono text-muted">{key}</dt>
            <dd className="min-w-0 break-words font-medium">
              {key === "sourceLink" ? <a className="text-primary underline" href={String(value)}>{String(value)}</a>
                : value === null ? "—" : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Admin({ slug, bank, devices, settings }: {
  slug: string; bank: Bank; devices: Devices; settings: SurveySettings;
}) {
  const remote = settings.storage.mode === "supabase";
  const [count, setCount] = useState<number | string | null>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!remote || !supabaseConfigured) return;
    let ignore = false;
    responseCount(slug).then(
      (value) => { if (!ignore) setCount(value); },
      () => { if (!ignore) setFailed(true); },
    );
    return () => { ignore = true; };
  }, [remote, slug]);

  const rows = countCards(bank, devices);
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-12 pt-8 sm:pt-12">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-3xl font-bold">Kérdőív-adminisztráció</h1>
        <a className="text-sm font-semibold text-primary underline" href="/">Vissza a kérdőívhez</a>
      </header>
      <section aria-label="Kérdőív adatai" className="mb-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Kérdőív</dt><dd className="break-all font-mono font-semibold">{slug}</dd></div>
          <div><dt className="text-muted">Kérdésbank verziója</dt><dd className="font-semibold">{bank.version}</dd></div>
          <div><dt className="text-muted">Válaszfogadás</dt><dd className="font-semibold">{acceptingResponses(settings.storage) ? "Nyitva" : "Lezárva"}</dd></div>
          <div>
            <dt className="text-muted">Szerverre érkezett válaszok</dt>
            <dd aria-live="polite" className="font-semibold">
              {!remote ? "Eszközön tárolva" : !supabaseConfigured ? "A Supabase nincs beállítva"
                : failed ? "A lekérdezés sikertelen" : count === null ? "A kérdőív nincs regisztrálva"
                : count === undefined ? "Betöltés…" : count}
            </dd>
          </div>
        </dl>
      </section>
      <section className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Kártyaszám kitöltési útvonalanként</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th scope="col">Fokozat</th><th scope="col">Kihagyással</th><th scope="col">Minden eszközzel</th><th scope="col">Eszköz nélkül</th></tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {rows.map(({ label, effortLevel, skipped, allDevices, noDevices }) => (
                <tr key={effortLevel ?? "all"}>
                  <th scope="row" className="py-2 font-medium">{label}</th>
                  <td>{skipped}</td><td>{allDevices}</td><td>{noDevices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Settings title="Megjelenítés" values={settings.display} />
        <Settings title="Tárolás" values={settings.storage} />
      </div>
    </main>
  );
}
