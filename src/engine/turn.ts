import type { GameState, EventEffects, Activity, ChoiceResult } from './types';
import { makeRng } from './rng';
import { tickEconomy } from './economy';
import { tickPolitics } from './politics';
import { rollEvents, matchesConditions } from './events';
import { recomputeReputation } from './reputation';
import { BANKRUPT_GRACE_TURNS } from './constants';
import activitiesData from '../data/activities.json';
import {
  generatePassiveNews,
  processExpiredActions,
  checkMafiaInvitation,
  checkTaxOfficeNotice,
  checkEmployeeUnrest,
} from './news';
import { applyEffects, resolvePendingSales } from './actions';
import { startTaxCombat } from './combat';
import { startChase } from './chase';

const INSTANT_BANKRUPTCY_LIMIT = -100_000;
const ACTIVITIES_PER_TURN = 3;
const CHASE_MAFIA_THRESHOLD = 25;
const CHASE_CHANCE = 0.3;

const REPUTATION_LABELS: Record<string, string> = {
  branza: 'Branża',
  opiniaPubliczna: 'Opinia publiczna',
  opiniaPracownicy: 'Opinia pracowników',
  opiniaBranza: 'Opinia w branży',
  opiniaMafia: 'Opinia wśród mafii',
  opiniaMedia: 'Opinia w mediach',
  opiniaPolitycy: 'Opinia wśród polityków',
  opiniaSkarbowa: 'Opinia skarbówki',
  ogolna: 'Reputacja ogólna',
};

const CONTRACT_LABELS: Record<string, string> = {
  bezUmowy: 'bez umowy',
  zlecenie: 'zlecenie',
  uop: 'umowa o pracę',
};

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')}`;

function describeEffects(e: EventEffects): string[] {
  const lines: string[] = [];
  if (e.stanKonta) lines.push(`Stan konta: ${signed(e.stanKonta)} PLN`);
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      if (!v) continue;
      lines.push(`${REPUTATION_LABELS[k] ?? k}: ${signed(v)}`);
    }
  }
  if (e.wydatki) {
    for (const [k, v] of Object.entries(e.wydatki)) {
      if (!v) continue;
      lines.push(`Wydatki (${k}): ${signed(v)}`);
    }
  }
  if (e.wplywy) {
    for (const [k, v] of Object.entries(e.wplywy)) {
      if (!v) continue;
      lines.push(`Wpływy (${k}): ${signed(v)}`);
    }
  }
  if (e.employeesDelta) {
    for (const [k, v] of Object.entries(e.employeesDelta)) {
      if (!v) continue;
      lines.push(`Pracownicy (${CONTRACT_LABELS[k] ?? k}): ${signed(v)}`);
    }
  }
  if (e.divideFinances) lines.push('Podział finansów');
  if (e.addItem) lines.push(`Nowy przedmiot: ${e.addItem}`);
  if (e.setParty) lines.push(`Zmiana strony politycznej: ${e.setParty}`);
  if (e.joinMafia) lines.push('Dołączasz do mafii');
  if (e.leaveMafia) lines.push('Opuszczasz mafię');
  if (e.setCurrentPartyId) lines.push(`Wstępujesz do partii: ${e.setCurrentPartyId}`);
  if (e.flagsAdd?.length) lines.push(`Nowe znaczniki: ${e.flagsAdd.join(', ')}`);
  if (e.flagsRemove?.length) lines.push(`Usunięte znaczniki: ${e.flagsRemove.join(', ')}`);
  if (lines.length === 0) lines.push('Brak widocznych skutków.');
  return lines;
}

export function nextTurn(state: GameState): GameState {
  if (state.gameOver) return state;

  let s = structuredClone(state);
  const rng = makeRng(s.seed, s.turn);
  const quarters = s.pace === 'year' ? 4 : 1;
  const oldPhase = s.phase;

  // 1. AKTUALIZACJA CZASU (przed ekonomią i eventami!)
  s.turn += 1;
  const totalQuarters = s.year * 4 + (s.quarter - 1) + quarters;
  s.year = Math.floor(totalQuarters / 4);
  s.quarter = ((totalQuarters % 4) + 1) as 1 | 2 | 3 | 4;
  s.phase = s.year < 2005 ? 'chaos' : s.year < 2030 ? 'duopol' : 'invasion';

  if (s.phase !== oldPhase) {
    s.ceo.partySwitchesByPhase[s.phase] = 0;
  }

  // 2. EKONOMIA I ROZLICZENIA
  for (let i = 0; i < quarters; i++) {
    resolvePendingSales(s);
    s = tickEconomy(s);
  }

  // 3. POLITYKA I EVENTY
  s = tickPolitics(s);
  s.pendingEvents = rollEvents(s);
  s.company.reputation = recomputeReputation(s);

  if (s.bankruptWarningTurns >= BANKRUPT_GRACE_TURNS && s.company.finances.stanKonta < 0) {
    s.gameOver = { reason: 'Bankructwo — nie spłaciłeś długów' };
  }
  if (s.company.reputation.ogolna <= 0) {
    s.gameOver = { reason: 'Utrata reputacji' };
  }
  if (s.gameOver) return s;

  // 4. AKTYWNOŚCI I POWIADOMIENIA
  s.currentActivities = rollActivities(s, rng);
  s.chosenActivityThisTurn = null;
  s.lastChoiceResult = null;

  generatePassiveNews(s);
  checkMafiaInvitation(s);
  checkTaxOfficeNotice(s);
  processExpiredActions(s);
  checkEmployeeUnrest(s);

  if (s.skarbowkaVisitTurn !== null && s.turn === s.skarbowkaVisitTurn && !s.activeCombat) {
    startTaxCombat(s);
  }

  if (!s.activeChase && !s.activeCombat && s.ceo.inMafia === false && s.company.reputation.opiniaMafia < CHASE_MAFIA_THRESHOLD) {
    const chaseRng = makeRng(s.seed, s.turn * 99 + 1);
    if (chaseRng.next() < CHASE_CHANCE) {
      startChase(s);
    }
  }
  
  return s;
}

function rollActivities(state: GameState, rng: ReturnType<typeof makeRng>): string[] {
  const pool = (activitiesData as Activity[])
    .filter((a) => matchesConditions(state, a.conditions))
    .map((a) => ({ id: a.id, weight: a.weight > 0 ? a.weight : 1 }));

  const picked: string[] = [];
  while (picked.length < ACTIVITIES_PER_TURN && pool.length > 0) {
    const item = rng.weighted(pool);
    picked.push(item.id);
    pool.splice(pool.findIndex((p) => p.id === item.id), 1);
  }
  return picked;
}

export function consumeActivity(state: GameState, activityId: string): GameState {
  if (state.gameOver) return state;
  if (state.chosenActivityThisTurn) return state;
  if (!state.currentActivities.includes(activityId)) return state;

  const activity = (activitiesData as Activity[]).find((a) => a.id === activityId);
  if (!activity) return state;

  const s = structuredClone(state);
  applyEffects(s, activity.effects);
  s.chosenActivityThisTurn = activityId;
  s.company.reputation = recomputeReputation(s);

  if (s.company.reputation.ogolna <= 0) {
    s.gameOver = { reason: 'Utrata reputacji' };
  }
  return s;
}

export function resolveEventChoice(state: GameState, eventId: string, choiceId: string): GameState {
  const ev = state.pendingEvents.find((e) => e.id === eventId);
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !choice) return state;

  const s = structuredClone(state);
  const rng = makeRng(s.seed, s.turn * 31 + s.history.length);

  let gambleResult: 'win' | 'lose' | undefined;
  let effects: EventEffects | undefined;
  let outcomeDescription: string | undefined;

  if (choice.outcomes && choice.outcomes.length > 0) {
    const picked = rng.weighted(choice.outcomes);
    effects = picked.effects;
    outcomeDescription = picked.description;
  } else if (choice.gamble) {
    if (rng.next() < choice.gamble.winChance) {
      effects = choice.gamble.onWin;
      gambleResult = 'win';
      outcomeDescription = choice.gamble.winText;
    } else {
      effects = choice.gamble.onLose;
      gambleResult = 'lose';
      outcomeDescription = choice.gamble.loseText;
    }
  } else {
    effects = choice.effects;
  }
  if (effects) applyEffects(s, effects);

  const result: ChoiceResult = {
    eventId: ev.id,
    eventTitle: ev.title,
    choiceId: choice.id,
    choiceLabel: choice.label,
    consequenceLines: effects ? describeEffects(effects) : ['Brak efektów.'],
    gambleResult,
    outcomeDescription,
  };

  s.pendingEvents = [];
  s.history.push(eventId);
  s.lastChoiceResult = result;
  s.company.reputation = recomputeReputation(s);

  if (s.company.finances.stanKonta < INSTANT_BANKRUPTCY_LIMIT) {
    s.gameOver = { reason: 'Bankructwo — nie spłaciłeś długów' };
  }
  if (s.company.reputation.ogolna <= 0) {
    s.gameOver = { reason: 'Utrata reputacji' };
  }

  return s;
}

export function dismissConsequence(state: GameState): GameState {
  const s = structuredClone(state);
  s.lastChoiceResult = null;
  return s;
}