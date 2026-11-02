import type { StateCreator } from 'zustand';
import type { ContractType, Pace } from '../../engine/types';
import { nextTurn, consumeActivity as consumeActivityEngine, resolveEventChoice, dismissConsequence } from '../../engine/turn';
import { 
  applyHire, applyLoan, applyChangeActivity, applyJoinParty, applyLeaveParty, 
  applyEmergencyLoan, applySetPace, toggleAccountant,
  changeCompanySize as changeCompanySizeEngine, 
  buildBranch as buildBranchEngine,
  buyResource as buyResourceEngine,   
  sellResource as sellResourceEngine, 
  buyAd as buyAdEngine,
  buyGoods as buyGoodsEngine,
  sellGoods as sellGoodsEngine,
  resolveComplaint as resolveComplaintEngine,
  rentWarehouse as rentWarehouseEngine // <- DODANO BRAKUJĄCY IMPORT
} from '../../engine/actions';
import { autosave } from '../autosave';

export interface GameSlice {
  doTurn: () => void;
  consumeActivity: (activityId: string) => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  dismissConsequence: () => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  changeActivity: (activity: string) => void;
  takeEmergencyLoan: () => void;
  hireWorker: (contract: ContractType, delta: number) => void;
  takeLoan: (source: 'bank' | 'szara_strefa', amount: number) => void;
  setPace: (pace: Pace) => void;
  toggleAccountant: () => void;
  dismissElection: () => void;
  dismissPresidentialResult: () => void;
  changeCompanySize: (direction: 'up' | 'down') => void;
  buildBranch: () => void;
  buyResource: (resId: string, amount: number, basePrice: number) => void;
  sellResource: (resId: string, amount: number, basePrice: number) => void;
  buyAd: (type: 'radio' | 'tv' | 'internet') => void;
  
  // POPRAWIONE SYGNATURY HANDLU:
  buyGoods: (supplier: any, amount: number) => void;
  sellGoods: (buyer: any, resId: string, amount: number, baseValue: number) => void;
  resolveComplaint: (id: string, accept: boolean) => void;
  rentWarehouse: () => void;
}

export const createGameSlice: StateCreator<any, [], [], GameSlice> = (set, get) => ({
  doTurn: () => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = nextTurn(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  consumeActivity: (id) => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = consumeActivityEngine(s, id);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  resolveEvent: (eventId, choiceId) => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = resolveEventChoice(s, eventId, choiceId);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  dismissConsequence: () => {
    const s = get().state;
    if (!s) return;
    const next = dismissConsequence(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  joinParty: (partyId) => {
    const s = get().state;
    if (!s) return;
    const next = applyJoinParty(s, partyId);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  leaveParty: () => {
    const s = get().state;
    if (!s) return;
    const next = applyLeaveParty(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  changeActivity: (activity) => {
    const s = get().state;
    if (!s) return;
    const next = applyChangeActivity(s, activity);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  takeEmergencyLoan: () => {
    const s = get().state;
    if (!s) return;
    const next = applyEmergencyLoan(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  hireWorker: (contract, delta) => {
    const s = get().state;
    if (!s) return;
    const next = applyHire(s, contract, delta);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  takeLoan: (source, amount) => {
    const s = get().state;
    if (!s) return;
    const next = applyLoan(s, source, amount);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  setPace: (pace) => {
    const s = get().state;
    if (!s) return;
    const next = applySetPace(s, pace);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  toggleAccountant: () => {
    const s = get().state;
    if (!s) return;
    const next = toggleAccountant(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  dismissElection: () => {
    const s = get().state;
    if (!s) return;
    const next = { ...s, lastElectionResult: null };
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  dismissPresidentialResult: () => {
    const s = get().state;
    if (!s) return;
    const next = { ...s, lastPresidentialResult: null };
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  changeCompanySize: (direction) => {
    const s = get().state;
    if (!s) return;
    const next = changeCompanySizeEngine(s, direction);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  buildBranch: () => {
    const s = get().state;
    if (!s) return;
    const next = buildBranchEngine(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  buyResource: (resId, amount, price) => {
    const s = get().state;
    if (!s) return;
    const next = buyResourceEngine(s, resId, amount, price);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  sellResource: (resId, amount, price) => {
    const s = get().state;
    if (!s) return;
    const next = sellResourceEngine(s, resId, amount, price);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  buyAd: (type) => {
    const s = get().state;
    if (!s) return;
    const next = buyAdEngine(s, type);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  // NOWE WERSJE HANDLU Z POPRAWIONYMI ARGUMENTAMI:
  buyGoods: (supplier, amount) => {
    const s = get().state;
    if (!s) return;
    const next = buyGoodsEngine(s, supplier, amount);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  sellGoods: (buyer, resId, amount, baseValue) => {
    const s = get().state;
    if (!s) return;
    const next = sellGoodsEngine(s, buyer, resId, amount, baseValue);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  resolveComplaint: (id, accept) => {
    const s = get().state;
    if (!s) return;
    const next = resolveComplaintEngine(s, id, accept);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },

  rentWarehouse: () => {
    const s = get().state;
    if (!s) return;
    const next = rentWarehouseEngine(s);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },
});