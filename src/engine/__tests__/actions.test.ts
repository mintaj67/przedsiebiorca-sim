import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import {
  applyHire, applyLoan, applyChangeActivity, applyJoinParty,
  applyLeaveParty, applyEmergencyLoan,
} from '../actions';
import { WORKER_CONFIG, ACTIVITY_MAFIA_BASELINE, MAX_PARTY_SWITCHES_PER_PHASE } from '../constants';
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

describe('applyHire', () => {
  it('zwiększa liczbę pracowników', () => {
    const state = makeState();
    const result = applyHire(state, 'zlecenie', 3);
    expect(result.company.employees.zlecenie).toBe(3);
  });

  it('nie pozwala zejść poniżej zera', () => {
    const state = makeState();
    const result = applyHire(state, 'zlecenie', -5);
    expect(result.company.employees.zlecenie).toBe(0);
  });

  it('przy zwolnieniu UOP zabiera odprawę z kasy', () => {
    const state = makeState();
    state.company.employees.uop = 2;
    const cashBefore = state.company.finances.stateKonta;

    const result = applyHire(state, 'uop', -2);

    const expectedSeverance = 2 * WORKER_CONFIG.uop.severance;
    expect(result.company.finances.stateKonta).toBe(cashBefore - expectedSeverance);
  });

  it('nie zwalnia UOP gdy nie stać na odprawę', () => {
    const state = makeState();
    state.company.employees.uop = 5;
    state.company.finances.stateKonta = 1000;

    const result = applyHire(state, 'uop', -5);

    expect(result.company.employees.uop).toBe(5);
    expect(result.company.finances.stateKonta).toBe(1000);
  });

  it('zwolnienie bez umowy obniża opinię pracowników', () => {
    const state = makeState();
    state.company.employees.bezUmowy = 3;
    const repBefore = state.company.reputation.opiniaPracownicy;

    const result = applyHire(state, 'bezUmowy', -2);

    expect(result.company.reputation.opiniaPracownicy).toBeLessThan(repBefore);
  });

  it('zwolnienie UOP nie obniża opinii pracowników (bo jest odprawa)', () => {
    const state = makeState();
    state.company.employees.uop = 2;
    state.company.finances.stateKonta = 100_000;
    const repBefore = state.company.reputation.opiniaPracownicy;

    const result = applyHire(state, 'uop', -1);

    expect(result.company.reputation.opiniaPracownicy).toBe(repBefore);
  });
});

describe('applyLoan', () => {
  it('zwiększa stan konta o kwotę kredytu', () => {
    const state = makeState();
    const before = state.company.finances.stateKonta;

    const result = applyLoan(state, 'bank', 20_000);

    expect(result.company.finances.stateKonta).toBe(before + 20_000);
  });

  it('dodaje kredyt do listy', () => {
    const state = makeState();
    const result = applyLoan(state, 'bank', 20_000);
    expect(result.company.loans).toHaveLength(1);
  });

  it('kredyt z szarej strefy ma wyższe odsetki niż bankowy', () => {
    const state = makeState();
    const bank = applyLoan(state, 'bank', 20_000);
    const strefa = applyLoan(state, 'szara_strefa', 20_000);

    expect(strefa.company.loans[0].interestRate).toBeGreaterThan(
      bank.company.loans[0].interestRate
    );
  });
});

describe('applyChangeActivity', () => {
  it('zmienia działalność firmy', () => {
    const state = makeState();
    state.turn = 10; // minęło dość tur
    const result = applyChangeActivity(state, 'it');
    expect(result.company.activity).toBe('it');
  });

  it('resetuje opinię mafii do baseline nowej branży', () => {
    const state = makeState();
    state.turn = 10;
    const result = applyChangeActivity(state, 'windykacja');
    expect(result.company.reputation.opiniaMafia).toBe(
      ACTIVITY_MAFIA_BASELINE.windykacja
    );
  });

  it('nie pozwala zmienić działalności w cooldownie', () => {
    const state = makeState();
    state.turn = 1;
    state.company.lastActivityChangeTurn = 0;
    const result = applyChangeActivity(state, 'it');
    expect(result.company.activity).toBe('handel');
  });
});

describe('applyJoinParty / applyLeaveParty', () => {
  it('dołączenie do partii ustawia currentPartyId', () => {
    const state = makeState();
    const result = applyJoinParty(state, 'sld');
    expect(result.ceo.currentPartyId).toBe('sld');
  });

  it('dołączenie do partii zwiększa licznik przefarbowań', () => {
    const state = makeState();
    const result = applyJoinParty(state, 'sld');
    expect(result.ceo.partySwitchesByPhase.chaos).toBe(1);
  });

  it('nie pozwala przekroczyć limitu przefarbowań', () => {
    const state = makeState();
    state.ceo.partySwitchesByPhase.chaos = MAX_PARTY_SWITCHES_PER_PHASE;
    const result = applyJoinParty(state, 'sld');
    expect(result.ceo.currentPartyId).toBeNull();
  });

  it('opuszczenie partii ustawia currentPartyId na null', () => {
    const state = makeState();
    state.ceo.currentPartyId = 'sld';
    const result = applyLeaveParty(state);
    expect(result.ceo.currentPartyId).toBeNull();
  });
});

describe('applyEmergencyLoan', () => {
  it('dodaje 50 000 PLN do konta', () => {
    const state = makeState();
    const before = state.company.finances.stateKonta;
    const result = applyEmergencyLoan(state);
    expect(result.company.finances.stateKonta).toBe(before + 50_000);
  });

  it('resetuje bankruptWarningTurns', () => {
    const state = makeState();
    state.bankruptWarningTurns = 2;
    const result = applyEmergencyLoan(state);
    expect(result.bankruptWarningTurns).toBe(0);
  });
});