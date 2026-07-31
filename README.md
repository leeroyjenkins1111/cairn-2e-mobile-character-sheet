# Cairn 2e Mobile Character Sheet

Szybki, dotykowy companion jednej lokalnej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają wyłącznie w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Interfejs — Wędrowny Dziennik

Cała aplikacja korzysta z jednego języka wizualnego inspirowanego fizycznym dziennikiem podróżnika:

- ilustracja lasu tworzy atmosferę canvasu, ale nie jest jedynym nośnikiem charakteru;
- treść korzysta z czytelnych powierzchni papieru i atramentu zamiast nakładających się warstw glassmorphismu;
- kolor ma role semantyczne: terenowa zieleń orientuje, mosiądz wyróżnia główną akcję, a czerwień sygnalizuje zagrożenie i destrukcję;
- serif jest używany dla tytułów i wartości, systemowy sans dla działań, opisów i formularzy;
- Postać, Ekwipunek, Kości, Dziennik, onboarding, ustawienia, import, backupy oraz wszystkie sheety korzystają z tych samych komponentów i rytmu;
- dark i light mode są równorzędnymi realizacjami tego samego systemu;
- forced colors wyłącza ilustrację, reduced motion usuwa ruch, a powiększenie tekstu przeorganizowuje layout bez zmniejszania treści.

Pełny kontrakt systemu znajduje się w [`docs/design-language.md`](docs/design-language.md).

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

Aplikacja używa `schemaVersion: 3`. Refaktor języka wizualnego nie zmienia formatu importu, backupu ani punktów odzyskiwania i nie wymaga migracji danych. Zapisy ze `schemaVersion: 2` są nadal migrowane automatycznie, a starsze eksporty pozostają obsługiwane.

## Struktura aplikacji

### Runtime

- `index.html` — semantyczny shell, cztery widoki, tab bar, bottom sheet i jawna kolejność assetów;
- `scripts/app-config.js` — konfiguracja i wersja aplikacji;
- `scripts/app-core.js` — model danych, logika Cairn, persystencja, import/eksport i bazowe renderowanie;
- `scripts/app-bootstrap.js` — wiązanie zdarzeń i funkcja inicjalizacji;
- `scripts/app-entry.js` — końcowy punkt wejścia uruchamiany po rejestracji rozszerzeń;
- `scripts/inventory-domain.js` — czysty, niezależny od DOM model podsumowania ekwipunku;
- `scripts/render-hooks.js`, `scripts/inventory-view.js`, `scripts/character-redesign.js` i pozostałe pliki runtime — jawnie rejestrowane renderery, hooki oraz rozszerzenia interfejsu;
- `service-worker.js` — jawny cache lokalnych plików do pracy offline.

### CSS

- `styles/tokens.css` — jeden zestaw tokenów semantycznych i oba motywy;
- `styles/foundations.css` — reset, typografia, focus, motion, contrast i forced colors;
- `styles/shell.css` — shell, header, dolna nawigacja, safe area i kontener;
- `styles/components.css` — przyciski, wiersze, formularze, powierzchnie, sheety i feedback;
- `styles/screens.css` — kompozycje Postaci, Ekwipunku, Kości, Dziennika i reflow;
- `styles/dice.css` — wyłącznie prezentacja fizycznych kości.

Runtime nie tworzy elementów `<style>`, nie wywołuje `insertRule()` i nie posiada warstwy `runtime-overrides.css`. Nie używa frameworka, bundlera, zewnętrznych fontów ani zależności sieciowych.

### Build i testy

- `scripts/prepare-site.mjs` — budowa katalogu `_site` używanego przez Pages i Playwright;
- `scripts/check-production-runtime.mjs` — kontrola kompletnego, statycznego systemu CSS oraz runtime;
- `tests/unit/` — testy czystej logiki i kontraktów źródłowych;
- `tests/*.spec.js` — regresja funkcjonalna, dostępnościowa, persystencji i screenshoty do review.

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

`check:production` buduje dokładnie ten sam katalog `_site`, który trafia do GitHub Pages, sprawdza komplet sześciu statycznych warstw CSS, oba motywy, wsparcie dostępności oraz brak starych override’ów i runtime CSS injection.

CI publikuje diagnostykę Playwright i wizualny zestaw review jako artefakty workflow.

## Publikacja

Zmiany w gałęzi `main` są wdrażane przez `.github/workflows/deploy-pages.yml`. Workflow sprawdza synchronizację wersji, buduje katalog `_site`, uruchamia wspólną walidację produkcyjnego runtime i publikuje artefakt GitHub Pages.
