import { useGameStore } from '../../store/gameStore';
import { WPLYWY_LABELS, WYDATKI_LABELS } from '../ui-labels';

export function FinanceScreen() {
  const { state, takeLoan } = useGameStore();
  if (!state) return null;
  
  const f = state.company.finances;

  // Zabezpieczenie na wypadek, gdyby stare zapisy nie miały tych pól
  const wplywy = f.wplywy || {};
  const wydatki = f.wydatki || {};

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Finanse</h1>
      <p className="text-3xl font-mono mb-6">{f.stateKonta.toLocaleString('pl-PL')} PLN</p>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-bold mb-3 text-green-800">Wpływy</h2>
          {Object.entries(wplywy).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
              <span className="text-stone-700">{WPLYWY_LABELS?.[k] ?? k}</span>
              <span className="font-mono">{Number(v).toLocaleString('pl-PL')}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-bold mb-3 text-red-800">Wydatki</h2>
          {Object.entries(wydatki).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
              <span className="text-stone-700">{WYDATKI_LABELS?.[k] ?? k}</span>
              <span className="font-mono">{Number(v).toLocaleString('pl-PL')}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="font-bold mb-3">Kredyty</h2>
      <div className="flex gap-2 mb-6">
        <button onClick={() => takeLoan('bank', 20000)} className="border px-4 py-2 rounded bg-white hover:bg-stone-50">Kredyt bankowy (+20 000 PLN, 3%)</button>
        <button onClick={() => takeLoan('szara_strefa', 20000)} className="border px-4 py-2 rounded bg-white hover:bg-stone-50">Kredyt z szarej strefy (+20 000 PLN, 7%)</button>
      </div>

      {state.company.loans && state.company.loans.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3">Aktywne kredyty</h3>
          {state.company.loans.map(loan => (
            <div key={loan.id} className="text-sm border-b border-stone-100 py-1.5 flex justify-between last:border-b-0">
              <span>{loan.source === 'bank' ? 'Bank' : 'Szara strefa'}</span>
              <span>Pozostało: {Math.round(loan.remaining).toLocaleString('pl-PL')} PLN</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}