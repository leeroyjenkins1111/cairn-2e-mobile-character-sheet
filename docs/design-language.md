# Wędrowny Dziennik — język wizualny aplikacji

Ten dokument jest kontraktem projektowym aplikacji Cairn 2e Mobile Character Sheet. Nowe widoki i komponenty muszą korzystać z opisanych tu tokenów, hierarchii i wzorców. Wyjątki wymagają uzasadnienia w opisie PR-a.

## 1. Kierunek

Interfejs ma przypominać narzędzie używane podczas wyprawy: terenowy dziennik, kartę postaci i zestaw prostych przyborów gracza. Nie imituje dosłownie papieru i nie korzysta z ciężkiego skeuomorfizmu.

Charakter budują:

- lokalna ilustracja lasu jako atmosfera poza treścią;
- ciepłe powierzchnie papieru i ciemnego atramentu;
- terenowa zieleń, mosiądz i kontrolowany kolor zagrożenia;
- serifowe tytuły i wartości oraz systemowy sans dla działań i treści;
- cienkie linie, ograniczone ornamenty i lekko organiczne znaki;
- wyraźna hierarchia informacji przydatnej podczas gry.

Nie budują go:

- wszechobecny blur i glassmorphism;
- purpurowy glow;
- duża liczba dekoracyjnych kart;
- ręcznie wpisane kolory w komponentach;
- ozdobniki konkurujące z wartościami mechanicznymi.

## 2. Zasady projektowe

### Gra przed atmosferą

OCHR, obrażenia, broń, miejsca, stany i wynik rzutu muszą być rozpoznawalne szybciej niż ornament lub ilustracja.

### Powierzchnia wynika z funkcji

- strona grupuje duże obszary;
- panel grupuje jedno zadanie;
- list row reprezentuje rekord;
- action row reprezentuje nawigację lub działanie;
- raised surface jest zarezerwowane dla sheetów, wyników i wyjątkowo ważnych paneli.

### Jedna główna akcja

W obrębie strony, sekcji lub sheeta może istnieć jedna dominująca akcja. Pozostałe są secondary albo ghost. Destructive action jest oddzielona wizualnie i przestrzennie.

### Styl nie może zależeć od tła

Tekst nigdy nie korzysta bezpośrednio ze szczegółowej ilustracji jako jedynego tła. Każda istotna treść ma stabilną powierzchnię lub odpowiednio mocny veil.

### Light i dark są równorzędne

Oba motywy używają tych samych ról semantycznych. Komponent nie może zawierać hardkodowanego koloru przeznaczonego wyłącznie dla jednego motywu.

### Dostępność jest częścią komponentu

Wzorzec bez focus state, disabled state, odpowiedniego targetu, reflow tekstu i forced-colors nie jest ukończony.

## 3. Tokeny

Tokeny znajdują się w `styles/tokens.css`. Komponenty korzystają wyłącznie z nazw ról.

### Kolor

Najważniejsze role:

- `--color-canvas` — otoczenie aplikacji i ilustracja;
- `--color-surface-page` — podstawowa powierzchnia treści;
- `--color-surface-raised` — sheet, dialog, wynik;
- `--color-surface-interactive` — przycisk i wybrana opcja;
- `--color-ink-primary` — tekst główny;
- `--color-ink-secondary` — tekst wspierający;
- `--color-ink-muted` — metadane;
- `--color-border` i `--color-border-strong` — linie podziału;
- `--color-accent-primary` — terenowa zieleń, status dodatni i orientacja;
- `--color-accent-secondary` — mosiądz, primary action i aktywny stan;
- `--color-state-danger` — obrażenia, błędy i operacje destrukcyjne;
- `--color-focus` — widoczny focus.

Nie należy dodawać tokenów nazwanych pigmentem lub ekranem, takich jak `--character-gold` albo `--inventory-purple`.

### Typografia

- `--font-display` — tytuły strony, sekcji i duże wartości;
- `--font-ui` — tekst, przyciski, formularze i metadane.

Skala:

| Token | Funkcja |
|---|---|
| `--type-meta` | czas, tag, licznik, pomocnicza etykieta |
| `--type-supporting` | opis i supporting text |
| `--type-body` | treść i pola formularzy |
| `--type-emphasis` | wyróżniona treść |
| `--type-section` | tytuł sekcji |
| `--type-page` | tytuł strony lub postaci |
| `--type-resource` | dominujący zasób |

Tekst ważny dla decyzji nie powinien być mniejszy niż `--type-supporting`. Nie zmniejszamy tekstu przy zoomie — zmieniamy układ.

### Spacing

Jedyna skala:

- `--space-1`: 4 px;
- `--space-2`: 8 px;
- `--space-3`: 12 px;
- `--space-4`: 16 px;
- `--space-5`: 24 px;
- `--space-6`: 32 px;
- `--space-7`: 48 px.

Nowa wartość wymaga dowodu, że istniejąca skala nie obsługuje przypadku.

### Promienie

- `--radius-sm`: pola i małe kontrolki;
- `--radius-md`: przyciski, wiersze i raporty;
- `--radius-lg`: duże panele i sheety;
- `--radius-pill`: badge, status i segmented control.

Organiczne, nieregularne promienie są zarezerwowane dla awatara oraz ornamentu empty state.

### Cienie

- `--shadow-raised` — panel nad tłem strony;
- `--shadow-floating` — sheet i toast.

Lista, pole formularza, badge i zwykły przycisk nie otrzymują własnego cienia.

### Motion

- `--motion-fast`: nacisk, hover i prosty selection;
- `--motion-base`: toast, disclosure i przejście widoku;
- `--motion-slow`: sheet i większa zmiana warstwy;
- animacja kości ma własny czas wynikający z fizycznego ruchu.

Każdy ruch musi mieć tryb reduced motion. Efekt nie może być jedynym nośnikiem informacji.

## 4. Ikony i ilustracje

Ikony:

- lokalne SVG;
- `currentColor`;
- domyślnie line icons o podobnym stroke width;
- zawsze mają dostępny tekst albo `aria-label` na kontrolce;
- nie mieszamy ikon liniowych, emoji i znaków tekstowych w jednym zestawie działań.

Ilustracja:

- las jest atmosferą canvasu;
- nie zastępuje empty state, ikony ani etykiety;
- nie może obniżać kontrastu treści;
- w forced colors jest całkowicie wyłączona;
- nowe ilustracje muszą być lokalne i działać offline.

## 5. Komponenty

### App header

Funkcja: orientacja i globalne akcje.

- kicker `Cairn 2e`;
- tytuł aktywnego widoku;
- maksymalnie dwie akcje ikonowe;
- identyczna geometria we wszystkich widokach.

Nie ukrywamy globalnych akcji zależnie od ekranu bez powodu funkcjonalnego.

### Dolna nawigacja

Funkcja: przełączanie czterech głównych widoków.

- target co najmniej 46 px;
- ikona i tekst;
- aktywny stan: kolor, delikatna powierzchnia i wskaźnik;
- padding głównej treści zawsze uwzględnia nav oraz safe area.

Nie umieszczamy działań kontekstowych w tab barze.

### Page header i section header

Page header zawiera jeden `h1`, opis i opcjonalnie jedną główną akcję. Section header zawiera `h2` i opcjonalną akcję niższego rzędu.

Nie opakowujemy nagłówka w dodatkową kartę bez zawartości.

### Stat block

Funkcja: pokazuje bieżący stan mechaniczny.

- duża wartość;
- krótka etykieta;
- wartość maksymalna lub opis;
- jednoznaczny affordance, gdy jest interaktywny.

Wartości mechaniczne nie opierają się wyłącznie na kolorze.

### Resource meter

Zawsze ma równoległą wartość tekstową. Kolor informuje o rodzaju zasobu, ale nie jest jedyną informacją.

### Card i surface

Card grupuje powiązaną treść. Nie używamy osobnej karty dla każdego wiersza listy. Raised surface jest rzadsze niż page surface.

### List row

- tytuł;
- supporting text lub metadane;
- opcjonalny trailing status lub jedna szybka akcja;
- pełny row jest klikalny albo ma osobną akcję — obie możliwości wymagają wyraźnego rozróżnienia.

### Action row

- ikona;
- czasownik lub nazwa działania;
- opis rezultatu;
- trailing value albo chevron.

Nie używamy action row jako bloku czysto informacyjnego.

### Button

- primary: jedna najważniejsza akcja;
- secondary/default: alternatywa;
- ghost: zamknięcie, drobna edycja, nawigacja;
- destructive: usunięcie, reset lub nieodwracalna operacja.

Nie umieszczamy dwóch primary actions obok siebie.

### Formularze

- pola są grupowane według zadania, nie typu danych;
- label jest zawsze widoczny;
- help opisuje format lub konsekwencję;
- błąd wskazuje pole oraz sposób naprawy;
- zapis znajduje się w sticky footerze sheeta;
- długie formularze używają logicznych sekcji.

Nie używamy placeholdera jako jedynej etykiety.

### Segmented control

Do 2–4 wzajemnie wykluczających się opcji, np. stan noszenia albo tryb ataku. Stan wybrany musi być czytelny bez koloru.

### Tag, badge i status

- tag: cecha rekordu;
- badge: liczba lub krótka metadana;
- status: bieżący stan wymagający uwagi.

Nie stosujemy ich zamiennie.

### Toast

- krótki komunikat;
- wariant info, success, warning albo error;
- semantyka live region zależna od pilności;
- opcjonalna akcja Undo.

Toast nie zastępuje błędu przypisanego do pola.

### Empty state

- mały lokalny ornament;
- jedno zdanie wyjaśnienia;
- jedna konkretna akcja.

Nie używamy samego szarego tekstu „Brak danych”, gdy użytkownik może od razu coś zrobić.

### Bottom sheet

Do krótkich zadań, edycji i kontekstowych wyborów.

- stały nagłówek;
- scrollowalne body;
- sticky footer;
- focus trafia na tytuł;
- Escape zamyka;
- focus wraca do wywołującej kontrolki.

### Confirm dialog

Tylko decyzja binarna. Treść opisuje rezultat i odwracalność. Akcja destrukcyjna ma nazwę skutku, np. „Usuń punkt”, a nie samo „OK”.

### Import report

Kolejność:

1. podsumowanie pliku;
2. elementy zaimportowane;
3. ostrzeżenia;
4. praca ręczna;
5. błędy.

Import jest niedostępny przy błędach. Ostrzeżenie i błąd mają ikonę lub etykietę, nie tylko kolor.

### Backup i checkpoint row

Pokazuje nazwę postaci, przyczynę, czas i wersję schematu. Odtworzenie jest secondary, pobranie ghost/default, usunięcie destructive.

### Dice result

Wynik jest najważniejszy, kontekst drugi, powtórzenie trzecie. Canvas jest dekoracyjny; tekstowy wynik pozostaje w drzewie dostępności. Kość nie może zajmować większości małego viewportu.

### Combat action

Pokazuje broń, formułę i jedną główną akcję rzutu. Enhanced, impaired i blast są statusami mechanicznymi, nie dekoracją.

### Inventory slot i item

Slot meter zawsze ma tekst `x/10`. Inventory item jest zwartym list row. Sposób noszenia, miejsca, użycia i obrażenia są metadanymi. Szybka akcja jest najwyżej jedna.

## 6. Dostępność

Minimalny kontrakt:

- czytelny focus visible;
- target przeważnie co najmniej 46×46 px;
- reflow przy 200% bez poziomego scrolla i bez zmniejszania tekstu;
- kolejność DOM zgodna z kolejnością wizualną;
- informacja nie zależy wyłącznie od koloru;
- reduced motion i ręczny override;
- forced colors bez ilustracji;
- light i dark z wystarczającym kontrastem;
- semantyczne `button`, `label`, `details`, `time`, nagłówki i live regions;
- błędy formularzy są zrozumiałe i kierują fokus na pole.

## 7. Odpowiedzialność plików

- `tokens.css` — role semantyczne i warianty motywu;
- `foundations.css` — reset, typografia, focus, motion, forced colors;
- `shell.css` — app shell, header, main, bottom nav i safe areas;
- `components.css` — buttons, rows, forms, cards, overlays i feedback;
- `screens.css` — kompozycje głównych widoków i reflow;
- `dice.css` — wyłącznie prezentacja fizycznych kości.

CSS nie może być tworzony, kopiowany ani wstrzykiwany przez JavaScript. Nie dodajemy plików typu `overrides`, `fixes`, `temporary` ani `redesign-2`.

## 8. Dodawanie nowego widoku

1. Zdefiniuj hierarchię: najważniejsza informacja, pierwsza akcja, dane wspierające i operacje destrukcyjne.
2. Użyj istniejących tokenów oraz komponentów.
3. Dodaj wyłącznie kompozycję do `screens.css`.
4. Sprawdź 320×568 i 390×844.
5. Sprawdź dark, light, 200% text, reduced motion i forced colors.
6. Dodaj screenshot do zestawu review.
7. Udokumentuj nowy wzorzec tylko wtedy, gdy jest rzeczywiście wielokrotnego użytku.

## 9. Właściwe i niewłaściwe użycie

### Właściwe

- jeden panel stanu postaci i osobny panel walki;
- lista przedmiotów rozdzielona liniami;
- primary action w footerze sheeta;
- danger section w ustawieniach;
- dark i light korzystające z tych samych ról;
- reflow komponentu do jednej kolumny przy powiększeniu tekstu.

### Niewłaściwe

- osobna szklana karta dla każdego wpisu;
- hardkodowany `rgba()` zależny od dark mode w komponencie;
- niewidoczny interaktywny skrót;
- dynamiczne `insertRule()`;
- zmniejszanie fontu, aby zachować layout;
- dwie równoległe skale spacingu lub tokenów;
- ważna akcja dostępna wyłącznie przez gest.
