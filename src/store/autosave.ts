import type { GameState } from '../engine/types';
import { useSettingsStore } from './settingsStore';

const SAVES_KEY = 'pp-saves-v1';

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: number;
  lastPlayed: number;
  state: GameState;
}

export type SaveSlots = Record<string, SaveSlot>;

export function loadSlotsFromStorage(): SaveSlots {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistSlots(slots: SaveSlots) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
  } catch { /* ignore */ }
}

export function autosave(state: GameState, slotId: string | null) {
  if (!useSettingsStore.getState().autosave || !slotId) return;
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
}