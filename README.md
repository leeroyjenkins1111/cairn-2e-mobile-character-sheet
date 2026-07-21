# Cairn 2e Mobile Character Sheet

Lekka, mobilna karta jednej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Najważniejsze funkcje

- Ochrona, SIŁ, ZRE, WOL, pancerz, złoto i stany;
- rozliczanie obrażeń, Blizn i obrażeń krytycznych;
- kompaktowy, grupowany ekwipunek według sposobu noszenia, ze zmęczeniem, drobiazgami, przedmiotami nieporęcznymi i użyciami;
- broń, podmuch, dwie bronie i wielu atakujących;
- kości, rzuty obronne i Kość Losu, z trzema ostatnimi wynikami, typami rzutów oraz bezpiecznym ponawianiem zwykłych rzutów i rzutów obronnych;
- import postaci z JSON Kettlewright;
- pełna, odtwarzalna kopia zapasowa JSON;
- do trzech lokalnych punktów odzyskiwania przed importem, resetem lub odtworzeniem;
- Undo dla zmian stanu postaci;
- instalacja jako lekka PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu;
- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;
- jawny log sesji: rozpoczęcie, aktywny zapis zmian i rzutów, zakończenie, podsumowanie oraz eksport Markdown/JSON;
- osobny Dziennik postaci, podczas gdy backup, instalacja i operacje techniczne są dostępne w ustawieniach nagłówka.

## Dane i kopie zapasowe

Dane są zapisywane wyłącznie w `localStorage` tej przeglądarki i urządzenia. Wyczyszczenie danych przeglądarki usuwa kartę. Regularnie używaj przycisku **Pobierz pełną kopię**.

Wersja 0.12.0 nadal używa `schemaVersion: 3`. Trzy najnowsze punkty odzyskiwania są przechowywane osobno w `localStorage` i nie wchodzą do pełnej kopii postaci. Chronią przed przypadkowym importem, resetem lub odtworzeniem, ale znikają po wyczyszczeniu danych przeglądarki i nie zastępują pobranej kopii JSON. Historia rzutów może zawierać opcjonalne metadane bezpiecznego powtórzenia, ale starsze wpisy bez tych danych pozostają czytelne i nie wymagają migracji. Zapisy i kopie ze `schemaVersion: 2` są migrowane automatycznie, a starsze pliki `cairn-*-eksport.json` z wersji 0.6.0 nadal mogą zostać odtworzone. Raport sesji Markdown/JSON jest czytelnym wyciągiem i nie zastępuje pełnej kopii zapasowej.

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
