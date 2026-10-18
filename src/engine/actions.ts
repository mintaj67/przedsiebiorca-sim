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
  if (source === 'bank') s.company.finances.Wplywy.srodkiZKredytow += amount;
  else s.company.finances.Wplywy.dofinansowaniaSzaraStrefa += amount;
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

export function applyEffects(state: GameState, e: EventEffects) {
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      (state.company.reputation as any)[k] = clamp((state.company.reputation as any)[k] + (v as number));
    }
  }
  if (e.stateKonta) state.company.finances.stateKonta += e.stateKonta;
  if (e.Wplywy) for (const [k, v] of Object.entries(e.Wplywy)) {
    (state.company.finances.Wplywy as any)[k] += v as number;
  }
  if (e.Wydatki) for (const [k, v] of Object.entries(e.Wydatki)) {
    (state.company.finances.Wydatki as any)[k] += v as number;
  }
  if (e.flagsAdd) state.ceo.flags.push(...e.flagsAdd);
  if (e.flagsRemove) state.ceo.flags = state.ceo.flags.filter(f => !e.flagsRemove!.includes(f));
  if (e.joinMafia) state.ceo.inMafia = true;
  if (e.leaveMafia) state.ceo.inMafia = false;
  if (e.setParty) state.ceo.party = e.setParty;
  if (e.setCurrentPartyId) state.ceo.currentPartyId = e.setCurrentPartyId;
}

export function toggleAccountant(state: GameState): GameState {
  const s = structuredClone(state);
  s.company.hasAccountant = !s.company.hasAccountant;
  return s;
}