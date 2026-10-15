    import type { ThemeId } from '../store/settingsStore';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'default',
    label: 'Domyślny',
    description: 'Klasyczny, minimalistyczny wygląd. Bez udziwnień.',
  },
  {
    id: 'teletext',
    label: 'Telegazeta',
    description: 'Czarne tło, żółty monospace. Jak Telegazeta TVP z 1993.',
  },
  {
    id: 'newspaper',
    label: 'Gazeta',
    description: 'Sepia i szeryfowa czcionka. Klimat porannej prasy.',
  },
  {
    id: 'gg',
    label: 'Gadu-Gadu',
    description: 'Szaro-niebieski, Tahoma, Windows XP. Retro komunikator.',
  },
  {
    id: 'brat',
    label: 'Brat',
    description: 'Lime green, Arial Bold, niższe litery. Brat summer 2024.',
  },
];