import { create } from 'zustand';
import type { GameState, Difficulty, ContractType, Pace, CompanySize, AppScreen } from '../engine/types';
import { createInitialState, getEligibleActivities } from '../engine/initialState';
import { nextTurn, consumeActivity as consumeActivityEngine, resolveEventChoice, dismissConsequence } from '../engine/turn';
import { applyHire, applyLoan, applyChangeActivity, applyJoinParty, applyLeaveParty, applyEmergencyLoan, applySetPace, toggleAccountant } from '../engine/actions';
import { useSettingsStore } from './settingsStore';
import { autosave, loadSlotsFromStorage, persistSlots } from './autosave';
import type { CombatSlice } from './slices/combatSlice';
import { createCombatSlice } from './slices/combatSlice';
import type { NewsSlice } from './slices/newsSlice.ts';
import { createNewsSlice } from './slices/newsSlice.ts';

export const MAX_SLOTS = 5;
export const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'] as const;

interface NewGameOpts { difficulty: Difficulty; inPZPR: boolean; activity: string; companyName: string; suffix: string; size: CompanySize; }

// Główny interfejs łączy w sobie wszystko
interface GameStore extends CombatSlice, NewsSlice {
  state: GameState | null;
  currentSlotId: string | null;
  screen: AppScreen;
  savesMode: 'new' | 'load';
  pendingSlotId: string | null;
  savesVersion: number;

  setScreen: (s: AppScreen) => void;
  openSaves: (mode: 'new' | 'load') => void;
  setPendingSlotId: (id: string | null) => void;
  newGame: (opts: NewGameOpts, slotId: string) => void;
  saveGame: () => void;
  loadGame: (slotId: string) => boolean;
  deleteSave: (slotId: string) => void;
  getSlots: () => any;
  hasAnySave: () => boolean;

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
}

export const useGameStore = create<GameStore>()((set, get, api) => ({
  ...createCombatSlice(set, get, api),
  ...createNewsSlice(set, get, api),

  state: null,
  currentSlotId: null,
  screen: 'menu',
  savesMode: 'load',
  pendingSlotId: null,
  savesVersion: 0,

  setScreen: (s) => set({ screen: s }),
  openSaves: (mode) => set({ screen: 'saves', savesMode: mode }),
  setPendingSlotId: (id) => set({ pendingSlotId: id }),

  newGame: (opts, slotId) => {
    const s = createInitialState({ seed: String(Date.now()), ...opts });
    s.pace = useSettingsStore.getState().defaultPace;
    s.currentActivities = getEligibleActivities(s);
    const slots = loadSlotsFromStorage();
    slots[slotId] = { id: slotId, name: (opts.companyName || 'Firma') + (opts.suffix ?? ''), createdAt: Date.now(), lastPlayed: Date.now(), state: s };
    persistSlots(slots);
    set({ state: s, currentSlotId: slotId, screen: 'game', pendingSlotId: null, savesVersion: Date.now() });
  },

  saveGame: () => {
    const s = get().state;
    if (!s || !get().currentSlotId) return;
    const slots = loadSlotsFromStorage();
    const existing = slots[get().currentSlotId!];
    slots[get().currentSlotId!] = { id: get().currentSlotId!, name: existing?.name ?? (s.company.name + s.company.suffix), createdAt: existing?.createdAt ?? Date.now(), lastPlayed: Date.now(), state: s };
    persistSlots(slots);
    set({ savesVersion: Date.now() });
  },

  loadGame: (slotId) => {
    const slots = loadSlotsFromStorage();
    const slot = slots[slotId];
    if (!slot) return false;
    slot.lastPlayed = Date.now();
    persistSlots(slots);
    set({ state: slot.state, currentSlotId: slotId, screen: 'game', savesVersion: Date.now() });
    return true;
  },

  deleteSave: (slotId) => {
    const slots = loadSlotsFromStorage();
    delete slots[slotId];
    persistSlots(slots);
    set({ savesVersion: Date.now() });
  },

  getSlots: () => loadSlotsFromStorage(),
  hasAnySave: () => Object.keys(loadSlotsFromStorage()).length > 0,

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
}));