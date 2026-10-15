import type { Ideology, Difficulty } from './types';

export const REPUTATION_WEIGHTS = {
  branza: 0.15,
  opiniaPubliczna: 0.30,
  opiniaPracownicy: 0.10,
  opiniaBranza: 0.10,
  opiniaMafia: 0.10,
  opiniaMedia: 0.10,
  opiniaPolitycy: 0.15,
} as const;

export const COALITION_RULES: Record<Ideology, Ideology[]> = {
  radical_left:  ['moderate_left', 'extreme_right'],
  moderate_left: ['center', 'radical_left'],
  center:        ['moderate_left', 'center_right'],
  center_right:  ['extreme_right', 'center'],
  extreme_right: ['center_right', 'radical_left'],
};

export const ACTIVITY_REPUTATION: Record<string, number> = {
  windykacja: 20,
  handel: 50,
  gastronomia: 55,
  produkcja: 55,
  uslugi: 60,
  budowlanka: 45,
  it: 75,
  edukacja: 70,
  transport: 50,
};

export const DIFFICULTY_CONFIG: Record<Difficulty, {
  startingCash: number;
  startingRep: number;
  eventBias: number;
}> = {
  easy:   { startingCash: 250_000, startingRep: 55, eventBias:  0.20 },
  medium: { startingCash: 120_000, startingRep: 50, eventBias:  0.00 },
  hard:   { startingCash:  40_000, startingRep: 40, eventBias: -0.20 },
};

export const MAFIA_PUBLIC_THRESHOLD = 70;

export const PARTY_INFLUENCE_WEIGHTS = {
  bothPresidentAndPremier: 1.0,
  onlyPresident:           0.4,
  onlyPremier:             0.7,
  opposition:              0.1,
};

export const MAX_PARTY_SWITCHES_PER_PHASE = 3;
export const ACTIVITY_CHANGE_COOLDOWN = 2;
export const BANKRUPT_GRACE_TURNS = 2;
export const BANKRUPT_EMERGENCY_LOAN = {
  amount: 50000,
  interestRate: 0.15,
  quartersLeft: 8,
};

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, { title: string; description: string }> = {
  easy: {
    title: 'Dziecko ambasadora',
    description: 'Dziecko prywatnego przedsiębiorcy z PRL. Startujesz z dużym kapitałem i znajomościami.',
  },
  medium: {
    title: 'Były pracownik PGRu',
    description: 'Zostajesz zwolniony po latach w zakładzie i postanawiasz zainwestować odprawę we własną firmę. .',
  },
  hard: {
    title: 'Syn włókniarki ze Rzgowa k. Łodzi',
    description: 'Pochodzisz z biednej robotniczej rodziny. Twoja matka oddaje ci ostatnie dolary wysłane przez ojca pracującego w USA, byś mógł zacząć nowe życie w wielkim mieście',
  },
};

import type { CompanySize } from './types';

export const COMPANY_SIZE_CONFIG: Record<CompanySize, {
  label: string;
  description: string;
  requiredWorkers: number;
  cashMultiplier: number;
  startingEmployees: { bezUmowy: number; zlecenie: number; uop: number };
}> = {
  micro: {
    label: 'Mikro',
    description: 'Firma jednoosobowa lub z kilkoma współpracownikami. Minimum formalności, minimum kosztów. Trudno o duże kontrakty.',
    requiredWorkers: 0,
    cashMultiplier: 1.0,
    startingEmployees: { bezUmowy: 0, zlecenie: 0, uop: 0 },
  },
  small: {
    label: 'Mała',
    description: 'Kilku pracowników na zleceniach. Większe możliwości, ale i większe koszty stałe.',
    requiredWorkers: 3,
    cashMultiplier: 1.5,
    startingEmployees: { bezUmowy: 0, zlecenie: 3, uop: 0 },
  },
  medium: {
    label: 'Średnia',
    description: 'Kilkunastu pracowników, lokal, księgowość. Prawdziwy biznes i prawdziwe ryzyko.',
    requiredWorkers: 10,
    cashMultiplier: 2.2,
    startingEmployees: { bezUmowy: 0, zlecenie: 7, uop: 3 },
  },
};

export const PSL_AVAILABILITY_CHANCE = 0.67;
export const BELOW_REQUIRED_WORKERS_PENALTY = 2;

export const WORKER_CONFIG: Record<'bezUmowy' | 'zlecenie' | 'uop', {
  label: string;
  wage: number;
  revenue: number;
  severance: number;
  reputationImpact: number;
}> = {
  bezUmowy: {
    label: 'Bez umowy',
    wage: 1500,
    revenue: 4000,
    severance: 0,
    reputationImpact: -0.5,
  },
  zlecenie: {
    label: 'Umowa zlecenie',
    wage: 2500,
    revenue: 6500,
    severance: 0,
    reputationImpact: 0,
  },
  uop: {
    label: 'Umowa o pracę',
    wage: 4500,
    revenue: 10000,
    severance: 8000,
    reputationImpact: 1,
  },
};

export const RUMOR_TEMPLATES = [
  'Coraz głośniej mówi się o: {topic}',
  'Anonimowe źródła donoszą: {topic}',
  'Pogłoski z kuluarów: {topic}',
  'Czego można się spodziewać? Wszyscy mówią o: {topic}',
  'Nieoficjalnie: {topic}',
];

export const MAX_NEWS = 120;

export const FAKE_RUMORS = [
  'Mówi się o wielkiej fuzji na rynku, ale nikt nie zna szczegółów.',
  'Krążą słuchy o nowym podatku, który ma wejść od przyszłego roku.',
  'Podobno szykuje się zmiana na stanowisku ministra finansów.',
  'Ktoś widział prominentnego polityka w twojej dzielnicy. Plotka?',
  'Mówi się o dziwnych ruchach kapitałowych wśród lokalnych biznesmenów.',
  'Nieoficjalnie: możliwa zmiana zasad przetargów publicznych.',
  'Słychać o tajemniczej spółce, która skupuje grunty w okolicy.',
  'Coraz głośniej o możliwych strajkach w przemyśle ciężkim.',
  'Gazety spekulują o dymisji w rządzie. Nikt nie potwierdza.',
  'Plotka: banki rozważają zaostrzenie polityki kredytowej.',
];

export const MISLEADING_RUMOR_CHANCE = 0.30;

export const CANDIDATE_FIRST_NAMES = [
  'Jan', 'Piotr', 'Andrzej', 'Marek', 'Krzysztof', 'Tomasz',
  'Paweł', 'Michał', 'Grzegorz', 'Rafał', 'Wojciech', 'Zbigniew',
  'Anna', 'Maria', 'Katarzyna', 'Ewa', 'Joanna', 'Małgorzata',
];

export const CANDIDATE_LAST_NAMES = [
  'Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński',
  'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
  'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski',
];