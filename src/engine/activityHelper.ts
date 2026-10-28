import type { ActivityItem } from './types';
import branchesData from '../data/branches.json';

const allActivities: ActivityItem[] = (branchesData as any[]).flatMap(c => c.activities);

export function getActivityData(id: string): ActivityItem | undefined {
  return allActivities.find(a => a.id === id);
}

export function getActivityName(id: string): string {
  return getActivityData(id)?.name ?? id;
}

export function getActivityFullInfo(id: string) {
  const categories = (branchesData as any[]);
  for (const cat of categories) {
    const sub = cat.activities.find((a: any) => a.id === id);
    if (sub) return { category: cat.name, subcategory: sub.name };
  }
  return { category: 'nieznana branża', subcategory: 'nieznana działalność' };
}