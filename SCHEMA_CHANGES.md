# Kártyaséma változásai

## v0.3.5

- Az `effortLevels` lista a `rovid`, `kozepes`, `alapos` szintek bármely részhalmaza lehet (1–3 szint, mindegyik legfeljebb egyszer, ebben a sorrendben). A kártyák `effort` értéke továbbra is a teljes háromszintes sorhoz igazodik: `effort: 2` a `kozepes` szinttől, `effort: 3` az `alapos` szinttől jelenik meg.
- A kérdőív `display.defaultEffort` értéke a bankban szereplő szint kell legyen, különben a build hibát jelez. A „További kérdések” a következő felkínált szintre lép.

## v0.3.3

- A `single` kártya `layout: pager` elrendezése egyenként lapozza az opciókat. A mentett válaszformátum változatlan.
- A `percent_split` kártya az `optionsFrom` mezőben megadott korábbi `multi_tiles` kártyán jelölt opciók százalékos megoszlását menti (`{opció: egész százalék}`, összesen 100). Legalább két kijelölt opció esetén jelenik meg.
- A `consumption` kártya becsült éves kWh-t ment, vagy `nem_tudom` értéket az `unknownLabel` gombbal. A `tariff` mező az éves sávhatárt és a két bruttó egységárat, a `sliderMax` a csúszka felső határát adja meg.

## v0.3.1 (beállítások)

- Új `display.privacyNotice` beállítás: a teljes adatkezelési tájékoztató azonos oldali útvonala vagy `https` címe. A hozzájárulási kártya és a lábléc új lapon nyíló linkkel mutat rá. Supabase-tároláshoz és mérésküldéshez kötelező.

## v0.3

- A `content/surveys/<slug>/survey.yaml` adja meg a kérdésbankot, az eszközfájlt és a kérdőív megjelenítési, tárolási beállításait.
- Az `effortChangedFromDefault` jelzést a kérdőív beállított kezdőértékéhez viszonyítjuk. A `temperatureArm` mező az `ab_test` módban rögzíti az I10 besorolását.

## v0.2

- A kérdésbank opcionális `effortLevels` listája megadja a három kitöltési hossz feliratait és modulkereteit. Az első információs kártya `effortLabel` mezője adja a választó feliratát. A korábbi bankok a meglévő eszközfájl kereteivel működnek.
- Az opcionális `effort` mező a kártya minimális kitöltési szintje. Alapértéke 1. A teljes séma és a feltételek szabályai a `content/sample.yaml` fájlban találhatók.
- A részvételi hozzájárulás után a mentett állapot és a JSON-válasz tartalmazza az `effortLevel` mezőt. Paraadat-hozzájárulással az export `effortChangedFromDefault` mezője jelzi, hogy a kitöltő a hozzájáruláskor az alapértéktől eltérő hosszt választott, vagy később a nyitókártyán ilyen hosszra váltott. A jelzés a Közepes szintre való visszatéréskor is megmarad.
- Hosszváltáskor az export megőrzi a korábbi tételválaszt, annak eredeti megjelenési sorrendjét és állapotát. Az útvonalról lekerült tételek `inactive: true` jelölést kapnak. Visszaállított hossz esetén az újra útvonalra kerülő tételekről lekerül a jelölés.
- Az összegzés egy szinttel hosszabb változatot ajánl a rövid és a közepes útvonal végén. A további kérdések kitöltése után az összegzés az új hosszt használja. Ha a kitöltő közben egészen az összegzésig visszalép, az előző hossz áll vissza, és az addigi válaszok megmaradnak.
