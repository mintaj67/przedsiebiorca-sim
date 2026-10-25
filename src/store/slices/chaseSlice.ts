import type { StateCreator } from 'zustand';
import { movePlayer, dismissChase as dismissChaseEngine } from '../../engine/chase';
import { autosave } from '../autosave';

export interface ChaseSlice {
  chaseMove: (dx: number, dy: number) => void;
  dismissChase: () => void;
}

export const createChaseSlice: StateCreator<any, [], [], ChaseSlice> = (set, get) => ({
  chaseMove: (dx, dy) => {
    const s = get().state;
    if (!s || !s.activeChase) return;
    const next = structuredClone(s);
    movePlayer(next, dx, dy);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },
  dismissChase: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    dismissChaseEngine(next);
    autosave(next, get().currentSlotId);
    set({ state: next, savesVersion: Date.now() });
  },
});