import type { GameState, ContractType, Pace, EventEffects } from './types';
import {
  ACTIVITY_REPUTATION,
  MAX_PARTY_SWITCHES_PER_PHASE,
  ACTIVITY_CHANGE_COOLDOWN,
  BANKRUPT_EMERGENCY_LOAN,
  WORKER_CONFIG,
  ACTIVITY_MAFIA_BASELINE,
} from './constants';
import { recomputeReputation } from './reputation';

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function applyHire(state: GameState, contract: ContractType, delta: number): GameState {
  const s = structuredClone(state);
  const current = s.company.employees[contract];
  const newCount = Math.max(0, current + delta);
  const actualDelta = newCount - current;

  if (actualDelta < 0 && contract === 'uop') {
    const fired = Math.abs(actualDelta);
    const severance = fired * WORKER_CONFIG.uop.severance;
    if (s.company.finances.stateKonta < severance) {
      return s;
    }
    s.company.finances.stateKonta -= severance;
  }

  if (actualDelta < 0 && contract !== 'uop') {
    const fired = Math.abs(actualDelta);
    s.company.reputation.opiniaPracownicy = Math.max(
      0,
      s.company.reputation.opiniaPracownicy - fired * 2
    );
  }

  if (actualDelta > 0) {
    const hired = actualDelta;
    const repImpact = WORKER_CONFIG[contract].reputationImpact;
    s.company.reputation.opiniaPracownicy = clamp(
      s.company.reputation.opiniaPracownicy + repImpact * hired
    );
  }

  s.company.employees[contract] = newCount;
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function applyLoan(state: GameState, source: 'bank' | 'szara_strefa', amount: number): GameState {
  const s = structuredClone(state);
  const rate = source === 'bank' ? 0.03 : 0.07;
  s.company.loans.push({
    id: `loan_${s.turn}_${s.company.loans.length}`,
    source,
    principal: amount,
    remaining: amount,
    interestRate: rate,
    quartersLeft: 12,
  });
  s.company.finances.stateKonta += amount;
  if (source === 'bank') s.company.finances.wplywy.srodkiZKredytow += amount;
  else s.company.finances.wplywy.dofinansowaniaSzaraStrefa += amount;
  return s;
}

export function applyChangeActivity(state: GameState, activity: string): GameState {
  const s = structuredClone(state);
  if (s.turn - s.company.lastActivityChangeTurn < ACTIVITY_CHANGE_COOLDOWN) return s;
  const oldBranza = s.company.reputation.branza;
  s.company.activity = activity;
  s.company.reputation.branza = ACTIVITY_REPUTATION[activity] ?? 50;
  s.company.lastActivityChangeTurn = s.turn;
  const delta = s.company.reputation.branza - oldBranza;
  s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza + delta * 0.3);
  s.company.reputation = recomputeReputation(s);
  s.company.reputation.opiniaMafia = ACTIVITY_MAFIA_BASELINE[activity] ?? 25;
  return s;
}

export function applyJoinParty(state: GameState, partyId: string): GameState {
  const s = structuredClone(state);
  if (s.ceo.partySwitchesByPhase[s.phase] >= MAX_PARTY_SWITCHES_PER_PHASE) return s;
  s.ceo.currentPartyId = partyId;
  s.ceo.partySwitchesByPhase[s.phase] += 1;
  s.company.reputation.opiniaPolitycy = clamp(s.company.reputation.opiniaPolitycy - 5);
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function applyLeaveParty(state: GameState): GameState {
  const s = structuredClone(state);
  s.ceo.currentPartyId = null;
  return s;
}

export function applyEmergencyLoan(state: GameState): GameState {
  const s = structuredClone(state);
  s.company.loans.push({
    id: `emergency_${s.turn}`,
    source: 'bank',
    principal: BANKRUPT_EMERGENCY_LOAN.amount,
    remaining: BANKRUPT_EMERGENCY_LOAN.amount,
    interestRate: BANKRUPT_EMERGENCY_LOAN.interestRate,
    quartersLeft: BANKRUPT_EMERGENCY_LOAN.quartersLeft,
  });
  s.company.finances.stateKonta += BANKRUPT_EMERGENCY_LOAN.amount;
  s.bankruptWarningTurns = 0;
  return s;
}

export function applySetPace(state: GameState, pace: Pace): GameState {
  const s = structuredClone(state);
  s.pace = pace;
  return s;
}

export function buyOfficeItem(state: GameState, itemId: string, price: number): GameState {
  const s = structuredClone(state);
  if (s.company.finances.stateKonta < price) return s; // Brak kasy
  if (s.company.inventory.includes(itemId)) return s; // Już to masz
  
  s.company.finances.stateKonta -= price;
  s.company.inventory.push(itemId);
  return s;
}

export function applyEffects(state: GameState, e: EventEffects) {
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      (state.company.reputation as any)[k] = clamp((state.company.reputation as any)[k] + (v as number));
    }
  }
  if (e.stateKonta) state.company.finances.stateKonta += e.stateKonta;
  if (e.wplywy) for (const [k, v] of Object.entries(e.wplywy)) {
    (state.company.finances.wplywy as any)[k] += v as number;
  }
  if (e.wydatki) for (const [k, v] of Object.entries(e.wydatki)) {
    (state.company.finances.wydatki as any)[k] += v as number;
  }
  if (e.flagsAdd) state.ceo.flags.push(...e.flagsAdd);
  if (e.flagsRemove) state.ceo.flags = state.ceo.flags.filter(f => !e.flagsRemove!.includes(f));
  if (e.joinMafia) state.ceo.inMafia = true;
  if (e.leaveMafia) state.ceo.inMafia = false;
  if (e.setParty) state.ceo.party = e.setParty;
  if (e.setCurrentPartyId) state.ceo.currentPartyId = e.setCurrentPartyId;
  if (e.divideFinances) {
    const div = (n: number) => Math.round((n / 10000) * 100) / 100;
    
    state.company.finances.stateKonta = div(state.company.finances.stateKonta);
    
    const wplywy = (state.company.finances as any).wplywy || (state.company.finances as any).aktywa;
    if (wplywy) {
      for (const k in wplywy) wplywy[k] = div(wplywy[k]);
    }
    
    const wydatki = (state.company.finances as any).wydatki || (state.company.finances as any).pasywa;
    if (wydatki) {
      for (const k in wydatki) wydatki[k] = div(wydatki[k]);
    }

    for (const loan of state.company.loans) {
      loan.principal = div(loan.principal);
      loan.remaining = div(loan.remaining);
    }
  }
  if (e.employeesDelta) {
    if (e.employeesDelta.bezUmowy) state.company.employees.bezUmowy = Math.max(0, state.company.employees.bezUmowy + e.employeesDelta.bezUmowy);
    if (e.employeesDelta.zlecenie) state.company.employees.zlecenie = Math.max(0, state.company.employees.zlecenie + e.employeesDelta.zlecenie);
    if (e.employeesDelta.uop) state.company.employees.uop = Math.max(0, state.company.employees.uop + e.employeesDelta.uop);
  }
   if (e.addItem && !state.company.inventory.includes(e.addItem)) {
    state.company.inventory.push(e.addItem);
  }   
}

export function toggleAccountant(state: GameState): GameState {
  const s = structuredClone(state);
  s.company.hasAccountant = !s.company.hasAccountant;
  return s;
}