import { create } from 'zustand';
import type { Pace } from '../engine/types';

const SETTINGS_KEY = 'pp-settings-v1';

export type ThemeId = 'default' | 'teletext' | 'newspaper' | 'gg' | 'brat';

export interface Settings {
  autosave: boolean;
  defaultPace: Pace;
  showHiddenStats: boolean;
  language: 'pl' | 'en';
  theme: ThemeId;
}

const DEFAULT_SETTINGS: Settings = {
  autosave: true,
  defaultPace: 'quarter',
  showHiddenStats: false,
  language: 'pl',
  theme: 'default',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...loadSettings(),
  set: (key, value) => {
    const next = { ...get(), [key]: value } as Settings;
    persist(next);
    set({ [key]: value } as any);
  },
  reset: () => {
    persist(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));