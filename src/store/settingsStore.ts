import { create } from 'zustand';

const SETTINGS_KEY = 'pp-settings-v1';
const DEBUG_PASSWORD = 'BALCEROWICZ';

export type ThemeId = 'default' | 'teletext' | 'newspaper' | 'gg' | 'brat';

export interface Settings {
  autosave: boolean;
  debugMode: boolean;
  /** Synchronizowane z debugMode dla kompatybilności z ekranem statystyk. */
  showHiddenStats: boolean;
  theme: ThemeId;
}

const DEFAULT_SETTINGS: Settings = {
  autosave: true,
  debugMode: false,
  showHiddenStats: false,
  theme: 'default',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const debugMode = Boolean(parsed.debugMode);
    return {
      autosave: typeof parsed.autosave === 'boolean' ? parsed.autosave : DEFAULT_SETTINGS.autosave,
      debugMode,
      showHiddenStats: debugMode,
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(s: Settings) {
  try {
    const toSave: Settings = {
      autosave: s.autosave,
      debugMode: s.debugMode,
      showHiddenStats: s.debugMode,
      theme: s.theme,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
  } catch {
    /* ignore */
  }
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  unlockDebug: (password: string) => boolean;
  disableDebug: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...loadSettings(),
  set: (key, value) => {
    const current = get();
    const next: Settings = {
      autosave: current.autosave,
      debugMode: current.debugMode,
      showHiddenStats: current.debugMode,
      theme: current.theme,
      [key]: value,
    };
    if (key === 'debugMode') {
      next.showHiddenStats = Boolean(value);
    }
    persist(next);
    set(next);
  },
  unlockDebug: (password: string) => {
    if (password.trim().toUpperCase() !== DEBUG_PASSWORD) {
      return false;
    }
    const current = get();
    const next: Settings = {
      autosave: current.autosave,
      debugMode: true,
      showHiddenStats: true,
      theme: current.theme,
    };
    persist(next);
    set(next);
    return true;
  },
  disableDebug: () => {
    const current = get();
    const next: Settings = {
      autosave: current.autosave,
      debugMode: false,
      showHiddenStats: false,
      theme: current.theme,
    };
    persist(next);
    set(next);
  },
  reset: () => {
    persist(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));