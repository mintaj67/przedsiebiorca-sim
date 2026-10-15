import type { GameState, NewsItem, GameEvent, Party } from './types';
import { makeRng } from './rng';
import {
  RUMOR_TEMPLATES,
  MAX_NEWS,
  FAKE_RUMORS,
  MISLEADING_RUMOR_CHANCE,
} from './constants';
import { matchesConditions } from './events';
import eventsData from '../data/events.json';
import partiesData from '../data/parties.json';
import customNewsData from '../data/custom_news.json';

interface CustomNews {
  id: string;
  headline: string;
  body?: string;
  weight: number;
  conditions: GameEvent['conditions'];
}

export function addNewsItem(state: GameState, item: NewsItem): void {
  state.news.unshift(item);
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
      const sorted = [...active].sort((a, b) => sizeRank(b) - sizeRank(a));
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

function sizeRank(p: Party): number {
  return p.size === 'large' ? 3 : p.size === 'medium' ? 2 : 1;
}