import type { StateCreator } from 'zustand';
import type { CombatMove } from '../../engine/combat';
import { executeCombatMove, dismissCombat as dismissCombatEngine } from '../../engine/combat';
import { autosave } from '../autosave';

export interface CombatSlice {
  combatMove: (move: CombatMove) => void;
  dismissCombat: () => void;
}

export const createCombatSlice: StateCreator<any, [], [], CombatSlice> = (set, get) => ({
  combatMove: (move) => {
    const s = get().state;
    if (!s || !s.activeCombat) return;
    const next = structuredClone(s);
    executeCombatMove(next, move);
    set({ state: next, savesVersion: Date.now() });
    autosave(next, get().currentSlotId);
  },
  dismissCombat: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    dismissCombatEngine(next);
    set({ state: next, savesVersion: Date.now() });
    autosave(next, get().currentSlotId);
  },
});