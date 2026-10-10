# Trening na masę

Aplikacja na telefon do treningu siłowego na masę mięśniową. Trening na każdy dzień układa się sam: z regeneracji mięśni, sprzętu, który masz pod ręką, i czasu, jakim dysponujesz. Ciężary podpowiada z Twojej historii.

**Aplikacja:** https://baniak88.github.io/trening-na-mase/ (po włączeniu GitHub Pages, patrz niżej)

## Co potrafi

- **Trening na dziś generowany automatycznie.** Wybiera wypoczęte partie mięśni, dobiera ćwiczenia do sprzętu i mieści się w wybranym czasie (30–90 min). Możesz wymusić zakres: całe ciało, góra, dół, push, pull, nogi.
- **Mapa regeneracji.** Sylwetka z przodu i z tyłu pokazuje kolorami, które mięśnie są gotowe, a które jeszcze odpoczywają, i za ile godzin wrócą do formy.
- **Siłownie ze sprzętem.** Np. „Siłownia” i „Dom”. Generator proponuje tylko ćwiczenia, które zrobisz w danym miejscu.
- **50 ćwiczeń z animacją techniki:** linie kontrolne, fazy ruchu, typowe błędy pokazane na animacji, wskazówki i zamienniki.
- **Trening krok po kroku:** jedno ćwiczenie na ekranie, duże przyciski do ciężaru i powtórzeń, timer przerwy z dźwiękiem, serie rozgrzewkowe, kalkulator talerzy.
- **Progresja:** podwójna progresja (najpierw powtórzenia, potem ciężar), rekordy, szacowany 1RM, wykresy postępów.
- **Cykl 6 tygodni:** wysiłek rośnie co tydzień, 6. tydzień jest lżejszy.
- **Stały plan:** zamiast generatora możesz wybrać plan FBW 2×, FBW 3×, Góra/Dół 4× albo Góra/Dół + PPL 5×.
- **Działa bez internetu** i instaluje się jak zwykła aplikacja. Dane zostają w telefonie; kopię zapiszesz do pliku w Ustawieniach.

## Instalacja na telefonie

1. Otwórz adres aplikacji w przeglądarce telefonu.
2. **Android (Chrome):** menu ⋮ → „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.
   **iPhone (Safari):** przycisk Udostępnij → „Do ekranu początkowego”.
3. Aplikacja pojawi się z ikoną na ekranie i będzie działać także offline.

## Włączenie GitHub Pages (jednorazowo)

1. Na GitHubie wejdź w repozytorium → **Settings** → **Pages**.
2. W **Build and deployment** ustaw **Source: Deploy from a branch**, gałąź **main**, folder **/ (root)** i kliknij **Save**.
3. Po minucie lub dwóch aplikacja będzie pod adresem https://baniak88.github.io/trening-na-mase/.

Każdy kolejny push na `main` publikuje nową wersję. Telefon pokaże pasek „Jest nowa wersja aplikacji” z przyciskiem „Odśwież”.

## Uruchomienie lokalnie

```bash
npm start        # serwer na http://localhost:8080 (wymaga Pythona 3)
npm test         # testy algorytmu (Node 20+)
```

Projekt nie ma kroku budowania ani zależności. Wystarczy dowolny serwer plików statycznych.

## Jak działa algorytm

**Regeneracja** (`js/engine/recovery.js`). Każda seria dodaje zmęczenie mięśniom, które trenuje (mięśnie pomocnicze liczą się w połowie). Zmęczenie maleje liniowo do zera: duże partie w 72 h, barki i ramiona w 48 h, łydki i brzuch w 36 h. Kilka treningów łączy się jako niezależne źródła zmęczenia.

**Generator** (`js/engine/generator.js`).
1. Tryb „Auto” wybiera całe ciało, gdy góra i dół są wypoczęte (85%+), w przeciwnym razie bardziej wypoczętą połowę.
2. Idzie po liście miejsc w treningu: najpierw wzorce wielostawowe (przysiad, zawias biodrowy, pchanie i przyciąganie w poziomie i pionie), potem izolacje. Pomija partie zmęczone (poniżej 60%) i te, które w ostatnich 7 dniach dostały już górny limit serii.
3. Do każdego miejsca wybiera ćwiczenie dostępne na sprzęcie: znane ćwiczenia i wolne ciężary w głównych bojach mają pierwszeństwo, ćwiczenia z ostatniego treningu są mniej prawdopodobne. Przycisk „Inne ćwiczenia” zmienia ziarno losowania.
4. Dokłada ćwiczenia, dopóki mieści się w czasie (rozgrzewka 8 min + serie × (przerwa + ok. 40 s)).

**Progresja** (`js/engine/progression.js`). Ten sam ciężar, dopóki wszystkie serie nie dojdą do górnej granicy zakresu powtórzeń, potem ciężar rośnie o krok ćwiczenia. Po przerwie dłuższej niż 4 tygodnie start od 90% ostatniego ciężaru.

## Struktura

```
index.html              szkielet aplikacji
manifest.webmanifest    instalacja na telefonie
sw.js                   praca offline (cache)
css/app.css             wygląd, jasny i ciemny motyw
js/app.js               ekrany i obsługa
js/store.js             zapis danych, eksport i import
js/figure.js            rysowanie i animacja ćwiczeń
js/bodymap.js           mapa regeneracji mięśni
js/data/catalog.js      ćwiczenia, plany, sprzęt
js/engine/              regeneracja, generator, progresja
tests/                  testy algorytmu
```

## Dane z poprzedniej wersji

Jeśli masz treningi w pierwszej wersji aplikacji (na claude.ai), skopiuj je tam w Plan → Ustawienia → „Kopiuj dane do nowej aplikacji”, a tutaj wklej w Ustawienia → Twoje dane → „Wklej dane z poprzedniej wersji”.

## Źródła

Zasady treningu oparte na programach kursów dla trenerów personalnych i badaniach nad hipertrofią:

- [NASM: model OPT, faza hipertrofii](https://www.nasm.org/certified-personal-trainer/the-opt-model)
- [Active IQ: Level 3 Diploma in Fitness Instructing and Personal Training](https://www.ActiveIQ.co.uk/docs/default-source/pdf/q3dfipt-declared-purpose-v2.pdf)
- [NCCPT: podstawowe wzorce ruchowe](https://open-exam-prep.com/study-guides/nccpt-cpt/exercise-technique/fundamental-movement-patterns)
- [Pelland i in.: objętość i częstotliwość a hipertrofia](https://sportrxiv.org/index.php/server/preprint/view/460)
- [Schoenfeld 2016: przerwy 1 vs 3 min](https://brookbushinstitute.com/article/longer-interset-rest-periods-enhance-muscle-strength-hypertrophy-resistance-trained-men)
- [Maeo 2021: uginanie nóg siedząc vs leżąc](https://sci-sport.com/en/hypertrophy-and-hamstring-protection-seated-prone-leg-curl/)
- [Maeo 2022: triceps nad głową vs wyciąg](https://sci-sport.com/en/triceps-hypertrophy-impact-of-arm-position/)
- [Bell i in. 2024: praktyki deloadu](https://doaj.org/article/7d15e260e0ac4cff9e8c685dd7335389)

Aplikacja nie zastępuje porady lekarza ani trenera. Przy bólu lub urazie przerwij ćwiczenie.
