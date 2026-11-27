import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  MAX_PLAYER_ALLIANCES,
  getActiveWarWith,
  getAcquisitionCost,
  getEquityBuybackCost,
  getPlayerAllies,
  getPlayerParentInfo,
  getWarActions,
  isInPlayerBranch,
} from '../../engine/competition';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { formatMoney } from '../../engine/currency';
import { scaleByInflation } from '../../engine/economy';
import type { AcquiredMode, CompetitorCharacter, Trend } from '../../engine/types';

interface CompetitorProfileProps {
  compId: string;
  onBack: () => void;
  onSelectCompany: (id: string) => void;
}

const CHARACTER_META: Record<
  CompetitorCharacter,
  { label: string; badgeClass: string; hint: string }
> = {
  aggressive: {
    label: 'Agresywny',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
    hint: 'Chętnie wywołuje wojny, częściej zdradza zgody i narzuca twarde warunki pokoju.',
  },
  neutral: {
    label: 'Neutralny',
    badgeClass: 'bg-stone-100 text-stone-800 border-stone-300',
    hint: 'Reaguje proporcjonalnie do relacji i sytuacji rynkowej.',
  },
  peaceful: {
    label: 'Pokojowy',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    hint: 'Unika konfliktów, lojalny w zgodach i łagodniejszy przy rozstrzygnięciach.',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  handel: 'Handel',
  produkcja: 'Produkcja',
  uslugi: 'Usługi',
  '*': 'Wielobranżowa',
};

const ACQUIRED_MODE_LABELS: Record<AcquiredMode, string> = {
  branch: 'Wchłonięta jako filia',
  liquidated: 'Zlikwidowana (wyprzedaż majątku)',
  subsidiary: 'Spółka zależna (dochód pasywny)',
};

function TrendMark({ t }: { t: Trend }) {
  if (t === 1) return <span title="Wzrost">⬆️</span>;
  if (t === -1) return <span title="Spadek">⬇️</span>;
  return <span title="Bez zmian" className="opacity-40">➡️</span>;
}

function opinionBadge(opinion: number): { label: string; className: string } {
  if (opinion >= 75) return { label: 'Bardzo przychylna', className: 'text-emerald-700' };
  if (opinion >= 55) return { label: 'Przychylna', className: 'text-emerald-600' };
  if (opinion >= 40) return { label: 'Neutralna', className: 'text-stone-700' };
  if (opinion >= 20) return { label: 'Niechętna', className: 'text-amber-700' };
  return { label: 'Wroga', className: 'text-red-700' };
}

export function CompetitorProfile({
  compId,
  onBack,
  onSelectCompany,
}: CompetitorProfileProps) {
  const {
    state,
    interactCompetitor,
    proposeAlliance,
    breakAlliance,
    takeAllyLoan,
    declareWar,
    performWarAction,
    surrenderWar,
    acquireCompetitor,
    buyBackEquity,
    requestParentBailout,
  } = useGameStore();

  const [showAcquirePanel, setShowAcquirePanel] = useState(false);
  const [acquireMode, setAcquireMode] = useState<AcquiredMode>('subsidiary');
  const [confirmWar, setConfirmWar] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);

  if (!state) return null;

  const comp = (state.competitors ?? []).find((c) => c.id === compId);
  if (!comp) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 px-3 py-1.5 rounded shadow-sm"
        >
          ← Powrót do rankingu
        </button>
        <div className="bg-white border rounded-lg p-6 text-stone-600">
          Nie znaleziono firmy.
        </div>
      </div>
    );
  }

  const isActive = (comp.status ?? 'active') === 'active';
  const charMeta = CHARACTER_META[comp.character ?? 'neutral'];
  const opMeta = opinionBadge(comp.opinionOfPlayer);
  const activeWar = getActiveWarWith(state, comp.id);
  const playerAllies = getPlayerAllies(state);
  const parentInfo = getPlayerParentInfo(state);
  const isOurParent = parentInfo?.parent.id === comp.id;
  const stakeInUs = (state.company.externalEquity ?? []).find((e) => e.holderId === comp.id);
  const acquisitionInfo = getAcquisitionCost(state, comp.id);
  const warActions = getWarActions();
  const sameBranch = isInPlayerBranch(state, comp);

  const compById = new Map((state.competitors ?? []).map((c) => [c.id, c]));
  const allyCompanies = (comp.allies ?? [])
    .map((id) => compById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c && c.status === 'active'));
  const rivalCompanies = (comp.rivals ?? [])
    .map((id) => compById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c && c.status === 'active'));

  const aiWarsInvolvingComp = (state.activeWars ?? []).filter(
    (w) =>
      w.attackerId !== 'player' &&
      w.defenderId !== 'player' &&
      (w.attackerId === comp.id || w.defenderId === comp.id)
  );

  const canProposeAlliance =
    isActive &&
    !comp.isAlliedWithPlayer &&
    !comp.atWarWithPlayer &&
    comp.opinionOfPlayer >= 65 &&
    playerAllies.length < MAX_PLAYER_ALLIANCES &&
    !(parentInfo && parentInfo.parent.rivals.includes(comp.id));

  const canDeclareWar =
    isActive &&
    !comp.atWarWithPlayer &&
    !(parentInfo && (parentInfo.parent.id === comp.id || parentInfo.parent.allies.includes(comp.id)));

  const allyLoanAmount = Math.max(
    scaleByInflation(50_000, state),
    Math.round(comp.value * 0.1)
  );

  const intelBonusFromComp = Math.round((Math.max(0, Math.min(100, comp.reputation)) / 100) * 6);

  const buybackStep = stakeInUs ? Math.min(25, stakeInUs.percent) : 0;
  const buybackStepCost =
    stakeInUs && buybackStep > 0 ? getEquityBuybackCost(state, comp.id, buybackStep) : 0;
  const buybackAllCost =
    stakeInUs && stakeInUs.percent > 0
      ? getEquityBuybackCost(state, comp.id, stakeInUs.percent)
      : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Górna nawigacja */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 px-3 py-1.5 rounded shadow-sm"
        >
          ← Powrót do tabeli rankingowej
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-white border border-stone-300 px-2.5 py-1 rounded font-semibold">
            Punkty interakcji: <span className="font-mono">{state.interactionPoints}</span>
          </span>
          <span className="bg-white border border-stone-300 px-2.5 py-1 rounded font-semibold">
            Sojusze: <span className="font-mono">{playerAllies.length}/{MAX_PLAYER_ALLIANCES}</span>
          </span>
        </div>
      </div>

      {/* Karta nagłówkowa firmy */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-stone-900">{comp.name}</h1>

              {!isActive && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                  {comp.status === 'bankrupt' ? '💀 Zbankrutowana' : '🏛️ Przejęta'}
                </span>
              )}
              {isActive && comp.atWarWithPlayer && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-red-600 text-white">
                  ⚔️ Stan wojny
                </span>
              )}
              {isActive && comp.isAlliedWithPlayer && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
                  🤝 Twój sojusznik
                </span>
              )}
              {isOurParent && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-purple-700 text-white">
                  👑 Twoja spółka-matka ({parentInfo?.percent}%)
                </span>
              )}
              {comp.dependentOn === 'player' && (
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-blue-600 text-white">
                  🔗 Zależna od Ciebie
                </span>
              )}
            </div>

            <p className="text-sm italic text-stone-600 mb-2">„{comp.motto}”</p>
            <p className="text-sm text-stone-700 mb-3">{comp.description}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                title={charMeta.hint}
                className={`px-2 py-0.5 rounded border font-semibold ${charMeta.badgeClass}`}
              >
                Charakter: {charMeta.label}
              </span>
              {(comp.categories ?? []).map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-700 font-medium"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
              {sameBranch && (
                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-semibold">
                  Ta sama branża
                </span>
              )}
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 min-w-[200px]">
            <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold">
              Rozmiar firmy
            </div>
            <div className="text-lg font-bold text-stone-900 mb-2">
              {COMPANY_SIZE_CONFIG[comp.size]?.label ?? comp.size}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold">
              Szacowana wartość
            </div>
            <div className="text-lg font-mono font-bold text-stone-900">
              {formatMoney(comp.value, state)} <TrendMark t={comp.trend.value} />
            </div>
          </div>
        </div>

        {/* Statystyki liczbowe */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-stone-100">
          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
            <div className="text-xs text-stone-500 uppercase font-semibold">Kondycja</div>
            <div className="text-xl font-bold text-stone-900">
              {Math.round(comp.condition)}% <TrendMark t={comp.trend.condition} />
            </div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
            <div className="text-xs text-stone-500 uppercase font-semibold">Reputacja rynkowa</div>
            <div className="text-xl font-bold text-stone-900">
              {Math.round(comp.reputation)}% <TrendMark t={comp.trend.reputation} />
            </div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
            <div className="text-xs text-stone-500 uppercase font-semibold">Opinia o Tobie</div>
            <div className={`text-xl font-bold ${opMeta.className}`}>
              {Math.round(comp.opinionOfPlayer)}%{' '}
              <span className="text-xs font-semibold">({opMeta.label})</span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL AKTYWNEJ WOJNY Z GRACZEM */}
      {isActive && activeWar && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-red-950">⚔️ Aktywna wojna biznesowa</h2>
              <p className="text-xs text-red-800">
                Pozostało tur do rozstrzygnięcia: {Math.max(1, activeWar.maxTurns - (state.turn - activeWar.startedTurn))}
              </p>
            </div>
            <div className="text-sm font-mono font-bold px-3 py-1 rounded bg-white border border-red-300 text-red-950">
              Stan wojny: {activeWar.warScore > 0 ? `+${activeWar.warScore}` : activeWar.warScore} / 100
            </div>
          </div>

          {/* Pasek stanu wojny (-100 do +100) */}
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-red-800">Przewaga {comp.name} (-100)</span>
              <span className="text-stone-500">0</span>
              <span className="text-emerald-800">Twoja przewaga (+100)</span>
            </div>
            <div className="w-full h-4 bg-stone-200 rounded-full overflow-hidden relative border border-stone-300">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600 z-10" />
              {activeWar.warScore >= 0 ? (
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{
                    marginLeft: '50%',
                    width: `${Math.min(50, activeWar.warScore / 2)}%`,
                  }}
                />
              ) : (
                <div
                  className="h-full bg-red-600 transition-all"
                  style={{
                    marginLeft: `${50 - Math.min(50, Math.abs(activeWar.warScore) / 2)}%`,
                    width: `${Math.min(50, Math.abs(activeWar.warScore) / 2)}%`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Akcje wojenne */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
            {warActions.map((act) => {
              const cost = scaleByInflation(act.baseCost, state);
              const usedThisTurn = activeWar.actionsUsedThisTurn?.includes(act.id) ?? false;
              const missingMafia = Boolean(act.requiresMafia && !state.ceo.inMafia);
              const noCash = state.company.finances.stanKonta < cost;
              const disabled =
                usedThisTurn || missingMafia || noCash || state.interactionPoints <= 0;

              return (
                <div
                  key={act.id}
                  className="bg-white border border-red-200 rounded-lg p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-stone-900">{act.label}</span>
                      <span className="text-xs font-mono font-bold text-red-900">
                        {formatMoney(cost, state)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1">{act.description}</p>
                    <div className="text-[11px] text-stone-500 mt-1.5 flex flex-wrap gap-2">
                      <span>Przewaga: ~+{act.warScoreGain}</span>
                      <span>Kondycja wroga: {act.enemyConditionDelta}</span>
                      {act.reputationEffects &&
                        Object.entries(act.reputationEffects).map(([k, v]) => (
                          <span key={k} className="text-amber-800">
                            {k}: {v && v > 0 ? `+${v}` : v}
                          </span>
                        ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => performWarAction(comp.id, act.id)}
                    className={`w-full py-1.5 px-3 rounded text-xs font-bold transition ${
                      disabled
                        ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                        : 'bg-red-700 text-white hover:bg-red-800'
                    }`}
                  >
                    {usedThisTurn
                      ? 'Użyto w tej turze'
                      : missingMafia
                        ? 'Wymaga przynależności do mafii'
                        : noCash
                          ? 'Brak środków'
                          : state.interactionPoints <= 0
                            ? 'Brak punktów interakcji'
                            : 'Wykonaj akcję (1 pkt)'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            {!confirmSurrender ? (
              <button
                type="button"
                onClick={() => setConfirmSurrender(true)}
                className="text-xs font-semibold text-red-800 hover:text-red-950 underline"
              >
                🏳️ Poddaj wojnę (kapitulacja)
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-red-300 rounded px-3 py-1.5 text-xs">
                <span className="font-semibold text-red-900">Na pewno kapitulujesz?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSurrender(false);
                    surrenderWar(comp.id);
                  }}
                  className="bg-red-700 text-white px-2.5 py-1 rounded font-bold hover:bg-red-800"
                >
                  Tak, poddaję się
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSurrender(false)}
                  className="bg-stone-200 text-stone-800 px-2.5 py-1 rounded font-semibold"
                >
                  Anuluj
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DWIE KOLUMNY: RELACJE (KOSY I ZGODY) + PRZEJĘCIA / UDZIAŁY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Kosy i zgody */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-stone-900 mb-3">Relacje na rynku (Kosy i zgody)</h2>

          <div className="mb-3">
            <div className="text-xs uppercase font-semibold text-emerald-700 mb-1.5">
              🤝 Zgody ({allyCompanies.length})
            </div>
            {allyCompanies.length === 0 ? (
              <p className="text-xs text-stone-400">Brak aktywnych zgód.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allyCompanies.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectCompany(a.id)}
                    className="text-xs px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-medium transition"
                  >
                    {a.name} →
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="text-xs uppercase font-semibold text-red-700 mb-1.5">
              🔪 Kosy ({rivalCompanies.length})
            </div>
            {rivalCompanies.length === 0 ? (
              <p className="text-xs text-stone-400">Brak otwartych kos.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {rivalCompanies.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectCompany(r.id)}
                    className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-300 text-red-900 font-medium transition"
                  >
                    {r.name} →
                  </button>
                ))}
              </div>
            )}
          </div>

          {aiWarsInvolvingComp.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <div className="text-xs uppercase font-semibold text-amber-800 mb-1">
                ⚔️ Aktywne wojny z innymi firmami
              </div>
              <ul className="space-y-1 text-xs">
                {aiWarsInvolvingComp.map((w) => {
                  const otherId = w.attackerId === comp.id ? w.defenderId : w.attackerId;
                  const other = compById.get(otherId);
                  return (
                    <li key={w.id} className="flex items-center justify-between">
                      <span>
                        Przeciwko:{' '}
                        <button
                          type="button"
                          onClick={() => onSelectCompany(otherId)}
                          className="font-semibold underline text-stone-900"
                        >
                          {other?.name ?? otherId}
                        </button>
                      </span>
                      <span className="font-mono text-stone-500">wynik: {w.warScore}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Status przejęć i udziałów */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-stone-900 mb-3">Przejęcia i zależności kapitałowe</h2>

          {/* Jeśli ta firma posiada udziały w firmie gracza */}
          {stakeInUs && stakeInUs.percent > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-xs">
              <div className="font-bold text-purple-950 mb-1">
                Ta firma posiada {stakeInUs.percent}% udziałów w Twojej firmie
              </div>
              {isOurParent && (
                <div className="mb-2">
                  <div className="text-purple-900 mb-1">
                    Irytacja centrali: <span className="font-mono font-bold">{Math.round(state.company.parentDispleasure ?? 0)} / 100</span>
                    {parentInfo?.isControlling && ' (przy 100 utrata fotela CEO)'}
                  </div>
                  <div className="w-full h-2 bg-purple-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-700"
                      style={{ width: `${Math.min(100, state.company.parentDispleasure ?? 0)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  disabled={state.company.finances.stanKonta < buybackStepCost}
                  onClick={() => buyBackEquity(comp.id, buybackStep)}
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    state.company.finances.stanKonta < buybackStepCost
                      ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                      : 'bg-purple-700 text-white hover:bg-purple-800'
                  }`}
                >
                  Odkup {buybackStep}% ({formatMoney(buybackStepCost, state)})
                </button>
                {stakeInUs.percent > buybackStep && (
                  <button
                    type="button"
                    disabled={state.company.finances.stanKonta < buybackAllCost}
                    onClick={() => buyBackEquity(comp.id, stakeInUs.percent)}
                    className={`px-2.5 py-1 rounded font-bold transition ${
                      state.company.finances.stanKonta < buybackAllCost
                        ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    Odkup całość ({formatMoney(buybackAllCost, state)})
                  </button>
                )}
                {isOurParent && (
                  <button
                    type="button"
                    onClick={() => requestParentBailout()}
                    className="px-2.5 py-1 rounded font-bold bg-white border border-purple-400 text-purple-900 hover:bg-purple-100"
                  >
                    Poproś o dokapitalizowanie (+15% udziałów dla nich)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Jeśli firma była przejęta lub zależna */}
          {comp.status === 'acquired' && (
            <div className="text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-lg p-3 mb-2">
              <div className="font-bold">
                Przejęta przez:{' '}
                {comp.acquiredBy === 'player'
                  ? 'Twoją firmę'
                  : compById.get(comp.acquiredBy ?? '')?.name ?? comp.acquiredBy}
              </div>
              {comp.acquiredMode && (
                <div className="text-stone-600 mt-0.5">
                  Tryb: {ACQUIRED_MODE_LABELS[comp.acquiredMode]}
                </div>
              )}
              {(comp.subsidiaryIncome ?? 0) > 0 && (
                <div className="text-emerald-700 font-semibold mt-1">
                  Dochód pasywny: +{formatMoney(comp.subsidiaryIncome!, state)} / kw.
                </div>
              )}
            </div>
          )}

          {comp.status === 'active' && comp.dependentOn && (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2 text-blue-950">
              Firma jest kapitałowo uzależniona od:{' '}
              <strong>
                {comp.dependentOn === 'player'
                  ? 'Twojej firmy'
                  : compById.get(comp.dependentOn)?.name ?? comp.dependentOn}
              </strong>
              {comp.dependentOn === 'player' && (comp.subsidiaryIncome ?? 0) > 0 && (
                <div className="mt-1 font-semibold text-emerald-800">
                  Płaci Ci pasywnie: +{formatMoney(comp.subsidiaryIncome!, state)} / kw.
                </div>
              )}
            </div>
          )}

          {/* Możliwość przejęcia aktywnej firmy */}
          {isActive && (
            <div className="text-xs text-stone-700">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">Szacowany koszt wykupu:</span>
                <span className="font-mono font-bold">
                  {formatMoney(acquisitionInfo.cost, state)}
                </span>
              </div>
              {!acquisitionInfo.canAcquire ? (
                <p className="text-stone-500">{acquisitionInfo.reason}</p>
              ) : (
                <div className="mt-2">
                  {!showAcquirePanel ? (
                    <button
                      type="button"
                      onClick={() => setShowAcquirePanel(true)}
                      className="w-full py-2 px-3 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold transition"
                    >
                      🏛️ Przejmij firmę ({formatMoney(acquisitionInfo.cost, state)})
                    </button>
                  ) : (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
                      <div className="font-bold text-amber-950">
                        Co zrobić z firmą po przejęciu?
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {(
                          [
                            { id: 'branch', label: 'Wchłoń jako filię (+1 filia, +6 rep. branży)' },
                            { id: 'liquidated', label: 'Zlikwiduj i wyprzedaj majątek (+45% wartości w gotówce)' },
                            { id: 'subsidiary', label: 'Spółka zależna (stały dochód pasywny co kwartał)' },
                          ] as const
                        ).map((opt) => (
                          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="acquireMode"
                              checked={acquireMode === opt.id}
                              onChange={() => setAcquireMode(opt.id)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            acquireCompetitor(comp.id, acquireMode);
                            setShowAcquirePanel(false);
                          }}
                          className="flex-1 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800"
                        >
                          Potwierdź przejęcie
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAcquirePanel(false)}
                          className="px-3 py-1.5 bg-white border border-stone-300 rounded font-semibold"
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PANEL INTERAKCJI I DYPLOMACJI (GDY FIRMA AKTYWNA I BEZ WOJNY) */}
      {isActive && !comp.atWarWithPlayer && (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-stone-900 mb-3">Interakcje i dyplomacja</h2>

          {comp.isAlliedWithPlayer && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold">🤝 Aktywny sojusz z {comp.name}</div>
                <div>
                  Cynk rynkowy od tej firmy: <strong>+{intelBonusFromComp}</strong> do dokładności przewidywań (zależne od jej reputacji {Math.round(comp.reputation)}%), rabaty zakupowe oraz niższe ryzyko kontroli Skarbówki.
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => takeAllyLoan(comp.id, allyLoanAmount)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold"
                >
                  Pożyczka po znajomości ({formatMoney(allyLoanAmount, state)})
                </button>
                <button
                  type="button"
                  onClick={() => breakAlliance(comp.id)}
                  className="px-3 py-1.5 bg-white border border-red-300 text-red-800 hover:bg-red-50 rounded font-semibold"
                >
                  Zerwij sojusz
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              disabled={state.interactionPoints <= 0}
              onClick={() => interactCompetitor(comp.id, 'positive')}
              className={`p-3 rounded-lg border text-left transition ${
                state.interactionPoints <= 0
                  ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-950'
              }`}
            >
              <div className="font-bold text-sm">🤝 Ociepl relacje (1 pkt)</div>
              <div className="text-xs opacity-80 mt-0.5">
                Poprawia ich opinię o Tobie (+10) i Twoją reputację w branży (+2).
              </div>
            </button>

            <button
              type="button"
              disabled={state.interactionPoints <= 0}
              onClick={() => interactCompetitor(comp.id, 'negative')}
              className={`p-3 rounded-lg border text-left transition ${
                state.interactionPoints <= 0
                  ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-950'
              }`}
            >
              <div className="font-bold text-sm">🎯 Sabotaż wizerunkowy (1 pkt)</div>
              <div className="text-xs opacity-80 mt-0.5">
                Próba osłabienia reputacji rywala. Ryzyko rykoszetu w Twoją reputację.
              </div>
            </button>

            {!comp.isAlliedWithPlayer && (
              <button
                type="button"
                disabled={!canProposeAlliance}
                onClick={() => proposeAlliance(comp.id)}
                className={`p-3 rounded-lg border text-left transition ${
                  !canProposeAlliance
                    ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-950'
                }`}
              >
                <div className="font-bold text-sm">📜 Zaproponuj sojusz</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {playerAllies.length >= MAX_PLAYER_ALLIANCES
                    ? `Osiągnięto limit sojuszy (${MAX_PLAYER_ALLIANCES}/${MAX_PLAYER_ALLIANCES}).`
                    : comp.opinionOfPlayer < 65
                      ? `Wymaga opinii ≥ 65% (obecnie ${Math.round(comp.opinionOfPlayer)}%).`
                      : 'Tańsze zakupy, cynk rynkowy, ochrona i wspólne wojny.'}
                </div>
              </button>
            )}

            {!confirmWar ? (
              <button
                type="button"
                disabled={!canDeclareWar}
                onClick={() => setConfirmWar(true)}
                className={`p-3 rounded-lg border text-left transition ${
                  !canDeclareWar
                    ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : 'bg-red-50 border-red-300 hover:bg-red-100 text-red-950'
                }`}
              >
                <div className="font-bold text-sm">⚔️ Wypowiedz wojnę</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {!canDeclareWar
                    ? 'Zablokowane przez spółkę-matkę.'
                    : 'Rozpoczyna wojnę z paskiem przewagi i płatnymi akcjami.'}
                </div>
              </button>
            ) : (
              <div className="p-3 rounded-lg border-2 border-red-400 bg-red-50 flex flex-col justify-between gap-2">
                <div className="text-xs font-bold text-red-950">
                  Wypowiedzieć wojnę firmie {comp.name}?
                  {comp.isAlliedWithPlayer && ' (Zdrada sojusznika — duża kara do reputacji!)'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmWar(false);
                      declareWar(comp.id);
                    }}
                    className="flex-1 py-1 bg-red-700 text-white rounded text-xs font-bold hover:bg-red-800"
                  >
                    Tak, wojna!
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWar(false)}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded text-xs font-semibold"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}