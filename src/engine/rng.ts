import seedrandom from 'seedrandom';

export function makeRng(seed: string, salt: number) {
  const rng = seedrandom(`${seed}:${salt}`);
  return {
    next: () => rng(),
    int: (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min,
    pick: <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)],
    weighted: <T extends { weight: number }>(arr: T[]) => {
      const total = arr.reduce((s, x) => s + x.weight, 0);
      let r = rng() * total;
      for (const item of arr) {
        r -= item.weight;
        if (r <= 0) return item;
      }
      return arr[arr.length - 1];
    },
  };
}