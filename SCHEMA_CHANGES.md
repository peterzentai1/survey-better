# Kártyaséma változásai

## v0.3

- A `content/surveys/<slug>/survey.yaml` adja meg a kérdésbankot, az eszközfájlt és a kérdőív megjelenítési, tárolási beállításait.
- Az `effortChangedFromDefault` jelzést a kérdőív beállított kezdőértékéhez viszonyítjuk. A `temperatureArm` mező az `ab_test` módban rögzíti az I10 besorolását.

## v0.2

- A kérdésbank opcionális `effortLevels` listája megadja a három kitöltési hossz feliratait és modulkereteit. Az első információs kártya `effortLabel` mezője adja a választó feliratát. A korábbi bankok a meglévő eszközfájl kereteivel működnek.
- Az opcionális `effort` mező a kártya minimális kitöltési szintje. Alapértéke 1. A teljes séma és a feltételek szabályai a `content/sample.yaml` fájlban találhatók.
- A részvételi hozzájárulás után a mentett állapot és a JSON-válasz tartalmazza az `effortLevel` mezőt. Paraadat-hozzájárulással az export `effortChangedFromDefault` mezője jelzi, hogy a kitöltő a hozzájáruláskor az alapértéktől eltérő hosszt választott, vagy később a nyitókártyán ilyen hosszra váltott. A jelzés a Közepes szintre való visszatéréskor is megmarad.
- Hosszváltáskor az export megőrzi a korábbi tételválaszt, annak eredeti megjelenési sorrendjét és állapotát. Az útvonalról lekerült tételek `inactive: true` jelölést kapnak. Visszaállított hossz esetén az újra útvonalra kerülő tételekről lekerül a jelölés.
- Az összegzés egy szinttel hosszabb változatot ajánl a rövid és a közepes útvonal végén. A további kérdések kitöltése után az összegzés az új hosszt használja. Ha a kitöltő közben egészen az összegzésig visszalép, az előző hossz áll vissza, és az addigi válaszok megmaradnak.
