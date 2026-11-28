import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { tickEconomy, scaleByInflation } from '../economy';
import { WORKER_CONFIG } from '../constants';
import type { GameState } from '../types';

function makeState(overrides: Partial<Parameters<typeof createInitialState>[0]> = {}): GameState {
  return createInitialState({
    seed: 'test',
    difficulty: 'medium',
    inPZPR: false,
    activity: 'handel',
    companyName: 'Test',
    suffix: '',
    size: 'micro',
    ...overrides,
  });
}

describe('tickEconomy', () => {
  it('nie generuje darmowego przychodu z działalności przy bezczynności', () => {
    const state = makeState();
    const result = tickEconomy(state);
    expect(result.company.finances.wplywy.przychodyZDzialalnosci).toBe(0);
  });

  it('pobiera czynsz co turę i obniża stan konta przy braku sprzedaży', () => {
    const state = makeState();
    const before = state.company.finances.stanKonta;
    const result = tickEconomy(state);
    expect(result.company.finances.wydatki.czynsz).toBeGreaterThan(0);
    expect(result.company.finances.stanKonta).toBe(before - result.company.finances.wydatki.czynsz);
  });

  it('koszt pracowników = suma stawek wg WORKER_CONFIG', () => {
    const state = makeState();
    state.company.employees.bezUmowy = 2;
    state.company.employees.zlecenie = 3;
    state.company.employees.uop = 1;

    const expected = scaleByInflation(
      2 * WORKER_CONFIG.bezUmowy.wage +
      3 * WORKER_CONFIG.zlecenie.wage +
      1 * WORKER_CONFIG.uop.wage,
      state
    );

    const result = tickEconomy(state);

    expect(result.company.finances.wydatki.pracownicy).toBe(expected);
  });

  it('nie nalicza podatku gdy przychód z działalności wynosi 0', () => {
    const state = makeState();
    const result = tickEconomy(state);
    expect(result.company.finances.wydatki.podatki).toBe(0);
  });

  it('nalicza 15% podatku od faktycznych przychodów z działalności w kwartale', () => {
    const state = makeState();
    state.company.finances.wplywy.przychodyZDzialalnosci = 10_000;

    const result = tickEconomy(state);

    expect(result.company.finances.wydatki.podatki).toBe(1500);
  });

  it('resetuje bankruptWarningTurns gdy saldo dodatnie', () => {
    const state = makeState();
    state.bankruptWarningTurns = 2;

    const result = tickEconomy(state);

    expect(result.bankruptWarningTurns).toBe(0);
  });

  it('zwiększa bankruptWarningTurns gdy saldo ujemne', () => {
    const state = makeState();
    state.company.finances.stanKonta = -100_000;
    state.bankruptWarningTurns = 0;

    const result = tickEconomy(state);

    expect(result.bankruptWarningTurns).toBe(1);
  });
});