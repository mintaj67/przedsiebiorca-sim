import type { GameState, GameEvent, EventConditions } from './types';
import { makeRng } from './rng';
import eventsData from '../data/events.json';

const ALL_EVENTS: GameEvent[] = eventsData as GameEvent[];

export function matchesConditions(state: GameState, c: EventConditions): boolean {
  if (c.yearMin !== undefined && state.year < c.yearMin) return false;
  if (c.yearMax !== undefined && state.year > c.yearMax) return false;
  if (c.phase && !c.phase.includes(state.phase)) return false;
  if (c.difficulty && !c.difficulty.includes(state.difficulty)) return false;
  if (c.party && !c.party.includes(state.ceo.party)) return false;
  if (c.currentPartyId && (!state.ceo.currentPartyId || !c.currentPartyId.includes(state.ceo.currentPartyId))) return false;
  if (c.rulingParty && !c.rulingParty.some(p => state.politics.rulingCoalition.includes(p))) return false;
  if (c.mafiaMember !== undefined && state.ceo.inMafia !== c.mafiaMember) return false;
  if (c.minStateKonta !== undefined && state.company.finances.stateKonta < c.minStateKonta) return false;
  if (c.maxStateKonta !== undefined && state.company.finances.stateKonta > c.maxStateKonta) return false;
  if (c.legalForm && !c.legalForm.includes(state.company.legalForm)) return false;
  if (c.activities && !c.activities.includes(state.company.activity)) return false;
  if (c.flags && !c.flags.every(f => state.ceo.flags.includes(f))) return false;
  if (c.notFlags && c.notFlags.some(f => state.ceo.flags.includes(f))) return false;

  if (c.minReputation) {
    for (const [k, v] of Object.entries(c.minReputation)) {
      if ((state.company.reputation as any)[k] < (v as number)) return false;
    }
  }
  if (c.maxReputation) {
    for (const [k, v] of Object.entries(c.maxReputation)) {
      if ((state.company.reputation as any)[k] > (v as number)) return false;
    }
  }
  return true;
}

export function rollEvents(state: GameState): GameEvent[] {
  const rng = makeRng(state.seed, state.turn);
  const eligible = ALL_EVENTS.filter(e => {
    if (state.history.includes(e.id)) return false;
    return matchesConditions(state, e.conditions);
  });
  if (eligible.length === 0) return [];
  const picked = rng.weighted(eligible);
  return [picked];
}