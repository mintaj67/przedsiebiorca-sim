/**
 * Umieść w: src/engine/simulation.test.ts
 * Uruchom:   npx vitest run src/engine/simulation.test.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ContractType, GameState } from './types';
import { createInitialState, getEligibleActivities } from './initialState';
import { nextTurn, consumeActivity, resolveEventChoice } from './turn';
import { matchesConditions } from './events';
import { makeRng } from './rng';
import {
  applyHire,
  applyLoan,
  applyEmergencyLoan,
  applyJoinParty,
  applyLeaveParty,
  applySetPace,
  toggleAccountant,
  changeCompanySize,
  buildBranch,
  buyAd,
  rentWarehouse,
} from './actions';
import branchesData from '../data/branches.json';
 
afterEach(() => vi.restoreAllMocks());
 
type Rng = ReturnType<typeof makeRng>;
type Policy = 'passive' | 'random';

function allActivityIds(): string[] {
  const raw: any = branchesData;
  const cats: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.categories)
      ? raw.categories
      : Object.values(raw ?? {});
  const ids: string[] = [];
  for (const cat of cats) for (const a of cat?.activities ?? []) if (a?.id) ids.push(a.id);
  return ids;
}
 
const ACTIVITY_IDS = allActivityIds();
 
function newGame(seed: string, i: number): GameState {
  const s = createInitialState({
    seed,
    difficulty: (['easy', 'medium', 'hard'] as const)[i % 3],
    inPZPR: i % 2 === 0,
    activity: ACTIVITY_IDS[i % ACTIVITY_IDS.length],
    companyName: 'Test',
    suffix: 'sp. z o.o.',
    size: 'micro',
  });
  s.currentActivities = getEligibleActivities(s);
  return s;
}
 
 
const median = (a: number[]) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : 0;
};
 
function findBadNumbers(obj: unknown, path = 'state', out: string[] = []): string[] {
  if (out.length > 5) return out;
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) out.push(path);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => findBadNumbers(v, `${path}[${i}]`, out));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) findBadNumbers(v, `${path}.${k}`, out);
  }
  return out;
}
 
function checkInvariants(s: GameState, before?: GameState): string[] {
  const v: string[] = [];
 
  const bad = findBadNumbers(s);
  if (bad.length) v.push(`NaN/Infinity w stanie: ${bad.slice(0, 3).join(', ')}`);
 
  for (const [k, val] of Object.entries(s.company.reputation)) {
    if (typeof val === 'number' && (val < -1e-9 || val > 100 + 1e-9)) v.push(`Reputacja poza 0-100: ${k}`);
  }
  for (const [k, val] of Object.entries(s.company.employees)) {
    if (val < 0 || !Number.isInteger(val)) v.push(`Zła liczba pracowników: ${k}`);
  }
  for (const [k, val] of Object.entries(s.company.resources)) {
    if (val < 0) v.push(`Ujemny zasób w magazynie: ${k}`);
  }
  for (const l of s.company.loans) {
    if (l.remaining < -1e-6) v.push('Ujemne saldo kredytu');
  }
  if (![1, 2, 3, 4].includes(s.quarter)) v.push(`Zły kwartał: ${s.quarter}`);
 
  const expectedPhase = s.year < 2005 ? 'chaos' : s.year < 2030 ? 'duopol' : 'invasion';
  if (s.phase !== expectedPhase) v.push('Faza nie pasuje do roku');
  if (s.pendingEvents.length > 1) v.push('Więcej niż 1 event naraz');
 
  if (before && !s.gameOver) {
    if (s.turn !== before.turn + 1) v.push('Licznik tury nie wzrósł o 1');
    const step = before.pace === 'year' ? 4 : 1;
    const dq = s.year * 4 + s.quarter - (before.year * 4 + before.quarter);
    if (dq !== step) v.push(`Data przesunęła się o ${dq} kwartałów zamiast ${step}`);
  }
  return v;
}
 
const CONTRACTS: ContractType[] = ['bezUmowy', 'zlecenie', 'uop'];
 
function randomActions(s: GameState, rng: Rng): GameState {
  const cash = s.company.finances.stanKonta;
  if (cash < 0 && s.bankruptWarningTurns > 0 && rng.next() < 0.7) return applyEmergencyLoan(s);
 
  const r = rng.next();
  if (r < 0.1) return applyHire(s, rng.pick(CONTRACTS), rng.pick([-1, 1, 1, 2]));
  if (r < 0.16 && cash < 50_000) {
    return applyLoan(s, rng.pick<'bank' | 'szara_strefa'>(['bank', 'szara_strefa']), rng.pick([10_000, 50_000, 100_000]));
  }
  if (r < 0.22) return buyAd(s, rng.pick<'radio' | 'tv' | 'internet'>(['radio', 'tv', 'internet']));
  if (r < 0.26) return changeCompanySize(s, rng.pick<'up' | 'down'>(['up', 'down']));
  if (r < 0.3) return buildBranch(s);
  if (r < 0.34) return rentWarehouse(s);
  if (r < 0.37) return toggleAccountant(s);
  if (r < 0.42 && s.politics.parties.length > 0) return applyJoinParty(s, rng.pick(s.politics.parties).id);
  if (r < 0.44) return applyLeaveParty(s);
  if (r < 0.46) return applySetPace(s, rng.pick<'quarter' | 'year'>(['quarter', 'year']));
  return s;
}
 
function playTurn(s: GameState, policy: Policy, rng: Rng): GameState {
  if (s.pendingEvents.length > 0) {
    const ev = s.pendingEvents[0];
    const choices = ev.choices.filter((c) => !c.requires || matchesConditions(s, c.requires));
    if (choices.length > 0) {
      const choice = policy === 'passive' ? choices[0] : rng.pick(choices);
      s = resolveEventChoice(s, ev.id, choice.id);
    }
  }
  if (s.gameOver) return s;
 
  if (s.currentActivities.length > 0 && (policy === 'passive' || rng.next() < 0.8)) {
    const id = policy === 'passive' ? s.currentActivities[0] : rng.pick(s.currentActivities);
    s = consumeActivity(s, id);
  }
  if (s.gameOver || policy === 'passive') return s;
 
  return randomActions(s, rng);
}
 
interface GameReport {
  final: GameState;
  violations: string[];
  eventTurns: number;
  emptyTurns: number;
  chases: number;
  combats: number;
  maxCash: number;
}
 
function playGame(seed: string, i: number, policy: Policy): GameReport {
  const mathRng = makeRng(seed, 777);
  vi.spyOn(Math, 'random').mockImplementation(() => mathRng.next());
 
  const rng = makeRng(seed, 1_000_001);
  let s = newGame(seed, i);
  const rep: GameReport = { final: s, violations: [], eventTurns: 0, emptyTurns: 0, chases: 0, combats: 0, maxCash: 0 };
 
  const check = (label: string, before?: GameState) => {
    for (const msg of checkInvariants(s, before)) rep.violations.push(`${msg}  [${seed}, tura ${s.turn}, ${label}]`);
  };
 
  for (let step = 0; step < 400 && !s.gameOver && s.year < 2031; step++) {
    s = playTurn(s, policy, rng);
    check('akcje gracza');
    if (s.gameOver) break;
 
    const before = s;
    s = nextTurn(s);
    check('nextTurn', before);
 
    if (s.pendingEvents.length > 0) rep.eventTurns++;
    else if (s.year < 2030) rep.emptyTurns++;
    if (s.activeChase) { rep.chases++; s.activeChase = null; }
    if (s.activeCombat) { rep.combats++; s.activeCombat = null; }
    rep.maxCash = Math.max(rep.maxCash, s.company.finances.stanKonta);
  }
 
  if (s.gameOver && nextTurn(s) !== s) rep.violations.push(`nextTurn działa po gameOver  [${seed}]`);
  rep.final = s;
  return rep;
}
 
const N_GAMES = 100;
 
describe('symulacja headless', () => {
  for (const policy of ['passive', 'random'] as const) {
    it(
      `${N_GAMES} gier, gracz "${policy}": niezmienniki + statystyki`,
      () => {
        const reports: GameReport[] = [];
        for (let i = 0; i < N_GAMES; i++) reports.push(playGame(`sim-${policy}-${i}`, i, policy));
 
        const reasons: Record<string, number> = {};
        for (const r of reports) {
          const key = r.final.gameOver?.reason ?? `dożył ${r.final.year}`;
          reasons[key] = (reasons[key] ?? 0) + 1;
        }
        const avg = (f: (r: GameReport) => number) =>
          (reports.reduce((a, r) => a + f(r), 0) / reports.length).toFixed(1);
 
        console.log(
          [
            `=== Gracz "${policy}", ${N_GAMES} gier ===`,
            `Zakończenia: ${JSON.stringify(reasons)}`,
            `Mediana roku końca: ${median(reports.map((r) => r.final.year))}`,
            `Tury z eventem / bez (przed 2030): ${avg((r) => r.eventTurns)} / ${avg((r) => r.emptyTurns)}`,
            `Ucieczki / walki: ${avg((r) => r.chases)} / ${avg((r) => r.combats)}`,
            `Mediana kasy na końcu: ${Math.round(median(reports.map((r) => r.final.company.finances.stanKonta))).toLocaleString('pl-PL')}`,
          ].join('\n'),
        );
 
        const groups = new Map<string, { n: number; example: string }>();
        for (const v of reports.flatMap((r) => r.violations)) {
          const key = v.replace(/\s+\[.*\]$/, '');
          const g = groups.get(key);
          if (g) g.n++;
          else groups.set(key, { n: 1, example: v });
        }
        const summary = [...groups.entries()].map(([k, g]) => `${g.n}x ${k}`);
        expect(summary).toEqual([]);
      },
      120_000,
    );
  }
 
  it('ten sam seed daje ten sam przebieg', () => {
    const a = playGame('sim-det', 3, 'random');
    const b = playGame('sim-det', 3, 'random');
    expect(JSON.stringify(a.final)).toEqual(JSON.stringify(b.final));
  });
});