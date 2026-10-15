import type { GameState, EventEffects, Activity, ChoiceResult } from './types';
import { makeRng } from './rng';
import { tickEconomy } from './economy';
import { tickPolitics } from './politics';
import { rollEvents, matchesConditions } from './events';
import { recomputeReputation } from './reputation';
import { BANKRUPT_GRACE_TURNS } from './constants';
import activitiesData from '../data/activities.json';
import { generatePassiveNews } from './news';

const REPUTATION_LABELS: Record<string, string> = {
  branza: 'Branża',
  opiniaPubliczna: 'Opinia publiczna',
  opiniaPracownicy: 'Opinia pracowników',
  opiniaBranza: 'Opinia w branży',
  opiniaMafia: 'Opinia wśród mafii',
  opiniaMedia: 'Opinia w mediach',
  opiniaPolitycy: 'Opinia wśród polityków',
  ogolna: 'Reputacja ogólna',
};

function describeEffects(e: EventEffects): string[] {
  const lines: string[] = [];
  if (e.stateKonta) lines.push(`Stan konta: ${e.stateKonta > 0 ? '+' : ''}${e.stateKonta.toLocaleString('pl-PL')} PLN`);
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      if (!v) continue;
      const label = REPUTATION_LABELS[k] ?? k;
      lines.push(`${label}: ${v > 0 ? '+' : ''}${v}`);
    }
  }
  if (e.pasywa) {
    for (const [k, v] of Object.entries(e.pasywa)) {
      if (!v) continue;
      lines.push(`Pasywa (${k}): ${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')}`);
    }
  }
  if (e.aktywa) {
    for (const [k, v] of Object.entries(e.aktywa)) {
      if (!v) continue;
      lines.push(`Aktywa (${k}): ${v > 0 ? '+' : ''}${v.toLocaleString('pl-PL')}`);
    }
  }
  if (e.joinMafia) lines.push('Dołączasz do mafii');
  if (e.leaveMafia) lines.push('Opuszczasz mafię');
  if (e.setCurrentPartyId) lines.push(`Wstępujesz do partii: ${e.setCurrentPartyId}`);
  if (e.flagsAdd?.length) lines.push(`Nowe znaczniki: ${e.flagsAdd.join(', ')}`);
  if (lines.length === 0) lines.push('Brak widocznych skutków.');
  return lines;
}

export function nextTurn(state: GameState): GameState {
  let s = structuredClone(state);
  const rng = makeRng(s.seed, s.turn);
  const quarters = s.pace === 'year' ? 4 : 1;
  const oldPhase = s.phase;

  for (let i = 0; i < quarters; i++) {
    s = tickEconomy(s);
  }

  s = tickPolitics(s);
  s.pendingEvents = rollEvents(s);
  s.company.reputation = recomputeReputation(s);

  if (s.bankruptWarningTurns >= BANKRUPT_GRACE_TURNS && s.company.finances.stateKonta < 0) {
    s.gameOver = { reason: 'Bankructwo — nie spłaciłeś długów' };
  }
  if (s.company.reputation.ogolna <= 0) {
    s.gameOver = { reason: 'Utrata reputacji' };
  }

  s.turn += 1;
  const totalQuarters = s.year * 4 + (s.quarter - 1) + quarters;
  s.year = Math.floor(totalQuarters / 4);
  s.quarter = ((totalQuarters % 4) + 1) as 1 | 2 | 3 | 4;
  s.phase = s.year < 2005 ? 'chaos' : s.year < 2030 ? 'duopol' : 'invasion';

  if (s.phase !== oldPhase) {
    s.ceo.partySwitchesByPhase[s.phase] = 0;
  }

  s.currentActivities = rollActivities(s, rng);
  s.chosenActivityThisTurn = null;
  s.lastChoiceResult = null;
  
    generatePassiveNews(s);

  return s;
}

export function applyEffects(state: GameState, e: EventEffects) {
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      (state.company.reputation as any)[k] = clamp((state.company.reputation as any)[k] + (v as number));
    }
  }
  if (e.stateKonta) state.company.finances.stateKonta += e.stateKonta;
  if (e.aktywa) for (const [k, v] of Object.entries(e.aktywa)) {
    (state.company.finances.aktywa as any)[k] += v as number;
  }
  if (e.pasywa) for (const [k, v] of Object.entries(e.pasywa)) {
    (state.company.finances.pasywa as any)[k] += v as number;
  }
  if (e.flagsAdd) state.ceo.flags.push(...e.flagsAdd);
  if (e.flagsRemove) state.ceo.flags = state.ceo.flags.filter(f => !e.flagsRemove!.includes(f));
  if (e.joinMafia) state.ceo.inMafia = true;
  if (e.leaveMafia) state.ceo.inMafia = false;
  if (e.setParty) state.ceo.party = e.setParty;
  if (e.setCurrentPartyId) state.ceo.currentPartyId = e.setCurrentPartyId;
}

function rollActivities(state: GameState, rng: ReturnType<typeof makeRng>): string[] {
  const eligible = (activitiesData as Activity[]).filter(a => matchesConditions(state, a.conditions));
  return eligible
    .sort(() => rng.next() - 0.5)
    .slice(0, 3)
    .map(a => a.id);
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function consumeActivity(state: GameState, activityId: string): GameState {
  if (state.chosenActivityThisTurn) return state;
  const s = structuredClone(state);
  const activity = (activitiesData as Activity[]).find(a => a.id === activityId);
  if (!activity) return s;

  applyEffects(s, activity.effects);
  s.chosenActivityThisTurn = activityId;
  s.company.reputation = recomputeReputation(s);

  if (s.company.reputation.ogolna <= 0) {
    s.gameOver = { reason: 'Utrata reputacji' };
  }

  return s;
}

export function resolveEventChoice(state: GameState, eventId: string, choiceId: string): GameState {
  const s = structuredClone(state);
  const ev = s.pendingEvents.find(e => e.id === eventId);
  const choice = ev?.choices.find(c => c.id === choiceId);
  const rng = makeRng(s.seed, s.turn * 31 + s.history.length);

    let gambleResult: 'win' | 'lose' | undefined;
  let effects: EventEffects | undefined;
  let outcomeDescription: string | undefined;

  if (choice) {
    if (choice.gamble) {
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
  }

   const result: ChoiceResult = {
    eventId: ev?.id ?? eventId,
    eventTitle: ev?.title ?? '',
    choiceId: choice?.id ?? choiceId,
    choiceLabel: choice?.label ?? '',
    consequenceLines: effects ? describeEffects(effects) : ['Brak efektów.'],
    gambleResult,
    outcomeDescription,
  };


  s.pendingEvents = [];
  s.history.push(eventId);
  s.lastChoiceResult = result;
  s.company.reputation = recomputeReputation(s);

  if (s.company.finances.stateKonta < -100000) {
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