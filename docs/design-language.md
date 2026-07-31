# Wędrowny Dziennik — język wizualny aplikacji

Ten dokument jest kontraktem projektowym Cairn 2e Mobile Character Sheet. Nowe widoki i komponenty muszą zachowywać opisane niżej zasady. Wyjątek wymaga uzasadnienia w PR-ze i screenshotu pokazującego jego wpływ na cały ekran.

## 1. Kierunek

**Ilustracja lasu jest głównym nośnikiem klimatu. Interfejs ma być cichą, przezroczystą warstwą organizującą grę.**

UI nie powinno budować osobnego świata wizualnego ponad tłem. Jego zadaniem jest zapewnić hierarchię, czytelność i wygodną obsługę jedną ręką.

### Charakter budują

- lokalna ilustracja widoczna przez większość ekranu;
- subtelne, transparentne powierzchnie;
- neutralny atrament i tylko trzy istniejące akcenty: oliwka, złoto i róż zagrożenia;
- serif dla nazw i wartości, systemowy sans dla działań i treści;
- cienkie separatory zamiast wielu kart;
- mała ilość tekstu widocznego jednocześnie;
- konsekwentne wyrównania i powtarzalny rytm.

### Charakteru nie budują

- pełne czarne, kremowe lub papierowe płyty zasłaniające ilustrację;
- osobna karta dla każdej sekcji albo wiersza;
- dodatkowe kolory dla ekranów, statystyk lub rodzajów kości;
- gradienty i glow konkurujące z tłem;
- opis pomocniczy powtarzający nazwę kontrolki;
- lokalne korekty marginesów i paddingów;
- `ellipsis`, line-clamp albo zmniejszanie fontu, aby ukryć problem layoutu.

## 2. Zasady nadrzędne

### Tło prowadzi

Veil zapewnia kontrast, ale nie może zamienić ilustracji w niewidoczną dekorację. Powierzchnia treści jest transparentna domyślnie. Mocniejsze krycie jest zarezerwowane dla sheetów, toastów, formularzy i trybu reduced transparency.

### Minimum treści

Na ekranie pozostaje tylko tekst potrzebny do:

1. rozpoznania stanu;
2. podjęcia decyzji;
3. wykonania działania.

Instrukcje, szczegóły i rzadkie operacje trafiają do sheeta lub disclosure. Mikrocopy nie może powtarzać oczywistej funkcji ikony, etykiety albo przycisku.

### Jedna siatka

Główne widoki korzystają z jednego poziomego guttera `--side`. Panele używają `--panel-pad`. Sekcje na tym samym poziomie muszą zaczynać się i kończyć na tych samych krawędziach.

Nie wprowadzamy lokalnego `margin-inline` tylko po to, aby wizualnie „dopasować” pojedynczą sekcję.

### Tekst zawija się, nigdy nie znika

Nazwy postaci, przedmiotów, broni, przycisków i sekcji:

- mogą zwiększyć wysokość elementu;
- korzystają z `overflow-wrap`;
- nie używają `text-overflow: ellipsis`;
- nie używają line-clamp;
- nie są zmniejszane przy powiększeniu tekstu.

Szczególnie ważne selektory są chronione przez test `tests/text-reflow.spec.js` na viewportcie 320×568 w dark i light mode.

### Kolor ma znaczenie

- oliwka: orientacja, stan dodatni i spokojna akcja;
- złoto: aktywny wybór i najważniejsza akcja;
- róż: obrażenia, błąd i operacja destrukcyjna;
- neutralny atrament: cała pozostała informacja.

Kolor nie może być jedynym nośnikiem stanu. Nie dodajemy koloru tylko dla urozmaicenia ekranu.

### Jedna dominująca akcja

W obrębie strony, sekcji lub sheeta istnieje najwyżej jedna akcja primary. Pozostałe są default, quiet albo ghost. Akcja destrukcyjna jest oddzielona i nazywa rezultat.

## 3. Tokeny

Tokeny znajdują się w `styles/tokens.css`. Komponenty korzystają z ról semantycznych, nie nazw pigmentów ani ekranów.

Najważniejsze role:

- `--color-surface-page-translucent` — podstawowe szkło nad ilustracją;
- `--color-surface-raised` — sheet, toast i tryb ograniczonej przezroczystości;
- `--color-surface-interactive` — delikatny stan kontrolki;
- `--color-ink-primary`, `secondary`, `muted` — hierarchia tekstu;
- `--color-border-subtle`, `border`, `border-strong` — separacja;
- `--color-accent-primary` — oliwka;
- `--color-accent-secondary` — złoto;
- `--color-state-danger` — róż zagrożenia;
- `--side` — wspólny gutter strony;
- `--panel-pad` — wspólny padding panelu;
- `--panel-gap` — podstawowy odstęp wewnątrz kompozycji.

Nie tworzymy tokenów typu `--character-gold`, `--inventory-purple` ani `--dice-blue`.

## 4. Powierzchnie

### Canvas

Ilustracja i lekki veil. Nie dodajemy osobnego pełnego tła widoku.

### Glass surface

Stosowana dla zwartego bloku wymagającego stabilnego kontrastu: stan Postaci, overview Ekwipunku, wynik Kości i kontrolki Walki. Blur ma być niewielki. Powierzchnia nie może całkowicie ukrywać ilustracji.

### Continuous page

Długie treści, listy i Dziennik korzystają z separatorów oraz wspólnych krawędzi zamiast stosu kart.

### Raised surface

Wyłącznie sheet, toast, dialog, raport importu i sytuacja wymagająca mocniejszego odcięcia od tła.

## 5. Komponenty

### Header i tab bar

- transparentne chrome;
- cienka krawędź;
- niewielki blur;
- aktywna zakładka używa złota i krótkiego wskaźnika, nie pełnego kolorowego kafla;
- etykiety mogą się zawijać i pozostają czytelne przy powiększeniu tekstu.

### Character state

Tożsamość leży bezpośrednio na ilustracji. Wartości mechaniczne otrzymują jedną spójną powierzchnię. SIŁ, ZRE i WOL używają tego samego koloru orientacyjnego; nie tworzą osobnej palety.

### Inventory

Overview jest jednym transparentnym panelem. Lista przedmiotów jest ciągłą listą bez kart wokół grup i rekordów. Wiersz pokazuje nazwę, najważniejsze metadane, status noszenia oraz najwyżej jedną szybką akcję.

### Dice

Wynik może mieć transparentny panel dla stabilności animacji. Szybkie kości są neutralne; złoto wskazuje ostatnio używaną. Rodzaj kości nie otrzymuje osobnego koloru.

### Journal

Dziennik jest ciągłą stroną z separatorami. Nie tworzymy osobnej karty dla Sesji, notatki, wpisów, dossier i disclosure. Opisy puste lub oczywiste są ukryte; dane użytkownika nie są przycinane.

### Sheet i formularz

Sheet ma mocniejsze, ale nadal transparentne tło. Header, body i footer korzystają z `--panel-pad`. Label pozostaje widoczny. Help pojawia się tylko wtedy, gdy wyjaśnia format, konsekwencję albo sposób naprawy błędu.

### Button

- primary: subtelna złota powierzchnia i obrys;
- default: neutralne szkło;
- quiet: prawie transparentny;
- ghost: brak powierzchni;
- danger: subtelny róż zagrożenia.

Primary nie może wyglądać jak pełny, ciężki blok dominujący nad ilustracją.

## 6. Dostępność

Minimalny kontrakt:

- focus visible;
- target przeważnie co najmniej 46×46 px;
- reflow przy 200% bez poziomego scrolla;
- brak uciętych etykiet;
- informacja niezależna od samego koloru;
- reduced motion;
- reduced transparency z mocniejszymi powierzchniami;
- forced colors bez ilustracji;
- semantyczne nagłówki, przyciski, etykiety, `details`, `time` i live regions;
- canvas kości jest dekoracyjny i nie przechwytuje hit-testów.

## 7. Odpowiedzialność plików

- `app.css` — jedyny entrypoint, wyłącznie uporządkowane `@import`;
- `tokens.css` — role semantyczne i motywy;
- `foundations.css` — reset, typografia, focus, motion i forced colors;
- `shell.css` — ilustracja, header, main, tab bar i safe areas;
- `components.css` — bazowe komponenty i zachowanie;
- `screens.css` — strukturalne kompozycje widoków;
- `dice.css` — renderer fizycznych kości;
- `atmosphere.css` — transparentność, wspólny rytm, minimalna gęstość i końcowy kontrakt wizualny.

CSS jest statyczny. JavaScript nie tworzy elementów `<style>`, nie używa `insertRule()` i nie dostarcza lokalnych reguł spacingu.

## 8. Checklist przed PR-em

1. Czy ilustracja pozostaje widoczna i prowadzi klimat?
2. Czy można usunąć jakiś tekst bez utraty decyzji albo działania?
3. Czy wszystkie główne krawędzie są wyrównane do `--side` albo `--panel-pad`?
4. Czy nazwy i etykiety zawijają się bez ucięcia?
5. Czy ekran używa wyłącznie neutralnego atramentu, oliwki, złota i różu zagrożenia?
6. Czy lista nie została zamieniona w stos kart?
7. Czy light i dark zachowują tę samą hierarchię?
8. Czy 320×568, 390×744 i 390×844 działają bez poziomego scrolla?
9. Czy reduced motion, reduced transparency i forced colors pozostają kompletne?
10. Czy screenshot całego ekranu wygląda spokojniej niż pojedynczy komponent oglądany w izolacji?
