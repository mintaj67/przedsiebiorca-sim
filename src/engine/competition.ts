import type {
  GameState,
  Competitor,
  CompanySize,
  CompetitorTrend,
  PlayerSnapshot,
  Trend,
} from './types';
import { makeRng } from './rng';
import { recomputeReputation } from './reputation';
import competitionData from '../data/competition.json';
import branchesData from '../data/branches.json';

// ===========================================================================
// KONFIGURACJA — wszystkie liczby do ustawienia po Twojej stronie.
// Wartości poniżej to tylko techniczne placeholdery, żeby kod działał.
// ===========================================================================

/** Ile interakcji z konkurencją gracz ma na turę. */
export const INTERACTIONS_PER_TURN = 2;

/** Domyślne wartości dla pól filtrujących, których nie ma we wpisie w data/competition.json. */
const TEMPLATE_DEFAULTS = {
  categories: ['*'] as string[], // "*" = firma jest konkurentem w każdej branży
  startYear: 1989,
};

/**
 * Losowy podział rozmiarów konkurencji: pierwsze sloty to wskazane rozmiary,
 * reszta firm dostaje DEFAULT_COMPETITOR_SIZE. Które firmy dostaną który rozmiar — losowo (seed).
 */
export const COMPETITOR_SIZE_MIX: CompanySize[] = ['large', 'medium', 'medium'];
export const DEFAULT_COMPETITOR_SIZE: CompanySize = 'small';

/** Zakresy losowania statystyk startowych (włącznie). Wartość firmy wynika z jej rozmiaru. */
const GENERATION = {
  reputation: { min: 20, max: 80 },
  condition: { min: 30, max: 70 },
  opinion: { min: 30, max: 70 },
};

/** Dynamika zmian na kwartał. */
const TUNING = {
  conditionPull: 0.15, // jak mocno kondycja wraca do bazowej (0-1)
  conditionNoise: 6, // losowy szum kondycji: ±
  reputationPull: 0.1,
  reputationNoise: 3,
  opinionPull: 0.1,
  opinionNoise: 1,
  valueGrowthFromCondition: 0.04, // maks. wzrost wartości na kwartał z samej kondycji
  valueNoise: 0.06, // całkowita rozpiętość losowego szumu wartości
  trendMinDelta: 2, // min. zmiana reputacji/kondycji, by pokazać trend
  trendMinRatio: 0.015, // min. zmiana wartości, by pokazać trend
};

/** Skutki interakcji gracza z konkurentem (wartości z Twojej oryginalnej wersji). */
export const INTERACTION_EFFECTS = {
  positive: {
    competitorReputation: 5,
    competitorOpinion: 0, // <-- do ustawienia
    playerOpiniaBranza: 2,
  },
  negativeSuccess: {
    chance: 0.5,
    competitorReputation: -10,
    competitorOpinion: 0, // <-- do ustawienia
    playerOpiniaBranza: 3,
  },
  negativeFail: {
    competitorReputation: -5,
    competitorOpinion: 0, // <-- do ustawienia
    playerOpiniaBranza: -5,
    playerOpiniaPubliczna: -5,
  },
};

export const SIZE_ORDER: CompanySize[] = [
  'micro',
  'small',
  'medium',
  'large',
  'very_large',
  'corporation',
];

/** Wartość (PLN), od której firma awansuje do danego rozmiaru. */
export const SIZE_VALUE_FLOOR: Record<CompanySize, number> = {
  micro: 0,
  small: 300_000,
  medium: 2_000_000,
  large: 15_000_000,
  very_large: 100_000_000,
  corporation: 600_000_000,
};
/** Spadek rozmiaru dopiero poniżej tego ułamka progu (histereza). */
const SIZE_DOWNGRADE_RATIO = 0.7;

/** Wagi w wyniku rankingowym (suma = 1). */
export const RANKING_WEIGHTS = { value: 0.35, size: 0.25, reputation: 0.2, condition: 0.2 } as const;

// ===========================================================================
// Szablony (data/competition.json)
// ===========================================================================

/**
 * Wpis z data/competition.json. Wymagane: id, name, description.
 * Statystyki są losowane przy tworzeniu gry — `baseReputation` z JSON jest ignorowane.
 */
export interface CompetitorTemplate {
  id: string;
  name: string;
  description: string;
  baseReputation?: number; // przestarzałe, nieużywane
  /** Id kategorii z branches.json albo "*". */
  categories?: string[];
  startYear?: number;
}

const TEMPLATES = competitionData as unknown as CompetitorTemplate[];

interface BranchCategory {
  id: string;
  activities: { id: string }[];
}

/** Zwraca id kategorii (np. "handel") dla id działalności (np. "handel_odziez"). */
export function getCategoryId(activityId: string): string | null {
  const cat = (branchesData as BranchCategory[]).find((c) =>
    c.activities.some((a) => a.id === activityId),
  );
  return cat?.id ?? null;
}

function templatesFor(category: string, year: number): CompetitorTemplate[] {
  return TEMPLATES.filter((t) => {
    const cats = t.categories ?? TEMPLATE_DEFAULTS.categories;
    const start = t.startYear ?? TEMPLATE_DEFAULTS.startYear;
    return (cats.includes('*') || cats.includes(category)) && start <= year;
  });
}

// ===========================================================================
// Pomocnicze
// ===========================================================================

type Rng = ReturnType<typeof makeRng>;

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

function trendDiff(cur: number, prev: number, minDelta: number): Trend {
  const d = cur - prev;
  return d >= minDelta ? 1 : d <= -minDelta ? -1 : 0;
}

function trendRatio(cur: number, prev: number, minRatio: number): Trend {
  if (prev <= 0) return 0;
  const r = cur / prev - 1;
  return r >= minRatio ? 1 : r <= -minRatio ? -1 : 0;
}

/** Rozmiar z histerezą: awans po przekroczeniu progu, spadek dopiero poniżej ułamka progu. */
function resolveSize(size: CompanySize, value: number): CompanySize {
  let idx = SIZE_ORDER.indexOf(size);
  while (idx < SIZE_ORDER.length - 1 && value >= SIZE_VALUE_FLOOR[SIZE_ORDER[idx + 1]]) idx++;
  while (idx > 0 && value < SIZE_VALUE_FLOOR[SIZE_ORDER[idx]] * SIZE_DOWNGRADE_RATIO) idx--;
  return SIZE_ORDER[idx];
}

// ===========================================================================
// Generowanie i migracja
// ===========================================================================

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wartość losowana logarytmicznie w przedziale [próg rozmiaru, próg następnego rozmiaru). */
function rollValue(size: CompanySize, rng: Rng): number {
  const idx = SIZE_ORDER.indexOf(size);
  const low = Math.max(SIZE_VALUE_FLOOR[size], 1000);
  const next = SIZE_ORDER[idx + 1];
  const high = next ? SIZE_VALUE_FLOOR[next] : low * 2;
  return Math.round(Math.exp(Math.log(low) + rng.next() * (Math.log(high) - Math.log(low))));
}

function createCompetitor(t: CompetitorTemplate, size: CompanySize, rng: Rng): Competitor {
  const reputation = rng.int(GENERATION.reputation.min, GENERATION.reputation.max);
  const condition = rng.int(GENERATION.condition.min, GENERATION.condition.max);
  const opinion = rng.int(GENERATION.opinion.min, GENERATION.opinion.max);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    size,
    reputation,
    value: rollValue(size, rng),
    condition,
    opinionOfPlayer: opinion,
    // Statystyki dryfują wokół wylosowanych wartości startowych.
    baseReputation: reputation,
    baseCondition: condition,
    baseOpinion: opinion,
    trend: { value: 0, reputation: 0, condition: 0 },
  };
}

/**
 * Konkurenci z szablonów pasujących do kategorii i roku, ze statystykami losowanymi
 * (deterministycznie dla seeda): rozmiary wg COMPETITOR_SIZE_MIX, reszta małe.
 */
export function generateCompetitors(category: string, year: number, seed: string): Competitor[] {
  const rng = makeRng(`${seed}:competition-init`, year);
  const pool = templatesFor(category, year);

  const sizeById = new Map<string, CompanySize>();
  shuffle(pool, rng).forEach((t, i) => {
    sizeById.set(t.id, COMPETITOR_SIZE_MIX[i] ?? DEFAULT_COMPETITOR_SIZE);
  });

  return pool.map((t) => createCompetitor(t, sizeById.get(t.id)!, rng));
}

/** Migracja starych zapisów (bez pola `competitors`). Nie mutuje wejścia. */
export function ensureCompetitors(s: GameState): GameState {
  if (Array.isArray(s.competitors) && typeof s.competitionCategory === 'string') return s;
  const category = getCategoryId(s.company.activity) ?? '';
  return {
    ...s,
    competitors: category ? generateCompetitors(category, s.year, s.seed) : [],
    competitionCategory: category,
    playerPrev: s.playerPrev ?? null,
    interactionPoints: s.interactionPoints ?? INTERACTIONS_PER_TURN,
  };
}

// ===========================================================================
// Tura
// ===========================================================================

function evolveCompetitor(c: Competitor, rng: Rng) {
  const before = { value: c.value, reputation: c.reputation, condition: c.condition };

  c.condition = clamp(
    c.condition +
      (c.baseCondition - c.condition) * TUNING.conditionPull +
      rng.int(-TUNING.conditionNoise, TUNING.conditionNoise),
  );
  c.reputation = clamp(
    c.reputation +
      (c.baseReputation - c.reputation) * TUNING.reputationPull +
      rng.int(-TUNING.reputationNoise, TUNING.reputationNoise),
  );
  c.opinionOfPlayer = clamp(
    c.opinionOfPlayer +
      (c.baseOpinion - c.opinionOfPlayer) * TUNING.opinionPull +
      rng.int(-TUNING.opinionNoise, TUNING.opinionNoise),
  );

  const growth =
    ((c.condition - 50) / 50) * TUNING.valueGrowthFromCondition + (rng.next() - 0.5) * TUNING.valueNoise;
  c.value = Math.max(1000, Math.round(c.value * (1 + growth)));
  c.size = resolveSize(c.size, c.value);

  const trend: CompetitorTrend = {
    value: trendRatio(c.value, before.value, TUNING.trendMinRatio),
    reputation: trendDiff(c.reputation, before.reputation, TUNING.trendMinDelta),
    condition: trendDiff(c.condition, before.condition, TUNING.trendMinDelta),
  };
  c.trend = trend;
}

/**
 * Jeden krok symulacji konkurencji (kwartał). MUTUJE przekazany stan
 * (tak jak applyEffects) — wołaj na klonie, np. wewnątrz nextTurn.
 */
export function tickCompetitors(s: GameState, step = 0): GameState {
  const category = getCategoryId(s.company.activity) ?? '';

  // Pierwsza tura po migracji albo zmiana branży przez gracza: konkurencja z nowej kategorii.
  if (!Array.isArray(s.competitors) || s.competitionCategory !== category) {
    s.competitors = category ? generateCompetitors(category, s.year, s.seed) : [];
    s.competitionCategory = category;
    return s;
  }

  const rng = makeRng(`${s.seed}:competition`, s.turn * 10 + step);
  for (const c of s.competitors) evolveCompetitor(c, rng);
  return s;
}

// ===========================================================================
// Interakcje gracza z konkurentem
// ===========================================================================

export function interactWithCompetitor(
  state: GameState,
  compId: string,
  actionType: 'positive' | 'negative',
): GameState {
  if (state.gameOver || state.interactionPoints <= 0) return state;
  const idx = (state.competitors ?? []).findIndex((c) => c.id === compId);
  if (idx < 0) return state;

  const s = structuredClone(state);
  const c = s.competitors[idx];
  const rep = s.company.reputation;
  s.interactionPoints -= 1;

  if (actionType === 'positive') {
    const fx = INTERACTION_EFFECTS.positive;
    c.reputation = clamp(c.reputation + fx.competitorReputation);
    c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
    rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
  } else {
    // Sól zależy od tury, konkurenta i liczby pozostałych punktów — każdy rzut jest inny.
    const rng = makeRng(`${s.seed}:interact`, s.turn * 100 + idx * 7 + s.interactionPoints);
    if (rng.next() < INTERACTION_EFFECTS.negativeSuccess.chance) {
      const fx = INTERACTION_EFFECTS.negativeSuccess;
      c.reputation = clamp(c.reputation + fx.competitorReputation);
      c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
      rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
    } else {
      const fx = INTERACTION_EFFECTS.negativeFail;
      c.reputation = clamp(c.reputation + fx.competitorReputation);
      c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
      rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
      rep.opiniaPubliczna = clamp(rep.opiniaPubliczna + fx.playerOpiniaPubliczna);
    }
  }

  s.company.reputation = recomputeReputation(s);
  return s;
}

// ===========================================================================
// Ranking
// ===========================================================================

export interface RankingRow {
  id: string;
  name: string;
  isPlayer: boolean;
  rank: number;
  score: number;
  size: CompanySize;
  reputation: number;
  value: number;
  condition: number;
  /** null dla gracza. */
  opinionOfPlayer: number | null;
  trend: CompetitorTrend;
}

export function computePlayerValue(s: GameState): number {
  const c = s.company;
  const debts = c.loans.reduce((sum, l) => sum + l.remaining, 0);
  return Math.max(0, Math.round(c.finances.stanKonta - debts));
}

export function rankingScore(size: CompanySize, value: number, reputation: number, condition: number): number {
  const valueScore = clamp(((Math.log10(Math.max(value, 1)) - 4) / 5) * 100);
  const sizeScore = (SIZE_ORDER.indexOf(size) / (SIZE_ORDER.length - 1)) * 100;
  const score =
    valueScore * RANKING_WEIGHTS.value +
    sizeScore * RANKING_WEIGHTS.size +
    clamp(reputation) * RANKING_WEIGHTS.reputation +
    clamp(condition) * RANKING_WEIGHTS.condition;
  return Math.round(score * 10) / 10;
}

/** Gracz i konkurenci, od najwyżej ocenionej firmy. */
export function computeRanking(s: GameState): RankingRow[] {
  const prev = s.playerPrev ?? null;

  const pValue = computePlayerValue(s);
  const pRep = s.company.reputation.ogolna;
  const pCond = s.profitabilityScore;
  const pTrendCond: Trend =
    s.profitabilityTrend === 'up1' || s.profitabilityTrend === 'up2'
      ? 1
      : s.profitabilityTrend === 'down1' || s.profitabilityTrend === 'down2'
        ? -1
        : 0;

  const rows: RankingRow[] = [
    {
      id: 'player',
      name: `${s.company.name}${s.company.suffix}`,
      isPlayer: true,
      rank: 0,
      score: rankingScore(s.company.size, pValue, pRep, pCond),
      size: s.company.size,
      reputation: pRep,
      value: pValue,
      condition: pCond,
      opinionOfPlayer: null,
      trend: {
        value: prev ? trendRatio(pValue, prev.value, TUNING.trendMinRatio) : 0,
        reputation: prev ? trendDiff(pRep, prev.reputation, TUNING.trendMinDelta) : 0,
        condition: pTrendCond,
      },
    },
  ];

  for (const c of s.competitors ?? []) {
    rows.push({
      id: c.id,
      name: c.name,
      isPlayer: false,
      rank: 0,
      score: rankingScore(c.size, c.value, c.reputation, c.condition),
      size: c.size,
      reputation: c.reputation,
      value: c.value,
      condition: c.condition,
      opinionOfPlayer: c.opinionOfPlayer,
      trend: c.trend,
    });
  }

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pl'));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/** Statystyki gracza „tu i teraz” — zapisywane na początku tury do liczenia trendów. */
export function snapshotPlayer(s: GameState): PlayerSnapshot {
  const me = computeRanking(s).find((r) => r.isPlayer)!;
  return { value: me.value, reputation: me.reputation, condition: me.condition, rank: me.rank };
}
