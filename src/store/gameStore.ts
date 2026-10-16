import { create } from 'zustand';
import type { GameState, Difficulty, ContractType, Pace, CompanySize, AppScreen } from '../engine/types';
import { createInitialState, getEligibleActivities } from '../engine/initialState';
import { nextTurn, consumeActivity as consumeActivityEngine, resolveEventChoice, dismissConsequence } from '../engine/turn';
import {
  applyHire, applyLoan, applyChangeActivity, applyJoinParty,
  applyLeaveParty, applyEmergencyLoan, applySetPace,
} from '../engine/actions';
import { useSettingsStore } from './settingsStore';
import { applyEffects } from '../engine/turn';
import { recomputeReputation } from '../engine/reputation';


const SAVE_KEY = 'pp-save-v1';

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
  screen: AppScreen;
  markNewsRead: (id: string) => void;
  setScreen: (s: AppScreen) => void;

  newGame: (opts: NewGameOpts) => void;
  saveGame: () => void;
  loadGame: () => boolean;
  deleteSave: () => void;
  hasSave: () => boolean;

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
  dismissElection: () => void;
  dismissPresidentialResult: () => void;  
  resolveNewsChoice: (newsId: string, choiceId: string) => void;
  devAddTestNews: () => void;
}

function saveToStorage(state: GameState) {
  if (!useSettingsStore.getState().autosave) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, state }));
  } catch {
    /* ignore */
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  screen: 'menu',
  setScreen: (s) => set({ screen: s }),

   newGame: (opts) => {
    const s = createInitialState({ seed: String(Date.now()), ...opts });
    s.pace = useSettingsStore.getState().defaultPace;
    s.currentActivities = getEligibleActivities(s);
    saveToStorage(s);
    set({ state: s, screen: 'game' });
  },

   saveGame: () => {
    const s = get().state;
    if (!s) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, state: s }));
    } catch {
      /* ignore */
    }
  },

  loadGame: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed.state) return false;
      set({ state: parsed.state, screen: 'game' });
      return true;
    } catch {
      return false;
    }
  },

  deleteSave: () => {
    localStorage.removeItem(SAVE_KEY);
  },

  hasSave: () => !!localStorage.getItem(SAVE_KEY),

  doTurn: () => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = nextTurn(s);
    saveToStorage(next);
    set({ state: next });
  },

  consumeActivity: (activityId) => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = consumeActivityEngine(s, activityId);
    saveToStorage(next);
    set({ state: next });
  },

  resolveEvent: (eventId, choiceId) => {
    const s = get().state;
    if (!s || s.gameOver) return;
    const next = resolveEventChoice(s, eventId, choiceId);
    saveToStorage(next);
    set({ state: next });
  },

  dismissConsequence: () => {
    const s = get().state;
    if (!s) return;
    const next = dismissConsequence(s);
    saveToStorage(next);
    set({ state: next });
  },

  joinParty: (partyId) => {
    const s = get().state;
    if (!s) return;
    const next = applyJoinParty(s, partyId);
    saveToStorage(next);
    set({ state: next });
  },

  leaveParty: () => {
    const s = get().state;
    if (!s) return;
    const next = applyLeaveParty(s);
    saveToStorage(next);
    set({ state: next });
  },

  changeActivity: (activity) => {
    const s = get().state;
    if (!s) return;
    const next = applyChangeActivity(s, activity);
    saveToStorage(next);
    set({ state: next });
  },

  takeEmergencyLoan: () => {
    const s = get().state;
    if (!s) return;
    const next = applyEmergencyLoan(s);
    saveToStorage(next);
    set({ state: next });
  },

  hireWorker: (contract, delta) => {
    const s = get().state;
    if (!s) return;
    const next = applyHire(s, contract, delta);
    saveToStorage(next);
    set({ state: next });
  },

  takeLoan: (source, amount) => {
    const s = get().state;
    if (!s) return;
    const next = applyLoan(s, source, amount);
    saveToStorage(next);
    set({ state: next });
  },

  setPace: (pace) => {
    const s = get().state;
    if (!s) return;
    const next = applySetPace(s, pace);
    saveToStorage(next);
    set({ state: next });
  },

  dismissElection: () => {
  const s = get().state;
  if (!s) return;
  const next = { ...s, lastElectionResult: null };
  saveToStorage(next);
  set({ state: next });
  },

  dismissPresidentialResult: () => {
  const s = get().state;
  if (!s) return;
  const next = { ...s, lastPresidentialResult: null };
  saveToStorage(next);
  set({ state: next });
  },

    markNewsRead: (id) => {
    const s = get().state;
    if (!s) return;
    const next = {
      ...s,
      news: s.news.map(n => n.id === id ? { ...n, read: true } : n),
    };
    saveToStorage(next);
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
    saveToStorage(next);
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
      body: 'To jest test systemu ActionableNews.\nWybierz jedną z opcji poniżej — sprawdzimy, czy działa.',
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
    saveToStorage(next);
    set({ state: next });
  },

}));