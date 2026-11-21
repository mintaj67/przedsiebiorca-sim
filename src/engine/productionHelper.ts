import type { GameState, TradeSupplier, TradeBuyer, Competitor } from './types';
import { makeRng } from './rng';
import { getCompanyActivities } from './activityHelper';
import { generateTradeBuyers } from './tradeHelper';
import { getPriceIndex } from './economy';
import productionData from '../data/production_data.json';

interface ProductionDataJson {
  suppliers: Array<{
    id: string;
    name: string;
    quality: number;
    price: number;
    desc: string;
    req?: { minRepBranza?: number; minRepMafia?: number };
  }>;
}

const BASE_CEO_CAPACITY = 5;
const CAPACITY_PER_WORKER = 5;

/** Maksymalna liczba sztuk, jaką zakład może wyprodukować w jednym kwartale. */
export function getProductionCapacity(state: GameState): number {
  const emp = state.company.employees;
  const totalWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  return BASE_CEO_CAPACITY + totalWorkers * CAPACITY_PER_WORKER;
}

/** Zwraca podkategorię produkcyjną gracza (np. 'prod_azbest'). */
export function getProductionActivityId(state: GameState): string {
  const activities = getCompanyActivities(state.company);
  return activities.find(id => id.startsWith('prod_')) || state.company.activity;
}

export function generateProductionSuppliers(state: GameState): TradeSupplier[] {
  const prodActId = getProductionActivityId(state);
  const record = productionData as Record<string, ProductionDataJson>;
  const branchData = record[prodActId] || record.default;

  const rng = makeRng(state.seed, state.turn * 37 + 19);
  const result: TradeSupplier[] = [];

  const priceIndex = getPriceIndex(state);
  const dev = state.macroStats?.development ?? 40;
  const devFactor = 1 - Math.min(0.15, Math.max(-0.15, (dev - 40) * 0.003));
  const repBranza = state.company.reputation.opiniaBranza;
  const repDiscount = Math.min(0.12, (repBranza / 100) * 0.12);

  if (branchData?.suppliers) {
    const valid = branchData.suppliers.filter(s => {
      if (s.req?.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req?.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });

    for (const sup of valid) {
      const calculatedPrice = Math.round(sup.price * priceIndex * devFactor * (1 - repDiscount));
      result.push({
        id: sup.id,
        name: sup.name,
        desc: sup.desc,
        quality: sup.quality,
        price: Math.max(5, calculatedPrice),
        req: sup.req,
      });
    }
  }

  if (state.competitors && state.competitors.length > 0) {
    const comp: Competitor = rng.pick([...state.competitors]);
    if (comp) {
      const compQuality = Math.min(10, Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10)));
      let baseCompPrice = Math.round((compQuality * 110 + 70) * priceIndex);
      if (comp.opinionOfPlayer < 40) {
        baseCompPrice = Math.round(baseCompPrice * (1 + (40 - comp.opinionOfPlayer) * 0.01));
      } else if (comp.opinionOfPlayer > 60) {
        baseCompPrice = Math.round(baseCompPrice * 0.9);
      }
      if (comp.condition < 35) {
        baseCompPrice = Math.round(baseCompPrice * 0.8);
      }

      result.push({
        id: `comp_${comp.id}`,
        name: `${comp.name} (Surowce / Konkurent)`,
        desc: `Nadwyżki magazynowe półproduktów od konkurencji. Opinia o Tobie: ${comp.opinionOfPlayer}%.`,
        quality: compQuality,
        price: Math.max(5, baseCompPrice),
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

/** Alias przekierowujący do wspólnej listy odbiorców */
export function generateProductionBuyers(state: GameState): TradeBuyer[] {
  return generateTradeBuyers(state);
}