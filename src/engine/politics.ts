import type {
  GameState,
  ElectionResult,
  Party,
  Ideology,
  PresidentialCandidate,
  PresidentialResult,
} from './types';
import { COALITION_RULES, CANDIDATE_FIRST_NAMES, CANDIDATE_LAST_NAMES } from './constants';
import { makeRng } from './rng';
import partiesData from '../data/parties.json';
import presidentialElectionsData from '../data/presidential_elections.json';

const SEATS_TOTAL = 460;

interface PredefinedCandidate {
  id: string;
  name: string;
  partyId: string | null;
  partyLabel?: string;
  minPercent: number;
  maxPercent: number;
  typicalPercent: number;
}

interface PredefinedElection {
  year: number;
  candidates: PredefinedCandidate[];
  secondRoundWinnerId?: string;
  secondRoundChance?: number;
}

export function tickPolitics(state: GameState): GameState {
  if (state.year >= state.politics.nextParliamentaryElection) {
    state.politics = runParliamentaryElection(state);
    state.politics.nextParliamentaryElection += 4;
    state.lastElectionResult = state.politics.lastElection;
  }
  if (state.year >= state.politics.nextPresidentialElection) {
    const result = computePresidentialElection(state);
    state.lastPresidentialResult = result;
    state.politics = {
      ...state.politics,
      president: {
        id: result.winner.id,
        name: result.winner.name,
        partyId: result.winner.partyId,
        termStart: state.year,
        termEnd: state.year + 5,
      },
      nextPresidentialElection: state.politics.nextPresidentialElection + 5,
    };
  }
  return state;
}

function activeParties(state: GameState): Party[] {
  return (partiesData as Party[]).filter(p => {
    if (p.isPSL && !state.politics.pslAvailable) return false;
    const sched = state.politics.partySchedule[p.id];
    if (!sched) return false;
    return state.year >= sched.from && state.year <= sched.to;
  });
}

function randomName(rng: ReturnType<typeof makeRng>): string {
  return `${rng.pick(CANDIDATE_FIRST_NAMES)} ${rng.pick(CANDIDATE_LAST_NAMES)}`;
}

function computePresidentialElection(state: GameState): PresidentialResult {
  const predefined = (presidentialElectionsData as PredefinedElection[])
    .find(e => e.year === state.year);

  if (predefined) {
    return computeFromPredefined(state, predefined);
  }
  return computeRandomElection(state);
}

function computeFromPredefined(state: GameState, pre: PredefinedElection): PresidentialResult {
  const rng = makeRng(state.seed, state.year * 100 + 2);

  const candidates: PresidentialCandidate[] = pre.candidates.map(c => {
    // Trzy rzuty, uśrednione — daje rozkład dzwonowy wokół środka
    const mid = (c.minPercent + c.maxPercent) / 2;
    const pull = c.typicalPercent - mid;
    const rolls = (rng.next() + rng.next() + rng.next()) / 3;
    const base = c.minPercent + (c.maxPercent - c.minPercent) * rolls;
    const value = Math.max(c.minPercent, Math.min(c.maxPercent, base + pull));

   return {
  id: c.id,
  name: c.name,
  partyId: c.partyId,
  partyLabel: c.partyLabel ?? (c.partyId ? c.partyId.replace(/_/g, ' ') : 'niezależny'),
  votesPercent: value,
    };
  });

  // Normalizacja do 100%
  const total = candidates.reduce((s, c) => s + c.votesPercent, 0);
  for (const c of candidates) c.votesPercent = (c.votesPercent / total) * 100;
  candidates.sort((a, b) => b.votesPercent - a.votesPercent);

  let winner = candidates[0];
  let secondRound = false;
  let secondRoundCandidates: PresidentialCandidate[] | undefined;

  if (candidates.length > 1 && candidates[0].votesPercent < 50) {
    secondRound = true;
    const c1 = candidates[0];
    const c2 = candidates[1];
    secondRoundCandidates = [c1, c2];

    if (pre.secondRoundWinnerId) {
      const forced = candidates.find(c => c.id === pre.secondRoundWinnerId);
      if (forced && (forced.id === c1.id || forced.id === c2.id)) {
        const chance = pre.secondRoundChance ?? 1.0;
        winner = rng.next() < chance ? forced : (forced.id === c1.id ? c2 : c1);
      }
    } else {
      const diff = (c1.votesPercent - c2.votesPercent) / 100;
      const c1Chance = Math.min(0.85, Math.max(0.5, 0.5 + diff + 0.1));
      winner = rng.next() < c1Chance ? c1 : c2;
    }
  }

  return {
    year: state.year,
    candidates,
    winner,
    secondRound,
    secondRoundCandidates,
  };
}

function computeRandomElection(state: GameState): PresidentialResult {
  const rng = makeRng(state.seed, state.year * 100 + 2);
  const parties = activeParties(state);

  const candidates: PresidentialCandidate[] = [];

  for (const p of parties) {
    const base = p.size === 'large' ? 0.28 : p.size === 'medium' ? 0.14 : 0.06;
    const noise = (rng.next() - 0.5) * 0.08;
    const strength = Math.max(0.02, base + noise);
    candidates.push({
      id: `cand_${p.id}_${state.year}`,
      name: randomName(rng),
      partyId: p.id,
      votesPercent: strength * 100,
    });
  }

  const indepCount = rng.next() < 0.5 ? 1 : 2;
  for (let i = 0; i < indepCount; i++) {
    candidates.push({
      id: `cand_indep_${state.year}_${i}`,
      name: randomName(rng),
      partyId: null,
      votesPercent: (0.05 + rng.next() * 0.10) * 100,
    });
  }

  const total = candidates.reduce((s, c) => s + c.votesPercent, 0);
  for (const c of candidates) c.votesPercent = (c.votesPercent / total) * 100;
  candidates.sort((a, b) => b.votesPercent - a.votesPercent);

  let winner = candidates[0];
  let secondRound = false;
  let secondRoundCandidates: PresidentialCandidate[] | undefined;

  if (candidates.length > 1 && candidates[0].votesPercent < 50) {
    secondRound = true;
    const c1 = candidates[0];
    const c2 = candidates[1];
    secondRoundCandidates = [c1, c2];
    const diff = (c1.votesPercent - c2.votesPercent) / 100;
    const c1Chance = Math.min(0.85, Math.max(0.5, 0.5 + diff + 0.1));
    winner = rng.next() < c1Chance ? c1 : c2;
  }

  return {
    year: state.year,
    candidates,
    winner,
    secondRound,
    secondRoundCandidates,
  };
}

function runParliamentaryElection(state: GameState) {
  const rng = makeRng(state.seed, state.year * 100 + 1);
  const parties = activeParties(state);
  const seats: Record<string, number> = {};
  let remaining = SEATS_TOTAL;

  for (const p of parties) {
    const base = p.size === 'large' ? 0.25 : p.size === 'medium' ? 0.12 : 0.05;
    const noise = (rng.next() - 0.5) * 0.1;
    const share = Math.max(0, base + noise);
    const s = Math.floor(share * SEATS_TOTAL);
    seats[p.id] = s;
    remaining -= s;
  }
  if (parties.length > 0) {
    const largest = parties.reduce((a, b) => (seats[a.id] > seats[b.id] ? a : b));
    seats[largest.id] += remaining;
  }

  const coalition = formCoalition(parties, seats);
  const premier = coalition[0] ?? null;

  const result: ElectionResult = {
    year: state.year,
    seats,
    coalition,
    premierId: premier,
  };
  return {
    ...state.politics,
    parties,
    lastElection: result,
    rulingCoalition: coalition,
    premierId: premier,
  };
}

function formCoalition(parties: Party[], seats: Record<string, number>): string[] {
  const sorted = [...parties].sort((a, b) => seats[b.id] - seats[a.id]);
  const coalition: string[] = [];
  let total = 0;

  for (const p of sorted) {
    if (total >= SEATS_TOTAL / 2 + 1) break;
    if (coalition.length === 0) {
      coalition.push(p.id);
      total += seats[p.id];
      continue;
    }
    const canJoin = coalition.some(memberId => {
      const member = parties.find(x => x.id === memberId)!;
      return canCoalition(member.ideology, p.ideology);
    });
    if (canJoin) {
      coalition.push(p.id);
      total += seats[p.id];
    }
  }
  return coalition;
}

export function canCoalition(a: Ideology, b: Ideology): boolean {
  if (a === b) return true;
  return COALITION_RULES[a].includes(b) || COALITION_RULES[b].includes(a);
}