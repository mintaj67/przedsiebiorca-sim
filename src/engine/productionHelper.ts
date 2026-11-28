import type {
  GameState,
  TradeSupplier,
  TradeBuyer,
  Competitor,
  ProductionDataFile,
  ProductionIngredient,
  ProductionTool,
  CompanySize,
} from './types';
import { makeRng } from './rng';
import { getCompanyActivities, getActivityName } from './activityHelper';
import { generateTradeBuyers, getRevenueRange } from './tradeHelper';
import { getPriceIndex, getInflationRate, scaleByInflation } from './economy';
import { SIZE_ORDER, getAllianceTradeDiscount, getPlayerAllies } from './competition';
import { COMPANY_SIZE_CONFIG } from './constants';
import productionDataRaw from '../data/production_data.json';

const productionData = productionDataRaw as unknown as ProductionDataFile;

const BASE_CEO_CAPACITY = 5;
const CAPACITY_PER_WORKER = 5;
const INGREDIENTS_PER_TURN = 4;

const BASE_COST_BY_QUALITY = [0, 25, 40, 65, 85, 110, 170, 240, 350, 480, 600];
const BASE_WHOLESALE_BY_QUALITY = [0, 60, 95, 150, 195, 240, 370, 520, 760, 1050, 1300];

export interface ProductionMarketFactors {
  demandScore: number;
  demandLabel: string;
  demandMultiplier: number;
  reputationScore: number;
  reputationMultiplier: number;
  branchRepScore: number;
  branchRepMultiplier: number;
  inflationRate: number;
  priceIndex: number;
  combinedMultiplier: number;
}

export interface EvaluatedIngredient extends ProductionIngredient {
  effectiveUnitCost: number;
  effectiveWholesalePrice: number;
  meetsRequirements: boolean;
  missingReasons: string[];
  isCompetitor?: boolean;
}

export interface EvaluatedTool extends ProductionTool {
  effectiveCost: number;
  owned: boolean;
  meetsRequirements: boolean;
  missingReasons: string[];
}

export interface ProductionBatchEstimate {
  ingredient: EvaluatedIngredient;
  tool: EvaluatedTool;
  factors: ProductionMarketFactors;
  workersCount: number;
  units: number;
  unitCost: number;
  totalCost: number;
  quality: number;
  estimatedUnitPrice: number;
  unitMinPrice: number;
  unitMaxPrice: number;
  estimatedTotalRevenue: number;
  totalMinRevenue: number;
  totalMaxRevenue: number;
  spreadPercent: number;
}

export interface StoredProducedItemEstimate {
  resId: string;
  label: string;
  ingredientName: string;
  quality: number;
  stock: number;
  estimatedUnitPrice: number;
  unitMinPrice: number;
  unitMaxPrice: number;
  retailBaseUnitPrice: number;
}

/** Zwraca podkategorię produkcyjną gracza (np. 'prod_azbest'). */
export function getProductionActivityId(state: GameState): string {
  const activities = getCompanyActivities(state.company);
  return activities.find(id => id.startsWith('prod_')) || state.company.activity;
}

/** Łączna liczba osób możliwych do przydzielenia do produkcji (Prezes + zatrudnieni pracownicy). */
export function getTotalProductionWorkers(state: GameState): number {
  const emp = state.company.employees;
  return 1 + emp.bezUmowy + emp.zlecenie + emp.uop;
}

/** Liczba wolnych osób do produkcji w bieżącym kwartale. */
export function getAvailableProductionWorkers(state: GameState): number {
  const total = getTotalProductionWorkers(state);
  const used = state.productionWorkersUsedThisTurn ?? 0;
  return Math.max(0, total - used);
}

/** Lista ID posiadanych na stałe narzędzi produkcyjnych (zawsze zawiera zestaw bazowy). */
export function getOwnedToolIds(state: GameState): string[] {
  const owned = Array.isArray(state.company.ownedTools) ? state.company.ownedTools : [];
  return owned.includes('tool_basic') ? owned : ['tool_basic', ...owned];
}

function getUopQualityBonus(state: GameState): number {
  const emp = state.company.employees;
  const totalWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  return totalWorkers > 0 && emp.uop / totalWorkers >= 0.5 ? 1 : 0;
}

function describeDemand(score: number): string {
  if (score >= 80) return 'Bardzo wysoki';
  if (score >= 62) return 'Wysoki';
  if (score >= 40) return 'Umiarkowany';
  if (score >= 22) return 'Niski';
  return 'Załamanie popytu';
}

function shuffleWithRng<T>(items: T[], rng: ReturnType<typeof makeRng>): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getProductionMarketFactors(state: GameState): ProductionMarketFactors {
  const prodActId = getProductionActivityId(state);
  const rng = makeRng(`${state.seed}:prod-demand:${prodActId}`, state.turn * 17 + 5);

  const dev = state.macroStats?.development ?? 40;
  const unemployment = state.macroStats?.unemployment ?? 10;
  const quarterlySwing = rng.int(-16, 16);

  const demandScore = Math.max(
    5,
    Math.min(100, Math.round(50 + (dev - 40) * 0.45 - (unemployment - 10) * 0.5 + quarterlySwing))
  );
  const demandMultiplier = 0.75 + (demandScore / 100) * 0.5;

  const reputationScore = Math.max(0, Math.min(100, Math.round(state.company.reputation.ogolna ?? 50)));
  const reputationMultiplier = 0.85 + (reputationScore / 100) * 0.3;

  const branchRepScore = Math.max(0, Math.min(100, Math.round(state.company.reputation.opiniaBranza ?? 50)));
  const branchRepMultiplier = 0.85 + (branchRepScore / 100) * 0.3;

  const priceIndex = getPriceIndex(state);
  const inflationRate = getInflationRate(state);

  const combinedMultiplier = Math.max(
    0.55,
    demandMultiplier * reputationMultiplier * branchRepMultiplier
  );

  return {
    demandScore,
    demandLabel: describeDemand(demandScore),
    demandMultiplier,
    reputationScore,
    reputationMultiplier,
    branchRepScore,
    branchRepMultiplier,
    inflationRate,
    priceIndex,
    combinedMultiplier,
  };
}

function evaluateAllCatalogIngredients(state: GameState): EvaluatedIngredient[] {
  const ingredients = productionData.ingredients ?? [];
  const factors = getProductionMarketFactors(state);
  const dev = state.macroStats?.development ?? 40;
  const devFactor = 1 - Math.min(0.15, Math.max(-0.15, (dev - 40) * 0.003));
  const repDiscount = Math.min(0.12, (factors.branchRepScore / 100) * 0.12);
  const allianceDiscount = getAllianceTradeDiscount(state);
  const totalDiscount = Math.min(0.35, repDiscount + allianceDiscount);

  return ingredients.map((ing) => {
    const missingReasons: string[] = [];
    if (ing.req?.minRepBranza && state.company.reputation.opiniaBranza < ing.req.minRepBranza) {
      missingReasons.push(`Opinia w branży ≥ ${ing.req.minRepBranza}`);
    }
    if (ing.req?.minRepMafia && state.company.reputation.opiniaMafia < ing.req.minRepMafia) {
      missingReasons.push(`Opinia mafii ≥ ${ing.req.minRepMafia}`);
    }

    const effectiveUnitCost = Math.max(
      5,
      Math.round(ing.unitCost * factors.priceIndex * devFactor * (1 - totalDiscount))
    );
    const effectiveWholesalePrice = Math.max(
      10,
      Math.round(ing.baseWholesalePrice * factors.priceIndex * factors.combinedMultiplier)
    );

    return {
      ...ing,
      effectiveUnitCost,
      effectiveWholesalePrice,
      meetsRequirements: missingReasons.length === 0,
      missingReasons,
      isCompetitor: false,
    };
  });
}

export function getProductionIngredients(state: GameState): EvaluatedIngredient[] {
  const allCatalog = evaluateAllCatalogIngredients(state);
  const factors = getProductionMarketFactors(state);
  const poolRng = makeRng(`${state.seed}:prod-ingredients-pool`, state.turn * 29 + 11);

  const unlocked = shuffleWithRng(
    allCatalog.filter(i => i.meetsRequirements),
    poolRng
  );
  const locked = shuffleWithRng(
    allCatalog.filter(i => !i.meetsRequirements),
    poolRng
  );

  const guaranteedUnlocked = unlocked.slice(0, Math.min(3, INGREDIENTS_PER_TURN));
  const remainingPool = shuffleWithRng(
    [...unlocked.slice(guaranteedUnlocked.length), ...locked],
    poolRng
  );

  const pickedCatalog = [
    ...guaranteedUnlocked,
    ...remainingPool.slice(0, Math.max(0, INGREDIENTS_PER_TURN - guaranteedUnlocked.length)),
  ].sort((a, b) => a.quality - b.quality || a.effectiveUnitCost - b.effectiveUnitCost);

  const list: EvaluatedIngredient[] = [...pickedCatalog];

  const eligibleComps = (state.competitors ?? []).filter(
    c => (c.status ?? 'active') === 'active' && !c.atWarWithPlayer
  );

  if (eligibleComps.length > 0) {
    const compRng = makeRng(`${state.seed}:prod-comp-ing`, state.turn * 37 + 19);
    const allies = getPlayerAllies(state);
    const friendsOfAllies = new Set<string>();
    for (const a of allies) {
      for (const fId of a.allies ?? []) friendsOfAllies.add(fId);
    }

    const preferredPool =
      allies.length > 0 && compRng.next() < 0.55 ? allies : eligibleComps;
    const comp: Competitor | undefined = compRng.pick([...preferredPool]);

    if (comp) {
      const compQuality = Math.min(
        10,
        Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10))
      );
      const baseCost = BASE_COST_BY_QUALITY[compQuality] ?? 110;
      const baseWholesale = BASE_WHOLESALE_BY_QUALITY[compQuality] ?? 240;

      let compUnitCost = Math.round(baseCost * factors.priceIndex);
      let relationNote = `Opinia o Tobie: ${Math.round(comp.opinionOfPlayer)}%.`;

      if (comp.isAlliedWithPlayer) {
        compUnitCost = Math.round(compUnitCost * 0.78);
        relationNote = 'Cena sojusznicza (-22%).';
      } else if (friendsOfAllies.has(comp.id)) {
        compUnitCost = Math.round(compUnitCost * 0.88);
        relationNote = 'Zniżka po znajomości przez sojusznika (-12%).';
      } else if (comp.opinionOfPlayer < 40) {
        compUnitCost = Math.round(compUnitCost * (1 + (40 - comp.opinionOfPlayer) * 0.01));
      } else if (comp.opinionOfPlayer > 60) {
        compUnitCost = Math.round(compUnitCost * 0.9);
      }

      if (comp.condition < 35) {
        compUnitCost = Math.round(compUnitCost * 0.8);
      }

      const effectiveWholesalePrice = Math.max(
        10,
        Math.round(baseWholesale * factors.priceIndex * factors.combinedMultiplier)
      );

      list.push({
        id: `comp_ing_${comp.id}`,
        name: `${comp.name}`,
        desc: `Nadwyżki magazynowe składników. ${relationNote}`,
        quality: compQuality,
        unitCost: baseCost,
        baseWholesalePrice: baseWholesale,
        effectiveUnitCost: Math.max(5, compUnitCost),
        effectiveWholesalePrice,
        meetsRequirements: true,
        missingReasons: [],
        isCompetitor: true,
      });
    }
  }

  return list;
}

export function getProductionTools(state: GameState): EvaluatedTool[] {
  const tools = productionData.tools ?? [];
  const ownedIds = getOwnedToolIds(state);
  const currentSizeIdx = SIZE_ORDER.indexOf(state.company.size);

  return tools.map((tool) => {
    const missingReasons: string[] = [];
    if (tool.req?.minSize) {
      const reqIdx = SIZE_ORDER.indexOf(tool.req.minSize as CompanySize);
      if (currentSizeIdx < reqIdx) {
        const label = COMPANY_SIZE_CONFIG[tool.req.minSize as CompanySize]?.label ?? tool.req.minSize;
        missingReasons.push(`Rozmiar firmy: min. ${label}`);
      }
    }
    if (tool.req?.minRepBranza && state.company.reputation.opiniaBranza < tool.req.minRepBranza) {
      missingReasons.push(`Opinia w branży ≥ ${tool.req.minRepBranza}`);
    }

    const owned = ownedIds.includes(tool.id);
    const effectiveCost = tool.cost > 0 ? scaleByInflation(tool.cost, state) : 0;

    return {
      ...tool,
      effectiveCost,
      owned,
      meetsRequirements: missingReasons.length === 0,
      missingReasons,
    };
  });
}

export function estimateProductionBatch(
  state: GameState,
  ingredientId: string,
  toolId: string,
  workersCount: number
): ProductionBatchEstimate | null {
  const ingredient =
    getProductionIngredients(state).find(i => i.id === ingredientId) ??
    evaluateAllCatalogIngredients(state).find(i => i.id === ingredientId);
  const tool = getProductionTools(state).find(t => t.id === toolId);
  if (!ingredient || !tool) return null;

  const factors = getProductionMarketFactors(state);
  const safeWorkers = Math.max(1, Math.floor(workersCount));
  const units = safeWorkers * tool.unitsPerWorker;
  const quality = Math.min(10, Math.max(1, ingredient.quality + tool.qualityBonus + getUopQualityBonus(state)));

  const qualityDelta = Math.max(0, quality - ingredient.quality);
  const qualityMultiplier = 1 + qualityDelta * 0.12;
  const estimatedUnitPrice = Math.max(
    10,
    Math.round(ingredient.effectiveWholesalePrice * qualityMultiplier)
  );

  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const unitRange = getRevenueRange(estimatedUnitPrice, accuracy);
  const estimatedTotalRevenue = estimatedUnitPrice * units;
  const totalRange = getRevenueRange(estimatedTotalRevenue, accuracy);

  return {
    ingredient,
    tool,
    factors,
    workersCount: safeWorkers,
    units,
    unitCost: ingredient.effectiveUnitCost,
    totalCost: ingredient.effectiveUnitCost * units,
    quality,
    estimatedUnitPrice,
    unitMinPrice: unitRange.min,
    unitMaxPrice: unitRange.max,
    estimatedTotalRevenue,
    totalMinRevenue: totalRange.min,
    totalMaxRevenue: totalRange.max,
    spreadPercent: unitRange.spreadPercent,
  };
}

export function estimateStoredProducedItem(
  state: GameState,
  resId: string
): StoredProducedItemEstimate {
  const stock = state.company.resources[resId] ?? 0;
  const parts = resId.split('_');
  const quality = Math.min(10, Math.max(1, parseInt(parts[parts.length - 1], 10) || 1));

  const middleId = parts.slice(1, -1).join('_');
  const allIngredients = evaluateAllCatalogIngredients(state);
  const matchedIng = allIngredients.find(i => i.id === middleId);
  const factors = getProductionMarketFactors(state);

  const prodName = getActivityName(getProductionActivityId(state));

  let ingredientName = matchedIng?.name ?? 'Wyrób gotowy';
  if (!matchedIng && middleId.startsWith('comp_ing_')) {
    const compId = middleId.slice('comp_ing_'.length);
    const comp = (state.competitors ?? []).find(c => c.id === compId);
    ingredientName = comp ? `składniki od ${comp.name}` : 'składniki od konkurencji';
  }

  let estimatedUnitPrice: number;
  if (matchedIng) {
    const qualityDelta = Math.max(0, quality - matchedIng.quality);
    estimatedUnitPrice = Math.max(
      10,
      Math.round(matchedIng.effectiveWholesalePrice * (1 + qualityDelta * 0.12))
    );
  } else {
    const baseWholesale = BASE_WHOLESALE_BY_QUALITY[quality] ?? (quality * 90 + 60);
    estimatedUnitPrice = Math.max(
      10,
      Math.round(baseWholesale * factors.priceIndex * factors.combinedMultiplier)
    );
  }

  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const unitRange = getRevenueRange(estimatedUnitPrice, accuracy);
  // Bez mnożnika x2–x4 w handlu: baza do SellScreen to 100% wartości rynkowej wyrobu
  const retailBaseUnitPrice = estimatedUnitPrice;

  return {
    resId,
    label: `${prodName} (${ingredientName})`,
    ingredientName,
    quality,
    stock,
    estimatedUnitPrice,
    unitMinPrice: unitRange.min,
    unitMaxPrice: unitRange.max,
    retailBaseUnitPrice,
  };
}

// --- Eksporty zachowane dla kompatybilności wstecznej ---

export function getProductionCapacity(state: GameState): number {
  const emp = state.company.employees;
  const totalWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  return BASE_CEO_CAPACITY + totalWorkers * CAPACITY_PER_WORKER;
}

export function generateProductionSuppliers(state: GameState): TradeSupplier[] {
  const branchData = productionData.default;
  const rng = makeRng(state.seed, state.turn * 37 + 19);
  const result: TradeSupplier[] = [];

  const priceIndex = getPriceIndex(state);
  const dev = state.macroStats?.development ?? 40;
  const devFactor = 1 - Math.min(0.15, Math.max(-0.15, (dev - 40) * 0.003));
  const repBranza = state.company.reputation.opiniaBranza;
  const repDiscount = Math.min(0.12, (repBranza / 100) * 0.12);
  const allianceDiscount = getAllianceTradeDiscount(state);
  const totalDiscount = Math.min(0.35, repDiscount + allianceDiscount);

  if (branchData?.suppliers) {
    const valid = branchData.suppliers.filter(s => {
      if (s.req?.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req?.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });

    for (const sup of valid) {
      const calculatedPrice = Math.round(sup.price * priceIndex * devFactor * (1 - totalDiscount));
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

  const eligibleComps = (state.competitors ?? []).filter(
    c => (c.status ?? 'active') === 'active' && !c.atWarWithPlayer
  );
  if (eligibleComps.length > 0) {
    const comp: Competitor = rng.pick([...eligibleComps]);
    if (comp) {
      const compQuality = Math.min(10, Math.max(2, Math.round((comp.reputation * 0.6 + comp.condition * 0.4) / 10)));
      let baseCompPrice = Math.round((compQuality * 110 + 70) * priceIndex);
      if (comp.isAlliedWithPlayer) {
        baseCompPrice = Math.round(baseCompPrice * 0.78);
      } else if (comp.opinionOfPlayer < 40) {
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
        desc: `Nadwyżki magazynowe półproduktów. Opinia o Tobie: ${Math.round(comp.opinionOfPlayer)}%.`,
        quality: compQuality,
        price: Math.max(5, baseCompPrice),
      });
    }
  }

  return result.sort(() => rng.next() - 0.5).slice(0, 3);
}

export function generateProductionBuyers(state: GameState): TradeBuyer[] {
  return generateTradeBuyers(state);
}