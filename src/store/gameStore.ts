import { create } from 'zustand';
import type { GameState, Difficulty, CompanySize, AppScreen } from '../engine/types';
import { createInitialState, getEligibleActivities } from '../engine/initialState';
import { useSettingsStore } from './settingsStore';
import { loadSlotsFromStorage, persistSlots } from './autosave';
import type { SaveSlots } from './autosave';

import type { CombatSlice } from './slices/combatSlice';
import { createCombatSlice } from './slices/combatSlice';
import type { NewsSlice } from './slices/newsSlice';
import { createNewsSlice } from './slices/newsSlice';
import type { GameSlice } from './slices/gameSlice';
import { createGameSlice } from './slices/gameSlice';
import type { ChaseSlice } from './slices/chaseSlice';
import { createChaseSlice } from './slices/chaseSlice';

export const MAX_SLOTS = 5;
export const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'] as const;

interface NewGameOpts { 
  difficulty: Difficulty; 
  inPZPR: boolean; 
  activity: string; 
  companyName: string; 
  suffix: string; 
  size: CompanySize; 
}

interface GameStore extends CombatSlice, NewsSlice, GameSlice, ChaseSlice {
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
  getSlots: () => SaveSlots;
  hasAnySave: () => boolean;
}

export const useGameStore = create<GameStore>()((set, get, store) => ({
  ...createCombatSlice(set, get, store),
  ...createNewsSlice(set, get, store),
  ...createGameSlice(set, get, store),
  ...createChaseSlice(set, get, store),

  state: null,
  currentSlotId: null,
  screen: 'menu' as AppScreen,
  savesMode: 'load' as 'new' | 'load',
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
}));