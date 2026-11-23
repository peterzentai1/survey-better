# Card-based questionnaire (kártya-kérdőív), v0.1

An open-source, card-based web questionnaire about household electricity flexibility, built for a Hungarian BSc thesis.
One card is shown at a time; the questions adapt to the respondent's household (appliances, answers so far).
It runs on phones, tablets and laptops (touch, mouse, trackpad, keyboard). The respondent-facing UI is in Hungarian.

**Status: v0.1 local prototype. It collects no data.** There is no backend and no network call; answers stay in the
browser (`localStorage`) on the device that was used. A banner says so on every screen.

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
| `npm run validate-content` | validate `content/kerdesbank.hu.yaml` + `content/eszkozok.yaml`, then print for two fixture households (no appliances / every appliance the picker offers) the cards that would be shown, their count and the module quotas |

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

## Privacy stance

No IP address, user-agent string or fingerprinting; the only date stored is the start date (no time). Technical
paradata (time per card, input counts) is collected **only** if the respondent ticks the optional box on the consent
card. Answers are never derived from dwell time or repeated gestures, and no respondent ever sees other respondents'
answers. Exports (`*.response.json`, `exports/`) are git-ignored.

## License

Code: AGPL-3.0-only (see `LICENSE`). The question bank and appliance content in `content/` are under CC BY 4.0
(see `content/LICENSE`).

---

## Röviden magyarul

Ez egy nyílt forráskódú, kártyaalapú online kérdőív a háztartási villamosenergia-rugalmasságról, egy BSc-szakdolgozathoz.
Egyszerre egy kártya jelenik meg, és a kérdések az adott háztartáshoz igazodnak.

**Állapot: v0.1, helyi prototípus, nem gyűjt adatot.** Nincs szerver és nincs hálózati kapcsolat; a válaszok csak a
használt eszköz böngészőjében maradnak.

**Futtatás:** `npm install`, majd `npm run dev`. Telefonon vagy tábláneten, ugyanazon a helyi hálózaton:
`npm run dev -- --host`. A tartalom a `content/` mappában van; a kártyaséma leírása a `content/sample.yaml` fájl.
A tartalom ellenőrzése: `npm run validate-content`.

**Használat:** minden kártya kitölthető csak gombokkal és csak billentyűzettel is; a húzás és a gyorsbillentyűk csak
gyorsítanak. **Adatvédelem:** nincs IP-cím, böngészőazonosító vagy ujjlenyomat; a technikai adatokat (kártyánkénti idő,
bevitelszámok) csak akkor rögzíti, ha a kitöltő a hozzájárulási kártyán bejelöli.

**Licenc:** a kód AGPL-3.0-only (lásd `LICENSE`), a kérdésbank és az eszköztartalom a `content/` mappában CC BY 4.0 (lásd `content/LICENSE`).
