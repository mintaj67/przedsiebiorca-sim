import { useGameStore } from '../../store/gameStore';
import type { ContractType } from '../../engine/types';
import { Wplywy_LABELS, Wydatki_LABELS } from '../Labels';
import { WORKER_CONFIG } from '../../engine/constants';

const CONTRACTS: { id: ContractType; label: string; wage: number; revenue: number; note: string }[] = [
  { id: 'bezUmowy', label: WORKER_CONFIG.bezUmowy.label, wage: WORKER_CONFIG.bezUmowy.wage, revenue: WORKER_CONFIG.bezUmowy.revenue, note: 'Łatwo zwolnić, słabe zyski' },
  { id: 'zlecenie', label: WORKER_CONFIG.zlecenie.label, wage: WORKER_CONFIG.zlecenie.wage, revenue: WORKER_CONFIG.zlecenie.revenue, note: 'Łatwo zwolnić, średnie zyski' },
  { id: 'uop', label: WORKER_CONFIG.uop.label, wage: WORKER_CONFIG.uop.wage, revenue: WORKER_CONFIG.uop.revenue, note: `Wysokie zyski, odprawa ${WORKER_CONFIG.uop.severance} PLN przy zwolnieniu` },
];


export function FinanceScreen() {
  const { state, hireWorker, takeLoan, toggleAccountant } = useGameStore();
  if (!state) return null;
  const f = state.company.finances;
  const workers = state.company.employees;
 const totalWages =
  workers.bezUmowy * WORKER_CONFIG.bezUmowy.wage +
  workers.zlecenie * WORKER_CONFIG.zlecenie.wage +
  workers.uop * WORKER_CONFIG.uop.wage;
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Finanse</h1>
      <p className="text-3xl font-mono mb-6">{f.stateKonta.toLocaleString('pl-PL')} PLN</p>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-bold mb-3 text-green-800">Wpływy</h2>
          {Object.entries(f.Wplywy).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
              <span className="text-stone-700">{Wplywy_LABELS[k] ?? k}</span>
              <span className="font-mono">{v.toLocaleString('pl-PL')}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-bold mb-3 text-red-800">Wydatki</h2>
          {Object.entries(f.Wydatki).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
              <span className="text-stone-700">{Wydatki_LABELS[k] ?? k}</span>
              <span className="font-mono">{v.toLocaleString('pl-PL')}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="font-bold mb-3">Zatrudnienie</h2>
      <p className="text-sm text-stone-600 mb-3">
        Łączne koszty pracowników: <b>{totalWages.toLocaleString('pl-PL')} PLN / kwartał</b>
      </p>
      <div className="bg-white rounded-lg shadow-sm mb-8">
        {CONTRACTS.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3 border-b border-stone-100 last:border-b-0">
            <div>
              <div className="font-semibold">{c.label}</div>
              <div className="text-xs text-stone-600">{c.wage} PLN / kwartał za osobę</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => hireWorker(c.id, -1)}
                disabled={workers[c.id] === 0}
                className="w-8 h-8 rounded border bg-white hover:bg-stone-50 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-10 text-center font-mono">{workers[c.id]}</span>
              <button
                onClick={() => hireWorker(c.id, 1)}
                className="w-8 h-8 rounded border bg-white hover:bg-stone-50"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* KSIĘGOWA */}
      <h2 className="font-bold mb-3 mt-6">Księgowość</h2>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-8 flex justify-between items-center">
        <div>
          <div className="font-semibold">
            Pani Grażyna (Księgowa)
            {state.company.hasAccountant && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Zatrudniona</span>}
          </div>
          <div className="text-xs text-stone-600 mt-1">
            Koszt: 3 000 PLN / kwartał. Zwiększa opinię w Urzędzie Skarbowym o +3 co turę.
          </div>
        </div>
        <button
          onClick={toggleAccountant}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            state.company.hasAccountant 
              ? 'bg-red-100 text-red-800 hover:bg-red-200' 
              : 'bg-stone-900 text-white hover:bg-stone-800'
          }`}
        >
          {state.company.hasAccountant ? 'Zwolnij' : 'Zatrudnij'}
        </button>
      </div>      

      <h2 className="font-bold mb-3">Kredyty</h2>
      <p className="text-sm text-stone-600 mb-3">
        Bank wymaga dobrej reputacji ogólnej. Szara strefa — dobrej opinii u mafii.
      </p>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => takeLoan('bank', 20000)}
          className="border px-4 py-2 rounded bg-white hover:bg-stone-50"
        >
          Kredyt bankowy (+20 000 PLN, 3%)
        </button>
        <button
          onClick={() => takeLoan('szara_strefa', 20000)}
          className="border px-4 py-2 rounded bg-white hover:bg-stone-50"
        >
          Kredyt z szarej strefy (+20 000 PLN, 7%)
        </button>
      </div>

      {state.company.loans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Aktywne kredyty</h3>
          {state.company.loans.map(loan => (
            <div key={loan.id} className="text-sm border-b border-stone-100 py-1.5 flex justify-between last:border-b-0">
              <span>{loan.source === 'bank' ? 'Bank' : 'Szara strefa'}</span>
              <span>
                Pozostało: {Math.round(loan.remaining).toLocaleString('pl-PL')} PLN ·
                jeszcze {loan.quartersLeft} kw.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}