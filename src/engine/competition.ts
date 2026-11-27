import type {
  GameState,
  Competitor,
  CompanySize,
  CompetitorTrend,
  CompetitorCharacter,
  PlayerSnapshot,
  Trend,
  ActiveWar,
  WarActionDefinition,
  WarDemandType,
  AcquiredMode,
  NewsItem,
  NewsChoice,
  EventEffects,
 } from './types';
import { makeRng } from './rng';
import { recomputeReputation } from './reputation';
import { formatCompanyName, getCompanyActivities } from './activityHelper';
import { scaleByInflation } from './economy';
import { formatMoney } from './currency';
import { MAX_NEWS } from './constants';
import competitionData from '../data/competition.json';
import competitionTextsData from '../data/competition_texts.json';
import branchesData from '../data/branches.json';

export const INTERACTIONS_PER_TURN = 2;
export const LEAGUE_TARGET_SIZE = 20;
export const MIN_SAME_BRANCH_COMPETITORS = 3;
export const MAX_PLAYER_ALLIANCES = 3;
export const WAR_MAX_TURNS = 8;
export const TAKEOVER_AFTER_WAR_CHANCE = 0.15;

const TEMPLATE_DEFAULTS = {
  categories: ['handel'] as string[],
  startYear: 1989,
  character: 'neutral' as CompetitorCharacter,
  mottos: ['Lorem ipsum 1', 'Lorem ipsum 2', 'Lorem ipsum 3'] as string[],
};

export const COMPETITOR_SIZE_MIX: CompanySize[] = [
  'very_large',
  'large',
  'large',
  'medium',
  'medium',
  'medium',
  'medium',
  'medium',
  'small',
  'small',
  'small',
  'small',
  'small',
  'small',
  'small',
  'micro',
  'micro',
  'micro',
  'micro',
  'micro',
];
export const DEFAULT_COMPETITOR_SIZE: CompanySize = 'small';

const GENERATION = {
  reputation: { min: 25, max: 80 },
  condition: { min: 35, max: 75 },
  opinion: { min: 35, max: 65 },
};

const TUNING = {
  conditionPull: 0.12,
  conditionNoise: 6,
  reputationPull: 0.08,
  reputationNoise: 3,
  opinionPull: 0.05,
  opinionNoise: 1,
  valueGrowthFromCondition: 0.04,
  valueNoise: 0.06,
  trendMinDelta: 2,
  trendMinRatio: 0.015,
};

export const INTERACTION_EFFECTS = {
  positive: {
    competitorReputation: 3,
    competitorOpinion: 10,
    playerOpiniaBranza: 2,
  },
  negativeSuccess: {
    chance: 0.55,
    competitorReputation: -8,
    competitorOpinion: -15,
    playerOpiniaBranza: 2,
  },
  negativeFail: {
    competitorReputation: -3,
    competitorOpinion: -22,
    playerOpiniaBranza: -5,
    playerOpiniaPubliczna: -4,
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

export const SIZE_VALUE_FLOOR: Record<CompanySize, number> = {
  micro: 0,
  small: 300_000,
  medium: 2_000_000,
  large: 15_000_000,
  very_large: 100_000_000,
  corporation: 600_000_000,
};

const SIZE_DOWNGRADE_RATIO = 0.7;

export const RANKING_WEIGHTS = { value: 0.35, size: 0.25, reputation: 0.2, condition: 0.2 } as const;

export interface CompetitorTemplate {
  id: string;
  name: string;
  description: string;
  mottos?: string[];
  character?: CompetitorCharacter;
  baseReputation?: number;
  categories?: string[];
  startYear?: number;
}

interface SubsidiaryTaskTemplate {
  id: string;
  headline: string;
  body: string;
  acceptLabel: string;
  acceptDescription: string;
  refuseLabel: string;
  refuseDescription: string;
  acceptEffects: EventEffects;
  displeasureOnAccept: number;
  displeasureOnRefuse: number;
}

interface CompetitionTextsFile {
  warActions: WarActionDefinition[];
  subsidiaryTasks: SubsidiaryTaskTemplate[];
  pressTemplates: Record<string, { headline: string; body: string }>;
}

const TEMPLATES = competitionData as unknown as CompetitorTemplate[];
const TEXTS = competitionTextsData as unknown as CompetitionTextsFile;

interface BranchCategory {
  id: string;
  activities: { id: string }[];
}

type Rng = ReturnType<typeof makeRng>;

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

function fillTemplate(str: string, vars: Record<string, string>): string {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

function pushNews(state: GameState, item: Omit<NewsItem, 'read'>): void {
  state.news.unshift({ ...item, read: false });
  if (state.news.length > MAX_NEWS) state.news.pop();
}

function pushActionNews(state: GameState, item: Omit<NewsItem, 'read' | 'resolved'>): void {
  state.news.unshift({ ...item, read: false, resolved: false });
  if (state.news.length > MAX_NEWS) state.news.pop();
}

function logTurnAction(
  state: GameState,
  icon: string,
  category: string,
  text: string,
  target: 'rankings' | 'competition' = 'rankings'
): void {
  if (!Array.isArray(state.turnActions)) state.turnActions = [];
  state.turnActions.push({
    id: `comp_act_${state.turn}_${state.turnActions.length}`,
    icon,
    category,
    text,
    target,
    canUndo: false,
  });
}

export function getCategoryId(activityId: string): string | null {
  const cat = (branchesData as BranchCategory[]).find((c) =>
    c.activities.some((a) => a.id === activityId),
  );
  return cat?.id ?? null;
}

export function getCategoryKey(activityOrList: string | string[]): string {
  const list = Array.isArray(activityOrList)
    ? activityOrList
    : activityOrList.includes(',')
      ? activityOrList.split(',').filter(Boolean)
      : [activityOrList];

  const cats = Array.from(
    new Set(list.map((id) => getCategoryId(id) ?? id).filter(Boolean))
  ).sort();

  return cats.join(',');
}

export function getPlayerCategories(state: GameState): string[] {
  const activities = getCompanyActivities(state.company);
  return Array.from(
    new Set(activities.map((id) => getCategoryId(id) ?? id).filter(Boolean))
  );
}

export function isInPlayerBranch(state: GameState, comp: Competitor): boolean {
  const playerCats = new Set(getPlayerCategories(state));
  const compCats = comp.categories ?? ['handel'];
  return compCats.includes('*') || compCats.some((c) => playerCats.has(c));
}

function trendDiff(cur: number, prev: number, minDelta: number): Trend {
  const d = cur - prev;
  return d >= minDelta ? 1 : d <= -minDelta ? -1 : 0;
}

function trendRatio(cur: number, prev: number, minRatio: number): Trend {
  if (prev <= 0) return 0;
  const r = cur / prev - 1;
  return r >= minRatio ? 1 : r <= -minRatio ? -1 : 0;
}

function resolveSize(size: CompanySize, value: number): CompanySize {
  let idx = SIZE_ORDER.indexOf(size);
  while (idx < SIZE_ORDER.length - 1 && value >= SIZE_VALUE_FLOOR[SIZE_ORDER[idx + 1]]) idx++;
  while (idx > 0 && value < SIZE_VALUE_FLOOR[SIZE_ORDER[idx]] * SIZE_DOWNGRADE_RATIO) idx--;
  return SIZE_ORDER[idx];
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollValue(size: CompanySize, rng: Rng): number {
  const idx = SIZE_ORDER.indexOf(size);
  const low = Math.max(SIZE_VALUE_FLOOR[size], 15_000);
  const next = SIZE_ORDER[idx + 1];
  const high = next ? SIZE_VALUE_FLOOR[next] : low * 2;
  return Math.round(Math.exp(Math.log(low) + rng.next() * (Math.log(high) - Math.log(low))));
}

function rollSizeForYear(year: number, rng: Rng): CompanySize {
  const r = rng.next();
  if (year >= 1998) {
    if (r < 0.15) return 'large';
    if (r < 0.50) return 'medium';
    if (r < 0.85) return 'small';
    return 'micro';
  }
  if (year >= 1993) {
    if (r < 0.10) return 'large';
    if (r < 0.35) return 'medium';
    if (r < 0.75) return 'small';
    return 'micro';
  }
  if (r < 0.25) return 'medium';
  if (r < 0.70) return 'small';
  return 'micro';
}

function createCompetitor(t: CompetitorTemplate, size: CompanySize, rng: Rng): Competitor {
  const reputation = t.baseReputation
    ? clamp(t.baseReputation + rng.int(-10, 10))
    : rng.int(GENERATION.reputation.min, GENERATION.reputation.max);
  const condition = rng.int(GENERATION.condition.min, GENERATION.condition.max);
  const opinion = rng.int(GENERATION.opinion.min, GENERATION.opinion.max);
  const mottos = t.mottos && t.mottos.length > 0 ? t.mottos : TEMPLATE_DEFAULTS.mottos;
  const motto = mottos[rng.int(0, mottos.length - 1)];

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    motto,
    character: t.character ?? TEMPLATE_DEFAULTS.character,
    categories: t.categories ?? TEMPLATE_DEFAULTS.categories,
    status: 'active',
    size,
    reputation,
    value: rollValue(size, rng),
    condition,
    opinionOfPlayer: opinion,
    baseReputation: reputation,
    baseCondition: condition,
    baseOpinion: opinion,
    trend: { value: 0, reputation: 0, condition: 0 },
    allies: [],
    rivals: [],
    isAlliedWithPlayer: false,
    atWarWithPlayer: false,
    dependentOn: null,
    acquiredBy: null,
    acquiredMode: null,
    subsidiaryIncome: 0,
  };
}

function seedRelationsBetweenCompetitors(competitors: Competitor[], rng: Rng): void {
  const active = competitors.filter((c) => c.status === 'active');
  if (active.length < 2) return;

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    const others = shuffle(
      active.filter((x) => x.id !== a.id),
      rng
    );

    // 1–2 zgody
    const targetAllies = a.character === 'peaceful' ? 2 : 1;
    for (const b of others) {
      if (a.allies.length >= targetAllies) break;
      if (a.allies.includes(b.id) || a.rivals.includes(b.id)) continue;
      if (b.allies.length >= 3) continue;
      a.allies.push(b.id);
      b.allies.push(a.id);
    }

    // 1–2 kosy (agresywni chętniej mają kosy)
    const targetRivals = a.character === 'aggressive' ? 2 : a.character === 'neutral' ? 1 : 0;
    for (const b of others) {
      if (a.rivals.length >= targetRivals) break;
      if (a.allies.includes(b.id) || a.rivals.includes(b.id)) continue;
      if (b.rivals.length >= 3) continue;
      a.rivals.push(b.id);
      b.rivals.push(a.id);
    }
  }
}

/**
 * Generuje stałą ligę 20 firm na początek gry, z gwarancją minimum 3 firm
 * z każdej aktywnej branży gracza. Pozostałe szablony trafiają do rezerwy.
 */
export function generateCompetitors(
  categoryOrList: string | string[],
  year: number,
  seed: string,
): Competitor[] {
  const rng = makeRng(`${seed}:competition-init`, year);
  const rawCats = Array.isArray(categoryOrList)
    ? categoryOrList
    : categoryOrList.split(',').filter(Boolean);
  const playerCats = Array.from(new Set(rawCats.map((c) => getCategoryId(c) ?? c).filter(Boolean)));

  const eligibleTemplates = TEMPLATES.filter(
    (t) => (t.startYear ?? TEMPLATE_DEFAULTS.startYear) <= year
  );

  const chosen: CompetitorTemplate[] = [];
  const chosenIds = new Set<string>();

  const pickFrom = (list: CompetitorTemplate[], count: number) => {
    const candidates = shuffle(
      list.filter((t) => !chosenIds.has(t.id)),
      rng
    );
    for (const t of candidates) {
      if (count <= 0) break;
      chosen.push(t);
      chosenIds.add(t.id);
      count -= 1;
    }
  };

  // Gwarancja min. 3 firm dla każdej branży gracza
  for (const cat of playerCats) {
    const alreadyInCat = chosen.filter((t) => {
      const cats = t.categories ?? TEMPLATE_DEFAULTS.categories;
      return cats.includes('*') || cats.includes(cat);
    }).length;
    const needed = Math.max(0, MIN_SAME_BRANCH_COMPETITORS - alreadyInCat);
    if (needed > 0) {
      const matching = eligibleTemplates.filter((t) => {
        const cats = t.categories ?? TEMPLATE_DEFAULTS.categories;
        return cats.includes('*') || cats.includes(cat);
      });
      pickFrom(matching, needed);
    }
  }

  // Dopełnienie ligi do 20 firm z pozostałej puli startowej
  const remainingNeeded = Math.max(0, LEAGUE_TARGET_SIZE - chosen.length);
  pickFrom(eligibleTemplates, remainingNeeded);

  const shuffledChosen = shuffle(chosen, rng);
  const competitors = shuffledChosen.map((t, i) =>
    createCompetitor(t, COMPETITOR_SIZE_MIX[i] ?? DEFAULT_COMPETITOR_SIZE, rng)
  );

  seedRelationsBetweenCompetitors(competitors, rng);
  return competitors;
}

/**
 * Upewnia się, że w lidze istnieją min. 3 aktywne firmy z każdej branży gracza.
 * NIE resetuje tabeli — dociąga brakujące firmy z rezerwy (np. po zmianie branży).
 */
export function ensureBranchCompetitors(state: GameState, announce = false): void {
  if (!Array.isArray(state.competitors)) state.competitors = [];
  const playerCats = getPlayerCategories(state);
  const existingIds = new Set(state.competitors.map((c) => c.id));
  const rng = makeRng(`${state.seed}:branch-refill`, state.turn * 19 + state.competitors.length);

  for (const cat of playerCats) {
    const activeInCat = state.competitors.filter(
      (c) =>
        c.status === 'active' &&
        (c.categories.includes('*') || c.categories.includes(cat))
    ).length;

    let needed = Math.max(0, MIN_SAME_BRANCH_COMPETITORS - activeInCat);
    if (needed <= 0) continue;

    const reserve = shuffle(
      TEMPLATES.filter((t) => {
        if (existingIds.has(t.id)) return false;
        const start = t.startYear ?? TEMPLATE_DEFAULTS.startYear;
        const cats = t.categories ?? TEMPLATE_DEFAULTS.categories;
        return start <= state.year && (cats.includes('*') || cats.includes(cat));
      }),
      rng
    );

    for (const tpl of reserve) {
      if (needed <= 0) break;
      const newComp = createCompetitor(tpl, rollSizeForYear(state.year, rng), rng);
      attachInitialRelationsForNewcomer(state, newComp, rng);
      state.competitors.push(newComp);
      existingIds.add(newComp.id);
      needed -= 1;

      if (announce) {
        const tmpl = TEXTS.pressTemplates.newEntrant;
        pushNews(state, {
          id: `comp_entrant_${newComp.id}_${state.turn}`,
          turn: state.turn,
          year: state.year,
          quarter: state.quarter,
          headline: fillTemplate(tmpl.headline, { company: newComp.name }),
          body: fillTemplate(tmpl.body, { company: newComp.name }),
          category: 'economy',
        });
      }
    }
  }

  state.competitionCategory = getCategoryKey(getCompanyActivities(state.company));
}

function attachInitialRelationsForNewcomer(state: GameState, newcomer: Competitor, rng: Rng): void {
  const active = state.competitors.filter((c) => c.status === 'active' && c.id !== newcomer.id);
  if (active.length === 0) return;

  const pickedAlly = active[rng.int(0, active.length - 1)];
  if (pickedAlly && pickedAlly.allies.length < 3) {
    newcomer.allies.push(pickedAlly.id);
    pickedAlly.allies.push(newcomer.id);
  }

  if (newcomer.character === 'aggressive' && active.length > 1) {
    const others = active.filter((c) => c.id !== pickedAlly?.id);
    const pickedRival = others[rng.int(0, others.length - 1)];
    if (pickedRival && pickedRival.rivals.length < 3) {
      newcomer.rivals.push(pickedRival.id);
      pickedRival.rivals.push(newcomer.id);
    }
  }
}

function isCompetitorMigrated(c: Competitor): boolean {
  return (
    typeof c.motto === 'string' &&
    typeof c.character === 'string' &&
    Array.isArray(c.categories) &&
    c.categories.length > 0 &&
    typeof c.status === 'string' &&
    Array.isArray(c.allies) &&
    Array.isArray(c.rivals) &&
    typeof c.isAlliedWithPlayer === 'boolean' &&
    typeof c.atWarWithPlayer === 'boolean'
  );
}

export function ensureCompetitors(s: GameState): GameState {
  const alreadyMigrated =
    Array.isArray(s.competitors) &&
    s.competitors.length > 0 &&
    typeof s.competitionCategory === 'string' &&
    Array.isArray(s.activeWars) &&
    Array.isArray(s.tributes) &&
    s.pendingWarResolution !== undefined &&
    Array.isArray(s.company.externalEquity) &&
    s.company.parentCompanyId !== undefined &&
    typeof s.company.parentDispleasure === 'number' &&
    typeof s.interactionPoints === 'number' &&
    s.competitors.every(isCompetitorMigrated);

  if (alreadyMigrated) return s;

  const cloned = structuredClone(s);
  const activities = getCompanyActivities(cloned.company);
  const category = getCategoryKey(activities);

  if (!Array.isArray(cloned.company.externalEquity)) cloned.company.externalEquity = [];
  if (cloned.company.parentCompanyId === undefined) cloned.company.parentCompanyId = null;
  if (typeof cloned.company.parentDispleasure !== 'number') cloned.company.parentDispleasure = 0;

  if (!Array.isArray(cloned.activeWars)) cloned.activeWars = [];
  if (!Array.isArray(cloned.tributes)) cloned.tributes = [];
  if (cloned.pendingWarResolution === undefined) cloned.pendingWarResolution = null;
  if (typeof cloned.interactionPoints !== 'number') cloned.interactionPoints = INTERACTIONS_PER_TURN;

  if (!Array.isArray(cloned.competitors) || cloned.competitors.length === 0) {
    cloned.competitors = generateCompetitors(category, cloned.year, cloned.seed);
    cloned.competitionCategory = category;
    cloned.playerPrev = cloned.playerPrev ?? null;
    return cloned;
  }

  const rng = makeRng(`${cloned.seed}:migrate-comp`, cloned.year);

  for (const c of cloned.competitors) {
    const tpl = TEMPLATES.find((t) => t.id === c.id);
    if (!c.motto) {
      const pool = tpl?.mottos ?? TEMPLATE_DEFAULTS.mottos;
      c.motto = pool[rng.int(0, pool.length - 1)];
    }
    if (!c.character) c.character = tpl?.character ?? TEMPLATE_DEFAULTS.character;
    if (!Array.isArray(c.categories) || c.categories.length === 0) {
      c.categories = tpl?.categories ?? TEMPLATE_DEFAULTS.categories;
    }
    if (!c.status) c.status = 'active';
    if (!Array.isArray(c.allies)) c.allies = [];
    if (!Array.isArray(c.rivals)) c.rivals = [];
    if (typeof c.isAlliedWithPlayer !== 'boolean') c.isAlliedWithPlayer = false;
    if (typeof c.atWarWithPlayer !== 'boolean') c.atWarWithPlayer = false;
    if (c.dependentOn === undefined) c.dependentOn = null;
    if (c.acquiredBy === undefined) c.acquiredBy = null;
    if (c.acquiredMode === undefined) c.acquiredMode = null;
    if (typeof c.subsidiaryIncome !== 'number') c.subsidiaryIncome = 0;
  }

  const activeCount = cloned.competitors.filter((c) => c.status === 'active').length;
  if (activeCount < LEAGUE_TARGET_SIZE) {
    const existingIds = new Set(cloned.competitors.map((c) => c.id));
    const reserve = shuffle(
      TEMPLATES.filter(
        (t) => !existingIds.has(t.id) && (t.startYear ?? TEMPLATE_DEFAULTS.startYear) <= cloned.year
      ),
      rng
    );
    let idx = activeCount;
    for (const tpl of reserve) {
      if (idx >= LEAGUE_TARGET_SIZE) break;
      cloned.competitors.push(
        createCompetitor(tpl, COMPETITOR_SIZE_MIX[idx] ?? DEFAULT_COMPETITOR_SIZE, rng)
      );
      idx += 1;
    }
    seedRelationsBetweenCompetitors(cloned.competitors, rng);
  }

  ensureBranchCompetitors(cloned, false);
  cloned.competitionCategory = category;
  return cloned;
}

// ============================================================================
// POMOCNIKI SOJUSZY, ZNIŻEK, WOJEN I ZALEŻNOŚCI
// ============================================================================

export function getWarActions(): WarActionDefinition[] {
  return TEXTS.warActions;
}

export function getPlayerAllies(state: GameState): Competitor[] {
  return (state.competitors ?? []).filter(
    (c) => c.status === 'active' && c.isAlliedWithPlayer
  );
}

/**
 * Zniżka na zakupy towarów/surowców wynikająca z sojuszy (u sojuszników i ich zaprzyjaźnionych firm).
 * Zwraca ułamek z przedziału 0 .. 0.25.
 */
export function getAllianceTradeDiscount(state: GameState): number {
  const allies = getPlayerAllies(state);
  if (allies.length === 0) return 0;

  const activeById = new Map(
    (state.competitors ?? [])
      .filter((c) => c.status === 'active')
      .map((c) => [c.id, c])
  );

  let discount = allies.length * 0.05; // 5% za każdego sojusznika

  // Dodatkowe 2% za unikalne zaprzyjaźnione firmy sojuszników
  const friendsOfAllies = new Set<string>();
  for (const a of allies) {
    for (const fId of a.allies ?? []) {
      if (activeById.has(fId) && !allies.some((x) => x.id === fId)) {
        friendsOfAllies.add(fId);
      }
    }
  }
  discount += Math.min(0.08, friendsOfAllies.size * 0.02);

  // Parasol spółki-matki daje dodatkowy niewielki rabat
  if (state.company.parentCompanyId && activeById.has(state.company.parentCompanyId)) {
    discount += 0.03;
  }

  return Math.min(0.25, Math.round(discount * 100) / 100);
}

export function getPlayerParentInfo(state: GameState): {
  parent: Competitor;
  percent: number;
  isControlling: boolean;
} | null {
  const stakes = state.company.externalEquity ?? [];
  if (stakes.length === 0) return null;

  const sorted = [...stakes].sort((a, b) => b.percent - a.percent);
  const top = sorted[0];
  if (!top || top.percent < 25) return null;

  const parent = (state.competitors ?? []).find(
    (c) => c.id === top.holderId && c.status === 'active'
  );
  if (!parent) return null;

  return {
    parent,
    percent: top.percent,
    isControlling: top.percent > 50,
  };
}

export function getActiveWarWith(state: GameState, compId: string): ActiveWar | null {
  return (
    (state.activeWars ?? []).find(
      (w) =>
        (w.attackerId === 'player' && w.defenderId === compId) ||
        (w.defenderId === 'player' && w.attackerId === compId)
    ) ?? null
  );
}

export function getAcquisitionCost(
  state: GameState,
  compId: string
): { canAcquire: boolean; cost: number; reason?: string } {
  const comp = (state.competitors ?? []).find((c) => c.id === compId && c.status === 'active');
  if (!comp) return { canAcquire: false, cost: 0, reason: 'Firma nie jest aktywna.' };

  if (state.company.parentCompanyId === comp.id) {
    return { canAcquire: false, cost: 0, reason: 'Nie możesz przejąć własnej spółki-matki.' };
  }

  const playerVal = computePlayerValue(state);
  const isWeak = comp.condition <= 30;
  const isMuchSmaller = playerVal >= comp.value * 1.5;

  if (!isWeak && !isMuchSmaller && comp.dependentOn !== 'player') {
    return {
      canAcquire: false,
      cost: Math.round(comp.value * 1.35),
      reason: 'Firma jest zbyt silna — osłab jej kondycję (<=30), uzależnij ją albo urośnij (1,5× jej wartości).',
    };
  }

  // Mnożnik ceny: wrogie przejęcie (zła opinia lub wojna) kosztuje więcej, firma w słabej kondycji mniej
  let mult = 1.15;
  if (comp.atWarWithPlayer || comp.opinionOfPlayer < 35) mult += 0.35;
  if (comp.isAlliedWithPlayer || comp.opinionOfPlayer >= 75) mult -= 0.15;
  if (comp.dependentOn === 'player') mult -= 0.25;
  if (comp.condition <= 25) mult -= 0.2;

  const cost = Math.max(scaleByInflation(25_000, state), Math.round(comp.value * Math.max(0.55, mult)));

  if (state.company.finances.stanKonta < cost) {
    return {
      canAcquire: false,
      cost,
      reason: `Brak środków — potrzebujesz ${formatMoney(cost, state)}.`,
    };
  }

  return { canAcquire: true, cost };
}

export function getEquityBuybackCost(
  state: GameState,
  holderId: string,
  percent: number
): number {
  const playerVal = Math.max(scaleByInflation(100_000, state), computePlayerValue(state));
  const holder = (state.competitors ?? []).find((c) => c.id === holderId);
  const opinionMod = holder && holder.opinionOfPlayer < 40 ? 1.35 : 1.15;
  return Math.max(
    scaleByInflation(15_000, state),
    Math.round(playerVal * (percent / 100) * opinionMod)
  );
}

// ============================================================================
// WEWNĘTRZNE MUTACJE DYPLOMACJI I WOJEN (UŻYWANE TEŻ PRZEZ actions.ts -> applyEffects)
// ============================================================================

function syncParentCompanyId(state: GameState): void {
  const stakes = (state.company.externalEquity ?? []).filter((e) => e.percent > 0);
  state.company.externalEquity = stakes;
  const top = [...stakes].sort((a, b) => b.percent - a.percent)[0];
  if (top && top.percent >= 25) {
    state.company.parentCompanyId = top.holderId;
  } else {
    state.company.parentCompanyId = null;
    state.company.parentDispleasure = 0;
  }
}

export function grantEquityToCompetitor(
  state: GameState,
  holderId: string,
  percent: number,
  cashReceived: number
): void {
  if (!Array.isArray(state.company.externalEquity)) state.company.externalEquity = [];

  const totalExisting = state.company.externalEquity.reduce((s, e) => s + e.percent, 0);
  const clampedAdd = Math.max(0, Math.min(percent, 100 - totalExisting));

  const existing = state.company.externalEquity.find((e) => e.holderId === holderId);
  if (existing) {
    existing.percent = Math.min(100, existing.percent + clampedAdd);
  } else if (clampedAdd > 0) {
    state.company.externalEquity.push({
      holderId,
      percent: clampedAdd,
      acquiredTurn: state.turn,
    });
  }

  if (cashReceived > 0) {
    state.company.finances.stanKonta += cashReceived;
    state.company.finances.wplywy.dofinansowania += cashReceived;
  }

  const holder = state.competitors.find((c) => c.id === holderId);
  if (holder) {
    holder.opinionOfPlayer = clamp(holder.opinionOfPlayer + 12);
    // Jeśli trwała wojna z tą firmą, kończymy ją
    if (holder.atWarWithPlayer) {
      holder.atWarWithPlayer = false;
      state.activeWars = (state.activeWars ?? []).filter(
        (w) =>
          !(
            (w.attackerId === 'player' && w.defenderId === holderId) ||
            (w.defenderId === 'player' && w.attackerId === holderId)
          )
      );
    }
  }

  syncParentCompanyId(state);
}

export function openWarInState(
  state: GameState,
  attackerId: 'player' | string,
  defenderId: 'player' | string,
  isBetrayal = false
): ActiveWar | null {
  if (attackerId === defenderId) return null;
  if (!Array.isArray(state.activeWars)) state.activeWars = [];

  const alreadyAtWar = state.activeWars.some(
    (w) =>
      (w.attackerId === attackerId && w.defenderId === defenderId) ||
      (w.attackerId === defenderId && w.defenderId === attackerId)
  );
  if (alreadyAtWar) return null;

  const attComp = attackerId === 'player' ? null : state.competitors.find((c) => c.id === attackerId);
  const defComp = defenderId === 'player' ? null : state.competitors.find((c) => c.id === defenderId);

  if (attackerId !== 'player' && (!attComp || attComp.status !== 'active')) return null;
  if (defenderId !== 'player' && (!defComp || defComp.status !== 'active')) return null;

  // Zerwanie ewentualnych sojuszy / zgód między stronami
  if (attackerId === 'player' && defComp) {
    defComp.isAlliedWithPlayer = false;
    defComp.atWarWithPlayer = true;
    defComp.opinionOfPlayer = clamp(defComp.opinionOfPlayer - 30);
  } else if (defenderId === 'player' && attComp) {
    attComp.isAlliedWithPlayer = false;
    attComp.atWarWithPlayer = true;
    attComp.opinionOfPlayer = clamp(attComp.opinionOfPlayer - 30);
  } else if (attComp && defComp) {
    attComp.allies = attComp.allies.filter((id) => id !== defComp.id);
    defComp.allies = defComp.allies.filter((id) => id !== attComp.id);
    if (!attComp.rivals.includes(defComp.id)) attComp.rivals.push(defComp.id);
    if (!defComp.rivals.includes(attComp.id)) defComp.rivals.push(attComp.id);
  }

  // Zbierz sojuszników obu stron
  const attackerAllies: string[] = [];
  const defenderAllies: string[] = [];

  if (attackerId === 'player') {
    for (const ally of getPlayerAllies(state)) {
      if (ally.id !== defenderId) attackerAllies.push(ally.id);
    }
    if (defComp) {
      for (const aId of defComp.allies) {
        if (aId !== attackerId && state.competitors.some((c) => c.id === aId && c.status === 'active')) {
          defenderAllies.push(aId);
        }
      }
    }
  } else if (defenderId === 'player') {
    for (const ally of getPlayerAllies(state)) {
      if (ally.id !== attackerId) defenderAllies.push(ally.id);
    }
    if (attComp) {
      for (const aId of attComp.allies) {
        if (aId !== defenderId && state.competitors.some((c) => c.id === aId && c.status === 'active')) {
          attackerAllies.push(aId);
        }
      }
    }
  } else if (attComp && defComp) {
    for (const aId of attComp.allies) {
      if (aId !== defComp.id && state.competitors.some((c) => c.id === aId && c.status === 'active')) {
        attackerAllies.push(aId);
      }
    }
    for (const aId of defComp.allies) {
      if (aId !== attComp.id && state.competitors.some((c) => c.id === aId && c.status === 'active')) {
        defenderAllies.push(aId);
      }
    }
  }

  const war: ActiveWar = {
    id: `war_${state.turn}_${attackerId}_${defenderId}_${state.activeWars.length}`,
    attackerId,
    defenderId,
    warScore: 0,
    startedTurn: state.turn,
    maxTurns: WAR_MAX_TURNS,
    attackerAllies,
    defenderAllies,
    actionsUsedThisTurn: [],
  };

  state.activeWars.push(war);

  // Prasa + wezwania sojusznicze dla gracza
  const attName = attackerId === 'player' ? formatCompanyName(state.company) : attComp!.name;
  const defName = defenderId === 'player' ? formatCompanyName(state.company) : defComp!.name;

  if (defenderId === 'player' && isBetrayal) {
    const tmpl = TEXTS.pressTemplates.playerBetrayed;
    pushNews(state, {
      id: `betrayal_${war.id}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: fillTemplate(tmpl.headline, { attacker: attName }),
      body: fillTemplate(tmpl.body, { attacker: attName }),
      category: 'economy',
    });
  } else if (attackerId !== 'player' && defenderId !== 'player') {
    const tmpl = isBetrayal ? TEXTS.pressTemplates.aiBetrayal : TEXTS.pressTemplates.aiWarStarted;
    pushNews(state, {
      id: `press_${war.id}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: fillTemplate(tmpl.headline, { attacker: attName, defender: defName }),
      body: fillTemplate(tmpl.body, { attacker: attName, defender: defName }),
      category: 'economy',
    });

    // Jeśli jedna ze stron wojny AI-AI jest sojusznikiem gracza — wezwanie do wojny (obowiązek sojuszniczy)
    const alliedComp = attComp!.isAlliedWithPlayer
      ? attComp
      : defComp!.isAlliedWithPlayer
        ? defComp
        : null;
    const enemyComp = alliedComp?.id === attComp!.id ? defComp : attComp;

    if (alliedComp && enemyComp && !enemyComp.atWarWithPlayer) {
      pushActionNews(state, {
        id: `ally_war_call_${war.id}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: `Wezwanie sojusznika: ${alliedComp.name} wzywa do wojny`,
        body: `Twój sojusznik ${alliedComp.name} toczy wojnę z firmą ${enemyComp.name} i oczekuje Twojego wsparcia zgodnie z sojuszem.`,
        category: 'economy',
        expiresAtTurn: state.turn + 2,
        choices: [
          {
            id: 'join_ally',
            label: `Wchodzę do wojny przeciwko ${enemyComp.name}`,
            description: 'Dotrzymujesz sojuszu. Zyskujesz wiarygodność w branży, ale rozpoczynasz wojnę z wrogiem sojusznika.',
            effects: {
              joinWarAsAlly: { warId: war.id, allyId: alliedComp.id },
              reputation: { opiniaBranza: 4 },
            },
          },
          {
            id: 'refuse_ally',
            label: 'Odmawiam — zrywam sojusz',
            description: 'Unikasz wojny, ale tracisz sojusznika i reputację wśród firm.',
            effects: {
              refuseWarCall: { allyId: alliedComp.id },
              reputation: { opiniaBranza: -10 },
            },
          },
        ],
        onExpireEffects: {
          refuseWarCall: { allyId: alliedComp.id },
          reputation: { opiniaBranza: -10 },
        },
      });
    }
  }

  return war;
}

export function joinAllyWarInState(state: GameState, warId: string, allyId: string): void {
  const ally = state.competitors.find((c) => c.id === allyId && c.status === 'active');
  const war = (state.activeWars ?? []).find((w) => w.id === warId);
  if (!ally) return;

  ally.opinionOfPlayer = clamp(ally.opinionOfPlayer + 15);

  if (war) {
    const enemyId = war.attackerId === allyId ? war.defenderId : war.attackerId;
    if (enemyId && enemyId !== 'player') {
      openWarInState(state, 'player', enemyId, false);
    }
  }
}

export function refuseAllyWarInState(state: GameState, allyId: string): void {
  const ally = state.competitors.find((c) => c.id === allyId);
  if (!ally) return;
  ally.isAlliedWithPlayer = false;
  ally.opinionOfPlayer = clamp(ally.opinionOfPlayer - 35);
}

// ============================================================================
// AKCJE GRACZA (INTERAKCJE, SOJUSZE, WOJNY, PRZEJĘCIA, UDZIAŁY)
// ============================================================================

export function interactWithCompetitor(
  state: GameState,
  compId: string,
  actionType: 'positive' | 'negative',
): GameState {
  if (state.gameOver || state.interactionPoints <= 0) return state;
  const idx = (state.competitors ?? []).findIndex(
    (c) => c.id === compId && c.status === 'active'
  );
  if (idx < 0) return state;

  const target = state.competitors[idx];
  if (actionType === 'positive' && target.atWarWithPlayer) return state;

  const s = structuredClone(state);
  const c = s.competitors[idx];
  const rep = s.company.reputation;
  s.interactionPoints -= 1;

  if (actionType === 'positive') {
    const fx = INTERACTION_EFFECTS.positive;
    c.reputation = clamp(c.reputation + fx.competitorReputation);
    c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
    rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
    logTurnAction(s, '🤝', 'Konkurencja', `Pozytywna interakcja z firmą: ${c.name}.`);
  } else {
    const rng = makeRng(`${s.seed}:interact`, s.turn * 100 + idx * 7 + s.interactionPoints);
    if (rng.next() < INTERACTION_EFFECTS.negativeSuccess.chance) {
      const fx = INTERACTION_EFFECTS.negativeSuccess;
      c.reputation = clamp(c.reputation + fx.competitorReputation);
      c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
      rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
      logTurnAction(s, '🎯', 'Konkurencja', `Skuteczna zagrywka przeciwko: ${c.name}.`);
    } else {
      const fx = INTERACTION_EFFECTS.negativeFail;
      c.reputation = clamp(c.reputation + fx.competitorReputation);
      c.opinionOfPlayer = clamp(c.opinionOfPlayer + fx.competitorOpinion);
      rep.opiniaBranza = clamp(rep.opiniaBranza + fx.playerOpiniaBranza);
      rep.opiniaPubliczna = clamp(rep.opiniaPubliczna + fx.playerOpiniaPubliczna);
      logTurnAction(s, '💥', 'Konkurencja', `Nieudana zagrywka przeciwko: ${c.name}.`);
    }

    // Jeśli zrywasz dobre relacje agresywnemu rywalowi, może sam wywołać wojnę
    if (c.isAlliedWithPlayer && c.opinionOfPlayer < 45) {
      c.isAlliedWithPlayer = false;
    }
  }

  s.company.reputation = recomputeReputation(s);
  return s;
}

export function proposeAlliance(state: GameState, compId: string): GameState {
  if (state.gameOver) return state;
  const currentAllies = getPlayerAllies(state);
  if (currentAllies.length >= MAX_PLAYER_ALLIANCES) return state;

  const target = (state.competitors ?? []).find(
    (c) => c.id === compId && c.status === 'active'
  );
  if (!target || target.isAlliedWithPlayer || target.atWarWithPlayer) return state;
  if (target.opinionOfPlayer < 65) return state;

  // Spółka-matka blokuje sojusze ze swoimi kosami
  const parentInfo = getPlayerParentInfo(state);
  if (parentInfo && parentInfo.parent.rivals.includes(target.id)) return state;

  const s = structuredClone(state);
  const c = s.competitors.find((x) => x.id === compId)!;
  c.isAlliedWithPlayer = true;
  c.opinionOfPlayer = clamp(c.opinionOfPlayer + 10);
  s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza + 5);
  s.company.reputation = recomputeReputation(s);

  logTurnAction(s, '🤝', 'Sojusz', `Zawarto formalny sojusz z firmą ${c.name}.`);
  return s;
}

export function breakAlliance(state: GameState, compId: string): GameState {
  if (state.gameOver) return state;
  const target = (state.competitors ?? []).find(
    (c) => c.id === compId && c.status === 'active' && c.isAlliedWithPlayer
  );
  if (!target) return state;

  const s = structuredClone(state);
  const c = s.competitors.find((x) => x.id === compId)!;
  c.isAlliedWithPlayer = false;
  c.opinionOfPlayer = clamp(c.opinionOfPlayer - 25);
  s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza - 8);
  s.company.reputation = recomputeReputation(s);

  logTurnAction(s, '💔', 'Sojusz', `Zerwano sojusz z firmą ${c.name}.`);
  return s;
}

export function takeAllyLoan(state: GameState, compId: string, amount: number): GameState {
  if (state.gameOver || amount <= 0) return state;
  const ally = (state.competitors ?? []).find(
    (c) => c.id === compId && c.status === 'active' && c.isAlliedWithPlayer
  );
  if (!ally) return state;

  const maxLoan = Math.max(scaleByInflation(50_000, state), Math.round(ally.value * 0.15));
  const finalAmount = Math.min(amount, maxLoan);
  if (finalAmount <= 0) return state;

  const s = structuredClone(state);
  s.company.loans.push({
    id: `ally_loan_${s.turn}_${s.company.loans.length}`,
    source: 'sojusznik',
    principal: finalAmount,
    remaining: finalAmount,
    interestRate: 0.015, // preferencyjna stopa u sojusznika
    quartersLeft: 12,
    lenderId: ally.id,
  });
  s.company.finances.stanKonta += finalAmount;
  s.company.finances.wplywy.srodkiZKredytow += finalAmount;

  logTurnAction(
    s,
    '🤝',
    'Sojusz',
    `Pożyczka po znajomości od sojusznika ${ally.name}: ${formatMoney(finalAmount, s)}.`
  );
  return s;
}

export function declareWar(state: GameState, compId: string): GameState {
  if (state.gameOver) return state;
  const target = (state.competitors ?? []).find(
    (c) => c.id === compId && c.status === 'active'
  );
  if (!target || target.atWarWithPlayer) return state;

  // Spółka-matka zabrania ataku na siebie lub swoich sojuszników
  const parentInfo = getPlayerParentInfo(state);
  if (
    parentInfo &&
    (parentInfo.parent.id === target.id || parentInfo.parent.allies.includes(target.id))
  ) {
    return state;
  }

  const s = structuredClone(state);
  const c = s.competitors.find((x) => x.id === compId)!;
  const wasAllied = c.isAlliedWithPlayer;

  openWarInState(s, 'player', compId, wasAllied);

  if (wasAllied) {
    // Kara za wbicie noża w plecy sojusznikowi
    s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza - 15);
    s.company.reputation.opiniaPubliczna = clamp(s.company.reputation.opiniaPubliczna - 6);
  } else {
    s.company.reputation.opiniaBranza = clamp(s.company.reputation.opiniaBranza - 4);
  }

  // Sojusznicy zaatakowanej firmy patrzą krzywo; jej kosy lekko przychylniej
  for (const other of s.competitors) {
    if (other.status !== 'active' || other.id === compId) continue;
    if (c.allies.includes(other.id)) {
      other.opinionOfPlayer = clamp(other.opinionOfPlayer - 12);
    }
    if (c.rivals.includes(other.id)) {
      other.opinionOfPlayer = clamp(other.opinionOfPlayer + 6);
    }
  }

  s.company.reputation = recomputeReputation(s);
  logTurnAction(s, '⚔️', 'Wojna', `Wypowiedziano wojnę firmie ${c.name}.`);
  return s;
}

export function performWarAction(
  state: GameState,
  compId: string,
  warActionId: string
): GameState {
  if (state.gameOver || state.interactionPoints <= 0) return state;
  const war = getActiveWarWith(state, compId);
  if (!war) return state;

  const action = TEXTS.warActions.find((a) => a.id === warActionId);
  if (!action) return state;
  if (action.requiresMafia && !state.ceo.inMafia) return state;
  if (war.actionsUsedThisTurn?.includes(warActionId)) return state;

  const cost = scaleByInflation(action.baseCost, state);
  if (state.company.finances.stanKonta < cost) return state;

  const s = structuredClone(state);
  const sWar = getActiveWarWith(s, compId)!;
  const enemy = s.competitors.find((c) => c.id === compId)!;

  s.interactionPoints -= 1;
  s.company.finances.stanKonta -= cost;
  s.company.finances.wydatki.inne += cost;

  // Przesunięcie paska wojny w stronę gracza (+), skalowane lekko różnicą rozmiaru
  const sizeDiff = SIZE_ORDER.indexOf(s.company.size) - SIZE_ORDER.indexOf(enemy.size);
  const sizeMod = clamp(1 + sizeDiff * 0.08, 0.7, 1.35);
  const gain = Math.round(action.warScoreGain * sizeMod);

  sWar.warScore = clamp(sWar.warScore + gain, -100, 100);
  sWar.actionsUsedThisTurn = [...(sWar.actionsUsedThisTurn ?? []), warActionId];

  enemy.condition = clamp(enemy.condition + action.enemyConditionDelta);
  enemy.reputation = clamp(enemy.reputation + action.enemyReputationDelta);

  if (action.reputationEffects) {
    for (const [k, v] of Object.entries(action.reputationEffects)) {
      if (typeof v === 'number') {
        (s.company.reputation as any)[k] = clamp((s.company.reputation as any)[k] + v);
      }
    }
  }

  s.company.reputation = recomputeReputation(s);
  logTurnAction(
    s,
    '⚔️',
    'Wojna',
    `Akcja wojenna przeciwko ${enemy.name}: ${action.label} (${formatMoney(cost, s)}, przewaga +${gain}).`
  );

  // Natychmiastowe zwycięstwo przy dobiciu paska do +100
  if (sWar.warScore >= 100) {
    finalizePlayerWarVictory(s, sWar, enemy);
  }

  return s;
}

export function surrenderWar(state: GameState, compId: string): GameState {
  if (state.gameOver) return state;
  const war = getActiveWarWith(state, compId);
  if (!war) return state;

  const s = structuredClone(state);
  const sWar = getActiveWarWith(s, compId)!;
  const enemy = s.competitors.find((c) => c.id === compId)!;
  const rng = makeRng(`${s.seed}:surrender`, s.turn * 41 + s.activeWars!.length);

  finalizePlayerWarDefeat(s, sWar, enemy, rng);
  logTurnAction(s, '🏳️', 'Wojna', `Skapitulowano w wojnie z firmą ${enemy.name}.`);
  return s;
}

function finalizePlayerWarVictory(state: GameState, war: ActiveWar, loser: Competitor): void {
  loser.atWarWithPlayer = false;
  state.activeWars = (state.activeWars ?? []).filter((w) => w.id !== war.id);

  const reparationsAmount = Math.max(
    scaleByInflation(20_000, state),
    Math.round(loser.value * 0.12)
  );
  const tributePerQuarter = Math.max(
    scaleByInflation(5_000, state),
    Math.round(loser.value * 0.03)
  );

  state.pendingWarResolution = {
    warId: war.id,
    loserId: loser.id,
    loserName: loser.name,
    reparationsAmount,
    tributePerQuarter,
    tributeQuarters: 6,
    canAcquire: loser.condition <= 40 || computePlayerValue(state) >= loser.value,
    finalWarScore: war.warScore,
  };

  state.company.reputation.opiniaBranza = clamp(state.company.reputation.opiniaBranza + 6);
  state.company.reputation = recomputeReputation(state);
}

/**
 * Gracz wybiera warunki po wygranej wojnie (może łączyć kary, np. kontrybucja + danina + uzależnienie,
 * albo przejąć firmę z wyborem jej losu).
 */
export function resolvePlayerWarVictory(
  state: GameState,
  warId: string,
  demands: WarDemandType[],
  acquisitionMode: AcquiredMode = 'subsidiary'
): GameState {
  const pending = state.pendingWarResolution;
  if (!pending || pending.warId !== warId) return state;

  const s = structuredClone(state);
  const loser = s.competitors.find((c) => c.id === pending.loserId);
  s.pendingWarResolution = null;

  if (!loser || loser.status !== 'active') return s;

  const uniqueDemands = Array.from(new Set(demands));
  const summaryParts: string[] = [];

  if (uniqueDemands.includes('acquire') && pending.canAcquire) {
    executeCompetitorAcquisition(s, loser, acquisitionMode, 0);
    summaryParts.push(`przejęcie firmy (${acquisitionMode})`);
  } else {
    if (uniqueDemands.includes('reparations')) {
      const paid = Math.min(pending.reparationsAmount, Math.round(loser.value * 0.4));
      loser.value = Math.max(1000, loser.value - paid);
      s.company.finances.stanKonta += paid;
      s.company.finances.wplywy.splatyZobowiazan += paid;
      summaryParts.push(`kontrybucja ${formatMoney(paid, s)}`);
    }

    if (uniqueDemands.includes('tribute')) {
      if (!Array.isArray(s.tributes)) s.tributes = [];
      s.tributes.push({
        id: `trib_${s.turn}_${loser.id}`,
        payerId: loser.id,
        receiverId: 'player',
        amountPerQuarter: pending.tributePerQuarter,
        quartersLeft: pending.tributeQuarters,
      });
      summaryParts.push(`danina ${formatMoney(pending.tributePerQuarter, s)}/kw.`);
    }

    if (uniqueDemands.includes('subjugate')) {
      loser.dependentOn = 'player';
      loser.subsidiaryIncome = Math.max(
        scaleByInflation(4_000, s),
        Math.round(loser.value * 0.015)
      );
      summaryParts.push('uzależnienie od Twojej firmy');
    }
  }

  const tmpl = TEXTS.pressTemplates.aiWarEnded;
  pushNews(s, {
    id: `war_win_${warId}`,
    turn: s.turn,
    year: s.year,
    quarter: s.quarter,
    headline: fillTemplate(tmpl.headline, {
      winner: formatCompanyName(s.company),
      loser: loser.name,
    }),
    body: fillTemplate(tmpl.body, {
      winner: formatCompanyName(s.company),
      loser: loser.name,
      outcome: summaryParts.join(', ') || 'brak dodatkowych roszczeń',
    }),
    category: 'economy',
  });

  s.company.reputation = recomputeReputation(s);
  return s;
}

function finalizePlayerWarDefeat(
  state: GameState,
  war: ActiveWar,
  winner: Competitor,
  rng: Rng
): void {
  winner.atWarWithPlayer = false;
  state.activeWars = (state.activeWars ?? []).filter((w) => w.id !== war.id);

  const playerCashRef = Math.max(
    scaleByInflation(40_000, state),
    Math.round(Math.max(0, state.company.finances.stanKonta) * 0.25)
  );
  const tributeAmount = Math.max(
    scaleByInflation(8_000, state),
    Math.round(playerCashRef * 0.25)
  );

  // 1. Sprawdzenie 15% szans na próbę przejęcia przez zwycięzcę
  const takeoverRoll = rng.next();
  const effectiveTakeoverChance =
    winner.character === 'aggressive'
      ? TAKEOVER_AFTER_WAR_CHANCE
      : winner.character === 'neutral'
        ? TAKEOVER_AFTER_WAR_CHANCE * 0.75
        : TAKEOVER_AFTER_WAR_CHANCE * 0.35;

  if (takeoverRoll < effectiveTakeoverChance) {
    const existingParent = getPlayerParentInfo(state);
    if (existingParent && existingParent.parent.id === winner.id && existingParent.isControlling) {
      state.gameOver = {
        reason: `Przejęcie firmy — ${winner.name} przejęło pełną kontrolę i odwołało Cię ze stanowiska CEO.`,
      };
      return;
    }

    // Zamiast nagłego Game Over — pełna zależność ("prezes na smyczy")
    grantEquityToCompetitor(state, winner.id, 55, 0);
    pushNews(state, {
      id: `war_defeat_takeover_${war.id}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: `Klęska w wojnie! ${winner.name} przejmuje pakiet kontrolny`,
      body: `Po przegranej wojnie ${winner.name} przejęło większościowy pakiet udziałów w Twojej firmie. Zachowujesz fotel prezesa, ale od teraz działasz pod dyktando centrali.`,
      category: 'economy',
    });
    return;
  }

  // 2. Szansa, że AI zostawi wybór kary pokonanemu graczowi (zależna od charakteru)
  const letPlayerChooseChance =
    winner.character === 'peaceful' ? 0.65 : winner.character === 'neutral' ? 0.35 : 0.1;

  if (rng.next() < letPlayerChooseChance) {
    pushActionNews(state, {
      id: `war_defeat_choice_${war.id}`,
      turn: state.turn,
      year: state.year,
      quarter: state.quarter,
      headline: `Warunki kapitulacji wobec ${winner.name}`,
      body: `Przegrałeś wojnę z firmą ${winner.name}. Zwycięzca pozwala Ci wybrać sposób zadośćuczynienia.`,
      category: 'economy',
      expiresAtTurn: state.turn + 2,
      choices: [
        {
          id: 'pay_now',
          label: `Zapłać jednorazowo ${formatMoney(playerCashRef, state)}`,
          description: 'Bolesny cios w gotówkę, ale zamykasz sprawę od ręki.',
          effects: {
            payReparationsTo: { compId: winner.id, amount: playerCashRef },
          },
        },
        {
          id: 'pay_tribute',
          label: `Płać daninę ${formatMoney(tributeAmount, state)} / kw. przez 6 tur`,
          description: 'Rozkładasz koszt porażki w czasie.',
          effects: {
            addTribute: {
              payerId: 'player',
              receiverId: winner.id,
              amountPerQuarter: tributeAmount,
              quartersLeft: 6,
            },
          },
        },
        {
          id: 'give_equity',
          label: 'Oddaj 30% udziałów w firmie',
          description: `Unikasz płacenia gotówką, ale uzależniasz się od ${winner.name}.`,
          effects: {
            sellEquityTo: { holderId: winner.id, percent: 30, cashReceived: 0 },
          },
        },
      ],
      onExpireEffects: {
        payReparationsTo: { compId: winner.id, amount: playerCashRef },
        addTribute: {
          payerId: 'player',
          receiverId: winner.id,
          amountPerQuarter: tributeAmount,
          quartersLeft: 4,
        },
      },
    });
    return;
  }

  // 3. Zwycięzca sam narzuca karę (agresywny często łączy kilka kar naraz)
  const appliedOutcomes: string[] = [];

  if (winner.character === 'aggressive') {
    state.company.finances.stanKonta -= playerCashRef;
    state.company.finances.wydatki.kary += playerCashRef;
    winner.value += playerCashRef;
    appliedOutcomes.push(`kontrybucja ${formatMoney(playerCashRef, state)}`);

    if (rng.next() < 0.55) {
      grantEquityToCompetitor(state, winner.id, 30, 0);
      appliedOutcomes.push('przejęcie 30% udziałów (uzależnienie)');
    } else {
      if (!Array.isArray(state.tributes)) state.tributes = [];
      state.tributes.push({
        id: `trib_def_${state.turn}_${winner.id}`,
        payerId: 'player',
        receiverId: winner.id,
        amountPerQuarter: tributeAmount,
        quartersLeft: 6,
      });
      appliedOutcomes.push(`danina ${formatMoney(tributeAmount, state)}/kw.`);
    }
  } else if (rng.next() < 0.5) {
    state.company.finances.stanKonta -= playerCashRef;
    state.company.finances.wydatki.kary += playerCashRef;
    winner.value += playerCashRef;
    appliedOutcomes.push(`kontrybucja ${formatMoney(playerCashRef, state)}`);
  } else {
    if (!Array.isArray(state.tributes)) state.tributes = [];
    state.tributes.push({
      id: `trib_def_${state.turn}_${winner.id}`,
      payerId: 'player',
      receiverId: winner.id,
      amountPerQuarter: tributeAmount,
      quartersLeft: 6,
    });
    appliedOutcomes.push(`danina ${formatMoney(tributeAmount, state)}/kw.`);
  }

  const tmpl = TEXTS.pressTemplates.aiWarEnded;
  pushNews(state, {
    id: `war_defeat_${war.id}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: fillTemplate(tmpl.headline, {
      winner: winner.name,
      loser: formatCompanyName(state.company),
    }),
    body: fillTemplate(tmpl.body, {
      winner: winner.name,
      loser: formatCompanyName(state.company),
      outcome: appliedOutcomes.join(' oraz '),
    }),
    category: 'economy',
  });
}

function executeCompetitorAcquisition(
  state: GameState,
  target: Competitor,
  mode: AcquiredMode,
  paidCost: number
): void {
  if (paidCost > 0) {
    state.company.finances.stanKonta -= paidCost;
    state.company.finances.wydatki.zakupy += paidCost;
  }

  target.status = 'acquired';
  target.acquiredBy = 'player';
  target.acquiredMode = mode;
  target.isAlliedWithPlayer = false;
  target.atWarWithPlayer = false;

  // Usuń powiązane wojny i relacje
  state.activeWars = (state.activeWars ?? []).filter(
    (w) => w.attackerId !== target.id && w.defenderId !== target.id
  );
  for (const other of state.competitors) {
    other.allies = other.allies.filter((id) => id !== target.id);
    other.rivals = other.rivals.filter((id) => id !== target.id);
  }

  if (mode === 'branch') {
    state.company.branches += 1;
    state.company.reputation.opiniaBranza = clamp(state.company.reputation.opiniaBranza + 6);
    target.subsidiaryIncome = 0;
  } else if (mode === 'liquidated') {
    const recovered = Math.round(target.value * 0.45);
    state.company.finances.stanKonta += recovered;
    state.company.finances.wplywy.splatyZobowiazan += recovered;
    target.subsidiaryIncome = 0;
  } else {
    // Spółka zależna dająca stały dochód pasywny
    target.dependentOn = 'player';
    target.subsidiaryIncome = Math.max(
      scaleByInflation(6_000, state),
      Math.round(target.value * 0.025)
    );
  }

  // Gdy przejmujesz firmę, która wcześniej miała Twoje udziały — odzyskujesz je
  if (Array.isArray(state.company.externalEquity)) {
    state.company.externalEquity = state.company.externalEquity.filter(
      (e) => e.holderId !== target.id
    );
    syncParentCompanyId(state);
  }

  const tmpl = TEXTS.pressTemplates.companyAcquired;
  pushNews(state, {
    id: `acq_${target.id}_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: fillTemplate(tmpl.headline, {
      winner: formatCompanyName(state.company),
      loser: target.name,
    }),
    body: fillTemplate(tmpl.body, {
      winner: formatCompanyName(state.company),
      loser: target.name,
    }),
    category: 'economy',
  });
}

export function acquireCompetitor(
  state: GameState,
  compId: string,
  postMode: AcquiredMode
): GameState {
  if (state.gameOver) return state;
  const check = getAcquisitionCost(state, compId);
  if (!check.canAcquire) return state;

  const s = structuredClone(state);
  const target = s.competitors.find((c) => c.id === compId && c.status === 'active');
  if (!target) return state;

  executeCompetitorAcquisition(s, target, postMode, check.cost);
  s.company.reputation = recomputeReputation(s);

  logTurnAction(
    s,
    '🏛️',
    'Przejęcie',
    `Przejęto firmę ${target.name} za ${formatMoney(check.cost, s)} (${postMode}).`
  );
  return s;
}

export function buyBackEquity(state: GameState, holderId: string, percent: number): GameState {
  if (state.gameOver || percent <= 0) return state;
  const stakes = state.company.externalEquity ?? [];
  const stake = stakes.find((e) => e.holderId === holderId);
  if (!stake || stake.percent <= 0) return state;

  const actualPercent = Math.min(percent, stake.percent);
  const cost = getEquityBuybackCost(state, holderId, actualPercent);
  if (state.company.finances.stanKonta < cost) return state;

  const s = structuredClone(state);
  const sStake = s.company.externalEquity!.find((e) => e.holderId === holderId)!;
  s.company.finances.stanKonta -= cost;
  s.company.finances.wydatki.inne += cost;
  sStake.percent -= actualPercent;

  const holder = s.competitors.find((c) => c.id === holderId);
  if (holder) holder.value += cost;

  syncParentCompanyId(s);
  logTurnAction(
    s,
    '🔓',
    'Udziały',
    `Odkupiono ${actualPercent}% udziałów od ${holder?.name ?? holderId} za ${formatMoney(cost, s)}.`
  );
  return s;
}

export function requestParentBailout(state: GameState): GameState {
  if (state.gameOver) return state;
  const parentInfo = getPlayerParentInfo(state);
  if (!parentInfo) return state;

  const totalExternal = (state.company.externalEquity ?? []).reduce((sum, e) => sum + e.percent, 0);
  if (totalExternal >= 95) return state;

  const s = structuredClone(state);
  const addedEquity = Math.min(15, 95 - totalExternal);
  const cashGrant = Math.max(
    scaleByInflation(60_000, s),
    Math.round(parentInfo.parent.value * 0.05)
  );

  grantEquityToCompetitor(s, parentInfo.parent.id, addedEquity, cashGrant);
  logTurnAction(
    s,
    '🏦',
    'Zależność',
    `Dokapitalizowanie od spółki-matki ${parentInfo.parent.name}: +${formatMoney(cashGrant, s)} za ${addedEquity}% udziałów.`
  );
  return s;
}

// ============================================================================
// SYMULACJA TURY KONKURENCJI (STATYSTYKI, WOJNY, ZDRADY, DANINY, ZADANIA CENTRALI)
// ============================================================================

function evolveCompetitor(c: Competitor, rng: Rng): void {
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

  const opinionTarget = c.isAlliedWithPlayer
    ? Math.max(c.baseOpinion, 75)
    : c.atWarWithPlayer
      ? Math.min(c.baseOpinion, 15)
      : c.baseOpinion;

  c.opinionOfPlayer = clamp(
    c.opinionOfPlayer +
      (opinionTarget - c.opinionOfPlayer) * TUNING.opinionPull +
      rng.int(-TUNING.opinionNoise, TUNING.opinionNoise),
  );

  const growth =
    ((c.condition - 50) / 50) * TUNING.valueGrowthFromCondition +
    (rng.next() - 0.5) * TUNING.valueNoise;
  c.value = Math.max(1000, Math.round(c.value * (1 + growth)));
  c.size = resolveSize(c.size, c.value);

  c.trend = {
    value: trendRatio(c.value, before.value, TUNING.trendMinRatio),
    reputation: trendDiff(c.reputation, before.reputation, TUNING.trendMinDelta),
    condition: trendDiff(c.condition, before.condition, TUNING.trendMinDelta),
  };
}

function tickTributesAndSubsidiaries(state: GameState): void {
  // 1. Pasywny dochód z przejętych spółek zależnych gracza
  let subsidiaryTotal = 0;
  for (const c of state.competitors) {
    if (c.dependentOn === 'player' && (c.subsidiaryIncome ?? 0) > 0) {
      if (c.status === 'active' || (c.status === 'acquired' && c.acquiredMode === 'subsidiary')) {
        subsidiaryTotal += c.subsidiaryIncome!;
      }
    }
  }
  if (subsidiaryTotal > 0) {
    state.company.finances.stanKonta += subsidiaryTotal;
    state.company.finances.wplywy.dochodPasywny += subsidiaryTotal;
  }

  // 2. Dywidenda dla spółek posiadających udziały gracza (procent od bieżącego przychodu z działalności)
  const stakes = state.company.externalEquity ?? [];
  if (stakes.length > 0 && state.company.finances.wplywy.przychodyZDzialalnosci > 0) {
    const netProfitBase = Math.max(
      0,
      state.company.finances.wplywy.przychodyZDzialalnosci -
        state.company.finances.wydatki.pracownicy -
        state.company.finances.wydatki.czynsz
    );
    if (netProfitBase > 0) {
      for (const stake of stakes) {
        const holder = state.competitors.find(
          (c) => c.id === stake.holderId && c.status === 'active'
        );
        if (!holder) continue;
        const dividend = Math.round(netProfitBase * (stake.percent / 100) * 0.5);
        if (dividend > 0) {
          state.company.finances.stanKonta -= dividend;
          state.company.finances.wydatki.inne += dividend;
          holder.value += dividend;
        }
      }
    }
  }

  // 3. Aktywne daniny kwartalne
  const remainingTributes = [];
  for (const t of state.tributes ?? []) {
    if (t.quartersLeft <= 0) continue;

    if (t.payerId === 'player') {
      const receiver = state.competitors.find((c) => c.id === t.receiverId && c.status === 'active');
      if (!receiver) continue;
      state.company.finances.stanKonta -= t.amountPerQuarter;
      state.company.finances.wydatki.kary += t.amountPerQuarter;
      receiver.value += t.amountPerQuarter;
    } else if (t.receiverId === 'player') {
      const payer = state.competitors.find((c) => c.id === t.payerId && c.status === 'active');
      if (!payer) continue;
      const paid = Math.min(t.amountPerQuarter, Math.max(0, payer.value - 1000));
      payer.value = Math.max(1000, payer.value - paid);
      state.company.finances.stanKonta += paid;
      state.company.finances.wplywy.splatyZobowiazan += paid;
    }

    if (t.quartersLeft - 1 > 0) {
      remainingTributes.push({ ...t, quartersLeft: t.quartersLeft - 1 });
    }
  }
  state.tributes = remainingTributes;
}

function tickActiveWars(state: GameState, rng: Rng): void {
  const wars = [...(state.activeWars ?? [])];

  for (const war of wars) {
    // Wyczyść listę użytych akcji w nowej turze
    war.actionsUsedThisTurn = [];

    const isPlayerInvolved = war.attackerId === 'player' || war.defenderId === 'player';

    if (isPlayerInvolved) {
      const enemyId = war.attackerId === 'player' ? war.defenderId : war.attackerId;
      const enemy = state.competitors.find((c) => c.id === enemyId);

      if (!enemy || enemy.status !== 'active') {
        state.activeWars = (state.activeWars ?? []).filter((w) => w.id !== war.id);
        continue;
      }

      // Siła ruchu AI wroga (zależna od charakteru, rozmiaru i kondycji)
      const charAggro =
        enemy.character === 'aggressive' ? 1.35 : enemy.character === 'neutral' ? 1.0 : 0.7;
      const sizePower = (SIZE_ORDER.indexOf(enemy.size) + 1) * 3;
      const aiPush = Math.round((sizePower + rng.int(3, 10)) * charAggro * (enemy.condition / 60));

      // Wsparcie sojuszników gracza vs sojuszników wroga
      const playerAllies = war.attackerId === 'player' ? war.attackerAllies : war.defenderAllies;
      const enemyAllies = war.attackerId === 'player' ? war.defenderAllies : war.attackerAllies;

      let allyDelta = 0;
      for (const aId of playerAllies) {
        const a = state.competitors.find((c) => c.id === aId && c.status === 'active');
        if (a) allyDelta += 4 + SIZE_ORDER.indexOf(a.size);
      }
      for (const eId of enemyAllies) {
        const e = state.competitors.find((c) => c.id === eId && c.status === 'active');
        if (e) allyDelta -= 4 + SIZE_ORDER.indexOf(e.size);
      }

      war.warScore = clamp(war.warScore - aiPush + allyDelta, -100, 100);

      // Odwet AI w reputację gracza (agresywny uderza częściej)
      const hitChance =
        enemy.character === 'aggressive' ? 0.45 : enemy.character === 'neutral' ? 0.25 : 0.1;
      if (rng.next() < hitChance) {
        state.company.reputation.opiniaBranza = clamp(state.company.reputation.opiniaBranza - 3);
        state.company.reputation.opiniaMedia = clamp(state.company.reputation.opiniaMedia - 2);
      }

      const elapsed = state.turn - war.startedTurn;
      if (war.warScore >= 100 || (elapsed >= war.maxTurns && war.warScore >= 0)) {
        finalizePlayerWarVictory(state, war, enemy);
      } else if (war.warScore <= -100 || (elapsed >= war.maxTurns && war.warScore < 0)) {
        finalizePlayerWarDefeat(state, war, enemy, rng);
      }
    } else {
      // Wojna AI vs AI w tle
      const att = state.competitors.find((c) => c.id === war.attackerId && c.status === 'active');
      const def = state.competitors.find((c) => c.id === war.defenderId && c.status === 'active');

      if (!att || !def) {
        state.activeWars = (state.activeWars ?? []).filter((w) => w.id !== war.id);
        continue;
      }

      const attPower =
        (SIZE_ORDER.indexOf(att.size) + 1) * 5 +
        att.condition * 0.25 +
        war.attackerAllies.length * 6 +
        (att.character === 'aggressive' ? 6 : 0);
      const defPower =
        (SIZE_ORDER.indexOf(def.size) + 1) * 5 +
        def.condition * 0.25 +
        war.defenderAllies.length * 6 +
        (def.character === 'aggressive' ? 6 : 0);

      const swing = Math.round((attPower - defPower) * 0.8 + rng.int(-15, 15));
      war.warScore = clamp(war.warScore + swing, -100, 100);
      att.condition = clamp(att.condition - 2);
      def.condition = clamp(def.condition - 2);

      const elapsed = state.turn - war.startedTurn;
      if (Math.abs(war.warScore) >= 100 || elapsed >= war.maxTurns) {
        const winner = war.warScore >= 0 ? att : def;
        const loser = war.warScore >= 0 ? def : att;
        state.activeWars = (state.activeWars ?? []).filter((w) => w.id !== war.id);

        let outcomeText = 'kontrybucja finansowa';
        if (rng.next() < TAKEOVER_AFTER_WAR_CHANCE) {
          loser.status = 'acquired';
          loser.acquiredBy = winner.id;
          winner.value += Math.round(loser.value * 0.6);
          outcomeText = 'przejęcie firmy';

          const acqTmpl = TEXTS.pressTemplates.companyAcquired;
          pushNews(state, {
            id: `ai_acq_${war.id}`,
            turn: state.turn,
            year: state.year,
            quarter: state.quarter,
            headline: fillTemplate(acqTmpl.headline, { winner: winner.name, loser: loser.name }),
            body: fillTemplate(acqTmpl.body, { winner: winner.name, loser: loser.name }),
            category: 'economy',
          });
        } else {
          const transfer = Math.round(loser.value * 0.15);
          loser.value = Math.max(1000, loser.value - transfer);
          loser.condition = clamp(loser.condition - 12);
          winner.value += transfer;
          if (winner.character === 'aggressive' && rng.next() < 0.4) {
            loser.dependentOn = winner.id;
            outcomeText = 'kontrybucja i uzależnienie';
          }

          const endTmpl = TEXTS.pressTemplates.aiWarEnded;
          pushNews(state, {
            id: `ai_war_end_${war.id}`,
            turn: state.turn,
            year: state.year,
            quarter: state.quarter,
            headline: fillTemplate(endTmpl.headline, { winner: winner.name, loser: loser.name }),
            body: fillTemplate(endTmpl.body, {
              winner: winner.name,
              loser: loser.name,
              outcome: outcomeText,
            }),
            category: 'economy',
          });
        }
      }
    }
  }
}

function tickAiDiplomacyAndBetrayals(state: GameState, rng: Rng): void {
  const active = state.competitors.filter((c) => c.status === 'active');
  if (active.length < 2) return;

  // Limit równoczesnych wojen AI-AI, żeby nie zalać prasy
  const aiWarCount = (state.activeWars ?? []).filter(
    (w) => w.attackerId !== 'player' && w.defenderId !== 'player'
  ).length;

  // 1. Nagła zdrada (zgoda/sojusz z graczem -> wojna) zależna od charakteru
  for (const c of active) {
    if (!c.isAlliedWithPlayer || c.atWarWithPlayer) continue;
    const betrayalChance =
      c.character === 'aggressive'
        ? 0.06
        : c.character === 'neutral'
          ? c.opinionOfPlayer < 55
            ? 0.03
            : 0.008
          : 0.002;

    if (rng.next() < betrayalChance) {
      openWarInState(state, c.id, 'player', true);
      break;
    }
  }

  // 2. Wojna AI vs AI lub nagły rozłam zgody między firmami AI
  if (aiWarCount < 2 && rng.next() < 0.22) {
    const initiator = active[rng.int(0, active.length - 1)];
    const warDesire =
      initiator.character === 'aggressive' ? 0.75 : initiator.character === 'neutral' ? 0.35 : 0.08;

    if (rng.next() < warDesire) {
      // Najpierw sprawdź kosy, a z mniejszą szansą nagłą zdradę zgody
      const activeRivals = initiator.rivals
        .map((id) => active.find((x) => x.id === id))
        .filter((x): x is Competitor => Boolean(x));
      const activeAllies = initiator.allies
        .map((id) => active.find((x) => x.id === id))
        .filter((x): x is Competitor => Boolean(x));

      if (activeAllies.length > 0 && rng.next() < (initiator.character === 'aggressive' ? 0.25 : 0.1)) {
        const victim = activeAllies[rng.int(0, activeAllies.length - 1)];
        openWarInState(state, initiator.id, victim.id, true);
      } else if (activeRivals.length > 0) {
        const victim = activeRivals[rng.int(0, activeRivals.length - 1)];
        openWarInState(state, initiator.id, victim.id, false);
      }
    }
  }

  // 3. Agresywna firma ze słabą opinią o graczu może sama wypowiedzieć wojnę graczowi
  const playerWarCount = (state.activeWars ?? []).filter(
    (w) => w.attackerId === 'player' || w.defenderId === 'player'
  ).length;
  if (playerWarCount < 2 && state.turn >= 4) {
    const hostile = active.filter(
      (c) =>
        !c.atWarWithPlayer &&
        !c.isAlliedWithPlayer &&
        c.id !== state.company.parentCompanyId &&
        c.opinionOfPlayer < 30
    );
    if (hostile.length > 0) {
      const candidate = hostile[rng.int(0, hostile.length - 1)];
      const chance =
        candidate.character === 'aggressive' ? 0.22 : candidate.character === 'neutral' ? 0.08 : 0.01;
      if (rng.next() < chance) {
        openWarInState(state, candidate.id, 'player', false);
        pushNews(state, {
          id: `ai_declares_player_${candidate.id}_${state.turn}`,
          turn: state.turn,
          year: state.year,
          quarter: state.quarter,
          headline: `${candidate.name} wypowiada Ci wojnę biznesową!`,
          body: `Narastający konflikt z firmą ${candidate.name} przerodził się w otwartą wojnę.`,
          category: 'economy',
        });
      }
    }
  }
}

function tickParentCompanyTasks(state: GameState, rng: Rng): void {
  const parentInfo = getPlayerParentInfo(state);
  if (!parentInfo) return;

  const hasPendingTask = state.news.some(
    (n) => n.id.startsWith('subsidiary_task_') && !n.resolved
  );
  if (hasPendingTask) return;

  // Częstsze zadania przy pakiecie kontrolnym >50%
  const chance = parentInfo.isControlling ? 0.42 : 0.22;
  if (rng.next() > chance) return;

  const tasks = TEXTS.subsidiaryTasks;
  if (!tasks || tasks.length === 0) return;

  const task = tasks[rng.int(0, tasks.length - 1)];
  const parentName = parentInfo.parent.name;

  pushActionNews(state, {
    id: `subsidiary_task_${task.id}_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: fillTemplate(task.headline, { parent: parentName }),
    body: fillTemplate(task.body, { parent: parentName }),
    category: 'custom',
    expiresAtTurn: state.turn + 2,
    choices: [
      {
        id: 'accept_task',
        label: task.acceptLabel,
        description: task.acceptDescription,
        effects: {
          ...task.acceptEffects,
          parentDispleasureDelta: task.displeasureOnAccept,
        },
      },
      {
        id: 'refuse_task',
        label: task.refuseLabel,
        description: task.refuseDescription,
        effects: {
          parentDispleasureDelta: task.displeasureOnRefuse,
        },
      },
    ],
    onExpireEffects: {
      parentDispleasureDelta: task.displeasureOnRefuse,
    },
  });
}

const TAKEOVER_OFFER_COOLDOWN = 5;

function tickTakeoverOfferToPlayer(state: GameState, rng: Rng): void {
  if (state.turn < 3) return;

  // Bezpiecznik 1: brak ofert przejęcia, gdy gracz już toczy wojnę
  const playerAtWar = (state.activeWars ?? []).some(
    (w) => w.attackerId === 'player' || w.defenderId === 'player'
  );
  if (playerAtWar) return;

  // Bezpiecznik 2: brak nierozwiązanej oferty i min. 5 tur przerwy od poprzedniej
  const lastOffer = state.news.find((n) => n.id.startsWith('takeover_offer_'));
  if (
    lastOffer &&
    (!lastOffer.resolved || state.turn - lastOffer.turn < TAKEOVER_OFFER_COOLDOWN)
  ) {
    return;
  }

  const totalExternal = (state.company.externalEquity ?? []).reduce((s, e) => s + e.percent, 0);
  if (totalExternal >= 75) return;

  const cond = clamp(state.profitabilityScore ?? 50, 0, 100);
  const negativeCash = state.company.finances.stanKonta < 0;
  if (!negativeCash && cond >= 45) return;

  // Im gorsza kondycja, tym częściej rywale wyczuwają okazję (12% .. 60%)
  const rawSeverity = clamp((45 - cond) / 45, 0, 1);
  const severity = negativeCash ? Math.max(rawSeverity, 0.55) : rawSeverity;
  const offerChance = 0.12 + severity * 0.48;
  if (rng.next() > offerChance) return;

  const playerVal = computePlayerValue(state);
  const minSuitorValue = Math.max(scaleByInflation(200_000, state), playerVal * 1.8);

  const candidates = (state.competitors ?? []).filter((c) => {
    if (c.status !== 'active' || c.atWarWithPlayer) return false;
    if (c.value < minSuitorValue) return false;
    if (negativeCash) return true;
    if (c.character === 'aggressive') return cond < 45;
    if (c.character === 'neutral') return cond < 32;
    return cond < 22;
  });

  if (candidates.length === 0) return;

  // Wyrównane wagi (agresywny 4 : neutralny 3 : pokojowy 2, +1 za tę samą branżę)
  const weightedPool = candidates.map((c) => ({
    comp: c,
    weight:
      (c.character === 'aggressive' ? 4 : c.character === 'neutral' ? 3 : 2) +
      (isInPlayerBranch(state, c) ? 1 : 0),
  }));
  const suitor = rng.weighted(weightedPool).comp;

  // Wycena spada wraz z kondycją (0.55x przy 0% .. 1.0x przy 45%) i zależy od charakteru
  const condFactor = 0.55 + (clamp(cond, 0, 45) / 45) * 0.45;
  const charMult = suitor.isAlliedWithPlayer
    ? 1.2
    : suitor.character === 'aggressive'
      ? 0.8
      : suitor.character === 'peaceful'
        ? 1.15
        : 1.0;

  const remainingRoom = 100 - totalExternal;
  const smallPct = Math.min(25, remainingRoom);
  const bigPct = Math.min(51, remainingRoom);

  const bailoutSmall = Math.max(
    scaleByInflation(15_000, state),
    Math.round(scaleByInflation(65_000, state) * (smallPct / 25) * condFactor * charMult)
  );
  const bailoutBig = Math.max(
    scaleByInflation(35_000, state),
    Math.round(scaleByInflation(140_000, state) * (bigPct / 51) * condFactor * charMult)
  );

  // Skutek odmowy zależny od charakteru firmy
  const isParent = state.company.parentCompanyId === suitor.id;
  let declineDescription = 'Zachowujesz niezależność.';
  let declineEffects: EventEffects = {};
  let expireEffects: EventEffects = {};

  if (isParent) {
    declineDescription = 'Spółka-matka zapamięta odmowę (+15 irytacji centrali).';
    declineEffects = { parentDispleasureDelta: 15 };
    expireEffects = { parentDispleasureDelta: 20 };
  } else if (suitor.character === 'aggressive') {
    const warChance = negativeCash || cond < 25 ? 0.9 : 0.75;
    const triggersWar = !suitor.isAlliedWithPlayer && rng.next() < warChance;
    if (triggersWar) {
      declineDescription =
        'Agresywny rywal nie przyjmie odmowy — odrzucenie oferty wywoła wojnę biznesową i pogorszy opinię w branży.';
      declineEffects = {
        startWarWith: suitor.id,
        reputation: { opiniaBranza: -4 },
      };
      expireEffects = {
        startWarWith: suitor.id,
        reputation: { opiniaBranza: -6 },
      };
    } else {
      declineDescription =
        'Agresywny kontrahent odbije to sobie czarnym PR-em w branży i mediach (-7 branża, -4 media).';
      declineEffects = {
        reputation: { opiniaBranza: -7, opiniaMedia: -4 },
      };
      expireEffects = {
        reputation: { opiniaBranza: -8, opiniaMedia: -5 },
      };
    }
  } else if (suitor.character === 'neutral') {
    declineDescription =
      'Zarząd przyjmie odmowę chłodno — na rynku rozejdą się plotki o Twoich problemach (-4 opinia w branży).';
    declineEffects = { reputation: { opiniaBranza: -4 } };
    expireEffects = { reputation: { opiniaBranza: -6 } };
  } else {
    declineDescription = 'Spokojny kontrahent uszanuje Twoją decyzję bez żadnych konsekwencji.';
    declineEffects = {};
    expireEffects = { reputation: { opiniaBranza: -2 } };
  }

  const choices: NewsChoice[] = [
    {
      id: 'sell_small',
      label: `Sprzedaj ${smallPct}% udziałów za ${formatMoney(bailoutSmall, state)}`,
      description: 'Zastrzyk gotówki na ratowanie płynności, ale firma zyskuje wpływ na Twoje decyzje.',
      effects: {
        sellEquityTo: { holderId: suitor.id, percent: smallPct, cashReceived: bailoutSmall },
      },
    },
  ];

  if (bigPct > smallPct) {
    choices.push({
      id: 'sell_big',
      label: `Sprzedaj ${bigPct}% udziałów za ${formatMoney(bailoutBig, state)}`,
      description:
        bigPct > 50 || totalExternal + bigPct > 50
          ? 'Większa gotówka, ale tracisz niezależność i zostajesz prezesem spółki zależnej.'
          : 'Większy zastrzyk gotówki w zamian za znaczny pakiet udziałów.',
      effects: {
        sellEquityTo: { holderId: suitor.id, percent: bigPct, cashReceived: bailoutBig },
      },
    });
  }

  choices.push({
    id: 'decline',
    label: 'Odrzucam ofertę',
    description: declineDescription,
    effects: declineEffects,
  });

  const charLabel =
    suitor.character === 'aggressive'
      ? 'agresywny'
      : suitor.character === 'peaceful'
        ? 'pokojowy'
        : 'neutralny';

  pushActionNews(state, {
    id: `takeover_offer_${suitor.id}_${state.turn}`,
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    headline: `Oferta kapitałowa od ${suitor.name}`,
    body: `Twoja firma ma słabą kondycję (${Math.round(cond)}%). Zarząd ${suitor.name} (charakter: ${charLabel}) proponuje gotówkę w zamian za udziały.`,
    category: 'economy',
    expiresAtTurn: state.turn + 2,
    choices,
    onExpireEffects: expireEffects,
  });

}

function tickBankruptciesAndEntrants(state: GameState, rng: Rng): void {
  // 1. Bankructwa bardzo słabych firm AI
  for (const c of state.competitors) {
    if (c.status !== 'active') continue;
    if (c.condition <= 8 && rng.next() < 0.28) {
      c.status = 'bankrupt';
      c.isAlliedWithPlayer = false;
      c.atWarWithPlayer = false;

      // Jeśli zbankrutowała spółka-matka gracza — udziały wracają do gracza!
      if (Array.isArray(state.company.externalEquity)) {
        state.company.externalEquity = state.company.externalEquity.filter(
          (e) => e.holderId !== c.id
        );
        syncParentCompanyId(state);
      }

      state.activeWars = (state.activeWars ?? []).filter(
        (w) => w.attackerId !== c.id && w.defenderId !== c.id
      );

      const tmpl = TEXTS.pressTemplates.companyBankrupt;
      pushNews(state, {
        id: `bankrupt_${c.id}_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: fillTemplate(tmpl.headline, { company: c.name }),
        body: fillTemplate(tmpl.body, { company: c.name }),
        category: 'economy',
      });
    }
  }

  // 2. Wejście nowych firm zaplanowanych na ten rok (startYear > 1989)
  const existingIds = new Set(state.competitors.map((c) => c.id));
  const timedEntrants = TEMPLATES.filter(
    (t) =>
      !existingIds.has(t.id) &&
      (t.startYear ?? 1989) > 1989 &&
      (t.startYear ?? 1989) <= state.year
  );

  for (const tpl of timedEntrants) {
    if (rng.next() < 0.45) {
      const newcomer = createCompetitor(tpl, rollSizeForYear(state.year, rng), rng);
      attachInitialRelationsForNewcomer(state, newcomer, rng);
      state.competitors.push(newcomer);
      existingIds.add(newcomer.id);

      const tmpl = TEXTS.pressTemplates.newEntrant;
      pushNews(state, {
        id: `timed_entrant_${newcomer.id}_${state.turn}`,
        turn: state.turn,
        year: state.year,
        quarter: state.quarter,
        headline: fillTemplate(tmpl.headline, { company: newcomer.name }),
        body: fillTemplate(tmpl.body, { company: newcomer.name }),
        category: 'economy',
      });
    }
  }

  // 3. Uzupełnienie ligi z rezerwy, jeśli aktywnych firm jest mniej niż 20
  const activeCount = state.competitors.filter((c) => c.status === 'active').length;
  if (activeCount < LEAGUE_TARGET_SIZE) {
    const reserve = shuffle(
      TEMPLATES.filter(
        (t) => !existingIds.has(t.id) && (t.startYear ?? 1989) <= state.year
      ),
      rng
    );
    if (reserve.length > 0 && rng.next() < 0.5) {
      const newcomer = createCompetitor(reserve[0], rollSizeForYear(state.year, rng), rng);
      attachInitialRelationsForNewcomer(state, newcomer, rng);
      state.competitors.push(newcomer);
      existingIds.add(newcomer.id);
    }
  }

  // 4. Gwarancja min. 3 aktywnych firm z branży gracza
  ensureBranchCompetitors(state, true);
}

export function tickCompetitors(s: GameState, step = 0): GameState {
  if (!Array.isArray(s.competitors) || s.competitors.length === 0) {
    const category = getCategoryKey(getCompanyActivities(s.company));
    s.competitors = generateCompetitors(category, s.year, s.seed);
    s.competitionCategory = category;
    return s;
  }

  const rng = makeRng(`${s.seed}:competition`, s.turn * 10 + step);

  for (const c of s.competitors) {
    if (c.status === 'active') evolveCompetitor(c, rng);
  }

  tickTributesAndSubsidiaries(s);
  tickActiveWars(s, rng);
  if (s.gameOver) return s;

  tickAiDiplomacyAndBetrayals(s, rng);
  tickParentCompanyTasks(s, rng);
  tickTakeoverOfferToPlayer(s, rng);
  tickBankruptciesAndEntrants(s, rng);

  return s;
}

// ============================================================================
// RANKING
// ============================================================================

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
  opinionOfPlayer: number | null;
  trend: CompetitorTrend;
  categories?: string[];
  character?: CompetitorCharacter;
  isAlliedWithPlayer?: boolean;
  atWarWithPlayer?: boolean;
  inPlayerBranch?: boolean;
  isPlayerParent?: boolean;
  isSubordinateToPlayer?: boolean;
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
      name: formatCompanyName(s.company),
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
      categories: getPlayerCategories(s),
      inPlayerBranch: true,
    },
  ];

  for (const c of s.competitors ?? []) {
    if ((c.status ?? 'active') !== 'active') continue;
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
      categories: c.categories,
      character: c.character,
      isAlliedWithPlayer: c.isAlliedWithPlayer,
      atWarWithPlayer: c.atWarWithPlayer,
      inPlayerBranch: isInPlayerBranch(s, c),
      isPlayerParent: s.company.parentCompanyId === c.id,
      isSubordinateToPlayer: c.dependentOn === 'player',
    });
  }

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pl'));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

export function snapshotPlayer(s: GameState): PlayerSnapshot {
  const me = computeRanking(s).find((r) => r.isPlayer)!;
  return { value: me.value, reputation: me.reputation, condition: me.condition, rank: me.rank };
}