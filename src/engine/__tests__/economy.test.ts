import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { tickEconomy } from '../economy';
import { WORKER_CONFIG, COMPANY_SIZE_CONFIG, BELOW_REQUIRED_WORKERS_PENALTY } from '../constants';
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
  it('generuje przychód z działalności nawet bez pracowników (CEO sam pracuje)', () => {
    const state = makeState();
    const result = tickEconomy(state);
    expect(result.company.finances.Wplywy.przychodyZDzialalnosci).toBeGreaterThan(0);
  });

  it('pobiera czynsz co turę', () => {
    const state = makeState();
    const result = tickEconomy(state);
    expect(result.company.finances.Wydatki.czynsz).toBeGreaterThan(0);
  });

  it('koszt pracowników = suma stawek wg WORKER_CONFIG', () => {
    const state = makeState();
    state.company.employees.bezUmowy = 2;
    state.company.employees.zlecenie = 3;
    state.company.employees.uop = 1;

    const result = tickEconomy(state);

    const expected =
      2 * WORKER_CONFIG.bezUmowy.wage +
      3 * WORKER_CONFIG.zlecenie.wage +
      1 * WORKER_CONFIG.uop.wage;

    expect(result.company.finances.Wydatki.pracownicy).toBe(expected);
  });

  it('pracownik UOP zarabia więcej niż kosztuje (netto na plus)', () => {
    const state = makeState();
    state.company.employees.uop = 1;

    const result = tickEconomy(state);

    const revenue = result.company.finances.Wplywy.przychodyZDzialalnosci;
    const wages = result.company.finances.Wydatki.pracownicy;

    expect(revenue).toBeGreaterThan(wages);
    expect(WORKER_CONFIG.uop.revenue).toBeGreaterThan(WORKER_CONFIG.uop.wage);
  });

  it('pracownik bez umowy zarabia więcej niż kosztuje (netto na plus)', () => {
    const state = makeState();
    state.company.employees.bezUmowy = 1;

    const result = tickEconomy(state);

    expect(WORKER_CONFIG.bezUmowy.revenue).toBeGreaterThan(WORKER_CONFIG.bezUmowy.wage);
    expect(result.company.finances.Wplywy.przychodyZDzialalnosci).toBeGreaterThan(0);
  });

  it('po turze z dodatnim saldem stanKonta rośnie', () => {
    const state = makeState();
    const before = state.company.finances.stateKonta;

    const result = tickEconomy(state);

    expect(result.company.finances.stateKonta).toBeGreaterThan(before);
  });

  it('resetuje bankruptWarningTurns gdy saldo dodatnie', () => {
    const state = makeState();
    state.bankruptWarningTurns = 2;

    const result = tickEconomy(state);

    expect(result.bankruptWarningTurns).toBe(0);
  });

  it('zwiększa bankruptWarningTurns gdy saldo ujemne', () => {
    const state = makeState();
    state.company.finances.stateKonta = -100_000;
    state.bankruptWarningTurns = 0;

    const result = tickEconomy(state);

    expect(result.bankruptWarningTurns).toBe(1);
  });

  it('kara reputacyjna gdy firma ma mniej pracowników niż wymaga rozmiar', () => {
    const state = makeState({ size: 'medium' });
    // medium wymaga 10 pracowników, a startowy stan ma 10 - obniżamy
    state.company.employees.zlecenie = 0;
    state.company.employees.uop = 0;
    state.company.employees.bezUmowy = 0;
    const repBefore = state.company.reputation.opiniaBranza;

    const result = tickEconomy(state);

    expect(COMPANY_SIZE_CONFIG.medium.requiredWorkers).toBeGreaterThan(0);
    expect(result.company.reputation.opiniaBranza).toBeLessThan(repBefore);
    expect(repBefore - result.company.reputation.opiniaBranza).toBe(BELOW_REQUIRED_WORKERS_PENALTY);
  });

  it('podatki są dodatnie gdy przychód dodatni', () => {
    const state = makeState();
    const result = tickEconomy(state);
    expect(result.company.finances.Wydatki.podatki).toBeGreaterThan(0);
  });
});