# Polski Przedsiębiorca — dokument projektu

## 1. Czym jest ta gra
Turowy symulator polskiego przedsiębiorcy osadzony w latach 1989–2030. Gracz zakłada firmę w chaosie transformacji ustrojowej i prowadzi ją przez kolejne dekady.

**Cel gracza:** Utrzymać się na stanowisku CEO, budować reputację i finanse. Porażka oznacza bankructwo, utratę firmy lub stanowiska. Gra dzieli się na trzy fazy: Chaos (1989-2005), Duopol (2005-2030) i Inwazja (2030+, atak kosmitów).

## 2. Stack techniczny
- **TypeScript** + **React 18** + **Vite**
- **Zustand** — stan gry (podzielony na slice'y)
- **Tailwind CSS** — stylowanie
- **Vitest** — testy jednostkowe
- **localStorage** — zapisy (klucz `pp-saves-v1`, ustawienia `pp-settings-v1`)

## 3. Struktura kodu
src/
├── engine/ # SILNIK — czysty TS, ZERO Reacta
│ ├── types.ts # wszystkie typy (GameState, Party, Activity itd.)
│ ├── constants.ts # stałe, wagi, konfiguracje, cenniki
│ ├── rng.ts # seedowany RNG
│ ├── initialState.ts # tworzenie nowej gry
│ ├── turn.ts # pętla tury, eventy, rozliczanie akcji
│ ├── actions.ts # akcje natychmiastowe (handel, kredyty, pracownicy)
│ ├── economy.ts # tickEconomy (przychody, koszty, rentowność)
│ ├── politics.ts # wybory, koalicje, rozmiary partii
│ ├── reputation.ts # kaskady reputacji
│ ├── events.ts # logika eventów
│ ├── combat.ts # walka ze skarbówką
│ ├── chase.ts # ucieczka przed mafią (Hamster Go)
│ ├── news.ts # generator plotek, sondaży, zaproszeń
│ └── activityHelper.ts # pomocnik do kategorii działalności
├── data/ # DANE (JSON)
│ ├── events.json # eventy
│ ├── activities.json # codzienne aktywności
│ ├── branches.json # kategorie i podkategorie działalności
│ ├── parties.json # partie (z sizeSchedule)
│ ├── presidential_elections.json # kandydaci na prezydenta
│ ├── office_items.json # przedmioty do biura
│ ├── trade_data.json # dostawcy i odbiorcy towarów
│ └── custom_news.json # własne newsy
├── store/
│ ├── gameStore.ts # spinacz stanu (zapis/odczyt)
│ ├── autosave.ts # logika zapisu do localStorage
│ ├── settingsStore.ts # ustawienia (motyw, autosave)
│ └── slices/ # akcje podzielone tematycznie
│ ├── gameSlice.ts # tury, finanse, handel, pracownicy
│ ├── newsSlice.ts # skrzynka, ActionableNews
│ ├── combatSlice.ts # walka ze skarbówką
│ └── chaseSlice.ts # minigra ucieczki
└── ui/
├── Dashboard.tsx # główny ekran (nawigacja)
├── themes.ts # motywy
├── ui-labels.ts # polskie etykiety
├── components/ # (StatBar, OptionsModal, EventModal)
└── screens/ # ekrany (Stats, Finance, Party, Trade itd.)

text

## 4. Kluczowe modele danych
- **GameState:** Główny obiekt stanu. Zawiera `ceo`, `company`, `politics`, listę `news`, kolejkę `pendingEvents`, `pendingComplaints`, `pendingSales`, postęp `profitabilityScore` itd.
- **Company:** `size` (6 poziomów: micro - corporation), `finances` (wplywy/wydatki), `reputation` (8 sub-statystyk), `resources` (magazyn), `warehouseCapacity`, `inventory` (przedmioty biurowe), `branches` (filie).
- **Reputacja:** Widoczne (publiczna, pracownicy, branża) i ukryte (media, politycy, skarbówka, mafia). Wpływają na ceny i dostęp do opcji.
- **Partie:** Mają przypisane `sizeSchedule` (zmieniają rozmiar z latami) i pule `descriptions`. Wybory parlamentarne co 4 lata (wg `ELECTION_YEARS`), prezydenckie co 5 lat.
- **Handel:** Oparty o `trade_data.json`. Towary mają `quality` (1-10). Niska jakość = tańszy zakup, ale ryzyko reklamacji przy sprzedaży.

## 5. Mechaniki gry
- **Tura (kwartał):** Po kliknięciu "Następna tura" następuje: rozliczenie `pendingSales`, `tickEconomy` (w tym rentowność), `tickPolitics`, losowanie eventów, `recomputeReputation`, generowanie newsów.
- **Akcje natychmiastowe:** Handel (kupno/sprzedaż), reklamy, zmiana rozmiaru firmy, budowa filii, zatrudnianie/zwalnianie, kredyty, zmiana partii.
- **Eventy:** Odpalane przez `events.json` (warunki: rok, partia, przedmioty, flagi). Mają opcje (effects / gamble / outcomes).
- **ActionableNews:** Wiadomości ze skrzynki, które wymagają decyzji (np. zaproszenie do mafii, wizyta urzędnika, żądania pracowników).
- **Minigry:** Walka ze Skarbówką (ataki/HP) i Ucieczka przed mafią (plansza 8x8, zamalowywanie pól).
- **Rentowność:** Wyliczana co turę na podstawie rozmiaru firmy, wydajności pracowników i reputacji. Pokazywana jako trend (⬆️⬇️➡️).

## 6. Motywy
5 motywów: default, telegazeta, gazeta, gg (Gadu-Gadu), brat. Implementacja: CSS variables w `index.css` (`data-theme`).

## 7. Co działa, a co nie (Status)
**Działa:**
- Cała pętla ekonomiczna (wpływy, wydatki, kredyty, podatki, bankructwo).
- System Działalności (branże, rozmiary, filie).
- System Handlu (magazyn, dostawcy/odbiorcy, reklamacje).
- Walka ze skarbówką i minigra z mafią.
- Wybory (parlamentarne/prezydenckie, dynamiczne partie).
- Motywy, zapis/odczyt, ActionableNews, reklamy.

**Do zrobienia:**
- **Rankingi:** Konkurencja, udziały w rynku.
- **Osiągnięcia:** System achievementów.
- **Statystyki globalne:** Bezrobocie, popyt, PKB (obecnie placeholder).
- **Aktywność Polityczna / Mafijna:** Obecnie placeholdery (do rozbudowy).
- **Faza 2 i 3:** PiS/PO, kosmici.
- **Giełda:** Ekran rynkowy.
- **Więcej eventów, aktywności i przedmiotów.**

## 8. Konwencje
- Nazwy plików: `.ts` (logika), `.tsx` (UI).
- ID w JSON: `snake_case` (bez polskich znaków).
- Komponenty: PascalCase.
- Zmienne: camelCase.
- Stałe: SCREAMING_SNAKE_CASE.

## 9. Jak kontynuować pracę
1. Wklej cały ten dokument do nowego czatu.
2. Napisz konkretne zadanie (np. "Zrób system rankingów").
3. Jeśli to bug, wklej screen z konsoli (F12).
4. Zasada: **małe kroki**, podmieniaj **całe pliki**.

## 10. Autor
Hobby project. MENTOS GAMES. Wersja 0.95.
© 2026.
