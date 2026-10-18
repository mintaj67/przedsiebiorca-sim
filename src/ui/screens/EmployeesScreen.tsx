import { useGameStore } from '../../store/gameStore';
import type { ContractType } from '../../engine/types';

export function EmployeesScreen() {
  const { state, hireWorker } = useGameStore();
  if (!state) return null;
  const workers = state.company.employees;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pracownicy</h1>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="font-bold mb-3">Zatrudnienie</h2>
        {(['bezUmowy', 'zlecenie', 'uop'] as ContractType[]).map(c => (
          <div key={c} className="flex items-center justify-between p-3 border-b border-stone-100 last:border-b-0">
            <div>
              <div className="font-semibold">{c === 'bezUmowy' ? 'Bez umowy' : c === 'zlecenie' ? 'Umowa zlecenie' : 'Umowa o pracę'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => hireWorker(c, -1)} disabled={workers[c] === 0} className="w-8 h-8 rounded border bg-white hover:bg-stone-50 disabled:opacity-30">−</button>
              <span className="w-10 text-center font-mono">{workers[c]}</span>
              <button onClick={() => hireWorker(c, 1)} className="w-8 h-8 rounded border bg-white hover:bg-stone-50">+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}