import type { ActivityCategory, ActivityItem, Company, CompanySize } from './types';
import { COMPANY_SIZE_CONFIG } from './constants';
import branchesData from '../data/branches.json';

const categories = branchesData as ActivityCategory[];
const allActivities: ActivityItem[] = categories.flatMap(c => c.activities);

export function getActivityData(id: string): ActivityItem | undefined {
  return allActivities.find(a => a.id === id);
}

export function getActivityName(id: string): string {
  return getActivityData(id)?.name ?? id;
}

/** Zwraca tablicę wszystkich wybranych podkategorii firmy (z fallbackiem na pojedyncze `activity`). */
export function getCompanyActivities(company: Pick<Company, 'activity' | 'activities'>): string[] {
  if (Array.isArray(company.activities) && company.activities.length > 0) {
    return company.activities;
  }
  return company.activity ? [company.activity] : [];
}

/** Zwraca unikalne ID głównych kategorii (np. ['handel', 'produkcja']) dla podanych podkategorii. */
export function getCategoryIdsForActivities(activityIds: string[]): string[] {
  const result = new Set<string>();
  for (const actId of activityIds) {
    for (const cat of categories) {
      if (cat.activities.some(a => a.id === actId)) {
        result.add(cat.id);
        break;
      }
    }
  }
  return Array.from(result);
}

/**
 * Sprawdza, czy wybrane podkategorie są ze sobą powiązane.
 * Powiązane są wtedy, gdy wybrano tylko 1 podkategorię LUB wszystkie wybrane podkategorie
 * współdzielą przynajmniej jedną grupę synergii (`synergyGroups`).
 */
export function areActivitiesRelated(activityIds: string[]): boolean {
  if (activityIds.length <= 1) return true;
  const items = activityIds
    .map(id => getActivityData(id))
    .filter((a): a is ActivityItem => Boolean(a));

  if (items.length <= 1) return true;

  const firstGroups = items[0].synergyGroups ?? [];
  return firstGroups.some(group =>
    items.every(item => (item.synergyGroups ?? []).includes(group))
  );
}

/**
 * Oblicza startową reputację branżową (`branza`) oraz startową opinię u mafii (`opiniaMafia`)
 * na podstawie wybranych podkategorii:
 * - Jeśli wszystkie są powiązane: czysta średnia z `rep` oraz czysta średnia z `mafia`.
 * - Jeśli choć jedna nie jest powiązana: średnia `rep` pomniejszona o 20% oraz `opiniaMafia` = 50.
 */
export function computeStartingActivityStats(activityIds: string[]): {
  branza: number;
  mafia: number;
  related: boolean;
} {
  const items = activityIds
    .map(id => getActivityData(id))
    .filter((a): a is ActivityItem => Boolean(a));

  if (items.length === 0) {
    return { branza: 50, mafia: 25, related: true };
  }

  if (items.length === 1) {
    return { branza: items[0].rep, mafia: items[0].mafia, related: true };
  }

  const avgRep = items.reduce((sum, item) => sum + item.rep, 0) / items.length;
  const avgMafia = items.reduce((sum, item) => sum + item.mafia, 0) / items.length;
  const related = areActivitiesRelated(activityIds);

  if (related) {
    return {
      branza: Math.round(avgRep),
      mafia: Math.round(avgMafia),
      related: true,
    };
  }

  return {
    branza: Math.round(avgRep * 0.8),
    mafia: 50,
    related: false,
  };
}

/**
 * Oblicza wymagany próg pracowników z uwzględnieniem mnożnika za wiele kategorii:
 * 1 kategoria = ×1.0, 2 kategorie = ×1.5, 3 kategorie = ×2.0
 * (dla mikrofirmy: +2 wymaganych pracowników za każdy dodatkowy filar powyżej pierwszego).
 */
export function getRequiredWorkers(size: CompanySize, categoryCount: number): number {
  const count = Math.max(1, categoryCount);
  const base = COMPANY_SIZE_CONFIG[size]?.requiredWorkers ?? 0;
  if (base === 0) {
    return (count - 1) * 2;
  }
  const multiplier = 1 + (count - 1) * 0.5;
  return Math.ceil(base * multiplier);
}

export function getActivityFullInfo(idOrIds: string | string[]) {
  const ids = Array.isArray(idOrIds)
    ? idOrIds
    : idOrIds.includes(',')
      ? idOrIds.split(',').filter(Boolean)
      : [idOrIds];

  const catNames: string[] = [];
  const subNames: string[] = [];

  for (const id of ids) {
    for (const cat of categories) {
      const sub = cat.activities.find(a => a.id === id);
      if (sub) {
        if (!catNames.includes(cat.name)) catNames.push(cat.name);
        subNames.push(sub.name);
        break;
      }
    }
  }

  if (subNames.length === 0) {
    return { category: 'nieznana branża', subcategory: 'nieznana działalność' };
  }

  return {
    category: catNames.join(' + '),
    subcategory: subNames.join(' + '),
  };
}