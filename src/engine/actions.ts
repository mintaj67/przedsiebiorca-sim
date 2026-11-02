import type { GameState, ContractType, Pace, EventEffects, CompanySize, NewsItem} from './types';
import {
  MAX_PARTY_SWITCHES_PER_PHASE,
  ACTIVITY_CHANGE_COOLDOWN,
  BANKRUPT_EMERGENCY_LOAN,
  WORKER_CONFIG,
  COMPANY_EXPANSION_CONFIG,
  BRANCH_COST,
  MAX_NEWS
} from './constants';
import { getActivityData } from './activityHelper';
import { recomputeReputation } from './reputation';

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function applyHire(state: GameState, contract: ContractType, delta: number): GameState {
  const s = structuredClone(state);
  const current = s.company.employees[contract];
  const newCount = Math.max(0, current + delta);
  const actualDelta = newCount - current;

  if (actualDelta < 0 && contract === 'uop') {
    const fired = Math.abs(actualDelta);
    const severance = fired * WORKER_CONFIG.uop.severance;
    if (s.company.finances.stateKonta < severance) {
      return s;
    }
    s.company.finances.stateKonta -= severance;
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
  const rate = source === 'bank' ? 0.03 : 0.07;
  s.company.loans.push({
    id: `loan_${s.turn}_${s.company.loans.length}`,
    source,
    principal: amount,
    remaining: amount,
    interestRate: rate,
    quartersLeft: 12,
  });
  s.company.finances.stateKonta += amount;
  if (source === 'bank') s.company.finances.wplywy.srodkiZKredytow += amount;
  else s.company.finances.wplywy.dofinansowaniaSzaraStrefa += amount;
  return s;
}

export function applyChangeActivity(state: GameState, activity: string): GameState {
  const s = structuredClone(state);
  if (s.turn - s.company.lastActivityChangeTurn < ACTIVITY_CHANGE_COOLDOWN) return s;
  
  const oldBranza = s.company.reputation.branza;
  const actData = getActivityData(activity); 
  
  s.company.activity = activity;
  s.company.reputation.branza = actData?.rep ?? 50;
  s.company.reputation.opiniaMafia = actData?.mafia ?? 25; 
  s.company.lastActivityChangeTurn = s.turn;
  
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
  s.company.loans.push({
    id: `emergency_${s.turn}`,
    source: 'bank',
    principal: BANKRUPT_EMERGENCY_LOAN.amount,
    remaining: BANKRUPT_EMERGENCY_LOAN.amount,
    interestRate: BANKRUPT_EMERGENCY_LOAN.interestRate,
    quartersLeft: BANKRUPT_EMERGENCY_LOAN.quartersLeft,
  });
  s.company.finances.stateKonta += BANKRUPT_EMERGENCY_LOAN.amount;
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
  if (s.company.finances.stateKonta < price) return s; // Brak kasy
  if (s.company.inventory.includes(itemId)) return s; // Już to masz
  
  s.company.finances.stateKonta -= price;
  s.company.inventory.push(itemId);
  return s;
}

export function applyEffects(state: GameState, e: EventEffects) {
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      (state.company.reputation as any)[k] = clamp((state.company.reputation as any)[k] + (v as number));
    }
  }
  if (e.stateKonta) state.company.finances.stateKonta += e.stateKonta;
  if (e.wplywy) for (const [k, v] of Object.entries(e.wplywy)) {
    (state.company.finances.wplywy as any)[k] += v as number;
  }
  if (e.wydatki) for (const [k, v] of Object.entries(e.wydatki)) {
    (state.company.finances.wydatki as any)[k] += v as number;
  }
  if (e.flagsAdd) state.ceo.flags.push(...e.flagsAdd);
  if (e.flagsRemove) state.ceo.flags = state.ceo.flags.filter(f => !e.flagsRemove!.includes(f));
  if (e.joinMafia) state.ceo.inMafia = true;
  if (e.leaveMafia) state.ceo.inMafia = false;
  if (e.setParty) state.ceo.party = e.setParty;
  if (e.setCurrentPartyId) state.ceo.currentPartyId = e.setCurrentPartyId;
  if (e.divideFinances) {
    const div = (n: number) => Math.round((n / 10000) * 100) / 100;
    
    state.company.finances.stateKonta = div(state.company.finances.stateKonta);
    
    const wplywy = (state.company.finances as any).wplywy || (state.company.finances as any).aktywa;
    if (wplywy) {
      for (const k in wplywy) wplywy[k] = div(wplywy[k]);
    }
    
    const wydatki = (state.company.finances as any).wydatki || (state.company.finances as any).pasywa;
    if (wydatki) {
      for (const k in wydatki) wydatki[k] = div(wydatki[k]);
    }

    for (const loan of state.company.loans) {
      loan.principal = div(loan.principal);
      loan.remaining = div(loan.remaining);
    }
  }
  if (e.employeesDelta) {
    if (e.employeesDelta.bezUmowy) state.company.employees.bezUmowy = Math.max(0, state.company.employees.bezUmowy + e.employeesDelta.bezUmowy);
    if (e.employeesDelta.zlecenie) state.company.employees.zlecenie = Math.max(0, state.company.employees.zlecenie + e.employeesDelta.zlecenie);
    if (e.employeesDelta.uop) state.company.employees.uop = Math.max(0, state.company.employees.uop + e.employeesDelta.uop);
  }
   if (e.addItem && !state.company.inventory.includes(e.addItem)) {
    state.company.inventory.push(e.addItem);
  }   
}

export function toggleAccountant(state: GameState): GameState {
  const s = structuredClone(state);
  s.company.hasAccountant = !s.company.hasAccountant;
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
    if (s.company.finances.stateKonta < config.cost) return s;
    s.company.finances.stateKonta -= config.cost;
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
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function buildBranch(state: GameState): GameState {
  const s = structuredClone(state);
  if (!['large', 'very_large', 'corporation'].includes(s.company.size)) return s;
  if (s.company.finances.stateKonta < BRANCH_COST) return s;
  
  s.company.finances.stateKonta -= BRANCH_COST;
  s.company.branches += 1;
  s.company.reputation.opiniaBranza += 5;
  s.company.reputation = recomputeReputation(s);
  return s;
}

export function buyResource(state: GameState, resourceId: string, amount: number, basePrice: number): GameState {
  const s = structuredClone(state);
  // Im wyższa reputacja w branży i mediach, tym taniej kupujemy (max 50% zniżki)
  const discount = Math.min(0.5, (s.company.reputation.opiniaBranza + s.company.reputation.opiniaMedia) / 400);
  const totalCost = Math.round(amount * basePrice * (1 - discount));
  
  if (s.company.finances.stateKonta < totalCost) return s;
  
  s.company.finances.stateKonta -= totalCost;
  s.company.resources[resourceId] = (s.company.resources[resourceId] || 0) + amount;
  return s;
}

export function sellResource(state: GameState, resourceId: string, amount: number, basePrice: number): GameState {
  const s = structuredClone(state);
  const available = s.company.resources[resourceId] || 0;
  if (available < amount) return s; // Nie masz tyle towaru
  
  // Im wyższa reputacja, tym drożej sprzedajemy (do 100% narzutu)
  const bonus = Math.min(1.0, (s.company.reputation.opiniaBranza + s.company.reputation.opiniaMedia) / 200);
  const totalRevenue = Math.round(amount * basePrice * (1 + bonus));
  
  s.company.finances.stateKonta += totalRevenue;
  s.company.resources[resourceId] -= amount;
  
  // W Kulturze "sprzedaż" to pozyskiwanie odbiorców
  if (s.company.activity.includes('kult_')) {
    s.company.audience += amount * 10; 
  }
  
  return s;
}

export function buyAd(state: GameState, type: 'radio' | 'tv' | 'internet'): GameState {
  const s = structuredClone(state);
  let cost = 0;
  let repGain = 0;
  let mediaGain = 0;

  if (type === 'radio') { cost = 5000; repGain = 2; mediaGain = 2; }
  if (type === 'tv') { cost = 50000; repGain = 8; mediaGain = 10; }
  if (type === 'internet') { cost = 15000; repGain = 4; mediaGain = 5; }

  if (s.company.finances.stateKonta < cost) return s;

  s.company.finances.stateKonta -= cost;
  s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna + repGain);
  s.company.reputation.opiniaMedia = clamp(s.company.reputation.opiniaMedia + mediaGain);
  s.company.reputation = recomputeReputation(s);
  
  return s;
}

export function buyGoods(state: GameState, supplier: any, amount: number): GameState {
  const s = structuredClone(state);

  const currentStock = Object.values(s.company.resources).reduce((a, b) => a + b, 0);
  if (currentStock + amount > s.company.warehouseCapacity) return s;

  // Obliczanie ceny hurtowej (im więcej, tym taniej)
  let discount = 0;
  if (amount === 10) discount = 0.1; // 10% taniej
  if (amount === 100) discount = 0.25; // 25% taniej

  const totalCost = Math.round(supplier.price * amount * (1 - discount));
  if (s.company.finances.stateKonta < totalCost) return s;

  s.company.finances.stateKonta -= totalCost;
  const resId = `${supplier.id}_${supplier.quality}`;
  s.company.resources[resId] = (s.company.resources[resId] || 0) + amount;
  
  return s;
}

export function sellGoods(state: GameState, buyer: any, resId: string, amount: number, baseValue: number): GameState {
  const s = structuredClone(state);
  const available = s.company.resources[resId] || 0;
  if (available < amount) return s;

  // Zabieramy towar z magazynu od razu
  s.company.resources[resId] -= amount;

  const quality = parseInt(resId.split('_')[1]);
  const estimatedRevenue = Math.round(baseValue * buyer.multiplier * amount);

  // Dodajemy do kolejki sprzedaży (rozliczy się w następnej turze)
  s.pendingSales.push({
    id: `sale_${Date.now()}_${Math.random()}`,
    buyerName: buyer.name,
    resId,
    amount,
    estimatedRevenue,
    quality,
    hasComplaints: buyer.complaints
  });

  return s;
}

export function rentWarehouse(state: GameState): GameState {
  const s = structuredClone(state);
  const cost = 10000;
  if (s.company.finances.stateKonta < cost) return s;
  
  s.company.finances.stateKonta -= cost;
  s.company.warehouseCapacity += 50;
  return s;
}

export function resolvePendingSales(state: GameState): void {
  if (state.pendingSales.length === 0) return;

  let totalRevenue = 0;

  for (const sale of state.pendingSales) {
    const variance = 0.9 + (Math.random() * 0.2);
    const actualRevenue = Math.round(sale.estimatedRevenue * variance);
    totalRevenue += actualRevenue;
    
    state.company.finances.stateKonta += actualRevenue;

    // Szansa na reklamację
    if (sale.hasComplaints && sale.quality < 5) {
      const chance = 0.6 - (sale.quality * 0.1);
      if (Math.random() < chance) {
        state.pendingComplaints.push({
          id: `comp_${Date.now()}_${Math.random()}`,
          itemName: sale.resId.split('_')[0],
          buyerName: sale.buyerName,
          penalty: 10 - sale.quality
        });
      }
    }
  }

  // Generowanie wiadomości z podsumowaniem
  if (totalRevenue > 0) {
    const newsItem: NewsItem = {
      id: `sales_report_${state.turn}_${Date.now()}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: 'Rozliczenie sprzedaży',
      body: `Kontrahenci uiścili płatności za dostarczone towary. Na Twoje konto wpłynęło ${totalRevenue.toLocaleString('pl-PL')} PLN.`,
      category: 'economy',
      read: false
    };
    state.news.unshift(newsItem);
    if (state.news.length > MAX_NEWS) state.news.pop();
  }

  state.pendingSales = []; // Czyścimy kolejkę
}

export function resolveComplaint(state: GameState, id: string, accept: boolean): GameState {
  const s = structuredClone(state);
  const comp = s.pendingComplaints.find(c => c.id === id);
  if (!comp) return s;

  if (accept) {
    s.company.finances.stateKonta -= 5000; // Koszt przyjęcia zwrotu
    s.company.reputation.opiniaPubliczna += 2; // Lekki plus za uczciwość
  } else {
    s.company.reputation.opiniaPubliczna -= comp.penalty;
    s.company.reputation.opiniaBranza -= comp.penalty;
  }

  s.pendingComplaints = s.pendingComplaints.filter(c => c.id !== id);
  return s;
}