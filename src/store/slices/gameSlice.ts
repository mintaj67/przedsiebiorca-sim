import type { StateCreator } from 'zustand';
import type {
  ContractType,
  GameState,
  Pace,
  InstallmentOption,
  TradeSupplier,
  TradeBuyer,
} from '../../engine/types';
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
  buyOfficeItem as buyOfficeItemEngine,
  toggleAccountant,
  changeCompanySize as changeCompanySizeEngine,
  buildBranch as buildBranchEngine,
  buyAd as buyAdEngine,
  rentWarehouse as rentWarehouseEngine,
  buyGoods as buyGoodsEngine,
  sellGoods as sellGoodsEngine,
  resolveComplaint as resolveComplaintEngine,
} from '../../engine/actions';
import { interactWithCompetitor as interactWithCompetitorEngine } from '../../engine/competition';
import { autosave } from '../autosave';

export interface GameSlice {
  doTurn: () => void;
  consumeActivity: (activityId: string) => void;
  resolveEvent: (eventId: string, choiceId: string) => void;
  dismissConsequence: () => void;
  dismissIntro: () => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  changeActivity: (activity: string) => void;
  takeEmergencyLoan: () => void;
  hireWorker: (contract: ContractType, delta: number) => void;
  takeLoan: (source: 'bank' | 'szara_strefa', amount: number) => void;
  setPace: (pace: Pace) => void;
  buyOfficeItem: (itemId: string, price: number) => void;
  toggleAccountant: () => void;
  dismissElection: () => void;
  dismissPresidentialResult: () => void;
  changeCompanySize: (direction: 'up' | 'down') => void;
  buildBranch: () => void;
  buyAd: (type: 'radio' | 'tv' | 'internet') => void;
  rentWarehouse: () => void;
  buyGoods: (supplier: TradeSupplier, amount: number, installments?: InstallmentOption) => void;
  sellGoods: (
    buyer: TradeBuyer,
    resId: string,
    amount: number,
    unitPrice: number,
    installments?: InstallmentOption
  ) => void;
  resolveComplaint: (id: string, accept: boolean) => void;
  interactCompetitor: (compId: string, type: 'positive' | 'negative') => void;
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

    set({ state: next, savesVersion: Date.now() });
    try {
      autosave(next, get().currentSlotId);
    } catch (err) {
      console.error('[autosave] zapis nie powiódł się:', err);
    }
  };

  return {
    // --- Tura i Okna ---
    doTurn: () => commit(nextTurn),
    consumeActivity: (id) => commit((s) => consumeActivityEngine(s, id)),
    resolveEvent: (eventId, choiceId) => commit((s) => resolveEventChoice(s, eventId, choiceId)),
    dismissConsequence: () => commit(dismissConsequence, { allowAfterGameOver: true }),
    dismissIntro: () => commit((s) => ({ ...s, showIntro: false }), { allowAfterGameOver: true }),

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
    buyOfficeItem: (itemId, price) => commit((s) => buyOfficeItemEngine(s, itemId, price)),
    toggleAccountant: () => commit(toggleAccountant),
    changeCompanySize: (direction) => commit((s) => changeCompanySizeEngine(s, direction)),
    buildBranch: () => commit(buildBranchEngine),
    buyAd: (type) => commit((s) => buyAdEngine(s, type)),
    rentWarehouse: () => commit(rentWarehouseEngine),

    // --- Finanse ---
    takeEmergencyLoan: () => commit(applyEmergencyLoan),
    takeLoan: (source, amount) => commit((s) => applyLoan(s, source, amount)),

    // --- Handel i Konkurencja ---
    buyGoods: (supplier, amount, installments = 1) =>
      commit((s) => buyGoodsEngine(s, supplier, amount, installments)),
    sellGoods: (buyer, resId, amount, unitPrice, installments = 1) =>
      commit((s) => sellGoodsEngine(s, buyer, resId, amount, unitPrice, installments)),
    resolveComplaint: (id, accept) => commit((s) => resolveComplaintEngine(s, id, accept)),
    interactCompetitor: (compId, type) =>
      commit((s) => interactWithCompetitorEngine(s, compId, type)),
  };
};