import { useGameStore } from '../../store/gameStore';
import type { ContractType } from '../../engine/types';
import { WORKER_CONFIG, ACCOUNTANT_COST } from '../../engine/constants';
import { scaleByInflation } from '../../engine/economy';
import { formatMoney } from '../../engine/currency';
import { TRADE_THROUGHPUT_CONFIG, getTradeThroughputLimit } from '../../engine/tradeHelper';

export function EmployeesScreen() {
  const { state, hireWorker, toggleAccountant } = useGameStore();
  if (!state) return null;

  const workers = state.company.employees;
  const pendingHires = state.pendingHires ?? [];
  const accountantCost = scaleByInflation(ACCOUNTANT_COST, state);
  const tradeLimit = getTradeThroughputLimit(state);

  const getEfficiency = (count: number) => Math.max(20, Math.round((1 - count * 0.05) * 100));

  const getPendingCount = (contract: ContractType) =>
    pendingHires
      .filter(h => h.contract === contract)
      .reduce((sum, h) => sum + h.count, 0);

  const totalPending = pendingHires.reduce((sum, h) => sum + h.count, 0);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold">Pracownicy</h1>
        <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right shrink-0">
          <div className="text-[10px] uppercase font-semibold text-stone-500">
            Przepustowość handlowa / kw.
          </div>
          <div className="text-sm font-bold font-mono text-stone-900">
            {tradeLimit} szt. kupna · {tradeLimit} szt. sprzedaży
          </div>
        </div>
      </div>

      <p className="text-sm text-stone-600 mb-6">
        Każdy kolejny pracownik w danej grupie pracuje z mniejszą wydajnością (prawo malejących przychodów). Pracownicy zwiększają też limit obrotu towarowego w handlu, obsadzają usługi i moce produkcyjne. Nowo zakontraktowani dołączają do załogi w <b>kolejnej turze</b>.
      </p>

      {totalPending > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-lg p-3.5 mb-5 text-xs sm:text-sm">
          ⏳ Oczekujący na rozpoczęcie pracy w następnym kwartale: <strong>+{totalPending} os.</strong>
        </div>
      )}

      {/* KSIĘGOWA */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              <span>🧮 Pani Grażyna (Księgowa)</span>
              {state.company.hasAccountant && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold">
                  Zatrudniona
                </span>
              )}
            </div>
            <div className="text-xs text-stone-600 mt-1">
              Koszt: {formatMoney(accountantCost, state)} / kwartał. Zwiększa opinię w Urzędzie Skarbowym o +3 co turę oraz poprawia dokładność wycen handlowych.
            </div>
          </div>
          <button
            onClick={toggleAccountant}
            className={`px-4 py-2 rounded text-sm font-semibold shrink-0 transition ${
              state.company.hasAccountant
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-stone-900 text-white hover:bg-stone-800'
            }`}
          >
            {state.company.hasAccountant ? 'Zwolnij' : 'Zatrudnij'}
          </button>
        </div>
      </div>

      {/* ZATRUDNIENIE ZAŁOGI */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="font-bold mb-3">Zatrudnienie</h2>
        {(['bezUmowy', 'zlecenie', 'uop'] as ContractType[]).map(c => {
          const count = workers[c];
          const pending = getPendingCount(c);
          const nextWorkerEff = getEfficiency(count + pending);
          const scaledWage = scaleByInflation(WORKER_CONFIG[c].wage, state);
          const scaledRevenue = scaleByInflation(WORKER_CONFIG[c].revenue, state);
          const throughputBonus = TRADE_THROUGHPUT_CONFIG[c];

          return (
            <div key={c} className="flex items-center justify-between p-3 border-b border-stone-100 last:border-b-0 gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  <span>
                    {c === 'bezUmowy' ? 'Bez umowy' : c === 'zlecenie' ? 'Umowa zlecenie' : 'Umowa o pracę'}
                  </span>
                  {pending > 0 && (
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                      +{pending} od nast. tury
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-600">
                  Koszt: {formatMoney(scaledWage, state)} | Baza: {formatMoney(scaledRevenue, state)} | Handel: +{throughputBonus} szt./kw.
                </div>
                <div className={`text-xs font-semibold mt-1 ${nextWorkerEff < 50 ? 'text-red-600' : 'text-green-700'}`}>
                  Wydajność kolejnego: {nextWorkerEff}%
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => hireWorker(c, -1)}
                  disabled={count === 0 && pending === 0}
                  className="w-8 h-8 rounded border bg-white hover:bg-stone-50 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-10 text-center font-mono">{count}</span>
                <button
                  onClick={() => hireWorker(c, 1)}
                  className="w-8 h-8 rounded border bg-white hover:bg-stone-50"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}