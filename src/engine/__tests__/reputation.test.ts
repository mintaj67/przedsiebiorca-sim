import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { recomputeReputation, politicianWeight } from '../reputation';
import { MAFIA_PUBLIC_THRESHOLD } from '../constants';
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

describe('recomputeReputation', () => {
  it('zwraca obiekt z polem ogolna', () => {
    const state = makeState();
    const rep = recomputeReputation(state);
    expect(rep).toHaveProperty('ogolna');
    expect(typeof rep.ogolna).toBe('number');
  });

  it('ogolna mieści się w zakresie 0-100', () => {
    const state = makeState();
    const rep = recomputeReputation(state);
    expect(rep.ogolna).toBeGreaterThanOrEqual(0);
    expect(rep.ogolna).toBeLessThanOrEqual(100);
  });

  it('bardzo wysoka opinia mafii szkodzi opinii publicznej', () => {
    const state = makeState();
    state.company.reputation.opiniaMafia = MAFIA_PUBLIC_THRESHOLD + 20;
    state.company.reputation.opiniaMedia = 50;
    state.company.reputation.opiniaPolitycy = 50;

    const rep = recomputeReputation(state);

    // Opinia publiczna nie może być wyższa niż przed kaskadą mafii
    // (dokładna wartość zależy od wag, ale spadek musi być)
    expect(rep.opiniaPubliczna).toBeLessThan(80);
  });

  it('klamruje wartości do 0-100', () => {
    const state = makeState();
    state.company.reputation.opiniaPubliczna = 150;
    state.company.reputation.opiniaBranza = -50;
    state.company.reputation.opiniaPracownicy = 200;

    const rep = recomputeReputation(state);

    for (const key of ['branza', 'opiniaPubliczna', 'opiniaPracownicy', 'opiniaBranza', 'opiniaMafia', 'opiniaMedia', 'opiniaPolitycy', 'ogolna'] as const) {
      expect(rep[key]).toBeGreaterThanOrEqual(0);
      expect(rep[key]).toBeLessThanOrEqual(100);
    }
  });

  it('nie modyfikuje oryginalnego stanu (immutability)', () => {
    const state = makeState();
    const originalRep = { ...state.company.reputation };
    recomputeReputation(state);
    expect(state.company.reputation).toEqual(originalRep);
  });
});

describe('politicianWeight', () => {
  it('zwraca niską wagę gdy gracz nie należy do partii', () => {
    const state = makeState();
    state.ceo.currentPartyId = null;
    const w = politicianWeight(state);
    expect(w).toBeGreaterThanOrEqual(0);
    expect(w).toBeLessThanOrEqual(0.5);
  });

  it('zwraca wyższą wagę gdy partia gracza rządzi', () => {
    const state = makeState();
    state.ceo.currentPartyId = 'pis';
    state.politics.rulingCoalition = ['pis'];
    state.politics.premierId = 'pis';
    const w = politicianWeight(state);
    expect(w).toBeGreaterThan(0.3);
  });
});