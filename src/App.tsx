import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useSettingsStore } from './store/settingsStore';
import { MainMenu } from './ui/screens/MainMenu';
import { StartScreen } from './ui/screens/StartScreen';
import { OptionsScreen } from './ui/screens/OptionsScreen';
import { AboutScreen } from './ui/screens/AboutScreen';
import { Dashboard } from './ui/Dashboard';
import { SavesScreen } from './ui/screens/SavesScreen';

export default function App() {
  const screen = useGameStore(s => s.screen);
  const state = useGameStore(s => s.state);
  const theme = useSettingsStore(s => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (screen === 'game' && state) return <Dashboard />;
  if (screen === 'start') return <StartScreen />;
  if (screen === 'options') return <OptionsScreen />;
  if (screen === 'about') return <AboutScreen />;
  if (screen === 'saves') return <SavesScreen />;
  return <MainMenu />;
}