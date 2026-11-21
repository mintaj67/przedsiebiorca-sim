import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatMoney } from '../../engine/currency';
import { getInflationRate, getLoanQuarterlyRate, scaleByInflation } from '../../engine/economy';
import { StatBar } from '../components/StatBar';
import { WPLYWY_LABELS, WYDATKI_LABELS, REPUTATION_LABELS, REPUTATION_DESCRIPTIONS } from '../ui-labels';

export function StatisticsScreen() {
  const { state, takeLoan } = useGameStore();
  const showHidden = useSettingsStore(s => s.showHiddenStats);

  if (!state) return null;
  const f = state.company.finances;
  const r = state.company.reputation;

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
        <h2 className="text-xl font-bold mb-1">Finanse</h2>
        <p className="text-2xl font-mono mb-4">{formatMoney(f.stanKonta, state)}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-bold mb-3 text-green-800">Wpływy</h3>
            {Object.entries(f.wplywy).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
                <span className="text-stone-700">{WPLYWY_LABELS[k] ?? k}</span>
                <span className="font-mono">{formatMoney(v as number, state)}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-bold mb-3 text-red-800">Wydatki</h3>
            {Object.entries(f.wydatki).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
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