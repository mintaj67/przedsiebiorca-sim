import type { StateCreator } from 'zustand';
import {
  finishChase as finishChaseEngine,
  dismissChase as dismissChaseEngine,
} from '../../engine/chase';
import { autosave } from '../autosave';

export interface ChaseSlice {
  chaseFinish: (result: 'escaped' | 'caught') => void;
  dismissChase: () => void;
}

export const createChaseSlice: StateCreator<any, [], [], ChaseSlice> = (set, get) => ({
  chaseFinish: (result) => {
    const s = get().state;
    if (!s || !s.activeChase || s.activeChase.finished) return;
    const next = structuredClone(s);
    finishChaseEngine(next, result);
    set({ state: next, savesVersion: Date.now() });
    try {
      autosave(next, get().currentSlotId);
    } catch (err) {
      console.error('[autosave] zapis nie powiódł się:', err);
    }
  },
  dismissChase: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    dismissChaseEngine(next);
    set({ state: next, savesVersion: Date.now() });
    try {
      autosave(next, get().currentSlotId);
    } catch (err) {
      console.error('[autosave] zapis nie powiódł się:', err);
    }
  },
});