# Card-based questionnaire (kártya-kérdőív), v0.2

An open-source, card-based web questionnaire about household electricity flexibility, built for a Hungarian BSc thesis.
One card is shown at a time; the questions adapt to the respondent's household (appliances, answers so far).
It runs on phones, tablets and laptops (touch, mouse, trackpad, keyboard). The respondent-facing UI is in Hungarian.

The opening card offers three lengths and initially selects **Közepes**. The prototype saves survey responses on the respondent’s device. With Supabase configured, it also shows per-level timing estimates and can send a small measurement record when a consenting respondent finishes.

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
| `content/kerdesbank.hu.yaml` | the question bank (cards, blocks, conditions) |
| `content/eszkozok.yaml` | appliances, modules, tier caps and the global module cap |
| `content/sample.yaml` | **the card schema reference**: one example of every card type and the condition language |

The YAML is imported as raw text, parsed with `yaml` (anchors and aliases work), validated with zod, and cross-checked
(unique card ids, `answer:` references point to existing cards that come earlier in deck order, `module:` and `owns`
ids exist, ...). On an error the app shows a Hungarian error screen listing every issue with its path.
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

I10 asks how it feels to lower the heating by one degree for two evening hours. Each new session has an equal chance of receiving six tap targets or a drag surface. The assignment is derived from the random session identifier and is stable on Back and resume. Both arms have the same six response labels, skip action and keyboard support. The drag surface also accepts taps. I11 measures willingness to lower the temperature using the same six buttons for everyone. I12 asks respondents who answered I10 how willing they would be to use its input method again.

### Supabase setup

The migration in `supabase/migrations/` is already applied to the **survey-better** project. For local use, copy `.env.example` to `.env.local` and fill in the project URL and publishable key from the Supabase dashboard. For deployment, set the same two variables in the build environment. Restart Vite or rebuild after changing them. Without those variables the survey runs entirely on the device.

When a participant opts into technical measurements and submits the survey, the browser sends the final effort level, bank version, assigned arm, I10 answer/skip status, first input method and latency, and the optional I12 rating. A digest of the random session token deduplicates retries. The database stores no I10 feeling, I11 intention, free text, device inventory or demographics. Unsent measurements are retried on the next visit or when the browser comes back online.

The opening screen displays a median after five measured completions for the same effort level and bank version. Until then it shows the question bank’s estimate. Eligible times cover visible-page time from initial technical consent through submission, including revisits, grouped by the final level. Time between visits and time in background tabs are excluded. Later opt-in after initially declining contributes no total duration.

Use the project's SQL Editor to compare arms among completed, consenting responses:

```sql
select * from survey_private.temperature_ab order by bank_version, effort, arm;
```

Compare `willing_to_use_again / rated_use_again` for the share choosing 4–6, and `median_first_answer_ms` for the first I10 answer. Latency stops on input before auto-advance and is recorded to the nearest 100 ms. The view also returns the sample sizes, skip counts and actual drag use. Incomplete sessions do not contribute to this comparison. Only aggregate median duration is public. Individual survey exports (`*.response.json`, `exports/`) are git-ignored.

## License

Code: AGPL-3.0-only (see `LICENSE`). The question bank and appliance content in `content/` are under CC BY 4.0
(see `content/LICENSE`).

---

## Röviden magyarul

Ez egy nyílt forráskódú, kártyaalapú online kérdőív a háztartási villamosenergia-rugalmasságról, egy BSc-szakdolgozathoz.
Egyszerre egy kártya jelenik meg, és a kérdések az adott háztartáshoz igazodnak.

A teljes kérdőívet a böngésző tárolja. A Supabase-kapcsolat a hozzájárulással befejezett kitöltések időmérését és a hőmérsékletes kártya válaszfelületének összehasonlítását szolgálja. A nyitókártya alapértéke a Közepes. Öt mért kitöltéstől fokozatonként megjelenik a medián.

**Futtatás:** `npm install`, majd `npm run dev`. Telefonon vagy tábláneten, ugyanazon a helyi hálózaton:
`npm run dev -- --host`. A tartalom a `content/` mappában van; a kártyaséma leírása a `content/sample.yaml` fájl.
A tartalom ellenőrzése: `npm run validate-content`.

**Használat:** minden kártya kitölthető csak gombokkal és csak billentyűzettel is; a húzás és a gyorsbillentyűk csak
gyorsítanak. A kérdőív a technikai adatokat (kártyánkénti idő,
bevitelszámok) csak akkor rögzíti, ha a kitöltő a hozzájárulási kártyán bejelöli.

**Licenc:** a kód AGPL-3.0-only (lásd `LICENSE`), a kérdésbank és az eszköztartalom a `content/` mappában CC BY 4.0 (lásd `content/LICENSE`).
