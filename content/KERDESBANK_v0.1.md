# Kérdésbank v0.1: változásnapló és indoklás

A `kerdesbank.hu.yaml` 0.1.0-s változata. A tartalom licence CC BY 4.0 (`content/LICENSE`).

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
- **N02:** a tájékoztató helyőrzői ([ADATKEZELŐ], [JOGALAP], [MEGŐRZÉSI IDŐ]) csak a konzulensi és adatvédelmi egyeztetés után tölthetők ki. Addig a platform nem gyűjthet valódi választ.

## Hossz

A válaszképernyők számát (információs, hozzájárulási és összegző kártya nélkül) a `npm run validate-content` számolja.
