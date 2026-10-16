import type { GameState, Difficulty, Activity, CompanySize } from './types';
import { DIFFICULTY_CONFIG, ACTIVITY_REPUTATION, COMPANY_SIZE_CONFIG, PSL_AVAILABILITY_CHANCE, ACTIVITY_MAFIA_BASELINE } from './constants';
import { matchesConditions } from './events';
import { makeRng } from './rng';
import activitiesData from '../data/activities.json';
import partiesData from '../data/parties.json';
import type { Party } from './types';

export function createInitialState(opts: {
  seed: string;
  difficulty: Difficulty;
  inPZPR: boolean;
  activity: string;
  companyName: string;
  suffix: string;
  size: CompanySize;
}): GameState {
  const { startingCash, startingRep } = DIFFICULTY_CONFIG[opts.difficulty];
  const sizeCfg = COMPANY_SIZE_CONFIG[opts.size];
  const branza = ACTIVITY_REPUTATION[opts.activity] ?? 50;
  const cash = Math.round(startingCash * sizeCfg.cashMultiplier);

  const rng = makeRng(opts.seed, 999);
  const pslAvailable = rng.next() < PSL_AVAILABILITY_CHANCE;

  return {
    schemaVersion: 1,
    seed: opts.seed,
    turn: 0,
    year: 1989,
    quarter: 1,
    phase: 'chaos',
    difficulty: opts.difficulty,
    pace: 'quarter',

    ceo: {
      party: opts.inPZPR ? 'PZPR' : 'none',
      currentPartyId: null,
      inMafia: false,
      partySwitchesByPhase: { chaos: 0, duopol: 0, invasion: 0 },
      flags: [],
      lastMafiaInvitationTurn: null,
    },

    company: {
      name: opts.companyName,
      suffix: opts.suffix,
      size: opts.size,
      legalForm: 'cywilna',
      activity: opts.activity,
      employees: { ...sizeCfg.startingEmployees },
      finances: {
        stateKonta: cash,
        aktywa: {
          przychodyZDzialalnosci: 0,
          srodkiZKredytow: 0,
          dofinansowania: 0,
          dofinansowaniaSzaraStrefa: 0,
          dochodPasywny: 0,
          splatyZobowiazan: 0,
        },
        pasywa: {
          splacaneKredyty: 0,
          pracownicy: 0,
          czynsz: 0,
          podatki: 0,
          kary: 0,
          wydatkiNieplanowane: 0,
          zakupy: 0,
          inne: 0,
        },
      },
      reputation: {
        branza,
        opiniaPubliczna: startingRep,
        opiniaPracownicy: startingRep,
        opiniaBranza: startingRep,
        opiniaMafia: ACTIVITY_MAFIA_BASELINE[opts.activity] ?? 25,
        opiniaMedia: 50,
        opiniaPolitycy: opts.inPZPR ? 60 : 40,
        ogolna: 0,
      },
      loans: [],
      lastActivityChangeTurn: -999,
    },

    politics: {
      parties: [],
      president: {
        id: 'wroniecki_1989',
        name: 'Włodzimierz Wroniecki',
        partyId: null,
        termStart: 1989,
        termEnd: 1990,
      },
      premierId: null,
      rulingCoalition: [],
      lastElection: null,
      nextParliamentaryElection: 1991,
      nextPresidentialElection: 1990,
      pslAvailable,
      partySchedule: generatePartySchedule(opts.seed),

    },

    pendingEvents: [],
    currentActivities: [],
    history: [],
    bankruptWarningTurns: 0,
    lastChoiceResult: null,
    chosenActivityThisTurn: null,
    lastElectionResult: null,
    lastPresidentialResult: null,
    news: [],
    gameOver: null,
  };
}

export function getEligibleActivities(state: GameState): string[] {
  const all = activitiesData as Activity[];
  const eligible = all.filter(a => matchesConditions(state, a.conditions));
  const rng = makeRng(state.seed, state.turn * 7 + 3);
  return eligible
    .sort(() => rng.next() - 0.5)
    .slice(0, 3)
    .map(a => a.id);
}

function generatePartySchedule(seed: string): Record<string, { from: number; to: number }> {
  const rng = makeRng(seed, 12345);
  const schedule: Record<string, { from: number; to: number }> = {};
  for (const p of (partiesData as Party[])) {
    if (p.isPSL) {
      schedule[p.id] = { from: 1989, to: 9999 };
    } else {
      const fromShift = rng.int(-2, 2);
      const toShift = p.activeTo >= 9000 ? 0 : rng.int(-2, 2);
      schedule[p.id] = {
        from: p.activeFrom + fromShift,
        to: p.activeTo >= 9000 ? 9999 : p.activeTo + toShift,
      };
    }
  }
  return schedule;
}