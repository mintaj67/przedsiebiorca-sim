import type { GameState, NewsItem, GameEvent, Party } from './types';
import { makeRng } from './rng';
import {
  RUMOR_TEMPLATES,
  MAX_NEWS,
  FAKE_RUMORS,
  MISLEADING_RUMOR_CHANCE,
  MAFIA_INVITATION_THRESHOLD,
  MAFIA_INVITATION_MIN_GAP_RETRY,
  MAFIA_INVITATION_MIN_GAP_FIRST,
  MAFIA_INVITATION_RETRY_CHANCE,
  MAFIA_INVITATION_EXPIRES_IN,
  SKARBOWKA_THRESHOLD,
  SKARBOWKA_PREPARE_TURNS,
  FLOWERS_COST,
  FLOWERS_BONUS,
} from './constants';
import { matchesConditions } from './events';
import { applyEffects } from './actions'; // <- upewnij się, że to jest stąd!
import eventsData from '../data/events.json';
import partiesData from '../data/parties.json';
import customNewsData from '../data/custom_news.json';
import { getPartySize } from './politics';

interface CustomNews {
  id: string;
  headline: string;
  body?: string;
  weight: number;
  conditions: GameEvent['conditions'];
}

export function addNewsItem(state: GameState, item: Omit<NewsItem, 'read'>): void {
  const fullItem: NewsItem = { ...item, read: false };
  state.news.unshift(fullItem);
  if (state.news.length > MAX_NEWS) state.news.pop();
}

export function generatePassiveNews(state: GameState): void {
  const rng = makeRng(state.seed, state.turn * 13 + 7);

  // 1. Plotki o nadchodzących eventach (mogą być prawdziwe lub fałszywe)
  const upcomingOnce = (eventsData as GameEvent[]).filter(e =>
    e.once &&
    !state.history.includes(e.id) &&
    e.conditions.yearMin !== undefined &&
    e.conditions.yearMin > state.year &&
    e.conditions.yearMin <= state.year + 2
  );

  if (rng.next() < 0.35) {
    const isFake = rng.next() < MISLEADING_RUMOR_CHANCE || upcomingOnce.length === 0;

    if (isFake) {
      addNewsItem(state, {
        id: `rumor_fake_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: rng.pick(FAKE_RUMORS),
        category: 'rumor',
      });
    } else {
      const ev = rng.pick(upcomingOnce);
      const template = rng.pick(RUMOR_TEMPLATES);
      addNewsItem(state, {
        id: `rumor_${state.turn}_${ev.id}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: template.replace('{topic}', ev.title),
        category: 'rumor',
      });
    }
  }

  // 2. Sondaże — co 4 tury w oknie 2 lat przed wyborami
  const electionIn = state.politics.nextParliamentaryElection - state.year;
  if (electionIn <= 2 && electionIn > 0 && state.turn % 4 === 0) {
    const active = activePartiesFor(state);
    if (active.length > 0) {
      const sorted = [...active].sort((a, b) => sizeRank(b, state.year) - sizeRank(a, state.year));
      const leader = sorted[0];
      const second = sorted[1];
      addNewsItem(state, {
        id: `poll_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: `Sondaż: ${leader.name} prowadzi, ${second?.name ?? 'drugie miejsce nieznane'} tuż za nim`,
        body: 'Badanie przeprowadzone na zlecenie lokalnej gazety.',
        category: 'poll',
      });
    }
  }

  // 3. Partie pojawiają się / znikają
  for (const [id, sched] of Object.entries(state.politics.partySchedule)) {
    const p = (partiesData as Party[]).find(x => x.id === id);
    if (!p) continue;

    if (sched.from === state.year && !state.history.includes(`appeared_${id}`)) {
      state.history.push(`appeared_${id}`);
      addNewsItem(state, {
        id: `party_appear_${id}_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: `Powstaje nowe ugrupowanie: ${p.name}`,
        body: `Grupa działaczy ogłasza utworzenie partii.`,
        category: 'party',
      });
    }
    if (sched.to === state.year && sched.to < 9999 && !state.history.includes(`disappeared_${id}`)) {
      state.history.push(`disappeared_${id}`);
      addNewsItem(state, {
        id: `party_disappear_${id}_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: `${p.name} rozwiązuje się`,
        body: `Partia nie zdołała utrzymać struktur.`,
        category: 'party',
      });
    }
  }

  // 4. Własne newsy (flavor)
  const eligibleCustom = (customNewsData as CustomNews[]).filter(c =>
    matchesConditions(state, c.conditions)
  );
  if (eligibleCustom.length > 0 && rng.next() < 0.4) {
    const picked = rng.weighted(eligibleCustom);
    addNewsItem(state, {
      id: `${picked.id}_${state.turn}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: picked.headline,
      body: picked.body,
      category: 'custom',
    });
  }
}

export function activePartiesFor(state: GameState): Party[] {
  return (partiesData as Party[]).filter(p => {
    if (p.isPSL && !state.politics.pslAvailable) return false;
    const sched = state.politics.partySchedule[p.id];
    if (!sched) return false;
    return state.year >= sched.from && state.year <= sched.to;
  });
}

function sizeRank(p: Party, year: number): number {
  const size = getPartySize(p, year);
  return size === 'very_large' ? 5 : size === 'large' ? 4 : size === 'medium' ? 3 : size === 'small' ? 2 : 1;
}

export function addActionableNewsItem(
  state: GameState,
  item: Omit<NewsItem, 'read' | 'resolved'>
): void {
  const fullItem: NewsItem = {
    ...item,
    read: false,
    resolved: false,
  };
  state.news.unshift(fullItem);
  if (state.news.length > MAX_NEWS) state.news.pop();
}

export function processExpiredActions(state: GameState): void {
  for (const item of state.news) {
    if (item.resolved) continue;
    if (!item.choices) continue;
    if (item.expiresAtTurn === undefined) continue;
    if (state.turn < item.expiresAtTurn) continue;

    item.resolved = true;
    item.resolvedChoiceId = '__expired__';

    if (item.onExpireEffects) {
      applyEffects(state, item.onExpireEffects);
    }
  }
}

export function checkMafiaInvitation(state: GameState): void {
  // Warunki bazowe
  if (state.year < 1990) return;
  if (state.phase !== 'chaos') return;
  if (state.ceo.inMafia) return;
  if (state.ceo.flags.includes('zdradzil_mafie')) return;
  if (state.company.reputation.opiniaMafia < MAFIA_INVITATION_THRESHOLD) return;

  // Sprawdź, czy w tej chwili nie ma już aktywnego zaproszenia w skrzynce
  const hasPending = state.news.some(
    n => n.id.startsWith('mafia_invitation_') && !n.resolved
  );
  if (hasPending) return;

  // Odstęp czasowy od poprzedniego zaproszenia
  const refusedBefore =
    state.ceo.flags.includes('mafia_refused') ||
    state.ceo.flags.includes('mafia_ghosted');

  const lastTurn = state.ceo.lastMafiaInvitationTurn ?? -999;
  const gap = state.turn - lastTurn;
  const minGap = refusedBefore ? MAFIA_INVITATION_MIN_GAP_RETRY : MAFIA_INVITATION_MIN_GAP_FIRST;
  if (gap < minGap) return;

  // Losowanie (przy ponownym zaproszeniu tylko 30% szansy na turę)
  const rng = makeRng(state.seed, state.turn * 17 + 5);
  const chance = refusedBefore ? MAFIA_INVITATION_RETRY_CHANCE : 1.0;
  if (rng.next() > chance) return;

  // Wyślij zaproszenie
  const isRetry = refusedBefore;
  addActionableNewsItem(state, {
    id: `mafia_invitation_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: isRetry ? 'Kolejna propozycja' : 'Propozycja nie do odrzucenia',
    body: isRetry
      ? 'Mężczyzna w drogim garniturze znowu się zjawił. Tym razem pyta wprost, czy zmieniłeś zdanie.'
      : 'Do twojego biura przyszedł mężczyzna w drogim garniturze. Bez zapowiedzi. Mówi, że reprezentuje "ludzi, którzy mogą wiele". Proponuje współpracę.',
    category: 'custom',
    expiresAtTurn: state.turn + MAFIA_INVITATION_EXPIRES_IN,
    choices: [
      {
        id: 'accept',
        label: 'Wchodzę w to',
        description: 'Akceptujesz propozycję. Od teraz masz nowych partnerów.',
        effects: {
          joinMafia: true,
          reputation: { opiniaMafia: 10, opiniaPubliczna: -5 },
          flagsAdd: ['w_mafii'],
        },
      },
      {
        id: 'refuse',
        label: 'Odmawiam',
        description: 'Nie chcesz mieć z tym nic wspólnego. Ryzykujesz konsekwencje.',
        effects: {
          reputation: { opiniaMafia: -25 },
          flagsAdd: ['mafia_refused'],
        },
      },
    ],
    onExpireEffects: {
      reputation: { opiniaMafia: -10 },
      flagsAdd: ['mafia_ghosted'],
    },
  });

  state.ceo.lastMafiaInvitationTurn = state.turn;
}

export function checkTaxOfficeNotice(state: GameState): void {
  if (state.skarbowkaVisitTurn !== null) return;
  if (state.company.reputation.opiniaSkarbowa >= SKARBOWKA_THRESHOLD) return;

  // Zapowiedź
  addActionableNewsItem(state, {
    id: `skarbowka_notice_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: 'Wiadomość od księgowej',
    body: 'Panie prezesie, mamy problem. Urząd skarbowy coś węszy. Słyszałam, że szykują kontrolę. Mamy jakieś 3 kwartały, zanim się zjawią.',
    category: 'custom',
    expiresAtTurn: state.turn + SKARBOWKA_PREPARE_TURNS,
    choices: [
      {
        id: 'send_flowers',
        label: 'Wysyłasz kwiaty do urzędu',
        description: `Kosztuje ${FLOWERS_COST} PLN, ale może poprawić nastroje.`,
        effects: {
          stateKonta: -FLOWERS_COST,
          reputation: { opiniaSkarbowa: FLOWERS_BONUS },
        },
      },
      {
        id: 'ignore',
        label: 'Ignorujesz sprawę',
        description: 'Może jakoś to będzie.',
        effects: {
          reputation: { opiniaSkarbowa: -5 },
        },
      },
    ],
    onExpireEffects: {
      reputation: { opiniaSkarbowa: -10 },
    },
  });

  state.skarbowkaVisitTurn = state.turn + SKARBOWKA_PREPARE_TURNS;
}

export function checkEmployeeUnrest(state: GameState): void {
  // Sprawdzamy, czy jest już jakaś wiadomość od pracowników w skrzynce
  const hasPending = state.news.some(n => n.id.startsWith('employee_demand_') && !n.resolved);
  if (hasPending) return;

  // Warunki: mamy pracowników na śmieciówkach/bez umowy ORAZ niska opinia (lub losowy pech)
  const hasWorkers = state.company.employees.bezUmowy > 0 || state.company.employees.zlecenie > 0;
  if (!hasWorkers) return;

  const isUnhappy = state.company.reputation.opiniaPracownicy < 40;
  const rng = makeRng(state.seed, state.turn * 11 + 4);

  // Szansa: 100% jeśli są bardzo nieszczęśliwi, 15% w normalnych warunkach
  const chance = isUnhappy ? 1.0 : 0.15;
  if (rng.next() > chance) return;

  addActionableNewsItem(state, {
    id: `employee_demand_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: 'Niezadowolenie w firmie',
    body: 'Jeden z Twoich najlepszych pracowników przychodzi do Ciebie z ultimatum. "Pracuję tu na śmieciówce od miesięcy. Albo dostaję umowę o pracę, albo odchodzę."',
    category: 'custom',
    expiresAtTurn: state.turn + 2,
    choices: [
      {
        id: 'accept',
        label: 'Daję mu umowę o pracę',
        description: 'Zmieniasz formę zatrudnienia na UOP. Kosztuje to więcej, ale zyskujesz lojalność.',
        effects: {
          employeesDelta: { bezUmowy: -1, uop: 1 },
          reputation: { opiniaPracownicy: 15 }
        }
      },
      {
        id: 'refuse',
        label: 'Odmawiam',
        description: 'Wypadasz na chama. Pracownik odchodzi, a inni patrzą.',
        effects: {
          employeesDelta: { bezUmowy: -1 },
          reputation: { opiniaPracownicy: -20, opiniaPubliczna: -5 }
        }
      }
    ],
    onExpireEffects: {
      employeesDelta: { bezUmowy: -1 },
      reputation: { opiniaPracownicy: -10 }
    }
  });
}
