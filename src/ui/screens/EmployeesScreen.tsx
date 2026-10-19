import { useGameStore } from '../../store/gameStore';
import type { ContractType } from '../../engine/types';
import { WORKER_CONFIG } from '../../engine/constants';

export function EmployeesScreen() {
  const { state, hireWorker } = useGameStore();
  if (!state) return null;
  const workers = state.company.employees;

  const getEfficiency = (count: number) => Math.max(20, Math.round((1 - (count * 0.05)) * 100));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Pracownicy</h1>
      <p className="text-sm text-stone-600 mb-6">
        Każdy kolejny pracownik w danej grupie pracuje z mniejszą wydajnością (prawo malejących przychodów).
      </p>
      
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="font-bold mb-3">Zatrudnienie</h2>
        {(['bezUmowy', 'zlecenie', 'uop'] as ContractType[]).map(c => {
          const count = workers[c];
          const nextWorkerEff = getEfficiency(count);
          
          return (
            <div key={c} className="flex items-center justify-between p-3 border-b border-stone-100 last:border-b-0">
              <div>
                <div className="font-semibold">
                  {c === 'bezUmowy' ? 'Bez umowy' : c === 'zlecenie' ? 'Umowa zlecenie' : 'Umowa o pracę'}
                </div>
                <div className="text-xs text-stone-600">
                  Koszt: {WORKER_CONFIG[c].wage} PLN | Baza: {WORKER_CONFIG[c].revenue} PLN
                </div>
                <div className={`text-xs font-semibold mt-1 ${nextWorkerEff < 50 ? 'text-red-600' : 'text-green-700'}`}>
                  Wydajność kolejnego: {nextWorkerEff}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => hireWorker(c, -1)} disabled={count === 0} className="w-8 h-8 rounded border bg-white hover:bg-stone-50 disabled:opacity-30">−</button>
                <span className="w-10 text-center font-mono">{count}</span>
                <button onClick={() => hireWorker(c, 1)} className="w-8 h-8 rounded border bg-white hover:bg-stone-50">+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}