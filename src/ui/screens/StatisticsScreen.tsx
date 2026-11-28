import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatMoney } from '../../engine/currency';
import {
  getInflationRate,
  getLoanQuarterlyRate,
  scaleByInflation,
  getAggregatedFinances,
  type FinancePeriod,
} from '../../engine/economy';
import { StatBar } from '../components/StatBar';
import { WPLYWY_LABELS, WYDATKI_LABELS, REPUTATION_LABELS, REPUTATION_DESCRIPTIONS } from '../ui-labels';

const PERIOD_TABS: { id: FinancePeriod; label: string }[] = [
  { id: 'quarter', label: 'Kwartał' },
  { id: 'year', label: 'Rok (4 kw.)' },
  { id: 'all', label: 'Całokształt' },
];

export function StatisticsScreen() {
  const { state, takeLoan } = useGameStore();
  const showHidden = useSettingsStore(s => s.showHiddenStats);
  const [period, setPeriod] = useState<FinancePeriod>('quarter');

  if (!state) return null;
  const f = state.company.finances;
  const r = state.company.reputation;
  const agg = getAggregatedFinances(state, period);

  const inflationRate = getInflationRate(state);
  const bankRatePct = (getLoanQuarterlyRate('bank', inflationRate) * 100).toFixed(1);
  const greyRatePct = (getLoanQuarterlyRate('szara_strefa', inflationRate) * 100).toFixed(1);
  const loanAmount = scaleByInflation(20000, state);

  const visibleRep: (keyof typeof r)[] = [
    'branza',
    'opiniaPubliczna',
    'opiniaBranza',
    'opiniaPracownicy',
  ];
  const hiddenRep: (keyof typeof r)[] = [
    'opiniaMafia',
    'opiniaMedia',
    'opiniaPolitycy',
    'opiniaSkarbowa',
    'dokladnoscPrzewidywan',
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Statystyki Firmy</h1>

      {/* FINANSE */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Finanse</h2>
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Bieżący stan konta</p>
            <p className="text-2xl font-mono font-bold">{formatMoney(f.stanKonta, state)}</p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <div className="inline-flex bg-white border border-stone-300 rounded-lg p-1 shadow-sm">
              {PERIOD_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    period === tab.id
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-stone-500">{agg.periodLabel}</span>
          </div>
        </div>

        {/* Podsumowanie wybranego przedziału */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-3.5">
            <div className="text-[11px] uppercase font-semibold text-stone-500">Suma wpływów</div>
            <div className="text-lg font-mono font-bold text-green-800">
              {formatMoney(agg.totalWplywy, state)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-3.5">
            <div className="text-[11px] uppercase font-semibold text-stone-500">Suma wydatków</div>
            <div className="text-lg font-mono font-bold text-red-800">
              {formatMoney(agg.totalWydatki, state)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-3.5">
            <div className="text-[11px] uppercase font-semibold text-stone-500">Bilans okresu</div>
            <div
              className={`text-lg font-mono font-bold ${
                agg.netBalance > 0
                  ? 'text-green-700'
                  : agg.netBalance < 0
                    ? 'text-red-700'
                    : 'text-stone-700'
              }`}
            >
              {formatMoney(agg.netBalance, state, { signed: true })}
            </div>
          </div>
        </div>

        {period !== 'all' && agg.hasCurrentTurnActivity && (f.history?.length ?? 0) > 0 && (
          <p className="text-xs text-stone-500 mb-4">
            ℹ Operacje z trwającej tury ({state.year} Q{state.quarter}: wpływy{' '}
            <span className="font-mono">{formatMoney(agg.currentTurnWplywy, state)}</span>, wydatki{' '}
            <span className="font-mono">{formatMoney(agg.currentTurnWydatki, state)}</span>) trafią do raportu po zamknięciu kwartału (widoczne od razu w zakładce <b>Całokształt</b>).
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-green-800">Wpływy</h3>
              <span className="text-xs font-mono font-bold text-green-800">
                {formatMoney(agg.totalWplywy, state)}
              </span>
            </div>
            {Object.entries(agg.wplywy).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5 last:border-b-0">
                <span className="text-stone-700">{WPLYWY_LABELS[k] ?? k}</span>
                <span className="font-mono">{formatMoney(v as number, state)}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-red-800">Wydatki</h3>
              <span className="text-xs font-mono font-bold text-red-800">
                {formatMoney(agg.totalWydatki, state)}
              </span>
            </div>
            {Object.entries(agg.wydatki).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5 last:border-b-0">
                <span className="text-stone-700">{WYDATKI_LABELS[k] ?? k}</span>
                <span className="font-mono">{formatMoney(v as number, state)}</span>
              </div>
            ))}
          </div>
        </div>

        <h3 className="font-bold mb-1">Kredyty</h3>
        <p className="text-xs text-stone-500 mb-3">
          Oprocentowanie nowych pożyczek zależy od bieżącej inflacji ({inflationRate.toFixed(1)}% r/r).
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => takeLoan('bank', loanAmount)}
            className="border px-4 py-2 rounded bg-white hover:bg-stone-50"
          >
            Kredyt bankowy (+{formatMoney(loanAmount, state)}, {bankRatePct}% / kw.)
          </button>
          <button
            onClick={() => takeLoan('szara_strefa', loanAmount)}
            className="border px-4 py-2 rounded bg-white hover:bg-stone-50"
          >
            Kredyt z szarej strefy (+{formatMoney(loanAmount, state)}, {greyRatePct}% / kw.)
          </button>
        </div>
        {state.company.loans.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h4 className="font-semibold mb-3">Aktywne kredyty i zobowiązania</h4>
            {state.company.loans.map(loan => (
              <div key={loan.id} className="text-sm border-b border-stone-100 py-1.5 flex justify-between gap-4 last:border-b-0">
                <span>
                  {loan.source === 'bank'
                    ? 'Bank'
                    : loan.source === 'zakup_raty'
                      ? 'Zakup na raty'
                      : loan.source === 'sojusznik'
                        ? 'Pożyczka od sojusznika'
                        : 'Szara strefa'}
                  {loan.interestRate > 0 ? ` (${(loan.interestRate * 100).toFixed(1)}%/kw.)` : ''}
                </span>
                <span className="font-mono">
                  Pozostało: {formatMoney(loan.remaining, state)} ({loan.quartersLeft} kw.)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* REPUTACJA */}
      <section>
        <h2 className="text-xl font-bold mb-1">Reputacja</h2>
        <p className="text-sm text-stone-600 mb-4">
          Reputacja ogólna: <b>{Math.round(r.ogolna)}%</b>
        </p>

        <h3 className="font-bold mb-3 text-stone-800">Widoczne statystyki</h3>
        <div className="grid gap-4 mb-8">
          {visibleRep.map(k => (
            <div key={k} className="bg-white rounded-lg shadow-sm p-4">
              <StatBar label={REPUTATION_LABELS[k] ?? k} value={r[k] ?? 50} />
              <p className="text-xs text-stone-500 mt-2">{REPUTATION_DESCRIPTIONS[k]}</p>
            </div>
          ))}
        </div>

        <h3 className="font-bold mb-3 text-stone-800">Statystyki ukryte</h3>
        <p className="text-xs text-stone-600 mb-3">
          {showHidden
            ? 'Tryb debugowania: widzisz dokładne wartości.'
            : 'Nie widzisz dokładnych wartości — tylko przybliżony stan. Wpływają na reputację ogólną oraz dokładność szacunków.'}
        </p>
        <div className="grid gap-4">
          {hiddenRep.map(k => (
            <div key={k} className="bg-white rounded-lg shadow-sm p-4">
              <StatBar label={REPUTATION_LABELS[k] ?? k} value={r[k] ?? 50} hidden={!showHidden} />
              <p className="text-xs text-stone-500 mt-2">{REPUTATION_DESCRIPTIONS[k]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}