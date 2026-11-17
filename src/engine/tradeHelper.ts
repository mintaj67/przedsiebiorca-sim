import type { GameState, TradeSupplier, TradeBuyer, Competitor } from './types';
import { makeRng } from './rng';
import { getCategoryId } from './competition';
import { getCompanyActivities } from './activityHelper';
import tradeData from '../data/trade_data.json';
import productionData from '../data/production_data.json';

interface TradeDataJson {
  suppliers: Array<{
    id: string;
    name: string;
    quality: number;
    price: number;
    desc: string;
    req?: { minRepBranza?: number; minRepMafia?: number; minRepPubliczna?: number };
  }>;
  buyers: Array<{
    id: string;
    name: string;
    multiplier: number;
    desc: string;
    req?: { minRepPubliczna?: number; minQuality?: number };
    complaints: boolean;
  }>;
}

/**
 * Wylicza przedział orientacyjnego przychodu [min, max] na podstawie Dokładności Przewidywań (0-100%).
 * Przy 0% rozstrzał wynosi ±45%, a przy 100% maleje do ±5%.
 */
export function getRevenueRange(
  estimatedRevenue: number,
  accuracy: number
): { min: number; max: number; spreadPercent: number } {
  const clampedAcc = Math.max(0, Math.min(100, accuracy ?? 50));
  const spread = 0.45 - (clampedAcc / 100) * 0.40;
  const min = Math.max(1, Math.round(estimatedRevenue * (1 - spread)));
  const max = Math.max(min, Math.round(estimatedRevenue * (1 + spread)));
  return {
    min,
    max,
    spreadPercent: Math.round(spread * 100),
  };
}

/** Zwraca podkategorię towarową gracza (Handel lub Produkcja + Handel). */
export function getGoodsActivityId(state: GameState): string {
  const acts = getCompanyActivities(state.company);
  return acts.find(id => id.startsWith('handel_') || id.startsWith('prod_')) || state.company.activity;
}

export function generateTradeSuppliers(state: GameState): TradeSupplier[] {
  const goodsAct = getGoodsActivityId(state);
  const categoryId = getCategoryId(goodsAct) || '';
  const tradeRecord = tradeData as Record<string, TradeDataJson>;
  const branchData = tradeRecord[goodsAct] || tradeRecord[categoryId] || tradeRecord.odziez;

  const rng = makeRng(state.seed, state.turn * 31 + 44);
  const result: TradeSupplier[] = [];

  const dev = state.macroStats?.development ?? 40;
  const devFactor = 1 - Math.min(0.15, Math.max(-0.15, (dev - 40) * 0.003));
  const repBranza = state.company.reputation.opiniaBranza;
  const repDiscount = Math.min(0.12, (repBranza / 100) * 0.12);

  if (branchData?.suppliers) {
    const valid = branchData.suppliers.filter((s) => {
      if (s.req?.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req?.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });

    for (const sup of valid) {
      const calculatedPrice = Math.round(sup.price * devFactor * (1 - repDiscount));
      result.push({
        id: sup.id,
        name: sup.name,
        desc: sup.desc,
        quality: sup.quality,
        price: Math.max(10, calculatedPrice),
        req: sup.req,
      });
    }
  }

  if (state.competitors && state.competitors.length > 0) {
    const compPool = [...state.competitors];
    const comp: Competitor = rng.pick(compPool);

    if (comp) {
      const compQuality = Math.min(10, Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10)));
      let baseCompPrice = compQuality * 150 + 100;

      if (comp.opinionOfPlayer < 40) {
        const spiteNarzut = 1 + (40 - comp.opinionOfPlayer) * 0.01;
        baseCompPrice = Math.round(baseCompPrice * spiteNarzut);
      } else if (comp.opinionOfPlayer > 60) {
        baseCompPrice = Math.round(baseCompPrice * 0.9);
      }

      if (comp.condition < 35) {
        baseCompPrice = Math.round(baseCompPrice * 0.8);
      }

      result.push({
        id: `comp_${comp.id}`,
        name: `${comp.name} (Konkurent)`,
        desc: comp.condition < 35
          ? `Wyprzedaż zapasów po kosztach z powodu kłopotów finansowych. Opinia o Tobie: ${comp.opinionOfPlayer}%.`
          : `Oferta hurtowa od konkurencyjnej spółki. Opinia o Tobie: ${comp.opinionOfPlayer}%.`,
        quality: compQuality,
        price: Math.max(10, baseCompPrice),
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

/**
 * Wspólna lista odbiorców dla Handlu oraz Produkcji + Handlu.
 */
export function generateTradeBuyers(state: GameState): TradeBuyer[] {
  const goodsAct = getGoodsActivityId(state);
  const categoryId = getCategoryId(goodsAct) || '';
  const tradeRecord = tradeData as Record<string, TradeDataJson>;
  const prodRecord = productionData as Record<string, TradeDataJson>;

  const branchData = goodsAct.startsWith('prod_')
    ? (prodRecord[goodsAct] || tradeRecord[goodsAct] || prodRecord.default || tradeRecord.odziez)
    : (tradeRecord[goodsAct] || tradeRecord[categoryId] || tradeRecord.odziez);

  const rng = makeRng(state.seed, state.turn * 43 + 71);
  const result: TradeBuyer[] = [];

  const dev = state.macroStats?.development ?? 40;
  const devBonus = Math.max(-0.1, (dev - 40) * 0.0025);

  if (branchData?.buyers) {
    const valid = branchData.buyers.filter((b) => {
      if (b.req?.minRepPubliczna && state.company.reputation.opiniaPubliczna < b.req.minRepPubliczna) return false;
      return true;
    });

    for (const buy of valid) {
      let minQuality = buy.req?.minQuality ?? 1;
      if (buy.multiplier >= 3.0) minQuality = Math.max(minQuality, 6);
      else if (buy.multiplier >= 2.2) minQuality = Math.max(minQuality, 3);

      const calculatedMult = Math.round((buy.multiplier + devBonus) * 100) / 100;

      result.push({
        id: buy.id,
        name: buy.name,
        desc: buy.desc,
        multiplier: Math.max(1.1, calculatedMult),
        complaints: buy.complaints,
        req: {
          minRepPubliczna: buy.req?.minRepPubliczna,
          minQuality,
        },
      });
    }
  }

  if (state.competitors && state.competitors.length > 0) {
    const compPool = [...state.competitors];
    const comp: Competitor = rng.pick(compPool);

    if (comp) {
      let compMinQuality = 1;
      if (comp.reputation >= 75) compMinQuality = 7;
      else if (comp.reputation >= 50) compMinQuality = 4;

      let compMult = 1.8 + (comp.condition / 100) * 1.2;
      if (comp.opinionOfPlayer < 35) {
        compMult *= 0.85;
      } else if (comp.opinionOfPlayer > 65) {
        compMult *= 1.15;
      }
      compMult = Math.round(compMult * 100) / 100;

      result.push({
        id: `comp_${comp.id}`,
        name: `${comp.name} (Skup / Konkurent)`,
        desc: comp.reputation >= 60
          ? `Prestiżowa spółka konkurencyjna. Wymaga wysokiej jakości towaru. Opinia: ${comp.opinionOfPlayer}%.`
          : `Konkurent szukający okazji hurtowych. Kondycja: ${comp.condition}%.`,
        multiplier: Math.max(1.2, compMult),
        complaints: comp.reputation > 40,
        req: {
          minQuality: compMinQuality,
        },
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}