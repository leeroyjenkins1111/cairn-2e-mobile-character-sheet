# Cairn 2e Mobile Character Sheet

Lekka, mobilna karta jednej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Najważniejsze funkcje

- Ochrona, SIŁ, ZRE, WOL, pancerz, złoto i stany;
- rozliczanie obrażeń, Blizn i obrażeń krytycznych;
- ekwipunek, zmęczenie, drobiazgi, przedmioty nieporęczne i użycia;
- broń, podmuch, dwie bronie i wielu atakujących;
- kości, rzuty obronne, Kość Losu i historia rzutów;
- import postaci z JSON Kettlewright;
- pełna, odtwarzalna kopia zapasowa JSON;
- Undo dla zmian stanu postaci;
- instalacja jako lekka PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu;
- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;
- osobny Dziennik postaci, podczas gdy backup, instalacja i operacje techniczne są dostępne w ustawieniach nagłówka.

## Dane i kopie zapasowe

Dane są zapisywane wyłącznie w `localStorage` tej przeglądarki i urządzenia. Wyczyszczenie danych przeglądarki usuwa kartę. Regularnie używaj przycisku **Pobierz pełną kopię**.

Wersja 0.8.0 zachowuje bezpieczny format kopii z 0.7.0 i potrafi również odtworzyć starsze pliki `cairn-*-eksport.json` wygenerowane przez wersję 0.6.0.

## Uruchomienie lokalne

```bash
python3 -m http.server 4173
```

Następnie otwórz `http://127.0.0.1:4173`.

Samo otwarcie `index.html` nadal pozwala korzystać z podstawowej karty, ale Service Worker i test offline wymagają serwera HTTP.

## Testy

Runtime aplikacji nie ma zewnętrznych bibliotek. Playwright jest używany wyłącznie jako zależność deweloperska.

```bash
npm ci
npx playwright install chromium webkit
npm test
```

CI uruchamia testy domenowe osadzone w aplikacji, kontrolę składni, testy mobilnych viewportów, reduced motion, round-trip kopii oraz test offline.

## Publikacja

Zmiany w gałęzi `main` są wdrażane przez `.github/workflows/deploy-pages.yml`. Workflow weryfikuje `checksums.sha256` przed publikacją plików PWA.
