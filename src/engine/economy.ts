import type { GameState } from './types';
import {
  COMPANY_SIZE_CONFIG,
  BELOW_REQUIRED_WORKERS_PENALTY,
  WORKER_CONFIG,
  SKARBOWKA_DECAY_BEZ_UMOWY,
  SKARBOWKA_DECAY_ZLECENIE,
  SKARBOWKA_GAIN_UOP,
  ACCOUNTANT_COST,
  ACCOUNTANT_BONUS
} from './constants';

const BASE_REVENUE = 5000;
const CZYNSZ = 2500;
const TAX_RATE = 0.15;

// Nowa funkcja: Im więcej pracowników, tym mniejsza wydajność każdego kolejnego (min. 20%)
function calculateWorkerRevenue(count: number, baseRevenue: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    const efficiency = Math.max(0.2, 1 - (i * 0.05)); // 5% spadku za każdego kolejnego pracownika
    total += baseRevenue * efficiency;
  }
  return total;
}

export function tickEconomy(state: GameState): GameState {
  const c = structuredClone(state.company);
  const f = c.finances;

  const baseRevenue = estimateRevenue(c);
  f.wplywy.przychodyZDzialalnosci = baseRevenue;

  f.wydatki.pracownicy =
    c.employees.bezUmowy * WORKER_CONFIG.bezUmowy.wage +
    c.employees.zlecenie * WORKER_CONFIG.zlecenie.wage +
    c.employees.uop      * WORKER_CONFIG.uop.wage;

  f.wydatki.czynsz = CZYNSZ;
  f.wydatki.podatki = Math.max(0, baseRevenue * TAX_RATE);

  f.wydatki.splacaneKredyty = 0;
  for (const loan of c.loans) {
    if (loan.remaining <= 0) continue;
    const installment = loan.remaining / Math.max(1, loan.quartersLeft);
    const interest = loan.remaining * loan.interestRate;
    f.wydatki.splacaneKredyty += installment + interest;
    loan.remaining -= installment;
    loan.quartersLeft -= 1;
  }

  // Logika Skarbówki
  let skarbowkaDelta =
    c.employees.bezUmowy * SKARBOWKA_DECAY_BEZ_UMOWY +
    c.employees.zlecenie * SKARBOWKA_DECAY_ZLECENIE +
    c.employees.uop * SKARBOWKA_GAIN_UOP;

  if (c.hasAccountant) {
    skarbowkaDelta += ACCOUNTANT_BONUS;
    f.wydatki.inne += ACCOUNTANT_COST; // Dodatkowy koszt co turę
  }
  c.reputation.opiniaSkarbowa = Math.max(0, Math.min(100, c.reputation.opiniaSkarbowa + skarbowkaDelta));

  const inflow  = sum(f.wplywy);
  const outflow = sum(f.wydatki);
  f.stateKonta += inflow - outflow;

  // Kara reputacyjna za za mało pracowników
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
  // Używamy nowej funkcji zamiast prostego mnożenia
  const workerRevenue =
    calculateWorkerRevenue(c.employees.bezUmowy, WORKER_CONFIG.bezUmowy.revenue) +
    calculateWorkerRevenue(c.employees.zlecenie, WORKER_CONFIG.zlecenie.revenue) +
    calculateWorkerRevenue(c.employees.uop, WORKER_CONFIG.uop.revenue);
    
  const activityMultiplier = 1 + (c.reputation.branza - 50) / 200;
  return (BASE_REVENUE + workerRevenue) * activityMultiplier;
}

function sum(obj: any): number {
  return Object.values(obj).reduce((a: number, b: any) => a + b, 0);
}