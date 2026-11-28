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
    description: 'Retro Manager (CM 01/02 × lata 90.): ciemny granat, stalowe fazowanie i bursztynowe belki.',
  },
  {
    id: 'futbol_czempion',
    label: 'Futbolowy Czempion',
    description: 'Nowoczesny manager piłkarski: głęboki fiolet, gładkie ciemne panele i miętowe akcenty.',
  },
  {
    id: 'substancja_87',
    label: 'Substancja 87',
    description: 'Minimalizm z okładki New Order (1987): matowa biel, ostra czerń, szwajcarska typografia i zieleń Factory.',
  },
  {
    id: 'miasto_nierzadu',
    label: 'Miasto Nierządu',
    description: 'Lata 80. na pełnym neonie: głęboki fiolet, gorący róż i elektryczny cyjan prosto z 1986.',
  },
  {
    id: 'miasto_leonida',
    label: 'Miasto Leonida',
    description: 'Współczesny tropikalny zmierzch: gradient koralu, brzoskwini i zmroku z akcentem oceanicznego turkusu.',
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