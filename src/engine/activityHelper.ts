import type { ActivityCategory, ActivityItem } from './types';
import branchesData from '../data/branches.json';

const categories = branchesData as ActivityCategory[];
const allActivities: ActivityItem[] = categories.flatMap(c => c.activities);

export function getActivityData(id: string): ActivityItem | undefined {
  return allActivities.find(a => a.id === id);
}

export function getActivityName(id: string): string {
  return getActivityData(id)?.name ?? id;
}

export function getActivityFullInfo(id: string) {
  for (const cat of categories) {
    const sub = cat.activities.find(a => a.id === id);
    if (sub) return { category: cat.name, subcategory: sub.name };
  }
  return { category: 'nieznana branża', subcategory: 'nieznana działalność' };
}