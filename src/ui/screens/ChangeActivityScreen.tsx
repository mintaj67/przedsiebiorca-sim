import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ACTIVITY_CHANGE_COOLDOWN, COMPANY_EXPANSION_CONFIG, BRANCH_COST, COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { makeRng } from '../../engine/rng';
import branchesData from '../../data/branches.json';
import type { ActivityCategory, CompanySize } from '../../engine/types';

interface ChangeActivityScreenProps {
  onNavigateToBuy?: () => void;
  onNavigateToSell?: () => void;
}

export function ChangeActivityScreen({ onNavigateToBuy, onNavigateToSell }: ChangeActivityScreenProps) {
  const { 
    state, changeActivity, changeCompanySize, buildBranch, 
    resolveComplaint, buyAd
  } = useGameStore();
  
  if (!state) return null;

  const sizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'very_large', 'corporation'];
  const currentSizeIndex = sizes.indexOf(state.company.size);
  const nextSize = sizes[currentSizeIndex + 1];
  const nextConfig = nextSize ? COMPANY_EXPANSION_CONFIG[nextSize] : null;

  const canChange = state.turn - state.company.lastActivityChangeTurn >= ACTIVITY_CHANGE_COOLDOWN;

  const visibleActivities = useMemo(() => {
    const categories = branchesData as ActivityCategory[];
    const rng = makeRng(state.seed, state.turn + 50);
    const mainCat = rng.pick(categories);
    const mainChoices = [...mainCat.activities].sort(() => rng.next() - 0.5).slice(0, 3);
    const otherActivities = categories.filter(c => c.id !== mainCat.id).flatMap(c => c.activities);
    const extraCount = state.company.inventory.includes('komputer') ? 2 : 1;
    const extraChoices = [...otherActivities].sort(() => rng.next() - 0.5).slice(0, extraCount);
    return [...mainChoices, ...extraChoices].sort(() => rng.next() - 0.5);
  }, [state.seed, state.turn, state.company.inventory]);

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity = state.company.warehouseCapacity || COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity || 50;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Zarządzanie Działalnością</h1>

      {/* REKLAMACJE */}
      {state.pendingComplaints?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-800 mb-2">⚠ Reklamacje klientów</h2>
          <div className="space-y-2">
            {state.pendingComplaints.map((comp: any) => (
              <div key={comp.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded shadow-sm gap-3">
                <div>
                  <div className="font-semibold text-sm">{comp.buyerName} zwraca towar</div>
                  <div className="text-xs text-stone-500">Zbyt niska jakość. Żądają zwrotu pieniędzy.</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resolveComplaint(comp.id, true)} className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded text-xs font-semibold">Uznaj (-5k PLN)</button>
                  <button onClick={() => resolveComplaint(comp.id, false)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded text-xs font-semibold">Odrzuć (-{comp.penalty} rep.)</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODUŁ HANDLU (PRZEJŚCIE DO KUPUJ / SPRZEDAWAJ) */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-blue-600">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold">Dział Handlowy i Magazyn</h2>
            <p className="text-sm text-stone-600">
              Stan magazynu: <strong>{currentStock} / {capacity} szt.</strong> (Pojemność zależy od rozmiaru firmy).
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={onNavigateToBuy}
              className="flex-1 md:flex-initial px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded shadow transition text-sm flex items-center justify-center gap-2"
            >
              🛒 KUPUJ
            </button>
            <button
              onClick={onNavigateToSell}
              className="flex-1 md:flex-initial px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded shadow transition text-sm flex items-center justify-center gap-2"
            >
              💰 SPRZEDAWAJ
            </button>
          </div>
        </div>
      </div>

      {/* ROZMIAR FIRMY I FILIE */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-stone-900">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold">Rozmiar: {COMPANY_SIZE_CONFIG[state.company.size]?.label}</h2>
            <p className="text-sm text-stone-600">Filie: {state.company.branches}</p>
          </div>
          <div className="flex gap-2">
            {currentSizeIndex > 0 && (
              <button onClick={() => changeCompanySize('down')} className="px-4 py-2 border border-red-200 text-red-700 bg-red-50 rounded hover:bg-red-100 transition text-sm font-semibold">Zmniejsz</button>
            )}
            {nextConfig && (
              <button onClick={() => changeCompanySize('up')} disabled={state.company.finances.stanKonta < nextConfig.cost} className="px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800 transition text-sm font-semibold disabled:opacity-50">
                Zwiększ na {COMPANY_SIZE_CONFIG[nextSize]?.label} ({nextConfig.cost.toLocaleString()} PLN)
              </button>
            )}
          </div>
        </div>
        {['large', 'very_large', 'corporation'].includes(state.company.size) && (
          <div className="border-t border-stone-200 pt-4 mt-2 flex justify-between items-center">
            <div><h3 className="font-bold text-sm">Ekspansja (Filie)</h3></div>
            <button onClick={buildBranch} disabled={state.company.finances.stanKonta < BRANCH_COST} className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-xs font-semibold disabled:opacity-50">Zbuduj filię ({BRANCH_COST.toLocaleString()} PLN)</button>
          </div>
        )}
      </div>

      {/* REKLAMY */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Kampanie Reklamowe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={() => buyAd('radio')} disabled={state.company.finances.stanKonta < 5000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">📻 Radio</span><span className="text-xs text-stone-500">5 000 PLN</span></button>
          <button onClick={() => buyAd('internet')} disabled={state.company.finances.stanKonta < 15000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">🌐 Internet</span><span className="text-xs text-stone-500">15 000 PLN</span></button>
          <button onClick={() => buyAd('tv')} disabled={state.company.finances.stanKonta < 50000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">📺 Telewizja</span><span className="text-xs text-stone-500">50 000 PLN</span></button>
        </div>
      </div>

      {/* ZMIANA BRANŻY */}
      <h2 className="text-xl font-bold mb-2">Zmiana profilu działalności</h2>
      <div className="space-y-2">
        {visibleActivities.map(a => {
          const isCurrent = state.company.activity === a.id;
          return (
            <div key={a.id} className={`flex justify-between items-center p-3 rounded border ${isCurrent ? 'bg-amber-50 border-amber-300' : 'bg-white'}`}>
              <div>
                <span className="font-semibold">{a.name}</span>
                {isCurrent && <span className="ml-2 text-xs bg-amber-200 px-2 py-0.5 rounded">Aktualna</span>}
              </div>
              <button onClick={() => changeActivity(a.id)} disabled={isCurrent || !canChange} className="px-3 py-1 bg-stone-800 text-white text-xs rounded hover:bg-stone-700 disabled:opacity-50">
                Wybierz
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
