import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import {
  generateCompetitors,
  tickCompetitors,
  computeRanking,
  interactWithCompetitor,
  ensureCompetitors,
  getCategoryId,
  SIZE_ORDER,
  SIZE_VALUE_FLOOR,
  INTERACTIONS_PER_TURN,
} from '../competition';
import type { GameState } from '../types';
import competitionData from '../../data/competition.json';
import branchesData from '../../data/branches.json';

const SIZES = new Set<string>(SIZE_ORDER);

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

  it('ma unikalne id i wymagane pola', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of templates) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
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

  it('zwraca unikalne firmy', () => {
    const list = generateCompetitors('produkcja', 1989, 'xyz');
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
  });

  it('rozmiary: jedna duża, dwie średnie, reszta małe (gdy jest dość firm)', () => {
    const list = generateCompetitors('handel', 1989, 'mix');
    if (list.length < 3) return;
    const count = (size: string) => list.filter((c) => c.size === size).length;
    expect(count('large')).toBe(1);
    expect(count('medium')).toBe(Math.min(2, list.length - 1));
    expect(count('small')).toBe(Math.max(0, list.length - 3));
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
    }
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

  it('regeneruje konkurencję po zmianie kategorii działalności', () => {
    const s = newState('switch');
    s.company.activity = 'gast_kebab';
    advance(s, 1);
    expect(s.competitionCategory).toBe('gastronomia');
  });
});

describe('computeRanking', () => {
  it('sortuje malejąco, numeruje od 1 i zawiera gracza dokładnie raz', () => {
    const s = newState('rank');
    advance(s, 20);
    const rows = computeRanking(s);
    expect(rows.filter((r) => r.isPlayer)).toHaveLength(1);
    expect(rows).toHaveLength(s.competitors.length + 1);
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

describe('ensureCompetitors (migracja zapisu)', () => {
  it('uzupełnia brakujące pola w starym zapisie', () => {
    const s = newState('migrate') as any;
    delete s.competitors;
    delete s.competitionCategory;
    const migrated = ensureCompetitors(s);
    expect(Array.isArray(migrated.competitors)).toBe(true);
    expect(migrated.competitionCategory).toBe(getCategoryId('handel_odziez'));
  });

  it('nie rusza stanu, który już ma konkurentów', () => {
    const s = newState('nochange');
    expect(ensureCompetitors(s)).toBe(s);
  });
});