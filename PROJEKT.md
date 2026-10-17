Polski Przedsiębiorca — dokument projektu
1. Czym jest ta gra
Turowy symulator polskiego przedsiębiorcy osadzony w latach 1989–2030. Gracz zakłada firmę w chaosie transformacji ustrojowej i prowadzi ją przez kolejne dekady. Inspiracja: Polski Piłkarz Simulator, Papers, Please, Democracy 4.

Cel gracza: utrzymać się na stanowisku CEO jak najdłużej, budować reputację i finanse.

Trzy fazy:

Faza 1 (1989–2005): chaos polityczny, wiele ugrupowań, możliwość wejścia do mafii.

Faza 2 (2005–2030): duopol PiS/PO, stabilizacja, brak mafii.

Faza 3 (2030+): atak kosmitów, dwie ścieżki (kolaboracja lub ruch oporu), porażka nieunikniona.

2. Stack techniczny
TypeScript + React 18 + Vite

Zustand — stan gry

Tailwind CSS — stylowanie

seedrandom — deterministyczne losowanie (dla save/load)

localStorage — zapisy (klucz: pp-save-v1, ustawienia: pp-settings-v1)

3. Struktura kodu
text
przedsiebiorca-sim/
├── src/
│   ├── main.tsx                 # entry point React
│   ├── App.tsx                  # router ekranów (menu/start/game/options/about)
│   ├── index.css                # Tailwind + motywy (CSS variables)
│   ├── engine/                  # SILNIK — czysty TS, ZERO Reacta
│   │   ├── types.ts             # wszystkie typy i interfejsy
│   │   ├── constants.ts         # stałe, wagi, konfiguracje
│   │   ├── rng.ts               # seedowany RNG
│   │   ├── initialState.ts      # createInitialState + generatePartySchedule
│   │   ├── turn.ts              # nextTurn, consumeActivity, resolveEventChoice, dismissConsequence
│   │   ├── actions.ts           # akcje natychmiastowe (hire, loan, join party itd.)
│   │   ├── economy.ts           # tickEconomy — przychody, koszty, kredyty
│   │   ├── politics.ts          # wybory parlamentarne i prezydenckie
│   │   ├── reputation.ts        # recomputeReputation — kaskady
│   │   ├── events.ts            # matchesConditions, rollEvents
│   │   └── news.ts              # generatePassiveNews, addNewsItem
│   ├── data/                    # DANE — JSON-y
│   │   ├── events.json          # eventy (gracz pisze własne)
│   │   ├── activities.json      # aktywności
│   │   ├── parties.json         # partie polityczne
│   │   ├── presidential_elections.json  # ręcznie wpisane wybory prezydenckie
│   │   └── custom_news.json     # własne newsy (flavor)
│   ├── store/
│   │   ├── gameStore.ts         # stan gry (Zustand)
│   │   └── settingsStore.ts     # ustawienia (motyw, autosave, tempo)
│   └── ui/
│       ├── Dashboard.tsx        # główny ekran gry z zakładkami
│       ├── themes.ts            # lista motywów
│       ├── labels.ts            # polskie etykiety i opisy
│       ├── components/
│       │   ├── StatBar.tsx
│       │   ├── EventModal.tsx
│       │   ├── NewsTicker.tsx
│       │   └── OptionsModal.tsx
│       └── screens/
│           ├── MainMenu.tsx
│           ├── StartScreen.tsx
│           ├── OptionsScreen.tsx
│           ├── AboutScreen.tsx
│           ├── ReputationScreen.tsx
│           ├── FinanceScreen.tsx
│           ├── PartyScreen.tsx
│           ├── ActivityScreen.tsx
│           ├── NewsScreen.tsx
│           ├── EventScreen.tsx
│           ├── ConsequenceScreen.tsx
│           ├── ElectionScreen.tsx              # parlamentarne
│           └── PresidentialElectionScreen.tsx  # prezydenckie
├── package.json
└── PROJEKT.md
Zasada: silnik (engine/) nie wie nic o React. UI (ui/) tylko czyta stan i wysyła akcje. Dane (data/) to JSON-y, które edytuje się bez zmiany kodu.

4. Kluczowe modele danych
GameState
Główny obiekt stanu. Zawiera:

turn, year, quarter, phase, difficulty, pace

ceo — partia, mafia, flagi, licznik przefarbowań

company — nazwa, sufiks, rozmiar, branża, pracownicy, finanse, reputacja, kredyty

politics — partie, prezydent, premier, koalicja, schedule partii, daty wyborów

pendingEvents, currentActivities, history

news — lista NewsItem

lastChoiceResult, lastElectionResult, lastPresidentialResult

chosenActivityThisTurn, bankruptWarningTurns, gameOver

Reputacja (7 sub-statystyk)
Widoczne: branża, opinia publiczna, pracownicy, branża, mafia

Ukryte: opinia w mediach, opinia wśród polityków

Kaskady: media + politycy → publiczna/branża/mafia. Mafia > 70 → szkodzi publicznej.

Waga opinii polityków zależy od tego, czy twoja partia rządzi.

Finanse
stateKonta — główna liczba

Wplywy (wpływy) — przychody, kredyty, dofinansowania, dochód pasywny

Wydatki (wydatki) — kredyty, pensje, czynsz, podatki, kary

Pracownicy (3 typy umów)
Bez umowy — najtańsi, łatwo zwolnić, obniżają opinię pracowników

Zlecenie — średni koszt, średnie przychody

UOP — najdrożsi, największe przychody, wymagają odprawy przy zwolnieniu (8k PLN)

Partie
Pola: id, name, ideology (5 opcji), size (large/medium/small), economicView, socialView, activeFrom, activeTo, isPSL.

Koalicje według reguł z COALITION_RULES:

radykalna lewica ↔ umiarkowana lewica, skrajna prawica

centrum ↔ umiarkowana lewica, centro-prawica

itd.

PSL — specjalna partia, dostępna losowo (67% szans na grę), ma tajne zakończenie.

Schedule partii — losowe przesunięcie ±2 lata od activeFrom/activeTo.

5. Mechaniki gry
Tura
Domyślnie kwartał (opcjonalnie rok). Po kliknięciu „Następna tura":

tickEconomy — przychody, koszty, kredyty

tickPolitics — wybory jeśli rok

rollEvents — losowanie eventu

recomputeReputation — kaskady reputacji

generatePassiveNews — plotki, sondaże, ruchy partii

Sprawdzenie końca gry (bankructwo: 2 tury z saldem < 0)

Akcje natychmiastowe (nie przesuwają tury)
Zatrudnianie/zwalnianie (applyHire)

Kredyt bankowy/szara strefa (applyLoan)

Zmiana działalności (co 2 tury, kosztuje reputację)

Dołączenie do partii (max 3 razy na fazę)

Kredyt ratunkowy (przy bankructwie)

Wybór aktywności (1 na turę)

Eventy
Losowane z events.json po conditions

2–3 opcje wyboru

Mogą mieć effects (stałe), gamble (2 wyniki), outcomes (N wyników z wagami)

once: true — odpalają się raz

Eventy zależne — przez flagi (flagsAdd → flags w innym evencie)

Newsy
Kategorie: rumor, poll, party, economy, custom

Plotki — 30% fałszywych, reszta antycypuje eventy

Sondaże — co 4 tury, 2 lata przed wyborami

Partie — pojawienie/zniknięcie z schedule

Custom — z custom_news.json, niezależne od fabuły

Eventy NIE idą do newsów

Wybory
Parlamentarne co 4 lata (od 1991)

Prezydenckie co 5 lat (od 1990)

Prezydenckie: jeśli rok jest w presidential_elections.json — używa ręcznie wpisanych kandydatów; w przeciwnym razie losuje

Kandydat ma minPercent, maxPercent, typicalPercent — wyniki rozkładają się wokół typical

II tura, jeśli nikt nie ma >50%

6. Motywy (skórki)
Wybór w Opcjach (rozwijana lista). 5 motywów:

default — domyślny

teletext — czarne tło, żółty tekst, VT323 monospace

newspaper — sepia, Georgia, szeryfowa

gg — Gadu-Gadu, szare, Tahoma

brat — lime green, Arial Bold

Implementacja: CSS variables w index.css. Klasy Tailwinda (bg-white, text-stone-900 itd.) są nadpisywane przez !important. Zmiana motywu ustawia data-theme na <html>.

Ważne: niektóre komponenty (np. <select> w Opcjach) używają inline styles — bo nadpisania CSS psuły ich wygląd.

7. Co działa, a co nie
Działa:

Menu główne, ekran startowy, dashboard, opcje, about

Silnik tury, ekonomia, reputacja z kaskadami

Eventy z wyborami i gamble

Wybory parlamentarne i prezydenckie (w tym ręcznie wpisane 1990)

System newsów (plotki, sondaże, partie, custom)

Motywy (skórki)

Zatrudnianie z odprawami, kredyty

Save/load w localStorage (auto + ręczny)

Ustawienia (autosave, tempo, ukryte statystyki, język, motyw)

W toku / do zrobienia:

Rozbudowa działalności (branże z wymaganiami, różne zyski/reputacje)

Dynamiczne partie (zmiana rozmiaru po wyborach, upadki, wchłonięcia)

Faza 2 (PiS/PO) i faza 3 (kosmici)

Giełda / ekran prognoz gospodarczych

Własne nazwiska kandydatów (przerobione, ale nie prawdziwe)

Więcej eventów (gracz pisze własne)

Balans ekonomiczny

Tutorial dla nowych graczy

8. Konwencje
Nazwy plików: .ts dla silnika, .tsx dla UI

Komponenty: PascalCase (Dashboard.tsx, EventScreen.tsx)

Typy: PascalCase (GameState, NewsItem)

Zmienne: camelCase (stateKonta, opiniaPubliczna)

Stałe: SCREAMING_SNAKE_CASE (MAX_NEWS, SEATS_TOTAL)

ID w JSON: snake_case bez polskich znaków (kaseta_vhs, plan_balcerowicza)

Teksty w UI: polskie, z polskimi znakami

Efekty: stateKonta (liczba), reputation (obiekt), Wydatki/Wplywy (obiekty), flagsAdd/flagsRemove (tablice)

9. Jak kontynuować pracę
Zawsze zaczynaj od:
Wklej cały ten dokument.

Napisz konkretne zadanie (np. „dodaj nowy ekran giełdy", „napraw błąd X", „rozszerz typ Partii o pole Y").

Jeśli to bug — wklej screen z konsoli przeglądarki (F12 → Console).

Jeśli to nowy feature — podaj zakres (co ma robić, gdzie w UI, jakie dane).

Zasady współpracy:
Małe kroki. Jedna rzecz na raz. Jak dostajesz duży patch, wklejaj go w całości (nie fragmentami).

Podmieniaj całe pliki, nie fragmenty. Kopiowanie fragmentów z czatu prowadzi do błędów składni.

Po każdej zmianie: Ctrl + S, sprawdź zakładkę Problems w VS Code, potem F5.

Jak coś się wysypie: F12 → Console → screen.

Nie zmieniaj wielu plików naraz — jak coś padnie, nie wiadomo które.

Komendy:
text
npm run dev      # uruchom grę (http://localhost:5173)
npm run build    # zbuduj wersję produkcyjną (folder dist/)
npm install      # po zmianach w package.json
10. Cele długoterminowe
Grywalna faza 1 — 30+ eventów, 15+ aktywności, zbalansowana ekonomia.

Faza 2 — PiS/PO, brak mafii, nowe eventy historyczne (2008, Smoleńsk, COVID).

Faza 3 — kosmici, dwie ścieżki, przetrwanie.

Publiczny release — itch.io (demo), potem Steam (pełna gra).

Monetyzacja: jednorazowy zakup, bez F2P. Cena 15–25 PLN.

Porty: web → Steam (Tauri) → mobile (Capacitor).

11. Autor
Hobby project. Kontakt: [uzupełnij].
Wersja: 0.67 (prototyp).
© by HZ GAMES 2026.

Jak używać tego dokumentu: zapisz jako PROJEKT.md w folderze przedsiebiorca-sim/. W nowym czacie wklej całość + konkretne zadanie. AI od razu będzie wiedzieć, o czym mówisz, i nie będzie trzeba tłumaczyć od zera.

This response is AI-generated, for reference only.
