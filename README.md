# Cairn 2e Mobile Character Sheet

Szybki, dotykowy companion jednej lokalnej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają wyłącznie w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Aktualny interfejs

Interfejs został strukturalnie przebudowany pod krótkie użycie na telefonie przy stole:

- **Postać** pokazuje jeden panel bieżącego stanu z dominującą OCHR, pancerzem, miejscami i dotykowymi rzutami SIŁ/ZRE/WOL;
- ekran **Postać** usuwa powtarzalne opisy z launchera walki, wyróżnia SIŁ/ZRE/WOL własnymi znakami i zastępuje złote CTA subtelnym, matowym wierszem obrażeń;
- ekran **Postać** używa autorskiej, sylwetkowej grafiki lasu, wyprawowej pieczęci i ikon inspirowanych fizycznym dziennikiem; dekoracja pozostaje subtelna i nie zastępuje informacji ani dostępnych nazw;
- opisowe dopiski bez znaczenia w rozgrywce zostały usunięte, a skrócone etykiety zachowują mechanicznie istotne informacje;
- otwarty panel stanu grupuje statystyki odstępami zamiast ramek, a obramowane powierzchnie pozostają zarezerwowane dla działań;
- ekran **Postać** skaluje pionowy rytm do wysokości telefonu, dzięki czemu stan, walka i najczęstsze akcje mieszczą się nad tab barem bez przewijania na typowych viewportach iPhone’a;
- **Ekwipunek** używa kompaktowego podsumowania, dziesięciu wizualnych miejsc i pełnych dotykowych wierszy z maksymalnie jedną szybką akcją;
- **Kości** działają jak konsola z dużym ostatnim wynikiem, rail-em szybkich kości, lekkim powtórzeniem i historią;
- wyniki rzutów otrzymały animację obracanej bryły 3D z wartością ujawnianą po zatrzymaniu oraz zsynchronizowane tyknięcia haptyczne na wspieranych urządzeniach;
- **Dziennik** zaczyna się od sesji i szybkiej notatki, a dossier oraz rzadsze korekty znajdują się niżej;
- top bar pokazuje bieżący widok, a dolny pasek działa jak stały mobilny tab bar z obsługą safe area;
- wszystkie widoki korzystają z lokalnej ilustracji lasu jako stałego tła; zależne od motywu warstwy kontrastowe utrzymują czytelność tekstu, a forced colors całkowicie wyłącza grafikę.

## Najważniejsze funkcje

- OCHR jako unikanie obrażeń, SIŁ, ZRE, WOL, pancerz, złoto i stany;
- rozliczanie obrażeń w kolejności pancerz → OCHR → SIŁ, Blizny i obrażenia krytyczne;
- grupowany ekwipunek ze zmęczeniem, drobiazgami, przedmiotami nieporęcznymi i użyciami;
- broń, podmuch, dwie bronie i wielu atakujących;
- rzuty obronne, Kość Losu, rzut własny, historia i bezpieczne powtarzanie;
- import postaci z JSON Kettlewright;
- pełna kopia zapasowa JSON i trzy lokalne punkty odzyskiwania;
- log aktywnej sesji, podsumowania i eksport Markdown/JSON;
- Undo każdej operacji zmieniającej kartę;
- instalacja jako PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu;
- dostępność klawiatury, fokusu, 200% tekstu, jasnego/ciemnego motywu, reduced motion i wysokiego kontrastu.

## Dane i kopie zapasowe

Dane są zapisywane wyłącznie w `localStorage` tej przeglądarki i urządzenia. Wyczyszczenie danych przeglądarki usuwa kartę, dlatego regularnie używaj **Pobierz pełną kopię**.

Aplikacja używa `schemaVersion: 3`. Aktualny układ interfejsu nie zmienia formatu importu, backupu ani punktów odzyskiwania i nie wymaga migracji danych. Zapisy ze `schemaVersion: 2` są nadal migrowane automatycznie, a starsze eksporty pozostają obsługiwane.

## Struktura aplikacji

- `index.html` — semantyczny shell, cztery widoki, tab bar, bottom sheet i jawna kolejność assetów runtime;
- `scripts/app-config.js` — konfiguracja i wersja aplikacji;
- `scripts/app-core.js` — model danych, logika Cairn, persystencja, import/eksport i bazowe renderowanie;
- `scripts/app-bootstrap.js` — wiązanie zdarzeń i funkcja inicjalizacji;
- `scripts/app-entry.js` — końcowy punkt wejścia uruchamiany po rejestracji rozszerzeń;
- `scripts/inventory-domain.js` — czysty, niezależny od DOM model podsumowania ekwipunku;
- `scripts/render-hooks.js`, `scripts/inventory-view.js`, `scripts/character-redesign.js` i pozostałe pliki runtime — jawnie rejestrowane renderery, hooki oraz rozszerzenia interfejsu;
- `styles/app.css` — bazowy layout i system wizualny;
- `styles/character-redesign.css` i `styles/screen-unification.css` — warstwy stylów ekranów;
- `styles/dice-runtime.css` — prezentacja fizycznych kości i ich układu ruchu;
- `styles/runtime-overrides.css` — małe, przekrojowe korekty runtime, które nie mają jeszcze własnej warstwy;
- `service-worker.js` — jawny cache lokalnych plików do pracy offline;
- `scripts/prepare-site.mjs` — budowa katalogu `_site` używanego zarówno przez Pages, jak i Playwright;
- `tests/unit/` — testy czystej logiki oraz kontraktów źródłowych;
- `tests/*.spec.js` — regresja funkcjonalna, dostępnościowa, persystencji i screenshoty do review.

Runtime nie używa frameworka, bundlera, zewnętrznych fontów ani zależności sieciowych. Kolejność skryptów w `index.html` jest kontraktem: konfiguracja i core są ładowane przed rejestrami rozszerzeń, a `app-entry.js` inicjalizuje aplikację jako ostatni asset.

## Uruchomienie lokalne

```bash
npm ci
npm run build
python3 -m http.server 4173 --directory _site
```

Następnie otwórz `http://127.0.0.1:4173`.

## Testy

```bash
npm ci
npx playwright install chromium webkit
npm run check:syntax
npm run test:unit
npm run check:version
npm run check:production
npm test
```

`check:production` buduje dokładnie ten sam katalog `_site`, który trafia do GitHub Pages, i sprawdza obecność wymaganych modułów, stylów oraz wpisów Service Workera. Testy Playwright obejmują również pełny reload zapisu i cykl backup → modyfikacja → import → checkpoint.

CI publikuje diagnostykę Playwright i wizualny zestaw review jako artefakty workflow.

## Publikacja

Zmiany w gałęzi `main` są wdrażane przez `.github/workflows/deploy-pages.yml`. Workflow sprawdza synchronizację wersji, buduje katalog `_site`, uruchamia wspólną walidację produkcyjnego runtime i publikuje artefakt GitHub Pages.
