# Card-based questionnaire (kártya-kérdőív), v0.3

An open-source, card-based web questionnaire about household electricity flexibility, built for a Hungarian BSc thesis.
One card is shown at a time; the questions adapt to the respondent's household (appliances, answers so far).
It runs on phones, tablets and laptops (touch, mouse, trackpad, keyboard). The respondent-facing UI is in Hungarian.

The default survey offers three lengths and initially selects **Közepes**. It saves responses on the respondent’s device. Each survey has build-time display and storage settings, shown alongside simulated card counts at `/admin`.

## Run it

Requires Node.js >= 22.18 (the `validate-content` script runs TypeScript directly) and npm.

```sh
npm install
npm run dev                 # http://localhost:5173
npm run dev -- --host       # also reachable from phones/tablets on the same local network
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | vitest: engine unit tests and component tests (jsdom) |
| `npm run lint` | oxlint |
| `npm run build` | `tsc` type check + production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run validate-content` | validate the bank and device definitions, print the simulated per-level card counts, then show the detailed no-device and all-device paths |

Add `?debug=1` to the URL for a small debug panel (current card, block, module quotas, owned appliances, answers) and a
"Válaszok letöltése (JSON)" button. The download button is also shown in dev mode (`npm run dev`).

## Content

| File | Role |
| --- | --- |
| `content/surveys/<slug>/survey.yaml` | bank and device paths, display settings and storage settings |
| `content/kerdesbank.hu.yaml` | the question bank (cards, blocks, conditions) |
| `content/eszkozok.yaml` | appliances, modules, tier caps and the global module cap |
| `content/sample.yaml` | **the card schema reference**: one example of every card type and the condition language |

Vite validates and bundles the survey selected by `VITE_SURVEY`, which defaults to `haztartasi_rugalmassag`. The manifest’s `bank` and `devices` paths are relative to its folder and may point anywhere under `content/`. The validator checks the schema, references and consent gate for every manifest. Use the hosting provider’s SPA fallback to serve `/admin` on a direct visit.
If the engine needs a schema change, it is written to `SCHEMA_CHANGES.md` instead of changing the schema silently.

Code layout: `src/engine/` is pure TypeScript with no React (conditions, deck order, module quotas, path, session
transitions, simulation); `src/state/` the zustand store; `src/ui/` the React cards; `src/storage/` the response sinks.
`simulatePath(bank, devices, strategy)` in `src/engine/simulate.ts` returns the card ids a scripted respondent would see.

## Input model

Every card type can be completed with **buttons alone** and with the **keyboard alone**; gestures and shortcuts only
accelerate (WCAG 2.2 AA: 2.5.1 pointer gestures, 2.5.7 dragging, 2.5.8 target size, 2.1.1 keyboard, 2.4.7 focus visible).

- Yes/no: two buttons. On touch or pen only, dragging the card right = yes, left = no (past about 30% of the width or a
  quick flick; otherwise it snaps back); an undo toast follows for 3 seconds. Mouse drags never answer.
- Six-point scale: six segment buttons. Tap/click selects; pointer scrubbing (press, slide, release) works with any
  pointer; digits `1`-`6` select; arrow keys move without advancing, `Enter` confirms.
- Timeline: 24 hour cells; tap toggles, dragging paints, arrow keys + `Space` on the keyboard.
- Global keys (ignored while typing): `I`/`→` yes, `N`/`←` no, `1`-`6` scale, `K` or `0` skip, `Enter` continue,
  `Backspace` previous card. Key hints show only on hover + fine-pointer devices.
- The browser Back button (and a trackpad two-finger back gesture) steps back one card instead of leaving the page.
- Wheel and scroll events never answer anything. Nothing needs press-and-hold.

## Temperature experiment and completion times

`display.scaleInput: ab_test` is enabled for the default survey. I10 asks how it feels to lower the heating by one degree for two evening hours. Each new session has an equal chance of receiving six tap targets or a drag surface. The assignment is derived from the random session identifier and is stable on Back and resume. Both arms have the same six response labels, skip action and keyboard support. The drag surface also accepts taps. I11 measures willingness to lower the temperature using the same six buttons for everyone. The I10 experiment uses behavioural outcomes such as answering or skipping, the first input method and the time to first answer.

## Survey settings

| Setting | Default | Effect |
| --- | --- | --- |
| `display.effortSelector` | `true` | Shows the length selector and the option to extend a shorter survey. |
| `display.defaultEffort` | `kozepes` | Starting length, including when the selector is hidden. |
| `display.showMedianTimes` | `true` | Shows timing estimates and replaces them with measured medians when available. |
| `display.banner` | `null` | Hides the banner unless text is provided. The default survey has a prototype banner. |
| `display.scaleInput` | `buttons` | `drag_reveal` uses a drag pad for every scale. `ab_test` randomizes I10 and uses buttons on the other scales. The default survey uses `ab_test`. |
| `display.sourceLink` | `https://github.com/peterzentai1/survey-better` | Link to the source code in the footer. Set this to your fork when deploying modified code. |
| `storage.mode` | `device` | `supabase` sends completed, consented responses to the database and keeps progress on the device for resume. |
| `storage.table` | `responses_<slug>` | Partition name, derived from the slug. Any explicit value must match it. |
| `storage.paradata` | `true` | Offers separate consent for technical measurements. Disable it to omit the prompt and the paradata. |
| `storage.metrics` | `false` | Sends opt-in completion metrics when paradata is enabled. These support median estimates and, with `ab_test`, the I10 analysis. |
| `storage.retentionUntil` | `null` | Last date for accepting responses, inclusive in UTC. Set a date for Supabase response storage. |
| `storage.acceptingResponses` | `true` | Set to `false` to close the questionnaire. Supabase also requires the survey to be open in its registry. |

The bundled N02 contains placeholders. The validator rejects Supabase response storage and measurement uploads until the consent card is complete.

### Supabase response storage

Review and apply the migrations in `supabase/migrations/` to the target project. To turn on remote collection, complete N02 and configure the survey manifest before building. Add the project URL and publishable key from `.env.example` to the build environment. Register the survey with the same slug, retention date and paradata policy as its manifest. The new registry entry starts closed. An owner can provision it in the SQL Editor using the service role for partition creation.

```sql
begin;
set local role service_role;
select survey_admin.create_survey('my_survey');
reset role;
update survey_admin.surveys
set accepting_responses = true, retention_until = date '2027-06-30', paradata = false
where slug = 'my_survey';
commit;
```

The write RPC checks the registry, requires completed responses with participation consent, and limits each JSON payload to 256 KiB. It saves the SHA-256 receipt in place of the browser session ID and ignores duplicate receipts within each survey. The browser retries pending writes on its next visit or when it comes online. The read-only `/admin` route uses a public RPC that returns only the selected survey’s response count. Raw rows are available through the service-role export RPC.

Turnstile is deferred for v0.3 because the bundled survey collects no server-side data and the issue calls for direct anonymous submission to the RPC. A Turnstile check on the page alone would leave that endpoint reachable. Before enabling collection for a public survey, arrange server-side abuse controls at the submission boundary. The size limit caps each accepted payload, and receipt deduplication prevents duplicate rows on retries.

Run `supabase/tests/per_survey_responses.sql` on a disposable database after applying the migrations to verify the roles and RPCs.

The retention date closes submissions. The researcher is responsible for deleting the survey’s rows and local exports according to the consent notice. Update the registry and rebuild with `acceptingResponses: false` to close a survey early.

### Researcher export

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local shell. Use a server-side service-role or secret key. Pause collection for a stable export across pages.

```sh
npm run export -- my_survey
```

The script writes a dated JSON file under the git-ignored `exports/` directory. Each row includes its hashed receipt, receipt time and response payload.

### Completion metrics

Consented timing and I10 measurements use the existing metrics table. A median appears after five measured completions for the same survey, bank version and effort level. Eligible times cover visible-page time from initial technical consent through submission, including revisits. Time between visits and time in background tabs are excluded. Later opt-in after initially declining contributes no total duration.

The project's SQL Editor can compare arms among completed, consenting responses.

```sql
select * from survey_private.temperature_ab
order by survey_slug, bank_version, effort, arm;
```

The view returns completion, answer and skip counts by assigned arm, plus actual tap and drag counts and `median_first_answer_ms` for the first I10 answer.

## License

Code: AGPL-3.0-only (see `LICENSE`). The question bank and appliance content in `content/` are under CC BY 4.0
(see `content/LICENSE`).

---

## Röviden magyarul

Ez egy nyílt forráskódú, kártyaalapú online kérdőív a háztartási villamosenergia-rugalmasságról, egy BSc-szakdolgozathoz.
Egyszerre egy kártya jelenik meg, és a kérdések az adott háztartáshoz igazodnak.

Az alapértelmezett kérdőív az eszközön tárolja a válaszokat. Kérdőívenként beállítható a megjelenítés és a Supabase-tárolás. Az `/admin` oldalon megtekinthetők a beállítások és az útvonalankénti kártyaszámok. A nyitókártya alapértéke a Közepes.

**Futtatás:** `npm install`, majd `npm run dev`. Telefonon vagy tábláneten, ugyanazon a helyi hálózaton:
`npm run dev -- --host`. A tartalom a `content/` mappában van; a kártyaséma leírása a `content/sample.yaml` fájl.
A tartalom ellenőrzése: `npm run validate-content`.

**Használat:** minden kártya kitölthető csak gombokkal és csak billentyűzettel is; a húzás és a gyorsbillentyűk csak
gyorsítanak. A kérdőív a technikai adatokat (kártyánkénti idő,
bevitelszámok) csak akkor rögzíti, ha a kitöltő a hozzájárulási kártyán bejelöli.

**Licenc:** a kód AGPL-3.0-only (lásd `LICENSE`), a kérdésbank és az eszköztartalom a `content/` mappában CC BY 4.0 (lásd `content/LICENSE`).
