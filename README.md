# Cairn 2e Mobile Character Sheet

Szybki, dotykowy companion jednej lokalnej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają wyłącznie w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Wersja 0.19.0

Interfejs został strukturalnie przebudowany pod krótkie użycie na telefonie przy stole:

- **Postać** pokazuje jeden panel bieżącego stanu z dominującą OCHR, pancerzem, miejscami i dotykowymi rzutami SIŁ/ZRE/WOL;
- **Ekwipunek** używa kompaktowego podsumowania, dziesięciu wizualnych miejsc i pełnych dotykowych wierszy z maksymalnie jedną szybką akcją;
- **Kości** działają jak konsola z dużym ostatnim wynikiem, rail-em szybkich kości, lekkim powtórzeniem i historią;
- wyniki rzutów otrzymały krótką animację przestrzennej kości z wartością na jej powierzchni oraz opcjonalną haptykę na wspieranych urządzeniach;
- **Dziennik** zaczyna się od sesji i szybkiej notatki, a dossier oraz rzadsze korekty znajdują się niżej;
- top bar pokazuje bieżący widok, a dolny pasek działa jak stały mobilny tab bar z obsługą safe area;
- jeden docelowy arkusz `styles/app.css` zawiera cały system wizualny, jasny motyw, forced colors i reduced motion.

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

Wersja aplikacji 0.19.0 nadal używa `schemaVersion: 3`. Animacje i haptyka nie zmieniają formatu importu, backupu ani punktów odzyskiwania i nie wymagają migracji danych. Zapisy ze `schemaVersion: 2` są nadal migrowane automatycznie, a starsze eksporty pozostają obsługiwane.

## Struktura aplikacji

- `index.html` — semantyczny shell, cztery widoki, tab bar i bottom sheet;
- `styles/app.css` — jedyne źródło layoutu, komponentów i systemu wizualnego;
- `scripts/app.js` — model danych, logika Cairn, renderowanie i interakcje;
- `service-worker.js` — jawny cache lokalnych plików do pracy offline;
- `tests/` — regresja funkcjonalna, dostępnościowa i screenshoty do review.

Runtime nie używa frameworka, bundlera, zewnętrznych fontów ani zależności sieciowych.

## Uruchomienie lokalne

```bash
python3 -m http.server 4173
```

Następnie otwórz `http://127.0.0.1:4173`.

## Testy

```bash
npm ci
npx playwright install chromium webkit
node --check scripts/app.js
sha256sum -c checksums.sha256
npm test
```

CI udostępnia nieblokujący wizualny zestaw review jako artefakt `ui-review-screenshots`.

## Publikacja

Zmiany w gałęzi `main` są wdrażane przez `.github/workflows/deploy-pages.yml`. Workflow weryfikuje `checksums.sha256` przed publikacją plików PWA.
