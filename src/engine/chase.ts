import type { GameState } from './types';
import { applyEffects } from './actions';
import { recomputeReputation } from './reputation';

export function startChase(state: GameState): void {
  state.activeChase = {
    player: { x: 0, y: 0 },
    enemies: [],
    gridSize: 0,
    grid: [],
    turn: 1,
    maxTurns: 1,
    finished: false,
    result: null,
  };
}

export function finishChase(state: GameState, result: 'escaped' | 'caught'): void {
  const c = state.activeChase;
  if (!c || c.finished) return;

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