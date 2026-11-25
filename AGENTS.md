# Szabályok kódoló ügynököknek (Codex, Claude)

Ez a fájl minden ügynökre vonatkozik, amely ebben a repóban dolgozik. A `CLAUDE.md` erre hivatkozik.

## Ellenőrzés minden PR előtt

```bash
npm test -- --maxWorkers=2
npm run lint
npm run validate-content
npm run build
```

A PR leírásában szerepeljen a tesztek száma.

## Tartalom

- A kérdések a `content/kerdesbank.hu.yaml` fájlban vannak, a séma leírása a `content/sample.yaml`.
- Minden tartalmi változásnál emeld a bank `version` mezőjét, és írd be a változást a `content/KERDESBANK_v0.1.md` naplóba.
- Új kártyatípus vagy mező esetén frissítsd a `SCHEMA_CHANGES.md` fájlt.
- **A szerző szövege (pl. N01, N02, a szerző által írt kártyaszövegek) csak a szerző kifejezett jóváhagyásával változhat, elírásjavítás is.** Javaslatot a PR leírásában vagy egy issue-ban lehet tenni, a szöveg cseréje nélkül.
- Ha egy válaszskála iránya vagy jelentése változik, a naplóban jelezd, hogy a régi és az új bankverzió válaszai nem vonhatók össze.

## Adatkezelési tájékoztató (`public/adatkezeles.html`)

- **Bankverzió-emelésnél** a fejléc „Kérdésbank-verzió:” értékét is írd át az új verzióra.
- **Ha a tájékoztató tartalma változik**, frissítsd az „Utolsó módosítás” dátumát is. A bankverzió átírása önmagában nem tartalmi változás.
- Új adatkezelés (új gyűjtött mező, analitika, külső szkript, Turnstile vagy más szolgáltató) csak úgy kerülhet be, hogy ugyanabban a PR-ban a tájékoztató is frissül. Ilyet a szerző jóváhagyása nélkül ne vezess be.

## Supabase és titkok

- Migráció csak fájlként készülhet a `supabase/migrations/` alá. Az élő projekten ne futtasd: azt a szerző jóváhagyása után külön lépésben alkalmazzuk, és a fájl a ténylegesen rögzített verziószámot kapja.
- A kliensben csak a publishable kulcs szerepelhet. Service-role kulcs, `.env.local` és más titok soha nem kerülhet a repóba.
