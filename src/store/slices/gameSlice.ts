import type { StateCreator } from 'zustand';
import type { ContractType, Pace } from '../../engine/types';
import { nextTurn, consumeActivity as consumeActivityEngine, resolveEventChoice, dismissConsequence } from '../../engine/turn';
import { applyHire, applyLoan, applyChangeActivity, applyJoinParty, applyLeaveParty, applyEmergencyLoan, applySetPace, toggleAccountant, buyOfficeItem } from '../../engine/actions';
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
  buyOfficeItem: (itemId: string, price: number) => void;
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

   buyOfficeItem: (itemId, price) => {
    const s = get().state;
    if (!s) return;
    const next = buyOfficeItem(s, itemId, price);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  }, 
});
