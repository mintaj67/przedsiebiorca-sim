import type { GameState, TradeSupplier, TradeBuyer, Competitor } from './types';
import { makeRng } from './rng';
import { getCategoryId } from './competition';
import tradeData from '../data/trade_data.json';

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
 * Wylicza dynamiczną listę dostawców dla gracza:
 * - uwzględnia bazowe dane z trade_data.json,
 * - dodaje możliwość pojawienia się firmy konkurencyjnej jako dostawcy,
 * - modyfikuje ceny w oparciu o: rozwój kraju (macroStats.development), reputację w branży (opiniaBranza),
 * - dla konkurencji: w oparciu o opinię o graczu (opinionOfPlayer) i kondycję spółki (condition).
 */
export function generateTradeSuppliers(state: GameState): TradeSupplier[] {
  const categoryId = getCategoryId(state.company.activity) || '';
  const tradeRecord = tradeData as Record<string, TradeDataJson>;
  const branchData = tradeRecord[state.company.activity] || tradeRecord[categoryId] || tradeRecord.odziez;

  const rng = makeRng(state.seed, state.turn * 31 + 44);
  const result: TradeSupplier[] = [];

  // Modyfikatory makro i reputacji
  const dev = state.macroStats?.development ?? 40;
  // Wyższy rozwój kraju = tańszy/dostępniejszy import (-0.2% za każdy punkt pow. 40, max -15%)
  const devFactor = 1 - Math.min(0.15, Math.max(-0.15, (dev - 40) * 0.003));
  // Wysoka opinia w branży = rabat kupiecki (do -12%)
  const repBranza = state.company.reputation.opiniaBranza;
  const repDiscount = Math.min(0.12, (repBranza / 100) * 0.12);

  if (branchData?.suppliers) {
    const valid = branchData.suppliers.filter((s) => {
      if (s.req?.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req?.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });

    for (const sup of valid) {
      // Wyliczenie ceny z uwzględnieniem rozwoju i reputacji
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

  // Czy konkurent pojawia się jako dostawca? (szansa 60%, jeśli są konkurenci)
  if (state.competitors && state.competitors.length > 0) {
    const compPool = [...state.competitors];
    const comp: Competitor = rng.pick(compPool);

    if (comp) {
      // Jakość towaru konkurenta zależy od jego reputacji i kondycji (od 3 do 9)
      const compQuality = Math.min(10, Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10)));
      
      // Baza cenowa wg jakości
      let baseCompPrice = compQuality * 150 + 100;

      // Opinia o graczu: jeśli konkurent nas nie lubi (<40), zawyża cenę (+25% do +50%)
      if (comp.opinionOfPlayer < 40) {
        const spiteNarzut = 1 + (40 - comp.opinionOfPlayer) * 0.01;
        baseCompPrice = Math.round(baseCompPrice * spiteNarzut);
      } else if (comp.opinionOfPlayer > 60) {
        // Dobre relacje = lekki upust od konkurencji
        baseCompPrice = Math.round(baseCompPrice * 0.9);
      }

      // Kondycja konkurenta: jeśli spółka ma kłopoty (<35), wyprzedaje zapasy taniej (-20%)
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

  // Zwracamy maksymalnie 3 dostawców wymieszanych deterministycznie
  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

/**
 * Wylicza dynamiczną listę odbiorców dla gracza:
 * - uwzględnia bazowe dane z trade_data.json,
 * - dodaje możliwość pojawienia się firmy konkurencyjnej jako odbiorcy,
 * - modyfikuje mnożnik ceny i wymagania w oparciu o: rozwój kraju, opinię publiczną oraz kondycję,
 * - kontrahenci o wyższej reputacji mogą odmówić zakupu towaru niskiej jakości (minQuality).
 */
export function generateTradeBuyers(state: GameState): TradeBuyer[] {
  const categoryId = getCategoryId(state.company.activity) || '';
  const tradeRecord = tradeData as Record<string, TradeDataJson>;
  const branchData = tradeRecord[state.company.activity] || tradeRecord[categoryId] || tradeRecord.odziez;

  const rng = makeRng(state.seed, state.turn * 43 + 71);
  const result: TradeBuyer[] = [];

  // Modyfikatory popytu i rozwoju
  const dev = state.macroStats?.development ?? 40;
  // Wyższy rozwój kraju = wyższa siła nabywcza odbiorców (+0.25% mnożnika za pkt pow. 40)
  const devBonus = Math.max(-0.1, (dev - 40) * 0.0025);

  if (branchData?.buyers) {
    const valid = branchData.buyers.filter((b) => {
      if (b.req?.minRepPubliczna && state.company.reputation.opiniaPubliczna < b.req.minRepPubliczna) return false;
      return true;
    });

    for (const buy of valid) {
      // Wyliczenie progu jakości w zależności od prestiżu/mnożnika odbiorcy
      // Odbiorcy płacący więcej (wysoki mnożnik) odmawiają przyjęcia tandety!
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

  // Czy konkurent pojawia się jako odbiorca? (szansa na pojawienie się w ofertach skupu)
  if (state.competitors && state.competitors.length > 0) {
    const compPool = [...state.competitors];
    const comp: Competitor = rng.pick(compPool);

    if (comp) {
      // Wymóg jakościowy konkurenta zależy od jego reputacji:
      // Firma o wysokiej reputacji (>60) nie kupi towaru poniżej jakości 5 lub 7!
      let compMinQuality = 1;
      if (comp.reputation >= 75) compMinQuality = 7;
      else if (comp.reputation >= 50) compMinQuality = 4;

      // Mnożnik skupu zależy od kondycji (bogata spółka płaci lepiej) i opinii o graczu
      let compMult = 1.8 + (comp.condition / 100) * 1.2; // 1.8 - 3.0
      if (comp.opinionOfPlayer < 35) {
        compMult *= 0.85; // Obniżka ceny skupu za wrogość
      } else if (comp.opinionOfPlayer > 65) {
        compMult *= 1.15; // Premia partnerska
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

  // Zwracamy maksymalnie 3 odbiorców
  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}
