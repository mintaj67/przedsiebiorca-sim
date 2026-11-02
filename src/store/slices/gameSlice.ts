import type { StateCreator } from 'zustand';
import type { ContractType, GameState, Pace } from '../../engine/types';
import {
  nextTurn,
  consumeActivity as consumeActivityEngine,
  resolveEventChoice,
  dismissConsequence,
} from '../../engine/turn';
import {
  applyHire,
  applyLoan,
  applyChangeActivity,
  applyJoinParty,
  applyLeaveParty,
  applyEmergencyLoan,
  applySetPace,
  toggleAccountant,
  changeCompanySize as changeCompanySizeEngine,
  buildBranch as buildBranchEngine,
  buyResource as buyResourceEngine,
  sellResource as sellResourceEngine,
  buyAd as buyAdEngine,
  buyGoods as buyGoodsEngine,
  sellGoods as sellGoodsEngine,
  resolveComplaint as resolveComplaintEngine,
  rentWarehouse as rentWarehouseEngine,
} from '../../engine/actions';
import { autosave } from '../autosave';

// Typy argumentów handlu bierzemy prosto z silnika, zamiast `any`.
type Supplier = Parameters<typeof buyGoodsEngine>[1];
type Buyer = Parameters<typeof sellGoodsEngine>[1];

export interface GameSlice {
  doTurn: () => void;
  consumeActivity: (activityId: string) => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  dismissConsequence: () => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  changeActivity: (activity: string) => void;
  takeEmergencyLoan: () => void;
  hireWorker: (contract: ContractType, delta: number) => void;
  takeLoan: (source: 'bank' | 'szara_strefa', amount: number) => void;
  setPace: (pace: Pace) => void;
  toggleAccountant: () => void;
  dismissElection: () => void;
  dismissPresidentialResult: () => void;
  changeCompanySize: (direction: 'up' | 'down') => void;
  buildBranch: () => void;
  buyResource: (resId: string, amount: number, basePrice: number) => void;
  sellResource: (resId: string, amount: number, basePrice: number) => void;
  buyAd: (type: 'radio' | 'tv' | 'internet') => void;
  buyGoods: (supplier: Supplier, amount: number) => void;
  sellGoods: (buyer: Buyer, resId: string, amount: number, baseValue: number) => void;
  resolveComplaint: (id: string, accept: boolean) => void;
  rentWarehouse: () => void;
}

interface CommitOptions {
  /** Akcje „zamykające okienka” mają działać także po końcu gry. */
  allowAfterGameOver?: boolean;
}

export const createGameSlice: StateCreator<any, [], [], GameSlice> = (set, get) => {
  /**
   * Jedyne miejsce, które: pobiera stan, blokuje akcje po końcu gry,
   * odpala funkcję silnika, zapisuje stan w store i robi autosave.
   */
  const commit = (fn: (s: GameState) => GameState, opts: CommitOptions = {}) => {
    const s: GameState | null = get().state;
    if (!s) return;
    if (s.gameOver && !opts.allowAfterGameOver) return;

    const next = fn(s);
    if (next === s) return; // nic się nie zmieniło — bez zbędnego zapisu

    // Najpierw stan, potem zapis: błąd localStorage (np. pełny) nie może zgubić akcji gracza.
    set({ state: next, savesVersion: Date.now() });
    try {
      autosave(next, get().currentSlotId);
    } catch (err) {
      console.error('[autosave] zapis nie powiódł się:', err);
    }
  };

  return {
    // --- Tura ---
    doTurn: () => commit(nextTurn),
    consumeActivity: (id) => commit((s) => consumeActivityEngine(s, id)),
    resolveEvent: (eventId, choiceId) => commit((s) => resolveEventChoice(s, eventId, choiceId)),
    dismissConsequence: () => commit(dismissConsequence, { allowAfterGameOver: true }),

    // --- Polityka ---
    joinParty: (partyId) => commit((s) => applyJoinParty(s, partyId)),
    leaveParty: () => commit(applyLeaveParty),
    dismissElection: () =>
      commit((s) => ({ ...s, lastElectionResult: null }), { allowAfterGameOver: true }),
    dismissPresidentialResult: () =>
      commit((s) => ({ ...s, lastPresidentialResult: null }), { allowAfterGameOver: true }),

    // --- Firma ---
    changeActivity: (activity) => commit((s) => applyChangeActivity(s, activity)),
    hireWorker: (contract, delta) => commit((s) => applyHire(s, contract, delta)),
    setPace: (pace) => commit((s) => applySetPace(s, pace)),
    toggleAccountant: () => commit(toggleAccountant),
    changeCompanySize: (direction) => commit((s) => changeCompanySizeEngine(s, direction)),
    buildBranch: () => commit(buildBranchEngine),
    buyAd: (type) => commit((s) => buyAdEngine(s, type)),

    // --- Finanse ---
    takeEmergencyLoan: () => commit(applyEmergencyLoan),
    takeLoan: (source, amount) => commit((s) => applyLoan(s, source, amount)),

    // --- Handel ---
    buyResource: (resId, amount, price) => commit((s) => buyResourceEngine(s, resId, amount, price)),
    sellResource: (resId, amount, price) => commit((s) => sellResourceEngine(s, resId, amount, price)),
    buyGoods: (supplier, amount) => commit((s) => buyGoodsEngine(s, supplier, amount)),
    sellGoods: (buyer, resId, amount, baseValue) =>
      commit((s) => sellGoodsEngine(s, buyer, resId, amount, baseValue)),
    resolveComplaint: (id, accept) => commit((s) => resolveComplaintEngine(s, id, accept)),
    rentWarehouse: () => commit(rentWarehouseEngine),
  };
};
