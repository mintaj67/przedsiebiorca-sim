import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import { recomputeReputation } from '../reputation';
import {
  generateCompetitors,
  ensureBranchCompetitors,
  tickCompetitors,
  computeRanking,
  interactWithCompetitor,
  proposeAlliance,
  breakAlliance,
  declareWar,
  performWarAction,
  getWarActions,
  getAllianceTradeDiscount,
  isInPlayerBranch,
  SIZE_ORDER,
  SIZE_VALUE_FLOOR,
  COMPETITOR_SIZE_MIX,
  INTERACTIONS_PER_TURN,
  LEAGUE_TARGET_SIZE,
  MIN_SAME_BRANCH_COMPETITORS,
  MAX_PLAYER_ALLIANCES,
} from '../competition';
import type { GameState } from '../types';
import competitionData from '../../data/competition.json';
import branchesData from '../../data/branches.json';

const SIZES = new Set<string>(SIZE_ORDER);
const VALID_CHARACTERS = new Set(['aggressive', 'neutral', 'peaceful']);

function newState(seed = 'test-seed', activity = 'handel_odziez'): GameState {
  return createInitialState({
    seed,
    difficulty: 'medium',
    inPZPR: false,
    activity,
    companyName: 'Testex',
    suffix: '',
    size: 'micro',
  });
}

/** Symuluje upływ czasu: turn++, kwartały, lata — bez reszty silnika. */
function advance(s: GameState, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    s.turn += 1;
    const total = s.year * 4 + (s.quarter - 1) + 1;
    s.year = Math.floor(total / 4);
    s.quarter = ((total % 4) + 1) as 1 | 2 | 3 | 4;
    tickCompetitors(s, 0);
  }
}

describe('data/competition.json', () => {
  const categoryIds = new Set((branchesData as { id: string }[]).map((c) => c.id));
  const templates = competitionData as any[];

  it('ma unikalne id, wymagane pola, 3 motta i poprawny charakter', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of templates) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(Array.isArray(t.mottos)).toBe(true);
      expect(t.mottos.length).toBeGreaterThanOrEqual(3);
      expect(VALID_CHARACTERS.has(t.character)).toBe(true);
    }
  });

  it('kategorie, jeśli podane, istnieją w branches.json', () => {
    for (const t of templates) {
      if (t.categories) {
        for (const c of t.categories) {
          expect(c === '*' || categoryIds.has(c)).toBe(true);
        }
      }
    }
  });
});

describe('generateCompetitors', () => {
  it('jest deterministyczne dla tego samego seeda', () => {
    expect(generateCompetitors('handel', 1989, 'abc')).toEqual(
      generateCompetitors('handel', 1989, 'abc')
    );
  });

  it('różne seedy dają różne statystyki', () => {
    const a = JSON.stringify(generateCompetitors('handel', 1989, 'seed-a'));
    const b = JSON.stringify(generateCompetitors('handel', 1989, 'seed-b'));
    expect(a).not.toBe(b);
  });

  it('generuje ligę 20 unikalnych firm z min. 3 z branży gracza', () => {
    const list = generateCompetitors('produkcja', 1989, 'xyz');
    expect(list).toHaveLength(LEAGUE_TARGET_SIZE);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);

    const sameBranch = list.filter(
      (c) => c.categories.includes('*') || c.categories.includes('produkcja')
    );
    expect(sameBranch.length).toBeGreaterThanOrEqual(MIN_SAME_BRANCH_COMPETITORS);
  });

  it('rozmiary zgadzają się z COMPETITOR_SIZE_MIX dla ligi 20 firm', () => {
    const list = generateCompetitors('handel', 1989, 'mix');
    const expectedCount = (size: string) =>
      COMPETITOR_SIZE_MIX.filter((s) => s === size).length;
    const actualCount = (size: string) =>
      list.filter((c) => c.size === size).length;

    for (const size of SIZE_ORDER) {
      expect(actualCount(size)).toBe(expectedCount(size));
    }
  });

  it('wartość mieści się w przedziale rozmiaru, a statystyki w 0-100', () => {
    for (const c of generateCompetitors('handel', 1989, 'ranges')) {
      const idx = SIZE_ORDER.indexOf(c.size);
      expect(c.value).toBeGreaterThanOrEqual(SIZE_VALUE_FLOOR[c.size] || 1000);
      if (SIZE_ORDER[idx + 1]) {
        expect(c.value).toBeLessThanOrEqual(SIZE_VALUE_FLOOR[SIZE_ORDER[idx + 1]]);
      }
      for (const v of [c.reputation, c.condition, c.opinionOfPlayer]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(typeof c.motto).toBe('string');
      expect(c.motto.length).toBeGreaterThan(0);
      expect(VALID_CHARACTERS.has(c.character)).toBe(true);
    }
  });
});

describe('ensureBranchCompetitors', () => {
  it('nie zmienia ligi, gdy są co najmniej 3 firmy z branży gracza', () => {
    const s = newState('already-migrated');
    const ids = s.competitors.map((c) => c.id);

    ensureBranchCompetitors(s);

    expect(s.competitors.map((c) => c.id)).toEqual(ids);
  });

  it('uzupełnia brakujące firmy z aktywnej branży gracza', () => {
    const s = newState('branch-refill');
    s.competitors = s.competitors.slice(0, 4);

    ensureBranchCompetitors(s);

    const activeInBranch = s.competitors.filter(
      (c) => c.status === 'active' && isInPlayerBranch(s, c)
    );
    expect(activeInBranch.length).toBeGreaterThanOrEqual(MIN_SAME_BRANCH_COMPETITORS);
  });
});

describe('tickCompetitors', () => {
  it('jest deterministyczne dla tego samego seeda', () => {
    const a = newState('same');
    const b = newState('same');
    advance(a, 40);
    advance(b, 40);
    expect(a.competitors).toEqual(b.competitors);
  });

  it('utrzymuje statystyki w granicach przez 160 tur', () => {
    const s = newState('bounds');
    advance(s, 160);
    for (const c of s.competitors) {
      for (const v of [c.reputation, c.condition, c.opinionOfPlayer]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(c.value).toBeGreaterThanOrEqual(1000);
      expect(SIZES.has(c.size)).toBe(true);
    }
  });

  it('nie resetuje ligi po zmianie branży i gwarantuje min. 3 aktywne firmy z nowej branży', () => {
    const s = newState('switch');
    const initialIds = new Set(s.competitors.map((c) => c.id));

    s.company.activity = 'gast_kebab';
    s.company.activities = ['gast_kebab'];
    advance(s, 1);

    expect(s.competitionCategory).toBe('uslugi');
    // Dotychczasowe firmy zostają w świecie gry
    for (const id of initialIds) {
      expect(s.competitors.some((c) => c.id === id)).toBe(true);
    }
    const activeInNewBranch = s.competitors.filter(
      (c) => c.status === 'active' && isInPlayerBranch(s, c)
    );
    expect(activeInNewBranch.length).toBeGreaterThanOrEqual(MIN_SAME_BRANCH_COMPETITORS);
  });
});

describe('computeRanking', () => {
  it('sortuje malejąco, numeruje od 1 i zawiera gracza oraz aktywne firmy', () => {
    const s = newState('rank');
    advance(s, 20);
    const rows = computeRanking(s);
    const activeCount = s.competitors.filter((c) => c.status === 'active').length;

    expect(rows.filter((r) => r.isPlayer)).toHaveLength(1);
    expect(rows).toHaveLength(activeCount + 1);
    rows.forEach((r, i) => expect(r.rank).toBe(i + 1));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    }
  });
});

describe('interactWithCompetitor', () => {
  it('zużywa punkt interakcji i nie mutuje starego stanu', () => {
    const s = newState('interact');
    const id = s.competitors[0].id;
    const next = interactWithCompetitor(s, id, 'positive');
    expect(next.interactionPoints).toBe(s.interactionPoints - 1);
    expect(next).not.toBe(s);
    expect(s.interactionPoints).toBe(INTERACTIONS_PER_TURN);
  });

  it('bez punktów albo dla nieznanego id zwraca ten sam obiekt', () => {
    const s = newState('nopoints');
    s.interactionPoints = 0;
    expect(interactWithCompetitor(s, s.competitors[0].id, 'positive')).toBe(s);
    const s2 = newState('unknown');
    expect(interactWithCompetitor(s2, 'nie_ma_takiego', 'negative')).toBe(s2);
  });
});

describe('sojusze, cynk rynkowy i wojny', () => {
  it('respektuje twardy limit sojuszy, daje rabat i skaluje dokładność reputacją sojusznika', () => {
    let s = newState('alliances');
    for (let i = 0; i < MAX_PLAYER_ALLIANCES + 1; i++) {
      s.competitors[i].opinionOfPlayer = 80;
    }

    for (let i = 0; i < MAX_PLAYER_ALLIANCES; i++) {
      s = proposeAlliance(s, s.competitors[i].id);
    }
    expect(s.competitors.filter((c) => c.isAlliedWithPlayer)).toHaveLength(MAX_PLAYER_ALLIANCES);
    expect(getAllianceTradeDiscount(s)).toBeGreaterThan(0);

    // Próba przekroczenia limitu nie dodaje kolejnego sojusznika
    const overLimit = proposeAlliance(s, s.competitors[MAX_PLAYER_ALLIANCES].id);
    expect(overLimit).toBe(s);

    // Zerwanie sojuszu zwalnia slot
    const afterBreak = breakAlliance(s, s.competitors[0].id);
    expect(afterBreak.competitors.filter((c) => c.isAlliedWithPlayer)).toHaveLength(
      MAX_PLAYER_ALLIANCES - 1
    );

    // Cynk rynkowy: wyższa reputacja sojusznika => wyższa dokładność przewidywań
    const lowRepState = newState('intel-test');
    lowRepState.competitors[0].isAlliedWithPlayer = true;
    lowRepState.competitors[0].reputation = 10;
    const highRepState = structuredClone(lowRepState);
    highRepState.competitors[0].reputation = 95;

    const lowAcc = recomputeReputation(lowRepState).dokladnoscPrzewidywan;
    const highAcc = recomputeReputation(highRepState).dokladnoscPrzewidywan;
    expect(highAcc).toBeGreaterThan(lowAcc);
  });

  it('pozwala wypowiedzieć wojnę i przesunąć pasek stanu wojny płatną akcją', () => {
    let s = newState('war-test');
    s.company.finances.stanKonta = 1_000_000;
    const targetId = s.competitors[0].id;

    s = declareWar(s, targetId);
    expect(s.competitors[0].atWarWithPlayer).toBe(true);
    expect(s.activeWars?.length).toBe(1);
    expect(s.activeWars?.[0].warScore).toBe(0);

    const action = getWarActions().find((a) => !a.requiresMafia)!;
    const beforeCash = s.company.finances.stanKonta;
    const afterAction = performWarAction(s, targetId, action.id);

    expect(afterAction.company.finances.stanKonta).toBeLessThan(beforeCash);
    expect(afterAction.activeWars?.[0].warScore).toBeGreaterThan(0);
  });
});