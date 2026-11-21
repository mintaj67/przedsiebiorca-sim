import type { GameState, Wplywy, Wydatki } from './types';
import {
  BELOW_REQUIRED_WORKERS_PENALTY,
  WORKER_CONFIG,
  SKARBOWKA_DECAY_BEZ_UMOWY,
  SKARBOWKA_DECAY_ZLECENIE,
  SKARBOWKA_GAIN_UOP,
  ACCOUNTANT_COST,
  ACCOUNTANT_BONUS,
} from './constants';
import {
  getCompanyActivities,
  getCategoryIdsForActivities,
  getRequiredWorkers,
} from './activityHelper';
import { makeRng } from './rng';

const BASE_REVENUE = 5000;
const CZYNSZ = 2500;
const TAX_RATE = 0.15;

export const INITIAL_INFLATION_RATE = 36;
export const INITIAL_PRICE_INDEX = 0.25;

export function getPriceIndex(state: GameState): number {
  const idx = state.macroStats?.priceIndex;
  return typeof idx === 'number' && Number.isFinite(idx) && idx > 0 ? idx : 1;
}

export function getInflationRate(state: GameState): number {
  const rate = state.macroStats?.inflationRate;
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : 5;
}

export function scaleByInflation(amount: number, state: GameState): number {
  return Math.round(amount * getPriceIndex(state));
}

/**
 * Kwartalne oprocentowanie nowego kredytu zależne od bieżącej rocznej stopy inflacji.
 * Bank: marża 1.5% + 85% inflacji kwartalnej (min. 2%, max. 15%).
 * Szara strefa: +4.5 p.p. ponad bank.
 */
export function getLoanQuarterlyRate(
  source: 'bank' | 'szara_strefa',
  annualInflationRate: number
): number {
  const safeAnnual = Math.max(0, annualInflationRate);
  const quarterlyInflation = Math.pow(1 + safeAnnual / 100, 0.25) - 1;
  const bankRate = Math.min(0.15, Math.max(0.02, 0.015 + quarterlyInflation * 0.85));
  const raw = source === 'bank' ? bankRate : bankRate + 0.045;
  return Math.round(raw * 1000) / 1000;
}

function getTargetInflationForYear(year: number): number {
  if (year <= 1989) return 36;
  if (year === 1990) return 42;
  if (year === 1991) return 30;
  if (year === 1992) return 22;
  if (year === 1993) return 18;
  if (year === 1994) return 14;
  if (year === 1995) return 11;
  if (year === 1996) return 9;
  if (year === 1997) return 7.5;
  if (year === 1998) return 6;
  if (year === 1999) return 5;
  if (year === 2000) return 4.5;
  if (year === 2001) return 3.5;
  return 3.0;
}

function calculateWorkerRevenue(count: number, baseRevenue: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    const efficiency = Math.max(0.2, 1 - i * 0.05);
    total += baseRevenue * efficiency;
  }
  return total;
}

export function tickEconomy(state: GameState): GameState {
  const oldProfitability = state.profitabilityScore;
  const c = structuredClone(state.company);
  const f = c.finances;
  const priceIndex = getPriceIndex(state);

  const baseRevenue = Math.round(estimateRevenue(c) * priceIndex);
  f.wplywy.przychodyZDzialalnosci = baseRevenue;

  const rawWages =
    c.employees.bezUmowy * WORKER_CONFIG.bezUmowy.wage +
    c.employees.zlecenie * WORKER_CONFIG.zlecenie.wage +
    c.employees.uop      * WORKER_CONFIG.uop.wage;

  f.wydatki.pracownicy = Math.round(rawWages * priceIndex);
  f.wydatki.czynsz = Math.round(CZYNSZ * priceIndex);
  f.wydatki.podatki = Math.max(0, Math.round(baseRevenue * TAX_RATE));

  // Raty zaciągniętych kredytów pozostają nominalne (inflacja realnie zmniejsza stare długi)
  f.wydatki.splacaneKredyty = 0;
  for (const loan of c.loans) {
    if (loan.remaining <= 0) continue;
    const installment = loan.remaining / Math.max(1, loan.quartersLeft);
    const interest = loan.remaining * loan.interestRate;
    f.wydatki.splacaneKredyty += Math.round(installment + interest);
    loan.remaining = Math.max(0, Math.round(loan.remaining - installment));
    loan.quartersLeft -= 1;
  }

  let skarbowkaDelta =
    c.employees.bezUmowy * SKARBOWKA_DECAY_BEZ_UMOWY +
    c.employees.zlecenie * SKARBOWKA_DECAY_ZLECENIE +
    c.employees.uop      * SKARBOWKA_GAIN_UOP;

  if (c.hasAccountant) {
    skarbowkaDelta += ACCOUNTANT_BONUS;
    f.wydatki.inne = Math.round(ACCOUNTANT_COST * priceIndex);
  } else {
    f.wydatki.inne = 0;
  }

  c.reputation.opiniaSkarbowa = Math.max(0, Math.min(100, c.reputation.opiniaSkarbowa + skarbowkaDelta));

  const inflow = sum(f.wplywy) - f.wplywy.srodkiZKredytow - f.wplywy.dofinansowaniaSzaraStrefa;
  const outflow = sum(f.wydatki);
  f.stanKonta = Math.round(f.stanKonta + inflow - outflow);

  const totalWorkers = c.employees.bezUmowy + c.employees.zlecenie + c.employees.uop;
  const activeCategories = getCategoryIdsForActivities(getCompanyActivities(c));
  const requiredWorkers = getRequiredWorkers(c.size, activeCategories.length);

  if (totalWorkers < requiredWorkers) {
    c.reputation.opiniaBranza = Math.max(0, c.reputation.opiniaBranza - BELOW_REQUIRED_WORKERS_PENALTY);
  }

  if (state.ceo.flags.includes('hipnoza_dziala')) {
    c.finances.stanKonta += Math.round(5000 * priceIndex);
  }
  if (state.ceo.flags.includes('hipnoza_nie_dziala')) {
    c.finances.stanKonta -= Math.round(5000 * priceIndex);
  }

  state.company = c;

  if (f.stanKonta < 0) {
    state.bankruptWarningTurns = (state.bankruptWarningTurns ?? 0) + 1;
  } else {
    state.bankruptWarningTurns = 0;
  }

  let score = 50;

  if (c.size === 'micro') score += 10;
  else if (c.size === 'small') score += 5;
  else if (c.size === 'medium') score -= 5;
  else if (c.size === 'large') score -= 10;
  else if (c.size === 'very_large') score -= 15;
  else if (c.size === 'corporation') score -= 20;

  if (f.wydatki.pracownicy > 0) {
    const ratio = f.wplywy.przychodyZDzialalnosci / f.wydatki.pracownicy;
    score += Math.min(20, (ratio - 1) * 10);
  }

  const avgRep = (c.reputation.opiniaBranza + c.reputation.opiniaPubliczna) / 2;
  score += (avgRep - 50) / 2;

  state.profitabilityScore = Math.max(0, Math.min(100, Math.round(score)));

  const diff = state.profitabilityScore - oldProfitability;
  if (diff > 5) state.profitabilityTrend = 'up2';
  else if (diff > 0) state.profitabilityTrend = 'up1';
  else if (diff < -5) state.profitabilityTrend = 'down2';
  else if (diff < 0) state.profitabilityTrend = 'down1';
  else state.profitabilityTrend = 'neutral';

  // --- Makroekonomia (bezrobocie, rozwój, inflacja) ---
  const macroRng = makeRng(state.seed, state.turn + 555);
  state.macroStats.unemployment = Math.max(
    0,
    Math.min(100, state.macroStats.unemployment + (macroRng.next() > 0.5 ? 1 : -1))
  );
  state.macroStats.development = Math.max(
    0,
    Math.min(100, state.macroStats.development + (macroRng.next() > 0.6 ? 1 : 0))
  );

  const currentInflation = getInflationRate(state);
  const targetInflation = getTargetInflationForYear(state.year);
  const pull = (targetInflation - currentInflation) * 0.35;
  const noise = (macroRng.next() - 0.5) * 4;
  const devNudge =
    state.macroStats.development > 65 ? -0.3 : state.macroStats.development < 30 ? 0.4 : 0;

  const nextInflation = Math.round(
    Math.max(0.5, Math.min(55, currentInflation + pull + noise + devNudge)) * 10
  ) / 10;

  const quarterlyFactor = Math.pow(1 + nextInflation / 100, 0.25);
  const nextPriceIndex = Math.round(priceIndex * quarterlyFactor * 10000) / 10000;

  state.macroStats.inflationRate = nextInflation;
  state.macroStats.priceIndex = nextPriceIndex;

  // Bezpiecznik: gdyby event denominacji nie wylosował się w 1995 r., przełączamy automatycznie od 1996
  if (state.year >= 1996 && !state.denominated) {
    state.denominated = true;
  }

  return state;
}

function estimateRevenue(c: GameState['company']): number {
  const workerRevenue =
    calculateWorkerRevenue(c.employees.bezUmowy, WORKER_CONFIG.bezUmowy.revenue) +
    calculateWorkerRevenue(c.employees.zlecenie, WORKER_CONFIG.zlecenie.revenue) +
    calculateWorkerRevenue(c.employees.uop, WORKER_CONFIG.uop.revenue);

  const activityMultiplier = 1 + (c.reputation.branza - 50) / 200;
  return (BASE_REVENUE + workerRevenue) * activityMultiplier;
}

function sum(obj: Wplywy | Wydatki): number {
  return (Object.values(obj) as number[]).reduce((a, b) => a + b, 0);
}