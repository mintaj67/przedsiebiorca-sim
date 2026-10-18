import type { StateCreator } from 'zustand';
import { executeCombatMove, dismissCombat as dismissCombatEngine } from '../../engine/combat';
import { autosave } from '../autosave';

export interface CombatSlice {
  combatMove: (move: any) => void;
  dismissCombat: () => void;
}

export const createCombatSlice: StateCreator<any, [], [], CombatSlice> = (set, get) => ({
  combatMove: (move) => {
    const s = get().state;
    if (!s || !s.activeCombat) return;
    const next = structuredClone(s);
    executeCombatMove(next, move);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },
  dismissCombat: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    dismissCombatEngine(next);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },
});