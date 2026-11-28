import type {
  GameState,
  ContractType,
  Pace,
  EventEffects,
  CompanySize,
  NewsItem,
  TradeSupplier,
  TradeBuyer,
  TradeProductOffer,
  TradeSpecialCategory,
  InstallmentOption,
  ServiceDefinition,
  TurnActionEntry,
} from './types';
import {
  ensureBranchCompetitors,
  getAllianceTradeDiscount,
  getPlayerParentInfo,
  grantEquityToCompetitor,
  joinAllyWarInState,
  openWarInState,
  refuseAllyWarInState,
} from './competition';
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
  getActivityFullInfo,
} from './activityHelper';
import { recomputeReputation } from './reputation';
import { makeRng } from './rng';
import { getInflationRate, getLoanQuarterlyRate, scaleByInflation } from './economy';
import { formatMoney, formatMoneyRange } from './currency';
import {
  getProductionCapacity,
  getOwnedToolIds,
  getProductionTools,
  getProductionIngredients,
  getAvailableProductionWorkers,
  estimateProductionBatch,
  estimateStoredProducedItem,
} from './productionHelper';
import {
  getRevenueRange,
  getRemainingTradeBuyLimit,
  getRemainingTradeSellLimit,
  getRemainingOfferStock,
  estimateStoredTradeItem,
} from './tradeHelper';
import {
  getTotalServiceWorkerSlots,
  getBusyServiceWorkers,
  getAvailableServices,
} from './servicesHelper';

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const MAX_UNDO_STEPS = 15;

const CONTRACT_LABELS: Record<ContractType, string> = {
  bezUmowy: 'bez umowy',
  zlecenie: 'umowa zlecenie',
  uop: 'umowa o pracę',
};

const AD_LABELS: Record<'radio' | 'tv' | 'internet', string> = {
  radio: 'Reklama radiowa',
  tv: 'Reklama telewizyjna',
  internet: 'Reklama internetowa',
};

/** Zapisuje migawkę stanu przed mutacją, aby gracz mógł cofnąć ruch w bieżącej turze. */
export function captureUndoSnapshot(state: GameState): GameState {
  const s = structuredClone(state);
  const prevStack = Array.isArray(s.undoStack) ? s.undoStack.slice(-(MAX_UNDO_STEPS - 1)) : [];
  const snapshot = structuredClone(state);
  delete snapshot.undoStack;
  s.undoStack = [...prevStack, snapshot];
  return s;
}

/** Cofa ostatni odwracalny ruch wykonany w bieżącej turze. */
export function undoLastAction(state: GameState): GameState {
  if (state.gameOver) return state;
  const stack = Array.isArray(state.undoStack) ? state.undoStack : [];
  if (stack.length === 0) return state;

  const previous = structuredClone(stack[stack.length - 1]);
  previous.undoStack = stack.slice(0, -1);
  return previous;
}

/** Rejestruje akcję wykonaną w bieżącej turze na rozwijanym pasku aktywności. */
export function recordTurnAction(
  state: GameState,
  entry: Omit<TurnActionEntry, 'id'>
): void {
  if (!Array.isArray(state.turnActions)) {
    state.turnActions = [];
  }
  state.turnActions.push({
    id: `ta_${state.turn}_${state.turnActions.length}`,
    canUndo: true,
    ...entry,
  });
  state.lastTradeNotice = entry.text;
}

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
  const current = state.company.employees[contract];
  const pendingForContract = (state.pendingHires ?? [])
    .filter(h => h.contract === contract)
    .reduce((sum, h) => sum + h.count, 0);

  if (delta > 0) {
    const s = captureUndoSnapshot(state);
    const repImpact = WORKER_CONFIG[contract].reputationImpact;
    s.company.reputation.opiniaPracownicy = clamp(
      s.company.reputation.opiniaPracownicy + repImpact * delta
    );
    const nextPendingIdx = (s.pendingHires ?? []).length;
    s.pendingHires = [
      ...(s.pendingHires ?? []),
      {
        id: `hire_${s.turn}_${nextPendingIdx}_${contract}`,
        contract,
        count: delta,
        hiredOnTurn: s.turn,
      },
    ];
    s.company.reputation = recomputeReputation(s);

    recordTurnAction(s, {
      icon: '👥',
      category: 'Pracownicy',
      text: `Zakontraktowano +${delta} os. (${CONTRACT_LABELS[contract]}) — dołączą w kolejnej turze.`,
      target: 'employees',
    });

    return s;
  }

  if (delta < 0) {
    const fireWant = Math.abs(delta);

    if (current === 0 && pendingForContract > 0) {
      const s = captureUndoSnapshot(state);
      let leftToCancel = Math.min(fireWant, pendingForContract);
      const nextPending = [];
      for (const h of s.pendingHires ?? []) {
        if (h.contract === contract && leftToCancel > 0) {
          const take = Math.min(h.count, leftToCancel);
          leftToCancel -= take;
          if (h.count - take > 0) {
            nextPending.push({ ...h, count: h.count - take });
          }
        } else {
          nextPending.push(h);
        }
      }
      s.pendingHires = nextPending;
      recordTurnAction(s, {
        icon: '👥',
        category: 'Pracownicy',
        text: `Anulowano zakontraktowanie ${Math.abs(delta)} os. (${CONTRACT_LABELS[contract]}).`,
        target: 'employees',
      });
      return s;
    }

    const newCount = Math.max(0, current - fireWant);
    const fired = current - newCount;
    if (fired <= 0) return state;

    const s = captureUndoSnapshot(state);
    if (contract === 'uop') {
      const severance = scaleByInflation(fired * WORKER_CONFIG.uop.severance, s);
      if (s.company.finances.stanKonta < severance) return state;
      s.company.finances.stanKonta -= severance;
      s.company.finances.wydatki.pracownicy += severance;
    } else {
      s.company.reputation.opiniaPracownicy = Math.max(
        0,
        s.company.reputation.opiniaPracownicy - fired * 2
      );
    }

    s.company.employees[contract] = newCount;
    s.company.reputation = recomputeReputation(s);

    recordTurnAction(s, {
      icon: '👥',
      category: 'Pracownicy',
      text: `Zwolniono ${fired} os. (${CONTRACT_LABELS[contract]}).`,
      target: 'employees',
    });

    return s;
  }

  return state;
}

export function applyLoan(state: GameState, source: 'bank' | 'szara_strefa', amount: number): GameState {
  const s = captureUndoSnapshot(state);
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

  recordTurnAction(s, {
    icon: '💰',
    category: 'Finanse',
    text: `Zaciągnięto ${source === 'bank' ? 'kredyt bankowy' : 'pożyczkę z szarej strefy'}: ${formatMoney(amount, s)}.`,
    target: 'statistics',
  });

  return s;
}

export function applyChangeActivity(state: GameState, activityOrList: string | string[]): GameState {
  if (state.turn - state.company.lastActivityChangeTurn < ACTIVITY_CHANGE_COOLDOWN) return state;

  const selectedActivities = Array.isArray(activityOrList)
    ? activityOrList
    : activityOrList.split(',').filter(Boolean);

  if (selectedActivities.length === 0) return state;

  const s = captureUndoSnapshot(state);
  const oldBranza = s.company.reputation.branza;
  const { branza, mafia } = computeStartingActivityStats(selectedActivities);

  s.company.activity = selectedActivities[0];
  s.company.activities = selectedActivities;
  s.company.reputation.branza = branza;
  s.company.reputation.opiniaMafia = mafia;
  s.company.lastActivityChangeTurn = s.turn;

  const hasServices = selectedActivities.some(id => id.startsWith('usl_') || id.startsWith('gast_'));
  if (!hasServices) {
    s.activeServiceIds = [];
  }

  const delta = s.company.reputation.branza - oldBranza;
  s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza + delta * 0.3);

  const parentInfo = getPlayerParentInfo(s);
  if (parentInfo?.isControlling) {
    s.company.parentDispleasure = clamp((s.company.parentDispleasure ?? 0) + 20);
  }

  ensureBranchCompetitors(s, true);
  s.company.reputation = recomputeReputation(s);

  const info = getActivityFullInfo(selectedActivities);
  recordTurnAction(s, {
    icon: '🏢',
    category: 'Działalność',
    text: `Zmieniono profil działalności na: ${info.category} (${info.subcategory}).`,
    target: 'changeActivity',
  });

  return s;
}

export function applyJoinParty(state: GameState, partyId: string): GameState {
  if (state.year <= 1989) return state;
  if (state.ceo.partySwitchesByPhase[state.phase] >= MAX_PARTY_SWITCHES_PER_PHASE) return state;

  const s = captureUndoSnapshot(state);
  s.ceo.currentPartyId = partyId;
  s.ceo.partySwitchesByPhase[s.phase] += 1;
  s.company.reputation.opiniaPolitycy = clamp(s.company.reputation.opiniaPolitycy - 5);
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '🏛️',
    category: 'Polityka',
    text: `Wstąpiono do partii (${partyId.toUpperCase()}).`,
    target: 'party',
  });

  return s;
}

export function applyLeaveParty(state: GameState): GameState {
  if (!state.ceo.currentPartyId) return state;
  const s = captureUndoSnapshot(state);
  s.ceo.currentPartyId = null;

  recordTurnAction(s, {
    icon: '🏛️',
    category: 'Polityka',
    text: 'Opuszczono dotychczasową partię polityczną.',
    target: 'party',
  });

  return s;
}

export function applyEmergencyLoan(state: GameState): GameState {
  if (state.company.finances.stanKonta > 0) return state;

  const s = captureUndoSnapshot(state);
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
  s.company.finances.wplywy.srodkiZKredytow += amount;
  s.bankruptWarningTurns = 0;

  recordTurnAction(s, {
    icon: '🚨',
    category: 'Finanse',
    text: `Zaciągnięto kredyt ratunkowy: ${formatMoney(amount, s)}.`,
    target: 'statistics',
  });

  return s;
}

export function applySetPace(state: GameState, _pace: Pace): GameState {
  if (state.pace === 'quarter') return state;
  const s = structuredClone(state);
  s.pace = 'quarter';
  return s;
}

export function buyOfficeItem(state: GameState, itemId: string, price: number): GameState {
  if (state.company.finances.stanKonta < price) return state;
  if (state.company.inventory.includes(itemId)) return state;

  const s = captureUndoSnapshot(state);
  s.company.finances.stanKonta -= price;
  s.company.finances.wydatki.zakupy += price;
  s.company.inventory.push(itemId);
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '🪑',
    category: 'Biuro',
    text: `Kupiono wyposażenie biura (${itemId}) za ${formatMoney(price, s)}.`,
    target: 'office',
  });

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
    const scaled = scaleByInflation(e.stanKonta, state);
    state.company.finances.stanKonta += scaled;
    if (scaled > 0 && !e.wplywy) {
      state.company.finances.wplywy.dofinansowania += scaled;
    } else if (scaled < 0 && !e.wydatki) {
      state.company.finances.wydatki.wydatkiNieplanowane += Math.abs(scaled);
    }
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

  if (typeof e.parentDispleasureDelta === 'number') {
    state.company.parentDispleasure = clamp(
      (state.company.parentDispleasure ?? 0) + e.parentDispleasureDelta
    );
    const parentInfo = getPlayerParentInfo(state);
    if (parentInfo?.isControlling && state.company.parentDispleasure >= 100) {
      state.gameOver = {
        reason: `Odwołanie ze stanowiska CEO — spółka-matka (${parentInfo.parent.name}) straciła do Ciebie cierpliwość.`,
      };
    }
  }
  if (e.joinWarAsAlly) {
    joinAllyWarInState(state, e.joinWarAsAlly.warId, e.joinWarAsAlly.allyId);
  }
  if (e.refuseWarCall) {
    refuseAllyWarInState(state, e.refuseWarCall.allyId);
  }
  if (e.sellEquityTo) {
    grantEquityToCompetitor(
      state,
      e.sellEquityTo.holderId,
      e.sellEquityTo.percent,
      e.sellEquityTo.cashReceived
    );
  }
  if (e.addTribute) {
    if (!Array.isArray(state.tributes)) state.tributes = [];
    state.tributes.push({
      id: `trib_fx_${state.turn}_${state.tributes.length}`,
      ...e.addTribute,
    });
  }
  if (e.payReparationsTo) {
    state.company.finances.stanKonta -= e.payReparationsTo.amount;
    state.company.finances.wydatki.kary += e.payReparationsTo.amount;
    const comp = (state.competitors ?? []).find(c => c.id === e.payReparationsTo!.compId);
    if (comp) comp.value += e.payReparationsTo.amount;
  }
  if (e.startWarWith) {
    openWarInState(state, 'player', e.startWarWith, false);
  }

  state.company.reputation = recomputeReputation(state);
}

export function toggleAccountant(state: GameState): GameState {
  const s = captureUndoSnapshot(state);
  s.company.hasAccountant = !s.company.hasAccountant;
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '🧮',
    category: 'Pracownicy',
    text: s.company.hasAccountant ? 'Zatrudniono Panią Grażynę (księgową).' : 'Zwolniono Panią Grażynę (księgową).',
    target: 'employees',
  });

  return s;
}

export function changeCompanySize(state: GameState, direction: 'up' | 'down'): GameState {
  const sizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'very_large', 'corporation'];
  const currentIndex = sizes.indexOf(state.company.size);

  let newIndex = currentIndex;
  if (direction === 'up' && currentIndex < sizes.length - 1) newIndex++;
  if (direction === 'down' && currentIndex > 0) newIndex--;
  if (newIndex === currentIndex) return state;

  const newSize = sizes[newIndex];
  const config = COMPANY_EXPANSION_CONFIG[newSize];

  if (direction === 'up') {
    const totalWorkers =
      state.company.employees.bezUmowy +
      state.company.employees.zlecenie +
      state.company.employees.uop;
    const activeCats = getCategoryIdsForActivities(getCompanyActivities(state.company));
    const reqWorkersForNextSize = getRequiredWorkers(newSize, activeCats.length);
    const expansionCost = scaleByInflation(config.cost, state);

    if (totalWorkers < reqWorkersForNextSize) return state;
    if (state.company.finances.stanKonta < expansionCost) return state;
  }

  const s = captureUndoSnapshot(state);

  if (direction === 'up') {
    const expansionCost = scaleByInflation(config.cost, s);
    s.company.finances.stanKonta -= expansionCost;
    s.company.finances.wydatki.inne += expansionCost;
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

  const label = COMPANY_SIZE_CONFIG[newSize]?.label ?? newSize;
  recordTurnAction(s, {
    icon: direction === 'up' ? '📈' : '📉',
    category: 'Działalność',
    text: `${direction === 'up' ? 'Rozbudowano' : 'Zmniejszono'} firmę do rozmiaru: ${label}.`,
    target: 'changeActivity',
  });

  return s;
}

export function buildBranch(state: GameState): GameState {
  if (!['large', 'very_large', 'corporation'].includes(state.company.size)) return state;
  const cost = scaleByInflation(BRANCH_COST, state);
  if (state.company.finances.stanKonta < cost) return state;

  const s = captureUndoSnapshot(state);
  s.company.finances.stanKonta -= cost;
  s.company.finances.wydatki.inne += cost;
  s.company.branches += 1;
  s.company.reputation.opiniaBranza += 5;
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '🏗️',
    category: 'Działalność',
    text: `Otwarto nową filię (łącznie: ${s.company.branches}) za ${formatMoney(cost, s)}.`,
    target: 'changeActivity',
  });

  return s;
}

export function buyAd(state: GameState, type: 'radio' | 'tv' | 'internet'): GameState {
  let baseCost = 0;
  let repGain = 0;
  let mediaGain = 0;

  if (type === 'radio') { baseCost = 5000; repGain = 2; mediaGain = 2; }
  if (type === 'tv') { baseCost = 50000; repGain = 8; mediaGain = 10; }
  if (type === 'internet') { baseCost = 15000; repGain = 4; mediaGain = 5; }

  const cost = scaleByInflation(baseCost, state);
  if (state.company.finances.stanKonta < cost) return state;

  const s = captureUndoSnapshot(state);
  s.company.finances.stanKonta -= cost;
  s.company.finances.wydatki.inne += cost;
  s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna + repGain);
  s.company.reputation.opiniaMedia = clamp(s.company.reputation.opiniaMedia + mediaGain);
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '📣',
    category: 'Marketing',
    text: `Wykupiono: ${AD_LABELS[type]} za ${formatMoney(cost, s)}.`,
    target: 'marketing',
  });

  return s;
}

export function rentWarehouse(state: GameState): GameState {
  const cost = scaleByInflation(10000, state);
  if (state.company.finances.stanKonta < cost) return state;

  const s = captureUndoSnapshot(state);
  s.company.finances.stanKonta -= cost;
  s.company.finances.wydatki.czynsz += cost;
  s.company.warehouseCapacity += 50;

  const activeCats = getCategoryIdsForActivities(getCompanyActivities(s.company));
  recordTurnAction(s, {
    icon: '🏬',
    category: 'Magazyn',
    text: `Powiększono magazyn o +50 szt. (pojemność: ${s.company.warehouseCapacity}) za ${formatMoney(cost, s)}.`,
    target: activeCats.includes('handel') ? 'buy' : 'production',
  });

  return s;
}

export function buyGoods(
  state: GameState,
  supplier: TradeSupplier,
  offer: TradeProductOffer,
  amount: number,
  installments: InstallmentOption = 1
): GameState {
  if (amount <= 0) return state;
  if (amount > getRemainingTradeBuyLimit(state)) return state;

  const remainingOfferStock = getRemainingOfferStock(state, offer);
  if (remainingOfferStock !== null && amount > remainingOfferStock) return state;

  const currentStock = Object.values(state.company.resources).reduce((a, b) => a + b, 0);
  const capacity = state.company.warehouseCapacity || COMPANY_SIZE_CONFIG[state.company.size].warehouseCapacity;
  if (currentStock + amount > capacity) return state;

  let discount = 0;
  if (amount >= 50) discount = 0.25;
  else if (amount >= 10) discount = 0.10;

  const allianceDiscount = getAllianceTradeDiscount(state);
  const totalDiscount = Math.min(0.45, discount + allianceDiscount);

  const baseTotal = Math.round(offer.buyPrice * amount * (1 - totalDiscount));
  const finalPrice = calculateInstallmentPrice(baseTotal, installments);

  if (installments <= 1 && state.company.finances.stanKonta < finalPrice) {
    return state;
  }

  const s = captureUndoSnapshot(state);

  if (installments <= 1) {
    s.company.finances.stanKonta -= finalPrice;
    s.company.finances.wydatki.zakupy += finalPrice;
  } else {
    s.company.loans.push({
      id: `trade_install_${s.turn}_${s.company.loans.length}`,
      source: 'zakup_raty',
      principal: finalPrice,
      remaining: finalPrice,
      interestRate: 0,
      quartersLeft: installments,
    });
  }

  const resId = `item__${offer.productId}__q${offer.quality}`;
  s.company.resources[resId] = (s.company.resources[resId] || 0) + amount;
  s.tradeBoughtThisTurn = (s.tradeBoughtThisTurn ?? 0) + amount;

  if (offer.availableStock !== null) {
    if (!s.tradeOfferPurchasedThisTurn) s.tradeOfferPurchasedThisTurn = {};
    s.tradeOfferPurchasedThisTurn[offer.offerKey] =
      (s.tradeOfferPurchasedThisTurn[offer.offerKey] ?? 0) + amount;
  }

  recordTurnAction(s, {
    icon: '🛒',
    category: 'Handel',
    text: `Kupiono ${amount} szt. "${offer.name}" (${supplier.name}) za ${formatMoney(finalPrice, s)}${allianceDiscount > 0 ? ` (rabat sojuszniczy -${Math.round(allianceDiscount * 100)}%)` : ''}${installments > 1 ? ` w ${installments} ratach` : ''}.`,
    target: 'buy',
  });

  return s;
}

export function sellGoods(
  state: GameState,
  buyer: TradeBuyer,
  resId: string,
  amount: number,
  offeredUnitPrice: number,
  installments: InstallmentOption = 1,
  productName?: string,
  specialCategory?: TradeSpecialCategory | null
): GameState {
  if (amount <= 0) return state;
  if (amount > getRemainingTradeSellLimit(state)) return state;

  const available = state.company.resources[resId] || 0;
  if (available < amount) return state;

  let quality = 1;
  let resolvedName = productName ?? 'Towar';
  let resolvedSpecial: TradeSpecialCategory | null = specialCategory ?? null;

  if (resId.startsWith('prod_')) {
    const prodInfo = estimateStoredProducedItem(state, resId);
    quality = prodInfo.quality;
    resolvedName = productName ?? prodInfo.label;
  } else {
    const tradeInfo = estimateStoredTradeItem(state, resId);
    quality = tradeInfo.quality;
    resolvedName = productName ?? tradeInfo.name;
    if (specialCategory === undefined) {
      resolvedSpecial = tradeInfo.specialCategory;
    }
  }

  if (buyer.req?.minQuality && quality < buyer.req.minQuality) {
    return state;
  }

  const s = captureUndoSnapshot(state);

  s.company.resources[resId] -= amount;
  if (s.company.resources[resId] <= 0) {
    delete s.company.resources[resId];
  }
  s.tradeSoldThisTurn = (s.tradeSoldThisTurn ?? 0) + amount;

  const baseEstimated = Math.round(offeredUnitPrice * amount);
  const estimatedRevenue = calculateInstallmentPrice(baseEstimated, installments);
  const accuracy = s.company.reputation.dokladnoscPrzewidywan ?? 50;
  const { min, max } = getRevenueRange(estimatedRevenue, accuracy);

  s.pendingSales.push({
    id: `sale_${s.turn}_${s.pendingSales.length}`,
    buyerName: buyer.name,
    resId,
    productName: resolvedName,
    specialCategory: resolvedSpecial,
    amount,
    estimatedRevenue,
    minRevenue: min,
    maxRevenue: max,
    quality,
    hasComplaints: buyer.complaints,
    installments,
  });

  recordTurnAction(s, {
    icon: '📦',
    category: 'Sprzedaż',
    text: `Wysłano ${amount} szt. "${resolvedName}" do ${buyer.name} (orientacyjnie: ${formatMoneyRange(min, max, s)}${installments > 1 ? ` w ${installments} ratach` : ''}).`,
    target: 'sell',
  });

  return s;
}

export function resolvePendingSales(state: GameState): void {
  if (state.pendingSales.length === 0) return;

  const rng = makeRng(state.seed, state.turn * 13 + 9);
  let totalRevenueThisTurn = 0;
  let prestigeRepGain = 0;
  const lines: string[] = [];

  for (let i = 0; i < state.pendingSales.length; i++) {
    const sale = state.pendingSales[i];
    const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
    const fallbackRange = getRevenueRange(sale.estimatedRevenue, accuracy);
    const minRev = sale.minRevenue ?? fallbackRange.min;
    const maxRev = sale.maxRevenue ?? fallbackRange.max;

    const finalRevenue = Math.round(minRev + rng.next() * (maxRev - minRev));
    const installments = sale.installments || 1;
    const itemLabel = sale.productName ? `„${sale.productName}” ` : '';
    const whiteRavenBonus = sale.specialCategory === 'bialy_kruk' ? ' (+2 rep. w branży za białego kruka!)' : '';

    if (sale.specialCategory === 'bialy_kruk') {
      prestigeRepGain += 2;
    }

    if (installments <= 1) {
      totalRevenueThisTurn += finalRevenue;
      state.company.finances.stanKonta += finalRevenue;
      state.company.finances.wplywy.przychodyZDzialalnosci += finalRevenue;
      lines.push(
        `• ${sale.buyerName}: ${sale.amount} szt. ${itemLabel}(jakość ${sale.quality}/10) → ostateczny utarg: ${formatMoney(finalRevenue, state)} (szacowano ${formatMoneyRange(minRev, maxRev, state)}).${whiteRavenBonus}`
      );
    } else {
      const quarterlyPayment = Math.round(finalRevenue / installments);
      totalRevenueThisTurn += quarterlyPayment;
      state.company.finances.stanKonta += quarterlyPayment;
      state.company.finances.wplywy.przychodyZDzialalnosci += quarterlyPayment;
      lines.push(
        `• ${sale.buyerName}: ${sale.amount} szt. ${itemLabel}(jakość ${sale.quality}/10) → rata 1/${installments}: +${formatMoney(quarterlyPayment, state)} (ostateczna wartość kontraktu: ${formatMoney(finalRevenue, state)}).${whiteRavenBonus}`
      );
    }

    if (sale.hasComplaints && sale.quality < 5) {
      const chance = 0.6 - sale.quality * 0.1;
      if (rng.next() < chance) {
        state.pendingComplaints.push({
          id: `comp_${state.turn}_${i}_${state.pendingComplaints.length}`,
          itemName: sale.productName ?? sale.resId.split('_')[0],
          buyerName: sale.buyerName,
          penalty: 10 - sale.quality,
        });
      }
    }
  }

  if (prestigeRepGain > 0) {
    state.company.reputation.opiniaBranza = clamp(state.company.reputation.opiniaBranza + prestigeRepGain);
    state.company.reputation = recomputeReputation(state);
  }

  if (totalRevenueThisTurn > 0 || state.pendingComplaints.length > 0) {
    const newsItem: NewsItem = {
      id: `sales_report_${state.turn}_${state.news.length}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: 'Rozliczenie transakcji handlowych i zbytu',
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
  const comp = state.pendingComplaints.find(c => c.id === id);
  if (!comp) return state;

  const s = captureUndoSnapshot(state);

  if (accept) {
    const cost = scaleByInflation(5000, s);
    s.company.finances.stanKonta -= cost;
    s.company.finances.wydatki.kary += cost;
    s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna + 2);
  } else {
    s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna - comp.penalty);
    s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza - comp.penalty);
  }

  s.pendingComplaints = s.pendingComplaints.filter(c => c.id !== id);
  s.company.reputation = recomputeReputation(s);

  recordTurnAction(s, {
    icon: '📋',
    category: 'Reklamacje',
    text: `${accept ? 'Uznano' : 'Odrzucono'} reklamację od ${comp.buyerName}.`,
    target: 'sell',
  });

  return s;
}

// --- Moduł Produkcji ---

export function buyProductionTool(state: GameState, toolId: string): GameState {
  const tool = getProductionTools(state).find(t => t.id === toolId);
  if (!tool || tool.owned || !tool.meetsRequirements) return state;
  if (state.company.finances.stanKonta < tool.effectiveCost) return state;

  const s = captureUndoSnapshot(state);
  s.company.finances.stanKonta -= tool.effectiveCost;
  s.company.finances.wydatki.zakupy += tool.effectiveCost;
  s.company.ownedTools = [...getOwnedToolIds(s), tool.id];

  recordTurnAction(s, {
    icon: '🔧',
    category: 'Produkcja',
    text: `Kupiono narzędzie na stałe: ${tool.name} (${formatMoney(tool.effectiveCost, s)}).`,
    target: 'production',
  });

  return s;
}

export function runProductionBatch(
  state: GameState,
  ingredientId: string,
  toolId: string,
  workersCount: number,
  sellNowAmount = 0
): GameState {
  const safeWorkers = Math.floor(workersCount);
  if (safeWorkers < 1) return state;

  const availableWorkers = getAvailableProductionWorkers(state);
  if (safeWorkers > availableWorkers) return state;

  const ingredient = getProductionIngredients(state).find(i => i.id === ingredientId);
  if (!ingredient || !ingredient.meetsRequirements) return state;

  const ownedTools = getOwnedToolIds(state);
  if (!ownedTools.includes(toolId)) return state;

  const estimate = estimateProductionBatch(state, ingredientId, toolId, safeWorkers);
  if (!estimate) return state;

  if (state.company.finances.stanKonta < estimate.totalCost) return state;

  const clampedSellNow = Math.max(0, Math.min(estimate.units, Math.floor(sellNowAmount)));
  const toStore = estimate.units - clampedSellNow;

  if (toStore > 0) {
    const currentStock = Object.values(state.company.resources).reduce((a, b) => a + b, 0);
    const capacity = state.company.warehouseCapacity || COMPANY_SIZE_CONFIG[state.company.size].warehouseCapacity;
    if (currentStock + toStore > capacity) return state;
  }

  const s = captureUndoSnapshot(state);

  s.company.finances.stanKonta -= estimate.totalCost;
  s.company.finances.wydatki.zakupy += estimate.totalCost;
  s.productionWorkersUsedThisTurn = (s.productionWorkersUsedThisTurn ?? 0) + safeWorkers;

  const resId = `prod_${ingredient.id}_${estimate.quality}`;

  if (toStore > 0) {
    s.company.resources[resId] = (s.company.resources[resId] || 0) + toStore;
  }

  let saleSummary = '';
  if (clampedSellNow > 0) {
    const estimatedRevenue = Math.round(estimate.estimatedUnitPrice * clampedSellNow);
    const accuracy = s.company.reputation.dokladnoscPrzewidywan ?? 50;
    const { min, max } = getRevenueRange(estimatedRevenue, accuracy);

    s.pendingSales.push({
      id: `prod_sale_${s.turn}_${s.pendingSales.length}`,
      buyerName: 'Zbyt produkcji',
      resId,
      productName: estimate.ingredient.name,
      amount: clampedSellNow,
      estimatedRevenue,
      minRevenue: min,
      maxRevenue: max,
      quality: estimate.quality,
      hasComplaints: false,
      installments: 1,
    });

    saleSummary =
      toStore > 0
        ? ` Zbyto ${clampedSellNow} szt. (${formatMoneyRange(min, max, s)}), do magazynu: ${toStore} szt.`
        : ` Zbyto całość (${formatMoneyRange(min, max, s)}).`;
  } else {
    saleSummary = ` Całość (${toStore} szt.) złożono w magazynie.`;
  }

  recordTurnAction(s, {
    icon: '⚙️',
    category: 'Produkcja',
    text: `Wyprodukowano ${estimate.units} szt. (jakość ${estimate.quality}/10, ${safeWorkers} os., koszt ${formatMoney(estimate.totalCost, s)}).${saleSummary}`,
    target: 'production',
  });

  return s;
}

export function sellProducedStock(state: GameState, resId: string, amount: number): GameState {
  const safeAmount = Math.floor(amount);
  if (safeAmount <= 0 || !resId.startsWith('prod_')) return state;

  const available = state.company.resources[resId] || 0;
  if (available < safeAmount) return state;

  const s = captureUndoSnapshot(state);

  const info = estimateStoredProducedItem(s, resId);
  const estimatedRevenue = Math.round(info.estimatedUnitPrice * safeAmount);
  const accuracy = s.company.reputation.dokladnoscPrzewidywan ?? 50;
  const { min, max } = getRevenueRange(estimatedRevenue, accuracy);

  s.company.resources[resId] -= safeAmount;
  if (s.company.resources[resId] <= 0) {
    delete s.company.resources[resId];
  }

  s.pendingSales.push({
    id: `prod_stock_sale_${s.turn}_${s.pendingSales.length}`,
    buyerName: 'Zbyt produkcji (magazyn)',
    resId,
    productName: info.label,
    amount: safeAmount,
    estimatedRevenue,
    minRevenue: min,
    maxRevenue: max,
    quality: info.quality,
    hasComplaints: false,
    installments: 1,
  });

  recordTurnAction(s, {
    icon: '🚛',
    category: 'Produkcja',
    text: `Wysłano do zbytu ${safeAmount} szt. (${info.label}, jakość ${info.quality}/10) — ok. ${formatMoneyRange(min, max, s)}.`,
    target: 'production',
  });

  return s;
}

// --- Eksporty zachowane dla kompatybilności ---

export function buyRawMaterials(
  state: GameState,
  supplier: TradeSupplier,
  amount: number,
  installments: InstallmentOption = 1
): GameState {
  if (amount <= 0) return state;

  const currentStock = Object.values(state.company.resources).reduce((a, b) => a + b, 0);
  const capacity = state.company.warehouseCapacity || COMPANY_SIZE_CONFIG[state.company.size].warehouseCapacity;
  if (currentStock + amount > capacity) return state;

  let discount = 0;
  if (amount >= 50) discount = 0.25;
  else if (amount >= 10) discount = 0.10;

  const allianceDiscount = getAllianceTradeDiscount(state);
  const totalDiscount = Math.min(0.45, discount + allianceDiscount);

  const baseTotal = Math.round(supplier.price * amount * (1 - totalDiscount));
  const finalPrice = calculateInstallmentPrice(baseTotal, installments);

  if (installments <= 1 && state.company.finances.stanKonta < finalPrice) {
    return state;
  }

  const s = captureUndoSnapshot(state);

  if (installments <= 1) {
    s.company.finances.stanKonta -= finalPrice;
    s.company.finances.wydatki.zakupy += finalPrice;
  } else {
    s.company.loans.push({
      id: `raw_install_${s.turn}_${s.company.loans.length}`,
      source: 'zakup_raty',
      principal: finalPrice,
      remaining: finalPrice,
      interestRate: 0,
      quartersLeft: installments,
    });
  }

  const resId = `raw_${supplier.id}_${supplier.quality}`;
  s.company.resources[resId] = (s.company.resources[resId] || 0) + amount;

  recordTurnAction(s, {
    icon: '🧱',
    category: 'Produkcja',
    text: `Kupiono ${amount} szt. surowców (${supplier.name}) za ${formatMoney(finalPrice, s)}${allianceDiscount > 0 ? ` (rabat sojuszniczy -${Math.round(allianceDiscount * 100)}%)` : ''}.`,
    target: 'production',
  });

  return s;
}

export function produceGoods(state: GameState, rawResId: string, amount: number): GameState {
  if (amount <= 0 || !rawResId.startsWith('raw_')) return state;

  const availableRaw = state.company.resources[rawResId] || 0;
  if (availableRaw < amount) return state;

  const maxCap = getProductionCapacity(state);
  const used = state.productionUsedThisTurn ?? 0;
  if (used + amount > maxCap) return state;

  const s = captureUndoSnapshot(state);

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

  recordTurnAction(s, {
    icon: '⚙️',
    category: 'Produkcja',
    text: `Wytworzono ${amount} szt. wyrobów gotowych (jakość ${finalQuality}/10).`,
    target: 'production',
  });

  return s;
}

export function toggleService(state: GameState, serviceId: string): GameState {
  const activeIds = state.activeServiceIds ?? [];
  const available = getAvailableServices(state);
  const target = available.find(srv => srv.id === serviceId);

  if (activeIds.includes(serviceId)) {
    const s = captureUndoSnapshot(state);
    s.activeServiceIds = activeIds.filter(id => id !== serviceId);
    recordTurnAction(s, {
      icon: '🛠️',
      category: 'Usługi',
      text: `Wstrzymano stałą usługę: ${target?.title ?? serviceId}.`,
      target: 'services',
    });
    return s;
  }

  if (!target || !target.meetsRequirements) return state;

  const totalSlots = getTotalServiceWorkerSlots(state);
  const busySlots = getBusyServiceWorkers(state);
  if (busySlots + target.workersRequired > totalSlots) return state;

  const s = captureUndoSnapshot(state);
  s.activeServiceIds = [...activeIds, serviceId];
  recordTurnAction(s, {
    icon: '🛠️',
    category: 'Usługi',
    text: `Uruchomiono stałą usługę: "${target.title}" (${formatMoneyRange(target.minPayout, target.maxPayout, s)} / kw.).`,
    target: 'services',
  });

  return s;
}

export function acceptServiceOrder(state: GameState, order: ServiceDefinition | string): GameState {
  const serviceId = typeof order === 'string' ? order : order.id;
  return toggleService(state, serviceId);
}

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