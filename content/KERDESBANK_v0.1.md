# Kérdésbank v0.1: változásnapló és indoklás

A `kerdesbank.hu.yaml` változásai. A tartalom licence CC BY 4.0 (`content/LICENSE`).

## v0.3.0 változások (élesítés előtti változat, 2026-11-25)

| Kártya | Változás |
| --- | --- |
| N01 | Forrásolt, semleges nyitószöveg. A kormány 2026. augusztus eleji kérése (17–21 óra) a hivatalos indoklással: Paks csökkentett teljesítménye az alacsony Duna-vízállás miatt, és az esti napelemes kiesés. Az augusztusi naperőművi részarány: a felhasználás 38%-a. Kikerült három forrás nélküli állítás: az esti áramár mint „valódi ok”, a 6,9 GW-os augusztus 13-i csúcs és a háztartási negyedórás ár. |
| N02 | A végleges rövid adatkezelési tájékoztató. Adatkezelő: Zentai Péter magánszemélyként, intézményi megnevezés nélkül. Visszakerült a megőrzési idő (2027-12-01), az abbahagyás joga és a 18 éves korhatár. Új a kitöltési azonosító és a törlés módja. Az „anonim” szó kikerült, mert a válaszok álnevesített személyes adatok. A helyőrzők megszűntek. |
| I10–I11 | „Tételezzük, hogy” helyett „Tételezzük fel, hogy”. |

A teljes tájékoztató a `public/adatkezeles.html` oldalon van. A kérdőív beállításai `display.privacyNotice` mezőben hivatkoznak rá.

## v0.2.2 változások (2026-11-24)

- **N03 kikerült.** A figyelmes válaszadás vállalása az N01 indítógombján marad. A gombnyomásból nem keletkezik külön tételválasz.
- **I12 kikerült.** Az I10 A/B összehasonlítás viselkedési mutatói a válaszadás vagy kihagyás, az első válasz beviteli módja (koppintás, húzás vagy billentyű), valamint az első válaszig eltelt idő.
- A közös bevezető mondat az első megjelenésekor nagyobb betűméretet kap. A méretezés a kitöltő tényleges sorrendjét követi, beleértve a véletlenszerű sorrendű kártyákat is.

## v0.2.1 változások (szövegjavítás, 2026-11-24)

A kitöltő a helyi kérdésszerkesztőben javított. Az export: `kerdes-szerkeszto/exports/kerdes-javitasok_0.2.0_2026-11-24-17-06.json`. A kártyák szerkezete és a logika nem változott.

| Kártya | Változás |
| --- | --- |
| N01 | Új cím és nyitószöveg: az augusztusi esti klímakérés, a napelemes csúcstermelés és az esti gázalapú áram. A gomb felirata egyben vállalás. A hosszválasztó magyarázata és az „ajánlatok elképzeltek” mondat kikerült. |
| N02 | Új cím. A kutató neve és intézménye, valamint a kapcsolattartó e-mail kitöltve. A kihagyásról és visszanézésről szóló mondat az N01-ből ide került. A megőrzési idő és az abbahagyás joga kikerült. |
| E03 | „a klímával” helyett „klímával”. |
| I01–I07 | A közös bevezető (`indok_lead`): „Képzelje el, hogy ma jelzést kap…”. |
| I09 | Az értesítés csatornái: SMS, e-mail vagy mobilapp. |
| I10–I11 | A közös bevezető (`homerseklet`): „Tételezzük, hogy Ön állítja a fűtést.” |

## v0.2 változások

- **I10–I12.** Kétórás, egyfokos esti hőmérséklet-csökkentés. Az első érzést véletlenszerűen kiosztott koppintós vagy húzós felületen mérjük, a vállalási szándékot egységes hatfokú skálán. Az első kérdést megválaszolók külön értékelhetik a válaszadási módot.

| Kártya | Változás |
| --- | --- |
| N01 | A nyitószöveg második bekezdése bemutatja a három választható kitöltési hosszt. A közepes a kezdő beállítás, a percek szögletes zárójelben jelölt előteszt-helyőrzők. |
| N03 | Új, kötelező igen/nem tétel a figyelmes válaszadás vállalásáról, közvetlenül a hozzájárulás után. Mindkét válasszal folytatható a kérdőív. |
| J02 | Az első opció az előrefizetés akadályára kérdez rá (`elozetes`, persely ikon). A megtérülés hiánya külön opció. |
| J04 | Új, elképzelt ajánlat a villanyszámlán törlesztett, a teljes rezsit nagyjából változatlanul hagyó kölcsönről. Ha más dönt a lakásról, a szöveg külön jelzi a feltételezett döntési lehetőséget. |
| J05 | A J04 elutasításakor megjelenő új szonda. A közepes és alapos változatban legfeljebb két akadály jelölhető. |
| B01 | Az `onkent_magam` más szereplőkkel együtt jelölhető. A `senki` kizáró opció a csempék végén, elválasztó alatt jelenik meg. Az E01 és J01 kizáró opciói ugyanígy jelennek meg. |

- `effort: 2` jelölést kapott az A02, A04, A05, T02, T03, T04, I08, I09, J01, J03, J05, F02, F04, F05 és B03. A B04 értéke `effort: 3`.
- A jelöletlen kártyák `effort` értéke 1. A modulkártyák elsőbbségi sorrendje a meglévő `priority` mezőn alapul. A rövid, közepes és alapos változatban rendre 3, 6 és 9 az összesített modulkeret.

**Állapot:** pilot előtti munkaváltozat. Kognitív előtesztelés még nem volt. Az összegek tesztértékek, a valós kitöltési időt pilottal kell mérni.

A `source` mezők rövidítései:

| Rövidítés | Jelentés |
|---|---|
| Aug-mag #n | A 2026. augusztusi kutatási terv 12 tételes indokmagjának n. tétele |
| NLM Qx.y | Egy korábbi, generált teljes kérdőívvázlat tétele (ezt bírálta a kritika) |
| S1–S16 | A háztartási interjúkhoz készült szűrőkérdőív |
| K1–K7 | Az interjúkhoz készült helyzetkártyák |
| kritika | A korábbi vázlat módszertani kritikája (a sorszámok a belső jegyzetre utalnak) |
| H1–H5 | Az augusztusi terv hipotézisei |

## Fő tervezési döntések

1. **Teljes körű minta.** A kérdőív minden háztartásnak szól, nem csak a villamosítottaknak. A nem villamosított háztartások saját ágat kapnak (J02, J03), és a méltányossági blokk (F03–F05) mindenkinek szól. Így mérhető, hogy az új tarifák és szolgáltatások aránytalanul hátrányosak-e azoknak, akiknek nincs időzíthető eszközük.

2. **1–6-os skála, mindig látható „Nem tudom / kihagyom” gombbal.**
   - **Előny:**
     - a kitöltő kénytelen irányt választani;
     - telefonon is elfér;
     - a középpont nem keveri össze a semleges választ a „nem tudom”-mal.
   - **Költség:**
     - Középpont nélkül a válaszok pozitív irányba tolódhatnak, ami elfogadási kérdéseknél túlbecslést okozhat (Wetzelhütter 2020).
     - A páros skála melletti irodalmi támogatás nálunk csak keresési szinten ellenőrzött.
     - A skála nem vethető össze közvetlenül az ECHOES és a Fell-féle 5 fokú skálával.
   - **Ellensúlyok:**
     - semleges végpontcímkék;
     - fordított irányú tétel (F04);
     - elemzéskor az irány (1–3 kontra 4–6) és az erősség külön kezelése.

3. **Minden tartalom egyszer szerepel.** Ez a kitöltőnek tett ígéret (N01), ezért ugyanazt a tartalmat más formában sem kérdezzük meg újra. A validálás így csak statisztikai lehet: irány- és erősség-felbontás, kategóriarend-ellenőrzés.
   - Ugyanezért nincs külön „melegvíz” kérdés: a villanybojler a csempék között szerepel.
   - Az eszközcsempék előre bejelölik a fűtésnél már megadott eszközt (`impliedBy`).
   - A vezérelt áramkörről egyetlen kérdés szól (T02).

4. **Kihagyás kérése helyett:** semleges kihagyásgomb, a végén pedig áttekintés a kihagyott kérdésekről, ahol pótolni lehet őket. A nyitószöveg nem a gyors kihagyásra biztat, hanem azt mondja, hogy a „nem tudom” is hasznos információ. A korábban tervezett „vállalom, hogy átgondoltan válaszolok” kártya kimaradt a hossz miatt, és mert hatását csak emlékezetből ismerjük.

5. **Kiemelés („szuperlájk”) a végén (Z01).** Legfeljebb 2 téma kaphat csillagot, témánként kész állítással vagy saját szöveggel. Így minden kártya szimmetrikus marad: nincs aszimmetrikus „szuper igen” gesztus.

6. **Eszközmodulok súlyozott kerettel** (`eszkozok.yaml`). Nagy, időben eltolható fogyasztóról (hőszivattyú, fűtő klíma, bojler, autó, akkumulátor, elektromos fűtés) legfeljebb 3 kártya jön, közepesről (nyári klíma, napelem, szivattyú) 2, a háztartási gépekről 1. Összesen legfeljebb 9 modulkártya.
   - A szintek saját sorrendi feltevések, nem mért kWh-adatok.
   - A kitöltő nem látja őket, és eredményként sem közölhetők.
   - Modulon belül a sorrend: 1. az ajánlat elfogadása, 2. a kitöltő saját szolgáltatási határa (fok, zuhanyzásnyi meleg víz, töltöttség, tartalék), 3. a használat időpontja vagy a felülbírálás.

7. **Helyi szöveg csak helyieknek.** A „mórahalmi hálózat” és a „mórahalmi közösségi alap” csak a mórahalmi kitöltőknek jelenik meg (`textVariants` az A01 alapján). A többiek a „helyi” változatot látják.

## Az augusztusi 12 tételes indokmag sorsa

A cselekvési keret közös, és rögzített: egy előre jelzett esti kétórás időszakban egy halasztható használatot egy-két órával későbbre tenni, kézzel. Csak az indok változik, véletlen sorrendben. Ez a kritika javaslatát követi. A kézi cselekvést (indokmag, I09) és az automatikus vezérlést (eszközmodulok) külön kérdések mérik.

| Aug. | Tartalom | v0.1 | Változás |
|---|---|---|---|
| #1 | Országos hiány vagy veszélyhelyzet | I01 | A „veszélyhelyzet” szó helyett semleges megfogalmazás |
| #2 | Helyi hálózati túlterhelés | I02 | Mórahalmi szövegváltozat |
| #3 | Nagy országos terhelés, még nincs veszélyhelyzet | (I01) | Összevonva: csak súlyosságban tért el az #1-től |
| #4 | Saját számla | I03 | Változatlan |
| #5 | Előre ismert jóváírás vagy pont | kimarad | Az ellentételezés formája a modulokban és a kiemelésben jelenik meg |
| #6 | Dinamikus tarifa | F01, F02 | Ez mechanizmus, nem indok, ezért a valós D árszabás kártyájává vált |
| #7 | Rendszerköltség | kimarad | Hossz miatt; az I03/I04 lefedi a pénzügyi és a rendszerszintű oldalt |
| #8 | Importfüggőség | I04 | Változatlan |
| #9 | Több megújuló, későbbre időzítéssel | I08 | Iránya javítva: délre **előrehozni**. Külön kártya, nem a randomizált csoportban |
| #10 | Közösségi alap | I05 | Mórahalmi szövegváltozat (H4) |
| #11 | Hasonló háztartások is részt vesznek | I06 | Változatlan |
| #12 | Indok nélkül, önkéntesen | I07 | Alaphelyzet, a H1 viszonyítási pontja |

## A kritika pontjai és a javításuk

| Kritika | Javítás |
|---|---|
| Az automatikus vezérlés és a kézi cselekvés összemosódik | Indokmag = kézi; modulok = automatikus, garanciákkal; K1 = önkéntes értesítés |
| Kettős állítások (NLM Q3.2: kiber és adat; Q3.3: szolgáltató és aggregátor) | B03 csak kiber; B01-ben szereplőnként külön csempe |
| Abszolút, érzelmi megfogalmazás („összeomlás”, „semmilyen… akár csak minimálisan”) | Semleges szöveg, nincs abszolút állítás |
| A napelem-többlet iránya hibás | I08 előrehozás; M_PV_1 a visszatáplálás korlátozásáról |
| Hiányzó háttérváltozók: tulajdon és döntési jog, fűtés, otthonlét, tarifaismeret | A03, A06, A05, T02–T04 |
| Okosmérőnél kell „nem tudom” | T03 |
| Túl széles korsávok | D01 tízéves sávokkal |
| Túl sok döntés, kb. 21+ | Kapuzás és keret: csak az jön, ami a háztartásra vonatkozik |
| A mini-conjoint nem becsülhető | Kimaradt. Helyette eszközönként egy ajánlat és a kitöltő saját határa |

## Ami új

- **Eszközcsempék piktogrammal és előbejelöléssel (E01).**
- **Teljes körű ág:**
  - villamosítási tervek, csak a még meg nem lévő eszközökkel (J01);
  - az okok, ha nincs nagy eszköz (J02);
  - közösségi napelem vagy akkumulátor iránti érdeklődés (J03).
- **Méltányosság:**
  - védelem a rugalmatlan háztartásoknak (F03);
  - nyerhet-e többet az eszköztulajdonos (F04, fordított tétel);
  - csatlakozás okostelefon nélkül (F05).
- **Valós tarifa:** a D árszabás (F01), a kizárásokkal együtt a súgóban. Ha valaki nem választaná, az okai (F02).
- **Saját szolgáltatási határok:** fok, zuhanyzásnyi meleg víz, töltöttség, akkumulátor-tartalék. Gombsorként, előre beállított érték nélkül, így nincs horgonyhatás.
- **24 órás idősáv-választó:** melegvíz, autó, szivattyú.

## Ellenőrizendő élesítés előtt

- **D árszabás (F01):** a szöveg az MVM 2026-10-25-én mentett oldala alapján készült. Élesítés előtt össze kell vetni az aktuális oldallal.
- **OETP (M_AK_3):** a távoli vezérlés követelménye a 2026-09-28-i módosított felhívás 6. pontjában szerepel, az eredeti januáriban nem.
- **D04 (szubjektív jövedelmi helyzet):** az ESS-kérdés mintájára, emlékezetből. Az eredeti megfogalmazással össze kell vetni.
- **Tesztértékek** (500 Ft, 1000 Ft, 20 000 Ft, 10%): horgonyozhatnak. A pilot után el kell dönteni, maradjanak-e, vagy legyenek változó értékek.
- **N02:** a tájékoztató helyőrzői ([ADATKEZELŐ], [JOGALAP]) csak a konzulensi és adatvédelmi egyeztetés után tölthetők ki. Addig a platform nem gyűjthet valódi választ. A 0.2.1-ben kikerült megőrzési időt és az abbahagyás jogát vissza kell írni.
- **N01 (0.2.1):** forrás kell minden tényállításhoz. (1) A kormány augusztusi kérése az esti klímahasználatról, és hogy a valódi ok az esti ár volt. (2) A 2026-08-13-i 6,9 GW-os napelemes csúcs (MAVIR) és a Paks ~2 GW-os viszonyítása. (3) A negyedórás ár (HUPX) és hogy ez a háztartási árra nem igaz. A kérdések előtti keretezés befolyásolhatja a válaszokat.

## Hossz

A válaszképernyők számát (információs, hozzájárulási és összegző kártya nélkül) a `npm run validate-content` számolja.
