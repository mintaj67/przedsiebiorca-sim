import type { GameState } from './types';
import { COMPANY_SIZE_CONFIG, BELOW_REQUIRED_WORKERS_PENALTY, WORKER_CONFIG } from './constants';

const BASE_REVENUE = 5000;
const CZYNSZ = 2500;
const TAX_RATE = 0.15;

export function tickEconomy(state: GameState): GameState {
  const c = structuredClone(state.company);
  const f = c.finances;

  const baseRevenue = estimateRevenue(c);
  f.aktywa.przychodyZDzialalnosci = baseRevenue;

  f.pasywa.pracownicy =
    c.employees.bezUmowy * WORKER_CONFIG.bezUmowy.wage +
    c.employees.zlecenie * WORKER_CONFIG.zlecenie.wage +
    c.employees.uop       * WORKER_CONFIG.uop.wage;

  f.pasywa.czynsz = CZYNSZ;
  f.pasywa.podatki = Math.max(0, baseRevenue * TAX_RATE);

  f.pasywa.splacaneKredyty = 0;
  for (const loan of c.loans) {
    if (loan.remaining <= 0) continue;
    const installment = loan.remaining / Math.max(1, loan.quartersLeft);
    const interest = loan.remaining * loan.interestRate;
    f.pasywa.splacaneKredyty += installment + interest;
    loan.remaining -= installment;
    loan.quartersLeft -= 1;
  }

  const inflow  = sum(f.aktywa);
  const outflow = sum(f.pasywa);
  f.stateKonta += inflow - outflow;

  const totalWorkers = c.employees.bezUmowy + c.employees.zlecenie + c.employees.uop;
  const requiredWorkers = COMPANY_SIZE_CONFIG[c.size].requiredWorkers;
  if (totalWorkers < requiredWorkers) {
    c.reputation.opiniaBranza = Math.max(0, c.reputation.opiniaBranza - BELOW_REQUIRED_WORKERS_PENALTY);
  }

  state.company = c;

  if (f.stateKonta < 0) {
    state.bankruptWarningTurns = (state.bankruptWarningTurns ?? 0) + 1;
  } else {
    state.bankruptWarningTurns = 0;
  }

  return state;
}

function estimateRevenue(c: GameState['company']): number {
  const workerRevenue =
    c.employees.bezUmowy * WORKER_CONFIG.bezUmowy.revenue +
    c.employees.zlecenie * WORKER_CONFIG.zlecenie.revenue +
    c.employees.uop       * WORKER_CONFIG.uop.revenue;
  const activityMultiplier = 1 + (c.reputation.branza - 50) / 200;
  return (BASE_REVENUE + workerRevenue) * activityMultiplier;
}

function sum(obj: Record<string, number>): number {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}