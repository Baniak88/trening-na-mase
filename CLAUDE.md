# Mój Trener (repo trening-na-mase)

PWA bez kroku budowania: czysty HTML, CSS i moduły ES, hostowane na GitHub Pages z gałęzi `main`.

## Zasady
- Interfejs pisany po polsku, kod i komentarze po angielsku. Angielski: `js/i18n.js` tłumaczy gotowy DOM; każdy nowy tekst interfejsu dopisz do `EN` (albo `EN_PATTERNS` z {0} dla liczb) w `js/i18n/en.js`, a nowe teksty ćwiczeń do `js/i18n/en-data.js`. Tekst użytkownika i odpowiedzi AI oznacz `data-noi18n`.
- Bez frameworków i zależności w runtime. Biblioteki tylko jeśli naprawdę potrzebne.
- Algorytm (`js/engine/`) to czyste funkcje bez DOM. Każda zmiana w nim ma test w `tests/`.
- Po każdej zmianie plików aplikacji podbij `VERSION` w `sw.js`, inaczej telefony zostaną na starej wersji z cache.
- Nowy plik JS lub CSS dopisz do listy `APP` w `sw.js`.
- Dane tylko w `localStorage` (klucz `tnm-v1`), zmiany schematu obsłuż w `migrate()` w `js/store.js`.

## Android
- `android/` to WebView ładujący pliki strony z assets (kopiowane w workflow `android.yml`, nie trzymamy ich w repo).
- Most JS: `window.TnmAndroid` (saveFile, keepScreenOn, vibrate); aplikacja woła `window.tnmBack()` i `window.tnmSave()`.
- APK ląduje na gałęzi `apk` (`trening-na-mase.apk` + `build.log`).

## Uruchomienie
- `npm start` (lub `python3 -m http.server 8080`) i otwórz http://localhost:8080
- `npm test` uruchamia testy algorytmu (Node 20+).

## Ćwiczenia
Ćwiczenie w `js/data/catalog.js` potrzebuje: nazwy, wzorca (`p`), rodzaju sprzętu (`kind`), mięśni (`m`: 1 = główny, 0,5 = pomocniczy),
wskazówek, błędów, zamienników, rysunku (`fig`: pozy A i B, sprzęt), opisu faz i linii kontrolnych (`ANN`), wpisu w `NEEDS`
oraz dowodu przyrostu w `EVID` (poziom A/B i klucz z `SOURCES`). Bez wpisu w `EVID` ćwiczenie jest ukryte.
Rysunki: `img/ek/<rysunek>-0.svg` i `-1.svg` z Everkinetic (CC BY-SA 4.0, przycięte, pokolorowane: mięśnie główne pomarańczowe, pomocnicze jasne; narzędzia w `tools/art/`), miniatury `img/ekt/<rysunek>.webp`, przypisanie w `ART` w `js/data/art.js` (`[rysunek, klucz]` = bliski wariant z opisem w `VARIANT`). Ćwiczenie bez rysunku nie jest pokazywane na listach.
Głowy mięśni (`HEADS`) i ich akcent z opisem: `CURATED` w `js/data/heads.js`; reszta z reguł po angielskiej nazwie.

## Plan tygodnia
Własny plan z `week: true` ma dni z `wd` (0 = poniedziałek) i `mus` (partie). Ćwiczenia dobiera `fillDay` w `js/engine/planner.js`.

## Trener AI
`js/ai.js`: dostawcy (`PROVIDERS`), `ask()` (fetch prosto z telefonu, klucz użytkownika), `buildSystem()` (kontekst: plan, treningi, regeneracja, lista ćwiczeń), `parsePlan()` (blok ```plan z JSON). Klucz i czat w `S.ai` i `S.chat`, poza `exportJSON`.
