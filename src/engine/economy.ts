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

export type FinancePeriod = 'quarter' | 'year' | 'all';

export interface AggregatedFinances {
  wplywy: Wplywy;
  wydatki: Wydatki;
  totalWplywy: number;
  totalWydatki: number;
  netBalance: number;
  quartersCount: number;
  periodLabel: string;
  hasCurrentTurnActivity: boolean;
  currentTurnWplywy: number;
  currentTurnWydatki: number;
}

export function createEmptyWplywy(): Wplywy {
  return {
    przychodyZDzialalnosci: 0,
    srodkiZKredytow: 0,
    dofinansowania: 0,
    dofinansowaniaSzaraStrefa: 0,
    dochodPasywny: 0,
    splatyZobowiazan: 0,
  };
}

export function createEmptyWydatki(): Wydatki {
  return {
    splacaneKredyty: 0,
    pracownicy: 0,
    czynsz: 0,
    podatki: 0,
    kary: 0,
    wydatkiNieplanowane: 0,
    zakupy: 0,
    inne: 0,
  };
}

function addWplywy(target: Wplywy, src?: Partial<Wplywy>): void {
  if (!src) return;
  target.przychodyZDzialalnosci += src.przychodyZDzialalnosci ?? 0;
  target.srodkiZKredytow += src.srodkiZKredytow ?? 0;
  target.dofinansowania += src.dofinansowania ?? 0;
  target.dofinansowaniaSzaraStrefa += src.dofinansowaniaSzaraStrefa ?? 0;
  target.dochodPasywny += src.dochodPasywny ?? 0;
  target.splatyZobowiazan += src.splatyZobowiazan ?? 0;
}

function addWydatki(target: Wydatki, src?: Partial<Wydatki>): void {
  if (!src) return;
  target.splacaneKredyty += src.splacaneKredyty ?? 0;
  target.pracownicy += src.pracownicy ?? 0;
  target.czynsz += src.czynsz ?? 0;
  target.podatki += src.podatki ?? 0;
  target.kary += src.kary ?? 0;
  target.wydatkiNieplanowane += src.wydatkiNieplanowane ?? 0;
  target.zakupy += src.zakupy ?? 0;
  target.inne += src.inne ?? 0;
}

/**
 * Zwraca zagregowane wpływy i wydatki dla wybranego przedziału:
 * - 'quarter': ostatni rozliczony kwartał (lub bieżący, jeśli jeszcze nie zamknięto żadnego),
 * - 'year': ostatnie 4 rozliczone kwartały krocząco,
 * - 'all': całokształt (wszystkie rozliczone kwartały + bieżąca tura).
 */
export function getAggregatedFinances(
  state: GameState,
  period: FinancePeriod
): AggregatedFinances {
  const f = state.company.finances;
  const history = Array.isArray(f.history) ? f.history : [];

  const currentTurnWplywy = sum(f.wplywy);
  const currentTurnWydatki = sum(f.wydatki);
  const hasCurrentTurnActivity = currentTurnWplywy > 0 || currentTurnWydatki > 0;

  const wplywy = createEmptyWplywy();
  const wydatki = createEmptyWydatki();
  let quartersCount = 0;
  let periodLabel = '';

  if (period === 'quarter') {
    if (history.length === 0) {
      addWplywy(wplywy, f.wplywy);
      addWydatki(wydatki, f.wydatki);
      quartersCount = 1;
      periodLabel = `${state.year} Q${state.quarter} (w trakcie)`;
    } else {
      const last = history[history.length - 1];
      addWplywy(wplywy, last.wplywy);
      addWydatki(wydatki, last.wydatki);
      quartersCount = 1;
      periodLabel = `${last.year} Q${last.quarter} (ostatni rozliczony kwartał)`;
    }
  } else if (period === 'year') {
    if (history.length === 0) {
      addWplywy(wplywy, f.wplywy);
      addWydatki(wydatki, f.wydatki);
      quartersCount = 1;
      periodLabel = `Ostatnie 4 kwartały (${state.year} Q${state.quarter} — w trakcie)`;
    } else {
      const slice = history.slice(-4);
      for (const entry of slice) {
        addWplywy(wplywy, entry.wplywy);
        addWydatki(wydatki, entry.wydatki);
      }
      quartersCount = slice.length;
      const first = slice[0];
      const last = slice[slice.length - 1];
      periodLabel =
        slice.length === 1
          ? `${last.year} Q${last.quarter} (1 z 4 kwartałów)`
          : `${first.year} Q${first.quarter} – ${last.year} Q${last.quarter} (${slice.length} kw.)`;
    }
  } else {
    for (const entry of history) {
      addWplywy(wplywy, entry.wplywy);
      addWydatki(wydatki, entry.wydatki);
    }
    addWplywy(wplywy, f.wplywy);
    addWydatki(wydatki, f.wydatki);
    quartersCount = history.length + (hasCurrentTurnActivity || history.length === 0 ? 1 : 0);
    periodLabel =
      history.length === 0
        ? `Od początku działalności (${state.year} Q${state.quarter})`
        : `Od początku działalności (${history.length} rozliczonych kw.${hasCurrentTurnActivity ? ' + bieżąca tura' : ''})`;
  }

  const totalWplywy = sum(wplywy);
  const totalWydatki = sum(wydatki);

  return {
    wplywy,
    wydatki,
    totalWplywy,
    totalWydatki,
    netBalance: totalWplywy - totalWydatki,
    quartersCount,
    periodLabel,
    hasCurrentTurnActivity,
    currentTurnWplywy,
    currentTurnWydatki,
  };
}

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

  const rawWages =
    c.employees.bezUmowy * WORKER_CONFIG.bezUmowy.wage +
    c.employees.zlecenie * WORKER_CONFIG.zlecenie.wage +
    c.employees.uop      * WORKER_CONFIG.uop.wage;

  const wages = Math.round(rawWages * priceIndex);
  const rent = Math.round(CZYNSZ * priceIndex);
  const taxes = Math.max(0, Math.round(baseRevenue * TAX_RATE));

  // Raty zaciągniętych kredytów pozostają nominalne (inflacja realnie zmniejsza stare długi)
  let loanPayments = 0;
  for (const loan of c.loans) {
    if (loan.remaining <= 0) continue;
    const installment = loan.remaining / Math.max(1, loan.quartersLeft);
    const interest = loan.remaining * loan.interestRate;
    loanPayments += Math.round(installment + interest);
    loan.remaining = Math.max(0, Math.round(loan.remaining - installment));
    loan.quartersLeft -= 1;
  }

  let skarbowkaDelta =
    c.employees.bezUmowy * SKARBOWKA_DECAY_BEZ_UMOWY +
    c.employees.zlecenie * SKARBOWKA_DECAY_ZLECENIE +
    c.employees.uop      * SKARBOWKA_GAIN_UOP;

  let accountantCost = 0;
  if (c.hasAccountant) {
    skarbowkaDelta += ACCOUNTANT_BONUS;
    accountantCost = Math.round(ACCOUNTANT_COST * priceIndex);
  }

  c.reputation.opiniaSkarbowa = Math.max(0, Math.min(100, c.reputation.opiniaSkarbowa + skarbowkaDelta));

  // Dopisujemy pozycje cykliczne do bieżącego kwartału (nie nadpisując transakcji z tej tury)
  f.wplywy.przychodyZDzialalnosci += baseRevenue;
  f.wydatki.pracownicy += wages;
  f.wydatki.czynsz += rent;
  f.wydatki.podatki += taxes;
  f.wydatki.splacaneKredyty += loanPayments;
  f.wydatki.inne += accountantCost;

  // Na stanKonta nakładamy WYŁĄCZNIE pozycje cykliczne z tego ticku
  // (wszystkie zakupy, kredyty, sprzedaże i usługi aktualizują stanKonta w momencie zajścia)
  const periodicOutflow = wages + rent + taxes + loanPayments + accountantCost;
  f.stanKonta = Math.round(f.stanKonta + baseRevenue - periodicOutflow);

  const totalWorkers = c.employees.bezUmowy + c.employees.zlecenie + c.employees.uop;
  const activeCategories = getCategoryIdsForActivities(getCompanyActivities(c));
  const requiredWorkers = getRequiredWorkers(c.size, activeCategories.length);

  if (totalWorkers < requiredWorkers) {
    c.reputation.opiniaBranza = Math.max(0, c.reputation.opiniaBranza - BELOW_REQUIRED_WORKERS_PENALTY);
  }

  if (state.ceo.flags.includes('hipnoza_dziala')) {
    const bonus = Math.round(5000 * priceIndex);
    c.finances.stanKonta += bonus;
    c.finances.wplywy.dochodPasywny += bonus;
  }
  if (state.ceo.flags.includes('hipnoza_nie_dziala')) {
    const penalty = Math.round(5000 * priceIndex);
    c.finances.stanKonta -= penalty;
    c.finances.wydatki.wydatkiNieplanowane += penalty;
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