import type { GameState } from './types';
import { makeRng } from './rng';
import {
  COMBAT_SKARBOWKA_PLAYER_HP,
  COMBAT_SKARBOWKA_ENEMY_HP,
  COMBAT_MAX_ROUNDS,
} from './constants';
import { applyEffects } from './actions';
import { recomputeReputation } from './reputation';

export type CombatMove = 'wspolpraca' | 'adwokat' | 'klamstwo' | 'wplywy' | 'mafia';

export function startTaxCombat(state: GameState): void {
  state.activeCombat = {
    type: 'skarbowka',
    playerHp: COMBAT_SKARBOWKA_PLAYER_HP,
    playerHpMax: COMBAT_SKARBOWKA_PLAYER_HP,
    enemyHp: COMBAT_SKARBOWKA_ENEMY_HP,
    enemyHpMax: COMBAT_SKARBOWKA_ENEMY_HP,
    round: 1,
    log: [
      { text: 'Urzędnik skarbowy rozkłada teczkę z dokumentami.', type: 'system' },
      { text: 'Zaczyna się kontrola.', type: 'enemy' },
    ],
    finished: false,
    result: null,
  };
}

export function executeCombatMove(state: GameState, move: CombatMove): void {
  const c = state.activeCombat;
  if (!c || c.finished) return;

  const rng = makeRng(state.seed, state.turn * 1000 + c.round);
  let playerDamage = 0;
  let playerMsg = '';

  // --- RUCH GRACZA ---
  switch (move) {
    case 'wspolpraca':
      playerDamage = 10;
      playerMsg = 'Zapewniasz o pełnej współpracy. Urzędnik kiwa głową.';
      break;
    case 'adwokat':
      if (state.company.finances.stateKonta >= 20000) {
        state.company.finances.stateKonta -= 20000;
        playerDamage = 25;
        playerMsg = 'Twój adwokat przejmuje rozmowę. Powołuje się na paragrafy. Urzędnik blednie. (-20 000 PLN)';
      } else {
        playerMsg = 'Chcesz wezwać adwokata, ale nie masz na to pieniędzy! Tracisz szansę.';
        playerDamage = 0;
      }
      break;
    case 'klamstwo':
      playerDamage = 30;
      if (rng.next() < 0.3) {
        const selfDamage = 20;
        c.playerHp = Math.max(0, c.playerHp - selfDamage);
        playerMsg = `Kłamiesz, ale urzędnik od razu to wyłapuje. Tracisz ${selfDamage} siły argumentów.`;
      } else {
        playerMsg = 'Mijasz się z prawdą, ale udaje ci się zbić urzędnika z tropu.';
      }
      break;
    case 'wplywy':
      if (state.company.reputation.opiniaPolitycy > 60) {
        playerDamage = 40;
        playerMsg = 'Dzwonisz do znajomego polityka. Urzędnik dostaje telefon z samej góry.';
      } else {
        playerMsg = 'Próbujesz powołać się na wpływy, ale nikt cię nie zna. Zero efektu.';
        playerDamage = 0;
      }
      break;
    case 'mafia':
      if (state.ceo.inMafia) {
        playerDamage = 50;
        playerMsg = 'Dzwonisz do "chłopaków". Urzędnik nagle przypomina sobie o braku dowodów i szybko kończy kontrolę.';
      } else {
        playerMsg = 'Nie masz do kogo zadzwonić.';
        playerDamage = 0;
      }
      break;      
  }

  c.enemyHp = Math.max(0, c.enemyHp - playerDamage);
  if (playerMsg) c.log.push({ text: playerMsg, type: 'player' });

  if (c.enemyHp <= 0) {
    endCombat(state, 'win');
    return;
  }

  // --- RUCH WROGA ---
  const enemyRoll = rng.next();
  let enemyDamage = 10;
  let enemyMsg = 'Urzędnik pyta o brakujące dokumenty.';

  if (enemyRoll > 0.7) {
    enemyDamage = 20;
    enemyMsg = 'Urzędnik nakłada na ciebie grzywnę za opóźnienia.';
  } else if (enemyRoll > 0.4) {
    enemyDamage = 15;
    enemyMsg = 'Urzędnik znajduje nieprawidłowości w sprawozdaniu.';
  }

  c.playerHp = Math.max(0, c.playerHp - enemyDamage);
  c.log.push({ text: `${enemyMsg} (-${enemyDamage} siły)`, type: 'enemy' });

  if (c.playerHp <= 0) {
    endCombat(state, 'lose');
    return;
  }

  // --- KONIEC RUNDY ---
  c.round += 1;
  if (c.round > COMBAT_MAX_ROUNDS) {
    endCombat(state, 'draw');
  }
}

function endCombat(state: GameState, result: 'win' | 'lose' | 'draw') {
  const c = state.activeCombat;
  if (!c) return;

  c.finished = true;
  c.result = result;

  if (result === 'win') {
    c.log.push({ text: 'Urzędnik zamyka teczkę. "Tym razem się wywinąłeś".', type: 'system' });
    applyEffects(state, { reputation: { opiniaSkarbowa: 15 } });
  } else if (result === 'lose') {
    c.log.push({ text: 'Urzędnik dopina swego. Wystawia mandat na 50 000 PLN.', type: 'system' });
    applyEffects(state, { stateKonta: -50000, reputation: { opiniaPubliczna: -10, opiniaSkarbowa: 10 } });
  } else {
    c.log.push({ text: 'Urzędnik jest zmęczony, ale znajduje błędy. Mandat 20 000 PLN.', type: 'system' });
    applyEffects(state, { stateKonta: -20000, reputation: { opiniaSkarbowa: 5 } });
  }

  state.company.reputation = recomputeReputation(state);
  state.skarbowkaVisitTurn = null; // Zakończ wizytę
}

export function dismissCombat(state: GameState): void {
  state.activeCombat = null;
}

