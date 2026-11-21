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
    description: 'P100 TVP1: Czarny CRT, żółty i cyjan, brak zaokrągleń, styl roku 1993.',
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
    description: 'Neobrutalizm: kontrastowe białe karty na neonowej zieleni.',
  },
];
