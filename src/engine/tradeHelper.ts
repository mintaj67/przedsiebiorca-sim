import type {
  GameState,
  TradeSupplier,
  TradeBuyer,
  TradeProductDefinition,
  TradeProductOffer,
  TradeSpecialCategory,
  Competitor,
} from './types';
import { makeRng } from './rng';
import { getCategoryId } from './competition';
import { getCompanyActivities } from './activityHelper';
import { getPriceIndex, scaleByInflation } from './economy';
import tradeData from '../data/trade_data.json';
import productionData from '../data/production_data.json';

export const TRADE_THROUGHPUT_CONFIG = {
  ceoBase: 20,
  bezUmowy: 15,
  zlecenie: 25,
  uop: 40,
} as const;

export interface SeasonInfo {
  quarter: 1 | 2 | 3 | 4;
  name: string;
  icon: string;
}

export function getSeasonInfo(quarter: 1 | 2 | 3 | 4): SeasonInfo {
  if (quarter === 1) return { quarter, name: 'Wiosna', icon: '🌱' };
  if (quarter === 2) return { quarter, name: 'Lato', icon: '☀️' };
  if (quarter === 3) return { quarter, name: 'Jesień', icon: '🍂' };
  return { quarter, name: 'Zima', icon: '❄️' };
}

export function getTradeThroughputLimit(state: GameState): number {
  const emp = state.company.employees;
  return (
    TRADE_THROUGHPUT_CONFIG.ceoBase +
    emp.bezUmowy * TRADE_THROUGHPUT_CONFIG.bezUmowy +
    emp.zlecenie * TRADE_THROUGHPUT_CONFIG.zlecenie +
    emp.uop * TRADE_THROUGHPUT_CONFIG.uop
  );
}

export function getRemainingTradeBuyLimit(state: GameState): number {
  return Math.max(0, getTradeThroughputLimit(state) - (state.tradeBoughtThisTurn ?? 0));
}

export function getRemainingTradeSellLimit(state: GameState): number {
  return Math.max(0, getTradeThroughputLimit(state) - (state.tradeSoldThisTurn ?? 0));
}

export function getRemainingOfferStock(
  state: GameState,
  offer: Pick<TradeProductOffer, 'offerKey' | 'availableStock'>
): number | null {
  if (offer.availableStock === null) return null;
  const bought = state.tradeOfferPurchasedThisTurn?.[offer.offerKey] ?? 0;
  return Math.max(0, offer.availableStock - bought);
}

interface RawSupplierJson {
  id: string;
  name: string;
  quality?: number;
  qualityDesc?: string;
  price?: number;
  priceBias?: number;
  desc: string;
  req?: { minRepBranza?: number; minRepMafia?: number; minRepPubliczna?: number };
}

interface RawBuyerJson {
  id: string;
  name: string;
  priceBias?: number;
  priceTierDesc?: string;
  minQualityDesc?: string;
  multiplier?: number;
  desc: string;
  req?: { minRepPubliczna?: number; minQuality?: number };
  complaints: boolean;
}

interface TradeDataJson {
  suppliers: RawSupplierJson[];
  buyers: RawBuyerJson[];
  products?: TradeProductDefinition[];
}

export interface StoredTradeItemEstimate {
  resId: string;
  productId: string | null;
  name: string;
  quality: number;
  demandPercent: number;
  marketUnitPrice: number;
  specialCategory: TradeSpecialCategory | null;
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

function getBranchTradeData(state: GameState): TradeDataJson {
  const goodsAct = getGoodsActivityId(state);
  const categoryId = getCategoryId(goodsAct) || '';
  const tradeRecord = tradeData as unknown as Record<string, TradeDataJson>;
  return tradeRecord[goodsAct] || tradeRecord[categoryId] || tradeRecord.odziez;
}

function getAllCatalogProducts(): TradeProductDefinition[] {
  const tradeRecord = tradeData as unknown as Record<string, TradeDataJson>;
  const map = new Map<string, TradeProductDefinition>();
  for (const branch of Object.values(tradeRecord)) {
    for (const p of branch?.products ?? []) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values());
}

export function describeSupplierQuality(quality: number): string {
  if (quality <= 2) return 'Bardzo niska / bazarowa';
  if (quality <= 4) return 'Przeciętna, bez szału';
  if (quality <= 6) return 'Solidny standard rynkowy';
  if (quality <= 8) return 'Wysoka jakość';
  return 'Najwyższa półka / premium';
}

export function describeBuyerMinQuality(minQuality: number): string {
  if (minQuality <= 1) return 'Bierze wszystko jak leci';
  if (minQuality <= 3) return 'Akceptuje podstawowy towar';
  if (minQuality <= 5) return 'Wymaga przyzwoitej jakości';
  if (minQuality <= 7) return 'Wymaga wysokiej jakości';
  return 'Tylko towar z najwyższej półki';
}

export function describeBuyerPriceTier(priceBias: number): string {
  if (priceBias < 0.92) return 'Płaci skromnie';
  if (priceBias < 1.02) return 'Płaci przeciętnie';
  if (priceBias < 1.14) return 'Płaci uczciwie';
  return 'Płaci bardzo dobrze';
}

function describeCompetitorRelation(opinion: number): string {
  if (opinion >= 70) return 'przyjazne';
  if (opinion >= 55) return 'poprawne';
  if (opinion >= 35) return 'chłodne';
  return 'napięte';
}

function meetsProductRequirements(state: GameState, p: TradeProductDefinition): boolean {
  if (p.req?.minRepBranza && state.company.reputation.opiniaBranza < p.req.minRepBranza) return false;
  if (p.req?.minRepPubliczna && state.company.reputation.opiniaPubliczna < p.req.minRepPubliczna) return false;
  if (p.req?.minRepMafia && state.company.reputation.opiniaMafia < p.req.minRepMafia) return false;
  return true;
}

/**
 * Deterministycznie przydziela w bieżącym kwartale statusy specjalne produktom:
 * - 1 HIT SEZONU (wybierany spośród produktów o wysokim popycie w tym kwartale),
 * - 1 TOWAR DEFICYTOWY (z 70% szansą na kwartał),
 * - 1 BIAŁY KRUK (produkty z `alwaysSpecial: 'bialy_kruk'` lub rzadkie losowanie 30%).
 */
function getQuarterlySpecialMap(
  state: GameState,
  products: TradeProductDefinition[]
): Map<string, TradeSpecialCategory> {
  const map = new Map<string, TradeSpecialCategory>();
  if (products.length === 0) return map;

  const rng = makeRng(`${state.seed}:trade-special`, state.turn * 67 + state.quarter * 13);

  for (const p of products) {
    if (p.alwaysSpecial) {
      map.set(p.id, p.alwaysSpecial);
    }
  }

  const normalPool = products.filter(p => !map.has(p.id));
  if (normalPool.length === 0) return map;

  // 1. HIT SEZONU — faworyzuje produkty z wysokim popytem w bieżącym kwartale
  const qIdx = state.quarter - 1;
  const sortedBySeason = [...normalPool].sort((a, b) => {
    const da = a.seasonalDemand?.[qIdx] ?? 1;
    const db = b.seasonalDemand?.[qIdx] ?? 1;
    return db - da;
  });
  const hitCandidates = sortedBySeason.slice(0, Math.min(3, sortedBySeason.length));
  const hitPick = rng.pick(hitCandidates);
  if (hitPick) {
    map.set(hitPick.id, 'hit_sezonu');
  }

  // 2. TOWAR DEFICYTOWY
  const afterHit = normalPool.filter(p => !map.has(p.id));
  if (afterHit.length > 0 && rng.next() < 0.72) {
    const deficitPick = rng.pick(afterHit);
    if (deficitPick) {
      map.set(deficitPick.id, 'deficytowy');
    }
  }

  // 3. Losowy BIAŁY KRUK (jeśli żaden z natury biały kruk nie pasuje lub jako dodatkowa okazja)
  const hasWhiteRaven = Array.from(map.values()).includes('bialy_kruk');
  const afterDeficit = normalPool.filter(p => !map.has(p.id));
  if (!hasWhiteRaven && afterDeficit.length > 0 && rng.next() < 0.35) {
    const highEnd = afterDeficit.filter(p => p.quality >= 6);
    const pick = rng.pick(highEnd.length > 0 ? highEnd : afterDeficit);
    if (pick) {
      map.set(pick.id, 'bialy_kruk');
    }
  }

  return map;
}

function getProductDemandFactor(
  state: GameState,
  product: TradeProductDefinition,
  special: TradeSpecialCategory | null
): number {
  const qIdx = state.quarter - 1;
  const baseSeason = product.seasonalDemand?.[qIdx] ?? 1.0;

  // Delikatne wahanie koniunktury kwartalnej dla konkretnego produktu (±8%)
  const swingRng = makeRng(`${state.seed}:prod-swing:${product.id}`, state.turn * 23 + state.quarter);
  const swing = 0.92 + swingRng.next() * 0.16;

  let specialMod = 1.0;
  if (special === 'hit_sezonu') specialMod = 1.4;
  else if (special === 'deficytowy') specialMod = 1.25;
  else if (special === 'bialy_kruk') specialMod = 1.3;

  return Math.max(0.55, Math.min(2.1, baseSeason * swing * specialMod));
}

function buildProductOffer(
  state: GameState,
  supplierId: string,
  supplierPriceBias: number,
  product: TradeProductDefinition,
  special: TradeSpecialCategory | null,
  devFactor: number,
  repDiscount: number,
  rng: ReturnType<typeof makeRng>
): TradeProductOffer {
  const priceIndex = getPriceIndex(state);
  const demandFactor = getProductDemandFactor(state, product, special);

  // Modyfikator ceny zakupu u dostawcy zależny od kategorii specjalnej
  let specialBuyMod = 1.0;
  let availableStock: number | null = null;

  if (special === 'hit_sezonu') {
    specialBuyMod = 1.18;
  } else if (special === 'deficytowy') {
    specialBuyMod = 1.08;
    availableStock = rng.int(3, 12);
  } else if (special === 'bialy_kruk') {
    specialBuyMod = 1.38;
    availableStock = rng.int(1, 3);
  }

  // Mały losowy rozrzut cenowy konkretnego dostawcy (±6%)
  const vendorJitter = 0.94 + rng.next() * 0.12;
  const rawBuyPrice =
    product.basePrice *
    priceIndex *
    demandFactor *
    supplierPriceBias *
    specialBuyMod *
    devFactor *
    (1 - repDiscount) *
    vendorJitter;

  return {
    offerKey: `${supplierId}__${product.id}`,
    productId: product.id,
    name: product.name,
    desc: product.desc,
    quality: product.quality,
    buyPrice: Math.max(5, Math.round(rawBuyPrice)),
    demandPercent: Math.round(demandFactor * 100),
    specialCategory: special,
    isExclusive: Boolean(
      product.exclusiveSupplierId === supplierId ||
        (product.supplierIds && product.supplierIds.length === 1 && product.supplierIds[0] === supplierId)
    ),
    availableStock,
  };
}

export function generateTradeSuppliers(state: GameState): TradeSupplier[] {
  const branchData = getBranchTradeData(state);
  const rng = makeRng(state.seed, state.turn * 31 + 44);
  const result: TradeSupplier[] = [];

  const dev = state.macroStats?.development ?? 40;
  const devFactor = 1 - Math.min(0.12, Math.max(-0.12, (dev - 40) * 0.0025));
  const repBranza = state.company.reputation.opiniaBranza;
  const repDiscount = Math.min(0.10, (repBranza / 100) * 0.10);

  const allProducts = branchData?.products ?? [];
  const eligibleProducts = allProducts.filter(p => meetsProductRequirements(state, p));
  const specialMap = getQuarterlySpecialMap(state, eligibleProducts);

  if (branchData?.suppliers) {
    const validSuppliers = branchData.suppliers.filter((s) => {
      if (s.req?.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req?.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });

    for (const sup of validSuppliers) {
      const supQuality = sup.quality ?? 5;
      const supBias = sup.priceBias ?? 0.94;

      // Dobierz produkty przypisane do tego sprzedawcy (ekskluzywne + ogólne)
      const matchingProducts = eligibleProducts.filter(p => {
        if (p.exclusiveSupplierId) return p.exclusiveSupplierId === sup.id;
        if (Array.isArray(p.supplierIds) && p.supplierIds.length > 0) {
          return p.supplierIds.includes(sup.id);
        }
        return true;
      });

      const offers: TradeProductOffer[] = matchingProducts
        .filter(p => {
          // Biały kruk pojawia się w danej turze z ograniczoną szansą, żeby faktycznie był rzadki
          const sp = specialMap.get(p.id) ?? null;
          if (sp === 'bialy_kruk' && p.alwaysSpecial === 'bialy_kruk') {
            return rng.next() < 0.45;
          }
          return true;
        })
        .sort(() => rng.next() - 0.5)
        .slice(0, 3)
        .map(p =>
          buildProductOffer(
            state,
            sup.id,
            supBias,
            p,
            specialMap.get(p.id) ?? null,
            devFactor,
            repDiscount,
            rng
          )
        );

      // Bezpiecznik: gdyby filtrowanie białego kruka wyczyściło listę, bierzemy pierwszy pasujący
      if (offers.length === 0 && matchingProducts.length > 0) {
        const fallback = matchingProducts[0];
        offers.push(
          buildProductOffer(
            state,
            sup.id,
            supBias,
            fallback,
            specialMap.get(fallback.id) ?? null,
            devFactor,
            repDiscount,
            rng
          )
        );
      }

      if (offers.length > 0) {
        result.push({
          id: sup.id,
          name: sup.name,
          desc: sup.desc,
          qualityDesc: sup.qualityDesc ?? describeSupplierQuality(supQuality),
          quality: supQuality,
          price: offers[0].buyPrice,
          products: offers,
          req: sup.req,
        });
      }
    }
  }

  // Oferta od aktywnego konkurenta (nie w stanie wojny)
  const eligibleComps = (state.competitors ?? []).filter(
    c => (c.status ?? 'active') === 'active' && !c.atWarWithPlayer
  );
  if (eligibleComps.length > 0 && eligibleProducts.length > 0) {
    const comp: Competitor = rng.pick([...eligibleComps]);
    if (comp) {
      const compQuality = Math.min(
        10,
        Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10))
      );

      let compBias = 0.96;
      if (comp.isAlliedWithPlayer) compBias *= 0.86;
      else if (comp.opinionOfPlayer < 40) compBias *= 1.12;
      else if (comp.opinionOfPlayer > 60) compBias *= 0.93;
      if (comp.condition < 35) compBias *= 0.84;

      const compPool = eligibleProducts.filter(p => !p.exclusiveSupplierId);
      const pickedForComp = (compPool.length > 0 ? compPool : eligibleProducts)
        .sort(() => rng.next() - 0.5)
        .slice(0, 2);

      const compOffers = pickedForComp.map(p =>
        buildProductOffer(
          state,
          `comp_${comp.id}`,
          compBias,
          p,
          specialMap.get(p.id) ?? null,
          devFactor,
          0,
          rng
        )
      );

      const relationWord = describeCompetitorRelation(comp.opinionOfPlayer);
      result.push({
        id: `comp_${comp.id}`,
        name: `${comp.name}`,
        desc:
          comp.condition < 35
            ? `Wyprzedaż zapasów w trudnej sytuacji finansowej. Relacje z Tobą: ${relationWord}.`
            : `Oferta hurtowa od konkurencyjnej spółki. Relacje z Tobą: ${relationWord}.`,
        qualityDesc: describeSupplierQuality(compQuality),
        quality: compQuality,
        price: compOffers[0]?.buyPrice ?? 100,
        products: compOffers,
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

/**
 * Wspólna lista odbiorców bez mnożników x2–x4:
 * każdy odbiorca ma ukryty profil cenowy wokół ceny rynkowej (priceBias ~0.88–1.22)
 * oraz słowne opisy oczekiwań i wypłacalności.
 */
export function generateTradeBuyers(state: GameState): TradeBuyer[] {
  const goodsAct = getGoodsActivityId(state);
  const categoryId = getCategoryId(goodsAct) || '';
  const tradeRecord = tradeData as unknown as Record<string, TradeDataJson>;
  const prodRecord = productionData as unknown as Record<string, TradeDataJson>;

  const branchData = goodsAct.startsWith('prod_')
    ? (prodRecord[goodsAct] || tradeRecord[goodsAct] || prodRecord.default || tradeRecord.odziez)
    : (tradeRecord[goodsAct] || tradeRecord[categoryId] || tradeRecord.odziez);

  const rng = makeRng(state.seed, state.turn * 43 + 71);
  const result: TradeBuyer[] = [];

  const dev = state.macroStats?.development ?? 40;
  const devMod = Math.max(-0.06, Math.min(0.08, (dev - 40) * 0.0015));

  if (branchData?.buyers) {
    const valid = branchData.buyers.filter((b) => {
      if (b.req?.minRepPubliczna && state.company.reputation.opiniaPubliczna < b.req.minRepPubliczna) {
        return false;
      }
      return true;
    });

    for (const buy of valid) {
      const minQuality = buy.req?.minQuality ?? 1;
      const baseBias =
        typeof buy.priceBias === 'number'
          ? buy.priceBias
          : buy.multiplier
            ? Math.max(0.88, Math.min(1.22, 0.78 + buy.multiplier * 0.12))
            : 1.02;

      const jitter = (rng.next() - 0.5) * 0.08;
      const finalBias = Math.round(Math.max(0.8, Math.min(1.3, baseBias + devMod + jitter)) * 100) / 100;

      result.push({
        id: buy.id,
        name: buy.name,
        desc: buy.desc,
        priceBias: finalBias,
        priceTierDesc: buy.priceTierDesc ?? describeBuyerPriceTier(finalBias),
        minQualityDesc: buy.minQualityDesc ?? describeBuyerMinQuality(minQuality),
        complaints: buy.complaints,
        req: {
          minRepPubliczna: buy.req?.minRepPubliczna,
          minQuality,
        },
      });
    }
  }

  const eligibleComps = (state.competitors ?? []).filter(
    c => (c.status ?? 'active') === 'active' && !c.atWarWithPlayer
  );
  if (eligibleComps.length > 0) {
    const comp: Competitor = rng.pick([...eligibleComps]);
    if (comp) {
      let compMinQuality = 1;
      if (comp.reputation >= 75) compMinQuality = 7;
      else if (comp.reputation >= 50) compMinQuality = 4;

      let compBias = 0.94 + (comp.condition / 100) * 0.24;
      if (comp.isAlliedWithPlayer) compBias *= 1.08;
      else if (comp.opinionOfPlayer < 35) compBias *= 0.88;
      else if (comp.opinionOfPlayer > 65) compBias *= 1.05;
      compBias = Math.round(Math.max(0.82, Math.min(1.28, compBias)) * 100) / 100;

      const relationWord = describeCompetitorRelation(comp.opinionOfPlayer);
      result.push({
        id: `comp_${comp.id}`,
        name: `${comp.name}`,
        desc:
          comp.reputation >= 60
            ? `Renomowana spółka poszukująca solidnych partii. Relacje z Tobą: ${relationWord}.`
            : `Spółka konkurencyjna szukająca okazji hurtowych. Relacje z Tobą: ${relationWord}.`,
        priceBias: compBias,
        priceTierDesc: describeBuyerPriceTier(compBias),
        minQualityDesc: describeBuyerMinQuality(compMinQuality),
        complaints: comp.reputation > 40,
        req: {
          minQuality: compMinQuality,
        },
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

/**
 * Rozpoznaje towar handlowy składowany w magazynie (`item__<productId>__q<quality>`
 * lub starszy format `<supplierId>_<quality>`) i wylicza jego bieżącą wartość rynkową w tym kwartale.
 */
export function estimateStoredTradeItem(
  state: GameState,
  resId: string
): StoredTradeItemEstimate {
  const priceIndex = getPriceIndex(state);
  const branchData = getBranchTradeData(state);
  const allCatalog = getAllCatalogProducts();
  const branchProducts = branchData?.products ?? [];
  const specialMap = getQuarterlySpecialMap(state, branchProducts);

  if (resId.startsWith('item__')) {
    const parts = resId.split('__');
    const productId = parts[1] ?? '';
    const qStr = (parts[2] ?? 'q1').replace(/^q/, '');
    const parsedQuality = Math.min(10, Math.max(1, parseInt(qStr, 10) || 1));

    const def =
      branchProducts.find(p => p.id === productId) ??
      allCatalog.find(p => p.id === productId);

    if (def) {
      const special = specialMap.get(def.id) ?? def.alwaysSpecial ?? null;
      const demandFactor = getProductDemandFactor(state, def, special);

      // Premia rynkowa przy sprzedaży kategorii specjalnych (bez sztucznych mnożników x3 na wszystko)
      let specialSellMod = 1.0;
      if (special === 'hit_sezonu') specialSellMod = 1.24;
      else if (special === 'deficytowy') specialSellMod = 1.32;
      else if (special === 'bialy_kruk') specialSellMod = 1.75;

      const marketUnitPrice = Math.max(
        5,
        Math.round(def.basePrice * priceIndex * demandFactor * specialSellMod)
      );

      return {
        resId,
        productId: def.id,
        name: def.name,
        quality: def.quality,
        demandPercent: Math.round(demandFactor * 100),
        marketUnitPrice,
        specialCategory: special,
      };
    }

    return {
      resId,
      productId,
      name: productId || 'Towar',
      quality: parsedQuality,
      demandPercent: 100,
      marketUnitPrice: Math.max(5, scaleByInflation(parsedQuality * 95 + 60, state)),
      specialCategory: null,
    };
  }

  // Fallback dla starszych zapisów sprzed aktualizacji produktów (`azjata_1`)
  const legacyParts = resId.split('_');
  const quality = Math.min(10, Math.max(1, parseInt(legacyParts[legacyParts.length - 1], 10) || 1));
  return {
    resId,
    productId: null,
    name: 'Partia towaru (starszy zapas)',
    quality,
    demandPercent: 100,
    marketUnitPrice: Math.max(5, scaleByInflation(quality * 95 + 60, state)),
    specialCategory: null,
  };
}

/**
 * Wylicza ofertową cenę za 1 szt. u konkretnego odbiorcy na podstawie bieżącej ceny rynkowej towaru
 * (bez mnożnika x2–x4 — tylko profil cenowy odbiorcy + lekkie dopasowanie do jakości).
 */
export function calculateBuyerOfferUnitPrice(
  marketUnitPrice: number,
  buyer: TradeBuyer,
  itemQuality: number
): number {
  const bias = buyer.priceBias ?? 1.0;
  const minQ = buyer.req?.minQuality ?? 1;
  // Towar wyraźnie powyżej progu odbiorcy daje mały bonus (+2% za punkt, max +8%)
  const qualityBonus = Math.min(0.08, Math.max(0, (itemQuality - minQ) * 0.02));
  return Math.max(5, Math.round(marketUnitPrice * bias * (1 + qualityBonus)));
}