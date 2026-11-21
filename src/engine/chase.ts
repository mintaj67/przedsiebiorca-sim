import type { GameState } from './types';
import { applyEffects } from './actions';
import { recomputeReputation } from './reputation';
import { makeRng } from './rng';

export function startChase(state: GameState): void {
  const size = 8;
  const grid = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  grid[0][0] = 1;

  state.activeChase = {
    player: { x: 0, y: 0 },
    enemies: [
      { x: 7, y: 7 },
      { x: 7, y: 0 },
    ],
    gridSize: size,
    grid,
    turn: 1,
    maxTurns: 30,
    finished: false,
    result: null,
  };
}

export function movePlayer(state: GameState, dx: number, dy: number): void {
  const c = state.activeChase;
  if (!c || c.finished) return;

  const newX = c.player.x + dx;
  const newY = c.player.y + dy;

  if (newX < 0 || newX >= c.gridSize || newY < 0 || newY >= c.gridSize) return;

  c.player = { x: newX, y: newY };
  c.grid[newY][newX] = 1;

  let paintedCount = 0;
  for (let y = 0; y < c.gridSize; y++) {
    for (let x = 0; x < c.gridSize; x++) {
      if (c.grid[y][x] === 1) paintedCount++;
    }
  }

  const totalTiles = c.gridSize * c.gridSize;
  if (paintedCount / totalTiles >= 0.4) {
    endChase(state, 'escaped');
    return;
  }

  // Jeśli gracz wszedł na pole zajęte już przez przeciwnika, od razu łapią go na miejscu
  const caughtOnEntry = c.enemies.some(e => e.x === c.player.x && e.y === c.player.y);
  if (caughtOnEntry) {
    endChase(state, 'caught');
    return;
  }

  const rng = makeRng(`${state.seed}:chase`, state.turn * 31 + paintedCount);

  c.enemies = c.enemies.map((enemy, idx) => {
    const ex = enemy.x;
    const ey = enemy.y;

    const candidates = [
      { x: ex + 1, y: ey },
      { x: ex - 1, y: ey },
      { x: ex, y: ey + 1 },
      { x: ex, y: ey - 1 },
    ].filter(p => p.x >= 0 && p.x < c.gridSize && p.y >= 0 && p.y < c.gridSize);

    if (candidates.length === 0) return enemy;

    // Preferujemy niepokrywanie dwóch przeciwników na tym samym polu, chyba że to ruch na pole gracza
    const nonStacked = candidates.filter(
      (p, cIdx) =>
        (p.x === c.player.x && p.y === c.player.y) ||
        !c.enemies.some((other, oIdx) => oIdx !== idx && other.x === p.x && other.y === p.y && cIdx >= 0)
    );
    const pool = nonStacked.length > 0 ? nonStacked : candidates;

    pool.sort((a, b) => {
      const distA = Math.abs(a.x - c.player.x) + Math.abs(a.y - c.player.y);
      const distB = Math.abs(b.x - c.player.x) + Math.abs(b.y - c.player.y);
      if (distA !== distB) return distA - distB;
      return rng.next() - 0.5;
    });

    return pool[0];
  });

  const caughtAfterMove = c.enemies.some(e => e.x === c.player.x && e.y === c.player.y);
  if (caughtAfterMove) {
    endChase(state, 'caught');
    return;
  }

  c.turn += 1;
  if (c.turn > c.maxTurns) {
    endChase(state, 'caught');
  }
}

function endChase(state: GameState, result: 'escaped' | 'caught') {
  const c = state.activeChase;
  if (!c) return;

  c.finished = true;
  c.result = result;

  if (result === 'escaped') {
    applyEffects(state, {
      stanKonta: -10000,
      reputation: { opiniaPubliczna: 10, opiniaMafia: -10 },
    });
  } else {
    applyEffects(state, {
      stanKonta: -50000,
      reputation: { opiniaPubliczna: -15, opiniaMafia: -20 },
    });
  }

  state.company.reputation = recomputeReputation(state);
}

export function dismissChase(state: GameState): void {
  state.activeChase = null;
}