import { create } from 'zustand';
import type { GameState, Difficulty, ContractType, Pace, CompanySize, AppScreen } from '../engine/types';
import { createInitialState, getEligibleActivities } from '../engine/initialState';
import {
  nextTurn,
  consumeActivity as consumeActivityEngine,
  resolveEventChoice,
  dismissConsequence,
} from '../engine/turn';
import {
  applyHire, applyLoan, applyChangeActivity, applyJoinParty,
  applyLeaveParty, applyEmergencyLoan, applySetPace, applyEffects,
} from '../engine/actions';
import { recomputeReputation } from '../engine/reputation';
import { useSettingsStore } from './settingsStore';
import { executeCombatMove } from '../engine/combat';
import { dismissCombat } from '../engine/combat';
import { toggleAccountant } from '../engine/actions';

const SAVES_KEY = 'pp-saves-v1';
const OLD_SAVE_KEY = 'pp-save-v1';
export const MAX_SLOTS = 5;

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: number;
  lastPlayed: number;
  state: GameState;
}

export type SaveSlots = Record<string, SaveSlot>;

export const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'] as const;

function loadSlotsFromStorage(): SaveSlots {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (raw) return JSON.parse(raw);

    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (old) {
      const parsed = JSON.parse(old);
      if (parsed.state) {
        const migrated: SaveSlots = {
          slot_1: {
            id: 'slot_1',
            name: (parsed.state.company?.name ?? 'Zapis') + (parsed.state.company?.suffix ?? ''),
            createdAt: Date.now(),
            lastPlayed: Date.now(),
            state: parsed.state,
          },
        };
        localStorage.setItem(SAVES_KEY, JSON.stringify(migrated));
        localStorage.removeItem(OLD_SAVE_KEY);
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function persistSlots(slots: SaveSlots) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
  } catch {
    /* ignore */
  }
}

interface NewGameOpts {
  difficulty: Difficulty;
  inPZPR: boolean;
  activity: string;
  companyName: string;
  suffix: string;
  size: CompanySize;
}

interface GameStore {
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
  getSaveSlot: (slotId: string) => SaveSlot | null;

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
  markNewsRead: (id: string) => void;
  resolveNewsChoice: (newsId: string, choiceId: string) => void;
  dismissElection: () => void;
  dismissPresidentialResult: () => void;
  devAddTestNews: () => void;
  combatMove: (move: any) => void;
  dismissCombat: () => void;
  toggleAccountant: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  function autosave(state: GameState, slotId: string | null) {
    if (!useSettingsStore.getState().autosave) return;
    if (!slotId) return;
    const slots = loadSlotsFromStorage();
    const existing = slots[slotId];
    slots[slotId] = {
      id: slotId,
      name: existing?.name ?? (state.company.name + state.company.suffix),
      createdAt: existing?.createdAt ?? Date.now(),
      lastPlayed: Date.now(),
      state,
    };
    persistSlots(slots);
    set({ savesVersion: Date.now() });
  }

  return {
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
      slots[slotId] = {
        id: slotId,
        name: (opts.companyName || 'Firma') + (opts.suffix ?? ''),
        createdAt: Date.now(),
        lastPlayed: Date.now(),
        state: s,
      };
      persistSlots(slots);

      set({
        state: s,
        currentSlotId: slotId,
        screen: 'game',
        pendingSlotId: null,
        savesVersion: Date.now(),
      });
    },

    saveGame: () => {
      const s = get().state;
      const slotId = get().currentSlotId;
      if (!s || !slotId) return;
      const slots = loadSlotsFromStorage();
      const existing = slots[slotId];
      slots[slotId] = {
        id: slotId,
        name: existing?.name ?? (s.company.name + s.company.suffix),
        createdAt: existing?.createdAt ?? Date.now(),
        lastPlayed: Date.now(),
        state: s,
      };
      persistSlots(slots);
      set({ savesVersion: Date.now() });
    },

    loadGame: (slotId) => {
      const slots = loadSlotsFromStorage();
      const slot = slots[slotId];
      if (!slot) return false;
      slot.lastPlayed = Date.now();
      persistSlots(slots);
      set({
        state: slot.state,
        currentSlotId: slotId,
        screen: 'game',
        savesVersion: Date.now(),
      });
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
    getSaveSlot: (slotId) => loadSlotsFromStorage()[slotId] ?? null,

    doTurn: () => {
      const s = get().state;
      if (!s || s.gameOver) return;
      const next = nextTurn(s);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    consumeActivity: (activityId) => {
      const s = get().state;
      if (!s || s.gameOver) return;
      const next = consumeActivityEngine(s, activityId);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    resolveEvent: (eventId, choiceId) => {
      const s = get().state;
      if (!s || s.gameOver) return;
      const next = resolveEventChoice(s, eventId, choiceId);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    dismissConsequence: () => {
      const s = get().state;
      if (!s) return;
      const next = dismissConsequence(s);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    joinParty: (partyId) => {
      const s = get().state;
      if (!s) return;
      const next = applyJoinParty(s, partyId);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    leaveParty: () => {
      const s = get().state;
      if (!s) return;
      const next = applyLeaveParty(s);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    changeActivity: (activity) => {
      const s = get().state;
      if (!s) return;
      const next = applyChangeActivity(s, activity);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    takeEmergencyLoan: () => {
      const s = get().state;
      if (!s) return;
      const next = applyEmergencyLoan(s);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    hireWorker: (contract, delta) => {
      const s = get().state;
      if (!s) return;
      const next = applyHire(s, contract, delta);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    takeLoan: (source, amount) => {
      const s = get().state;
      if (!s) return;
      const next = applyLoan(s, source, amount);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    setPace: (pace) => {
      const s = get().state;
      if (!s) return;
      const next = applySetPace(s, pace);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    markNewsRead: (id) => {
      const s = get().state;
      if (!s) return;
      const next = {
        ...s,
        news: s.news.map(n => n.id === id ? { ...n, read: true } : n),
      };
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    resolveNewsChoice: (newsId, choiceId) => {
      const s = get().state;
      if (!s) return;
      const next = structuredClone(s);
      const item = next.news.find(n => n.id === newsId);
      if (!item || item.resolved || !item.choices) return;
      const choice = item.choices.find(c => c.id === choiceId);
      if (!choice) return;

      if (choice.effects) applyEffects(next, choice.effects);
      item.resolved = true;
      item.resolvedChoiceId = choiceId;
      item.read = true;

      next.company.reputation = recomputeReputation(next);
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    dismissElection: () => {
      const s = get().state;
      if (!s) return;
      const next = { ...s, lastElectionResult: null };
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    dismissPresidentialResult: () => {
      const s = get().state;
      if (!s) return;
      const next = { ...s, lastPresidentialResult: null };
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

    devAddTestNews: () => {
      const s = get().state;
      if (!s) return;
      const next = structuredClone(s);
      next.news.unshift({
        id: `test_action_${Date.now()}`,
        turn: next.turn,
        year: next.year,
        quarter: next.quarter,
        headline: 'Testowa wiadomość z akcją',
        body: 'To jest test systemu ActionableNews.\nWybierz jedną z opcji poniżej.',
        category: 'custom',
        read: false,
        resolved: false,
        expiresAtTurn: next.turn + 3,
        choices: [
          {
            id: 'a',
            label: 'Opcja A — dostajesz 10 000 PLN',
            description: 'Prosty test pozytywnego efektu.',
            effects: { stateKonta: 10000 },
          },
          {
            id: 'b',
            label: 'Opcja B — tracisz 5 000 PLN',
            description: 'Prosty test negatywnego efektu.',
            effects: { stateKonta: -5000 },
          },
        ],
        onExpireEffects: { reputation: { opiniaPubliczna: -3 } },
      });
      autosave(next, get().currentSlotId);
      set({ state: next });
    },

  combatMove: (move) => {
    const s = get().state;
    if (!s || !s.activeCombat) return;
    const next = structuredClone(s);
    executeCombatMove(next, move); // Zaimportuj executeCombatMove z '../engine/combat'
    autosave(next, get().currentSlotId);
    set({ state: next });
  },

  dismissCombat: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    dismissCombat(next); // Zaimportuj dismissCombat z '../engine/combat'
    autosave(next, get().currentSlotId);
    set({ state: next });
  },  
  
  toggleAccountant: () => {
    const s = get().state;
    if (!s) return;
    const next = toggleAccountant(s); // Zaimportuj toggleAccountant z '../engine/actions'
    autosave(next, get().currentSlotId);
    set({ state: next });
  },  
  };
});