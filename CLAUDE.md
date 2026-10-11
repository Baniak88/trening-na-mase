# Twój Trener (repo trening-na-mase)

PWA bez kroku budowania: czysty HTML, CSS i moduły ES, hostowane na GitHub Pages z gałęzi `main`.

## Zasady
- Interfejs i teksty po polsku. Kod i komentarze po angielsku.
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
wskazówek, błędów, zamienników, rysunku (`fig`: pozy A i B, sprzęt), opisu faz i linii kontrolnych (`ANN`) oraz wpisu w `NEEDS`.
