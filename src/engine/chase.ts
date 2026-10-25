import type { GameState, Point } from './types';
import { makeRng } from './rng';
import { applyEffects } from './actions';
import { recomputeReputation } from './reputation';

export function startChase(state: GameState): void {
  const size = 8; // Plansza 8x8
  const grid = Array(size).fill(null).map(() => Array(size).fill(0));
  
  // Startujemy w lewym górnym rogu i od razu go zamalowujemy
  grid[0][0] = 1; 

  state.activeChase = {
    player: { x: 0, y: 0 },
    enemies: [
      { x: 7, y: 7 }, // Przeciwnicy startują w przeciwległych rogach
      { x: 7, y: 0 },
    ],
    gridSize: size,
    grid,
    turn: 1,
    maxTurns: 30, // Dajemy więcej tur, bo zamalowanie wymaga czasu
    finished: false,
    result: null,
  };
}

export function movePlayer(state: GameState, dx: number, dy: number): void {
  const c = state.activeChase;
  if (!c || c.finished) return;

  const newX = c.player.x + dx;
  const newY = c.player.y + dy;

  // Sprawdzenie granic planszy
  if (newX < 0 || newX >= c.gridSize || newY < 0 || newY >= c.gridSize) return;

  // Gracz się porusza i zamalowuje kafelek
  c.player = { x: newX, y: newY };
  c.grid[newY][newX] = 1;

  // Sprawdzenie czy gracz wygrał (np. 40% planszy zamalowane)
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

  // Ruch wrogów (idą w stronę gracza, ale tylko po pustych polach)
  c.enemies = c.enemies.map(enemy => {
    let ex = enemy.x;
    let ey = enemy.y;

    const possibleMoves = [
      { x: ex + 1, y: ey },
      { x: ex - 1, y: ey },
      { x: ex, y: ey + 1 },
      { x: ex, y: ey - 1 }
    ].filter(p => 
      p.x >= 0 && p.x < c.gridSize && 
      p.y >= 0 && p.y < c.gridSize && 
      c.grid[p.y][p.x] === 0 // Tylko puste pola
    );

    if (possibleMoves.length > 0) {
      // Wybierz ruch, który przybliża do gracza
      possibleMoves.sort((a, b) => {
        const distA = Math.abs(a.x - c.player.x) + Math.abs(a.y - c.player.y);
        const distB = Math.abs(b.x - c.player.x) + Math.abs(b.y - c.player.y);
        return distA - distB;
      });
      return possibleMoves[0];
    }
    return enemy;
  });

  // Sprawdzenie kolizji
  const caught = c.enemies.some(e => e.x === c.player.x && e.y === c.player.y);
  if (caught) {
    endChase(state, 'caught');
    return;
  }

  c.turn += 1;
  if (c.turn > c.maxTurns) {
    endChase(state, 'caught'); // Czas minął, a oni cię dopadli
  }
}

function endChase(state: GameState, result: 'escaped' | 'caught') {
  const c = state.activeChase;
  if (!c) return;

  c.finished = true;
  c.result = result;

  if (result === 'escaped') {
    applyEffects(state, {
      stateKonta: -10000,
      reputation: { opiniaPubliczna: 10, opiniaMafia: -10 },
    });
  } else {
    applyEffects(state, {
      stateKonta: -50000,
      reputation: { opiniaPubliczna: -15, opiniaMafia: -20 },
    });
  }
  
  state.company.reputation = recomputeReputation(state);
}

export function dismissChase(state: GameState): void {
  state.activeChase = null;
}