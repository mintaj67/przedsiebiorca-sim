import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng';

describe('makeRng', () => {
  it('daje ten sam wynik dla tego samego seeda', () => {
    const rng1 = makeRng('test-seed', 1);
    const rng2 = makeRng('test-seed', 1);
    expect(rng1.next()).toBe(rng2.next());
    expect(rng1.next()).toBe(rng2.next());
  });

  it('daje różne wyniki dla różnych seedów', () => {
    const rng1 = makeRng('seed-a', 1);
    const rng2 = makeRng('seed-b', 1);
    expect(rng1.next()).not.toBe(rng2.next());
  });

  it('int zwraca liczby w podanym zakresie', () => {
    const rng = makeRng('test', 1);
    for (let i = 0; i < 100; i++) {
      const value = rng.int(1, 10);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});
