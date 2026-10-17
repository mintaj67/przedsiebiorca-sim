import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { matchesConditions } from '../events';
import type { GameState } from '../types';

function makeState(): GameState {
  return createInitialState({
    seed: 'test',
    difficulty: 'medium',
    inPZPR: false,
    activity: 'handel',
    companyName: 'Test',
    suffix: '',
    size: 'micro',
  });
}

describe('matchesConditions', () => {
  it('pusty warunek pasuje do każdego stanu', () => {
    const state = makeState();
    expect(matchesConditions(state, {})).toBe(true);
  });

  it('yearMin wyklucza eventy z wcześniejszych lat', () => {
    const state = makeState();
    state.year = 1990;
    expect(matchesConditions(state, { yearMin: 1995 })).toBe(false);
    expect(matchesConditions(state, { yearMin: 1989 })).toBe(true);
  });

  it('yearMax wyklucza eventy z późniejszych lat', () => {
    const state = makeState();
    state.year = 2000;
    expect(matchesConditions(state, { yearMax: 1995 })).toBe(false);
    expect(matchesConditions(state, { yearMax: 2005 })).toBe(true);
  });

  it('zakres lat działa obustronnie', () => {
    const state = makeState();
    state.year = 1993;
    expect(matchesConditions(state, { yearMin: 1990, yearMax: 1995 })).toBe(true);
    expect(matchesConditions(state, { yearMin: 1995, yearMax: 2000 })).toBe(false);
  });

  it('phase wyklucza eventy z innych faz', () => {
    const state = makeState();
    state.phase = 'chaos';
    expect(matchesConditions(state, { phase: ['duopol'] })).toBe(false);
    expect(matchesConditions(state, { phase: ['chaos'] })).toBe(true);
    expect(matchesConditions(state, { phase: ['chaos', 'duopol'] })).toBe(true);
  });

  it('minStateKonta wyklucza gdy gracz ma za mało', () => {
    const state = makeState();
    state.company.finances.stateKonta = 10_000;
    expect(matchesConditions(state, { minStateKonta: 50_000 })).toBe(false);
    expect(matchesConditions(state, { minStateKonta: 5_000 })).toBe(true);
  });

  it('maxStateKonta wyklucza gdy gracz ma za dużo', () => {
    const state = makeState();
    state.company.finances.stateKonta = 100_000;
    expect(matchesConditions(state, { maxStateKonta: 50_000 })).toBe(false);
    expect(matchesConditions(state, { maxStateKonta: 200_000 })).toBe(true);
  });

  it('mafiaMember true wyklucza graczy spoza mafii', () => {
    const state = makeState();
    state.ceo.inMafia = false;
    expect(matchesConditions(state, { mafiaMember: true })).toBe(false);
    state.ceo.inMafia = true;
    expect(matchesConditions(state, { mafiaMember: true })).toBe(true);
  });

  it('mafiaMember false wyklucza członków mafii', () => {
    const state = makeState();
    state.ceo.inMafia = true;
    expect(matchesConditions(state, { mafiaMember: false })).toBe(false);
  });

  it('flags wymaga wszystkich podanych flag', () => {
    const state = makeState();
    state.ceo.flags = ['a', 'b', 'c'];
    expect(matchesConditions(state, { flags: ['a'] })).toBe(true);
    expect(matchesConditions(state, { flags: ['a', 'b'] })).toBe(true);
    expect(matchesConditions(state, { flags: ['a', 'z'] })).toBe(false);
  });

  it('notFlags wyklucza gdy gracz ma którąkolwiek z flag', () => {
    const state = makeState();
    state.ceo.flags = ['a', 'b'];
    expect(matchesConditions(state, { notFlags: ['z'] })).toBe(true);
    expect(matchesConditions(state, { notFlags: ['a'] })).toBe(false);
    expect(matchesConditions(state, { notFlags: ['z', 'a'] })).toBe(false);
  });

  it('minReputation wyklucza gdy reputacja za niska', () => {
    const state = makeState();
    state.company.reputation.opiniaPubliczna = 40;
    expect(matchesConditions(state, { minReputation: { opiniaPubliczna: 50 } })).toBe(false);
    expect(matchesConditions(state, { minReputation: { opiniaPubliczna: 30 } })).toBe(true);
  });

  it('maxReputation wyklucza gdy reputacja za wysoka', () => {
    const state = makeState();
    state.company.reputation.opiniaPubliczna = 80;
    expect(matchesConditions(state, { maxReputation: { opiniaPubliczna: 70 } })).toBe(false);
    expect(matchesConditions(state, { maxReputation: { opiniaPubliczna: 90 } })).toBe(true);
  });

  it('party wyklucza gdy gracz ma inną przynależność startową', () => {
    const state = makeState();
    state.ceo.party = 'none';
    expect(matchesConditions(state, { party: ['PZPR'] })).toBe(false);
    expect(matchesConditions(state, { party: ['none'] })).toBe(true);
  });

  it('currentPartyId wyklucza gdy gracz jest w innej partii', () => {
    const state = makeState();
    state.ceo.currentPartyId = 'sld';
    expect(matchesConditions(state, { currentPartyId: ['pis'] })).toBe(false);
    expect(matchesConditions(state, { currentPartyId: ['sld', 'pis'] })).toBe(true);
  });

  it('currentPartyId wyklucza bezpartyjnych gdy lista nie zawiera null', () => {
    const state = makeState();
    state.ceo.currentPartyId = null;
    expect(matchesConditions(state, { currentPartyId: ['sld'] })).toBe(false);
  });
});