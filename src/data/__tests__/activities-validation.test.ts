import { describe, it, expect } from 'vitest';
import activities from '../activities.json';

describe('activities.json - walidacja struktury', () => {
  it('każda aktywność ma wymagane pola', () => {
    for (const a of activities) {
      expect(a.id, `Aktywność bez id`).toBeTruthy();
      expect(a.label, `${a.id}: brak label`).toBeTruthy();
      expect(a.description, `${a.id}: brak description`).toBeTruthy();
      expect(typeof a.weight, `${a.id}: weight musi być liczbą`).toBe('number');
      expect(a.conditions, `${a.id}: brak conditions`).toBeDefined();
      expect(a.effects, `${a.id}: brak effects`).toBeDefined();
    }
  });

  it('id aktywności są unikalne', () => {
    const ids = activities.map((a: any) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});