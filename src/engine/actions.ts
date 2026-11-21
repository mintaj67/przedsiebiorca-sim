import type {
  GameState,
  ContractType,
  Pace,
  EventEffects,
  CompanySize,
  NewsItem,
  TradeSupplier,
  TradeBuyer,
  InstallmentOption,
  ServiceDefinition,
} from './types';
import {
  MAX_PARTY_SWITCHES_PER_PHASE,
  ACTIVITY_CHANGE_COOLDOWN,
  BANKRUPT_EMERGENCY_LOAN,
  WORKER_CONFIG,
  COMPANY_EXPANSION_CONFIG,
  BRANCH_COST,
  MAX_NEWS,
  COMPANY_SIZE_CONFIG,
} from './constants';
import {
  computeStartingActivityStats,
  getCompanyActivities,
  getCategoryIdsForActivities,
  getRequiredWorkers,
} from './activityHelper';
import { recomputeReputation } from './reputation';
import { makeRng } from './rng';
import { getInflationRate, getLoanQuarterlyRate, scaleByInflation } from './economy';
import { formatMoney, formatMoneyRange } from './currency';
import { getProductionCapacity } from './productionHelper';
import { getRevenueRange } from './tradeHelper';
import {
  getTotalServiceWorkerSlots,
  getBusyServiceWorkers,
  getAvailableServices,
} from './servicesHelper';

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function calculateInstallmentPrice(price: number, installments: InstallmentOption): number {
  if (installments <= 1) return price;
  const tiers: Record<InstallmentOption, number> = {
    1: 0,
    2: 0.05,
    6: 0.10,
    12: 0.15,
    24: 0.20,
  };
  const surcharge = tiers[installments] ?? 0.05;
  return Math.round(price * (1 + surcharge));
}

export function applyHire(state: GameState, contract: ContractType, delta: number): GameState {
  const s = structuredClone(state);
  const current = s.company.employees[contract];
  const newCount = Math.max(0, current + delta);
  const actualDelta = newCount - current;

  if (actualDelta < 0 && contract === 'uop') {
    const fired = Math.abs(actualDelta);
    const severance = scaleByInflation(fired * WORKER_CONFIG.uop.severance, s);
    if (s.company.finances.stanKonta < severance) return s;
    s.company.finances.stanKonta -= severance;
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
  const rate = getLoanQuarterlyRate(source, getInflationRate(s));
  s.company.loans.push({
    id: `loan_${s.turn}_${s.company.loans.length}`,
    source,
    principal: amount,
    remaining: amount,
    interestRate: rate,
    quartersLeft: 12,
  });
  s.company.finances.stanKonta += amount;
  if (source === 'bank') s.company.finances.wplywy.srodkiZKredytow += amount;
  else s.company.finances.wplywy.dofinansowaniaSzaraStrefa += amount;
  return s;
}

export function applyChangeActivity(state: GameState, activityOrList: string | string[]): GameState {
  const s = structuredClone(state);
  if (s.turn - s.company.lastActivityChangeTurn < ACTIVITY_CHANGE_COOLDOWN) return s;

  const selectedActivities = Array.isArray(activityOrList)
    ? activityOrList
    : activityOrList.split(',').filter(Boolean);

  if (selectedActivities.length === 0) return s;

  const oldBranza = s.company.reputation.branza;
  const { branza, mafia } = computeStartingActivityStats(selectedActivities);

  s.company.activity = selectedActivities[0];
  s.company.activities = selectedActivities;
  s.company.reputation.branza = branza;
  s.company.reputation.opiniaMafia = mafia;
  s.company.lastActivityChangeTurn = s.turn;

  // Jeśli gracz zrezygnował z usług, czyścimy włączone na stałe usługi
  const hasServices = selectedActivities.some(id => id.startsWith('usl_') || id.startsWith('gast_'));
  if (!hasServices) {
    s.activeServiceIds = [];
  }

  const delta = s.company.reputation.branza - oldBranza;
  s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza + delta * 0.3);
  s.company.reputation = recomputeReputation(s);

  return s;
}

export function applyJoinParty(state: GameState, partyId: string): GameState {
  const s = structuredClone(state);
  if (s.year <= 1989) return s;
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
  if (s.company.finances.stanKonta > 0) return s;

  const amount = scaleByInflation(BANKRUPT_EMERGENCY_LOAN.amount, s);
  const rate = Math.max(
    BANKRUPT_EMERGENCY_LOAN.interestRate,
    getLoanQuarterlyRate('szara_strefa', getInflationRate(s)) + 0.03
  );

  s.company.loans.push({
    id: `emergency_${s.turn}`,
    source: 'bank',
    principal: amount,
    remaining: amount,
    interestRate: Math.round(rate * 1000) / 1000,
    quartersLeft: BANKRUPT_EMERGENCY_LOAN.quartersLeft,
  });
  s.company.finances.stanKonta += amount;
  s.bankruptWarningTurns = 0;
  return s;
}

export function applySetPace(state: GameState, pace: Pace): GameState {
  const s = structuredClone(state);
  s.pace = pace;
  return s;
}

export function buyOfficeItem(state: GameState, itemId: string, price: number): GameState {
  const s = structuredClone(state);
  if (s.company.finances.stanKonta < price) return s;
  if (s.company.inventory.includes(itemId)) return s;

  s.company.finances.stanKonta -= price;
  s.company.inventory.push(itemId);
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function applyEffects(state: GameState, e: EventEffects) {
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      if (k === 'dokladnoscPrzewidywan' || k === 'bazowaDokladnosc') {
        const currentBase = state.company.reputation.bazowaDokladnosc ?? 50;
        state.company.reputation.bazowaDokladnosc = clamp(currentBase + (v as number));
      } else {
        (state.company.reputation as any)[k] = clamp((state.company.reputation as any)[k] + (v as number));
      }
    }
  }
  if (e.stanKonta) {
    state.company.finances.stanKonta += scaleByInflation(e.stanKonta, state);
  }
  if (e.wplywy) {
    for (const [k, v] of Object.entries(e.wplywy)) {
      (state.company.finances.wplywy as any)[k] += scaleByInflation(v as number, state);
    }
  }
  if (e.wydatki) {
    for (const [k, v] of Object.entries(e.wydatki)) {
      (state.company.finances.wydatki as any)[k] += scaleByInflation(v as number, state);
    }
  }
  if (e.flagsAdd) {
    for (const flag of e.flagsAdd) {
      if (!state.ceo.flags.includes(flag)) state.ceo.flags.push(flag);
    }
  }
  if (e.flagsRemove) {
    state.ceo.flags = state.ceo.flags.filter(f => !e.flagsRemove!.includes(f));
  }
  if (e.joinMafia) state.ceo.inMafia = true;
  if (e.leaveMafia) state.ceo.inMafia = false;
  if (e.setParty) state.ceo.party = e.setParty;
  if (e.setCurrentPartyId) state.ceo.currentPartyId = e.setCurrentPartyId;
  if (e.divideFinances) {
    // Model 2: bez dzielenia wartości bazowych w silniku — obcinamy 4 zera w wyświetlaniu UI
    state.denominated = true;
  }
  if (e.employeesDelta) {
    if (e.employeesDelta.bezUmowy) {
      state.company.employees.bezUmowy = Math.max(0, state.company.employees.bezUmowy + e.employeesDelta.bezUmowy);
    }
    if (e.employeesDelta.zlecenie) {
      state.company.employees.zlecenie = Math.max(0, state.company.employees.zlecenie + e.employeesDelta.zlecenie);
    }
    if (e.employeesDelta.uop) {
      state.company.employees.uop = Math.max(0, state.company.employees.uop + e.employeesDelta.uop);
    }
  }
  if (e.addItem && !state.company.inventory.includes(e.addItem)) {
    state.company.inventory.push(e.addItem);
  }
  state.company.reputation = recomputeReputation(state);
}

export function toggleAccountant(state: GameState): GameState {
  const s = structuredClone(state);
  s.company.hasAccountant = !s.company.hasAccountant;
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function changeCompanySize(state: GameState, direction: 'up' | 'down'): GameState {
  const s = structuredClone(state);
  const sizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'very_large', 'corporation'];
  const currentIndex = sizes.indexOf(s.company.size);

  let newIndex = currentIndex;
  if (direction === 'up' && currentIndex < sizes.length - 1) newIndex++;
  if (direction === 'down' && currentIndex > 0) newIndex--;
  if (newIndex === currentIndex) return s;

  const newSize = sizes[newIndex];
  const config = COMPANY_EXPANSION_CONFIG[newSize];

  if (direction === 'up') {
    const totalWorkers =
      s.company.employees.bezUmowy +
      s.company.employees.zlecenie +
      s.company.employees.uop;
    const activeCats = getCategoryIdsForActivities(getCompanyActivities(s.company));
    const reqWorkersForNextSize = getRequiredWorkers(newSize, activeCats.length);
    const expansionCost = scaleByInflation(config.cost, s);

    if (totalWorkers < reqWorkersForNextSize) return s;
    if (s.company.finances.stanKonta < expansionCost) return s;

    s.company.finances.stanKonta -= expansionCost;
    s.company.reputation.opiniaPubliczna += config.repBonus;
    s.company.reputation.opiniaPracownicy += config.repBonus;
    s.company.reputation.opiniaBranza += config.repBonus;
    s.company.reputation.opiniaMedia += config.repBonus;
  } else {
    s.company.reputation.opiniaPubliczna += config.repPenalty;
    s.company.reputation.opiniaPracownicy += config.repPenalty;
    s.company.reputation.opiniaBranza += config.repPenalty;
    s.company.reputation.opiniaMedia += config.repPenalty;
  }

  s.company.size = newSize;
  s.company.warehouseCapacity = COMPANY_SIZE_CONFIG[newSize].warehouseCapacity;
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function buildBranch(state: GameState): GameState {
  const s = structuredClone(state);
  if (!['large', 'very_large', 'corporation'].includes(s.company.size)) return s;
  const cost = scaleByInflation(BRANCH_COST, s);
  if (s.company.finances.stanKonta < cost) return s;

  s.company.finances.stanKonta -= cost;
  s.company.branches += 1;
  s.company.reputation.opiniaBranza += 5;
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function buyAd(state: GameState, type: 'radio' | 'tv' | 'internet'): GameState {
  const s = structuredClone(state);
  let baseCost = 0;
  let repGain = 0;
  let mediaGain = 0;

  if (type === 'radio') { baseCost = 5000; repGain = 2; mediaGain = 2; }
  if (type === 'tv') { baseCost = 50000; repGain = 8; mediaGain = 10; }
  if (type === 'internet') { baseCost = 15000; repGain = 4; mediaGain = 5; }

  const cost = scaleByInflation(baseCost, s);
  if (s.company.finances.stanKonta < cost) return s;

  s.company.finances.stanKonta -= cost;
  s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna + repGain);
  s.company.reputation.opiniaMedia = clamp(s.company.reputation.opiniaMedia + mediaGain);
  s.company.reputation = recomputeReputation(s);

  return s;
}

export function rentWarehouse(state: GameState): GameState {
  const s = structuredClone(state);
  const cost = scaleByInflation(10000, s);
  if (s.company.finances.stanKonta < cost) return s;

  s.company.finances.stanKonta -= cost;
  s.company.warehouseCapacity += 50;
  return s;
}

export function buyGoods(
  state: GameState,
  supplier: TradeSupplier,
  amount: number,
  installments: InstallmentOption = 1
): GameState {
  const s = structuredClone(state);
  if (amount <= 0) return s;

  const currentStock = Object.values(s.company.resources).reduce((a, b) => a + b, 0);
  const capacity = s.company.warehouseCapacity || COMPANY_SIZE_CONFIG[s.company.size].warehouseCapacity;
  if (currentStock + amount > capacity) return s;

  let discount = 0;
  if (amount === 10) discount = 0.10;
  if (amount === 50 || amount === 100) discount = 0.25;

  const baseTotal = Math.round(supplier.price * amount * (1 - discount));
  const finalPrice = calculateInstallmentPrice(baseTotal, installments);

  if (installments <= 1) {
    if (s.company.finances.stanKonta < finalPrice) return s;
    s.company.finances.stanKonta -= finalPrice;
    s.company.finances.wydatki.zakupy += finalPrice;
  } else {
    s.company.loans.push({
      id: `trade_install_${s.turn}_${Date.now()}`,
      source: 'zakup_raty',
      principal: finalPrice,
      remaining: finalPrice,
      interestRate: 0,
      quartersLeft: installments,
    });
  }

  const resId = `${supplier.id}_${supplier.quality}`;
  s.company.resources[resId] = (s.company.resources[resId] || 0) + amount;
  s.lastTradeNotice = `Kupiono: ${amount} szt. (${supplier.name}) za ${formatMoney(finalPrice, s)}${installments > 1 ? ` w ${installments} ratach` : ''}.`;

  return s;
}

export function sellGoods(
  state: GameState,
  buyer: TradeBuyer,
  resId: string,
  amount: number,
  unitPrice: number,
  installments: InstallmentOption = 1
): GameState {
  const s = structuredClone(state);
  if (amount <= 0) return s;

  const available = s.company.resources[resId] || 0;
  if (available < amount) return s;

  const parts = resId.split('_');
  const quality = parseInt(parts[parts.length - 1], 10) || 1;

  if (buyer.req?.minQuality && quality < buyer.req.minQuality) {
    return s;
  }

  s.company.resources[resId] -= amount;
  if (s.company.resources[resId] <= 0) {
    delete s.company.resources[resId];
  }

  const baseEstimated = Math.round(unitPrice * buyer.multiplier * amount);
  const estimatedRevenue = calculateInstallmentPrice(baseEstimated, installments);
  const accuracy = s.company.reputation.dokladnoscPrzewidywan ?? 50;
  const { min, max } = getRevenueRange(estimatedRevenue, accuracy);

  s.pendingSales.push({
    id: `sale_${s.turn}_${s.pendingSales.length}`,
    buyerName: buyer.name,
    resId,
    amount,
    estimatedRevenue,
    minRevenue: min,
    maxRevenue: max,
    quality,
    hasComplaints: buyer.complaints,
    installments,
  });

  s.lastTradeNotice = `Wysłano: ${amount} szt. do ${buyer.name} (orientacyjny przychód: ${formatMoneyRange(min, max, s)}${installments > 1 ? ` w ${installments} ratach` : ''}).`;

  return s;
}

export function resolvePendingSales(state: GameState): void {
  if (state.pendingSales.length === 0) return;

  const rng = makeRng(state.seed, state.turn * 13 + 9);
  let totalRevenueThisTurn = 0;
  const lines: string[] = [];

  for (let i = 0; i < state.pendingSales.length; i++) {
    const sale = state.pendingSales[i];
    const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
    const fallbackRange = getRevenueRange(sale.estimatedRevenue, accuracy);
    const minRev = sale.minRevenue ?? fallbackRange.min;
    const maxRev = sale.maxRevenue ?? fallbackRange.max;

    const finalRevenue = Math.round(minRev + rng.next() * (maxRev - minRev));
    const installments = sale.installments || 1;

    if (installments <= 1) {
      totalRevenueThisTurn += finalRevenue;
      state.company.finances.stanKonta += finalRevenue;
      state.company.finances.wplywy.przychodyZDzialalnosci += finalRevenue;
      lines.push(
        `• ${sale.buyerName}: ${sale.amount} szt. (jakość ${sale.quality}) → ostateczny utarg: ${formatMoney(finalRevenue, state)} (szacowano ${formatMoneyRange(minRev, maxRev, state)}).`
      );
    } else {
      const quarterlyPayment = Math.round(finalRevenue / installments);
      totalRevenueThisTurn += quarterlyPayment;
      state.company.finances.stanKonta += quarterlyPayment;
      state.company.finances.wplywy.przychodyZDzialalnosci += quarterlyPayment;
      lines.push(
        `• ${sale.buyerName}: ${sale.amount} szt. (jakość ${sale.quality}) → rata 1/${installments}: +${formatMoney(quarterlyPayment, state)} (ostateczna wartość kontraktu: ${formatMoney(finalRevenue, state)}).`
      );
    }

    if (sale.hasComplaints && sale.quality < 5) {
      const chance = 0.6 - sale.quality * 0.1;
      if (rng.next() < chance) {
        state.pendingComplaints.push({
          id: `comp_${state.turn}_${i}_${state.pendingComplaints.length}`,
          itemName: sale.resId.split('_')[0],
          buyerName: sale.buyerName,
          penalty: 10 - sale.quality,
        });
      }
    }
  }

  if (totalRevenueThisTurn > 0 || state.pendingComplaints.length > 0) {
    const newsItem: NewsItem = {
      id: `sales_report_${state.turn}_${state.news.length}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: 'Rozliczenie transakcji handlowych',
      body: `Kontrahenci rozliczyli zamówienia z poprzedniego kwartału.\nŁączny wpływ do kasy: ${formatMoney(totalRevenueThisTurn, state)}.\n\nSzczegóły:\n${lines.join('\n')}`,
      category: 'economy',
      read: false,
    };
    state.news.unshift(newsItem);
    if (state.news.length > MAX_NEWS) state.news.pop();
  }

  state.pendingSales = [];
}

export function resolveComplaint(state: GameState, id: string, accept: boolean): GameState {
  const s = structuredClone(state);
  const comp = s.pendingComplaints.find(c => c.id === id);
  if (!comp) return s;

  if (accept) {
    s.company.finances.stanKonta -= scaleByInflation(5000, s);
    s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna + 2);
  } else {
    s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna - comp.penalty);
    s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza - comp.penalty);
  }

  s.pendingComplaints = s.pendingComplaints.filter(c => c.id !== id);
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function buyRawMaterials(
  state: GameState,
  supplier: TradeSupplier,
  amount: number,
  installments: InstallmentOption = 1
): GameState {
  const s = structuredClone(state);
  if (amount <= 0) return s;

  const currentStock = Object.values(s.company.resources).reduce((a, b) => a + b, 0);
  const capacity = s.company.warehouseCapacity || COMPANY_SIZE_CONFIG[s.company.size].warehouseCapacity;
  if (currentStock + amount > capacity) return s;

  let discount = 0;
  if (amount === 10) discount = 0.10;
  if (amount === 50 || amount === 100) discount = 0.25;

  const baseTotal = Math.round(supplier.price * amount * (1 - discount));
  const finalPrice = calculateInstallmentPrice(baseTotal, installments);

  if (installments <= 1) {
    if (s.company.finances.stanKonta < finalPrice) return s;
    s.company.finances.stanKonta -= finalPrice;
    s.company.finances.wydatki.zakupy += finalPrice;
  } else {
    s.company.loans.push({
      id: `raw_install_${s.turn}_${Date.now()}`,
      source: 'zakup_raty',
      principal: finalPrice,
      remaining: finalPrice,
      interestRate: 0,
      quartersLeft: installments,
    });
  }

  const resId = `raw_${supplier.id}_${supplier.quality}`;
  s.company.resources[resId] = (s.company.resources[resId] || 0) + amount;
  s.lastTradeNotice = `Surowce: kupiono ${amount} szt. (${supplier.name}) za ${formatMoney(finalPrice, s)}.`;

  return s;
}

export function produceGoods(state: GameState, rawResId: string, amount: number): GameState {
  const s = structuredClone(state);
  if (amount <= 0 || !rawResId.startsWith('raw_')) return s;

  const availableRaw = s.company.resources[rawResId] || 0;
  if (availableRaw < amount) return s;

  const maxCap = getProductionCapacity(s);
  const used = s.productionUsedThisTurn ?? 0;
  if (used + amount > maxCap) return s;

  const parts = rawResId.split('_');
  const rawQuality = parseInt(parts[parts.length - 1], 10) || 1;

  const emp = s.company.employees;
  const totalWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  const qualityBonus = totalWorkers > 0 && emp.uop / totalWorkers >= 0.5 ? 1 : 0;
  const finalQuality = Math.min(10, rawQuality + qualityBonus);

  s.company.resources[rawResId] -= amount;
  if (s.company.resources[rawResId] <= 0) {
    delete s.company.resources[rawResId];
  }

  const prodResId = `prod_wyrob_${finalQuality}`;
  s.company.resources[prodResId] = (s.company.resources[prodResId] || 0) + amount;
  s.productionUsedThisTurn = used + amount;
  s.lastTradeNotice = `Produkcja: wytworzono ${amount} szt. wyrobów gotowych (jakość ${finalQuality}/10). Sprzedaj je w zakładce Sprzedawaj.`;

  return s;
}

/** Włącza lub wyłącza wybraną usługę na stałe. */
export function toggleService(state: GameState, serviceId: string): GameState {
  const s = structuredClone(state);
  const activeIds = s.activeServiceIds ?? [];

  if (activeIds.includes(serviceId)) {
    s.activeServiceIds = activeIds.filter(id => id !== serviceId);
    s.lastTradeNotice = `Wstrzymano świadczenie wybranej usługi.`;
    return s;
  }

  const available = getAvailableServices(s);
  const target = available.find(srv => srv.id === serviceId);
  if (!target || !target.meetsRequirements) return s;

  const totalSlots = getTotalServiceWorkerSlots(s);
  const busySlots = getBusyServiceWorkers(s);
  if (busySlots + target.workersRequired > totalSlots) return s;

  s.activeServiceIds = [...activeIds, serviceId];
  s.lastTradeNotice = `Uruchomiono stałą usługę: "${target.title}" (orientacyjny przychód: ${formatMoneyRange(target.minPayout, target.maxPayout, s)} / kw.).`;
  return s;
}

/** Alias zachowany dla kompatybilności wstecznej */
export function acceptServiceOrder(state: GameState, order: ServiceDefinition | string): GameState {
  const serviceId = typeof order === 'string' ? order : order.id;
  return toggleService(state, serviceId);
}

/** Rozlicza aktywne stałe usługi na przełomie tury. */
export function resolvePendingServices(state: GameState): void {
  const activeIds = state.activeServiceIds ?? [];
  if (activeIds.length === 0) return;

  const rng = makeRng(state.seed, state.turn * 71 + 13);
  const evaluated = getAvailableServices(state);
  const totalSlots = getTotalServiceWorkerSlots(state);
  let usedSlots = 0;

  let totalPayout = 0;
  const lines: string[] = [];
  const stillActiveIds: string[] = [];

  for (const id of activeIds) {
    const srv = evaluated.find(item => item.id === id);
    if (!srv) continue;

    if (!srv.meetsRequirements) {
      lines.push(
        `• ❌ ${srv.title}: usługa wyłączona — firma przestała spełniać wymagania (${srv.missingReasons.join(', ')}).`
      );
      continue;
    }

    if (usedSlots + srv.workersRequired > totalSlots) {
      lines.push(
        `• ❌ ${srv.title}: usługa wyłączona — brak wolnych mocy kadrowych (wymagane ${srv.workersRequired} os.).`
      );
      continue;
    }

    usedSlots += srv.workersRequired;
    stillActiveIds.push(id);

    const rolledRevenue = Math.round(srv.minPayout + rng.next() * (srv.maxPayout - srv.minPayout));
    const repProtection = (state.company.reputation.opiniaPubliczna + state.company.reputation.opiniaBranza) / 400;
    const effectiveRisk = Math.max(0.02, srv.risk - repProtection);

    if (rng.next() < effectiveRisk) {
      const reducedPayout = Math.round(rolledRevenue * 0.5);
      totalPayout += reducedPayout;
      state.company.finances.stanKonta += reducedPayout;
      state.company.finances.wplywy.przychodyZDzialalnosci += reducedPayout;
      state.company.reputation.opiniaPubliczna = clamp(state.company.reputation.opiniaPubliczna - 3);
      lines.push(
        `• ⚠ ${srv.title}: reklamacje klientów! Przychód wyniósł tylko ${formatMoney(reducedPayout, state)} (-3 rep.).`
      );
    } else {
      totalPayout += rolledRevenue;
      state.company.finances.stanKonta += rolledRevenue;
      state.company.finances.wplywy.przychodyZDzialalnosci += rolledRevenue;
      state.company.reputation.opiniaBranza = clamp(state.company.reputation.opiniaBranza + srv.repGain);
      lines.push(
        `• ✓ ${srv.title}: +${formatMoney(rolledRevenue, state)} (szacowano ${formatMoneyRange(srv.minPayout, srv.maxPayout, state)}, +${srv.repGain} rep. branży).`
      );
    }
  }

  state.activeServiceIds = stillActiveIds;
  state.company.reputation = recomputeReputation(state);

  if (lines.length > 0) {
    const newsItem: NewsItem = {
      id: `services_report_${state.turn}_${state.news.length}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: 'Rozliczenie świadczonych usług',
      body: `Podsumowanie przychodów z aktywnych usług za miniony kwartał.\nŁączny przychód: ${formatMoney(totalPayout, state)}.\n\nSzczegóły:\n${lines.join('\n')}`,
      category: 'economy',
      read: false,
    };
    state.news.unshift(newsItem);
    if (state.news.length > MAX_NEWS) state.news.pop();
  }
}