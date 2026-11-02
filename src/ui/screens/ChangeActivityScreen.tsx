import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ACTIVITY_CHANGE_COOLDOWN, COMPANY_EXPANSION_CONFIG, BRANCH_COST, COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { makeRng } from '../../engine/rng';
import branchesData from '../../data/branches.json';
import tradeData from '../../data/trade_data.json';
import type { ActivityCategory, CompanySize } from '../../engine/types';

export function ChangeActivityScreen() {
  const { 
    state, changeActivity, changeCompanySize, buildBranch, 
    buyGoods, sellGoods, resolveComplaint, buyAd, rentWarehouse
  } = useGameStore();
  
  if (!state) return null;

  const sizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'very_large', 'corporation'];
  const currentSizeIndex = sizes.indexOf(state.company.size);
  const nextSize = sizes[currentSizeIndex + 1];
  const nextConfig = nextSize ? COMPANY_EXPANSION_CONFIG[nextSize] : null;

  const currentTrade = (tradeData as any).odziez;

  const { suppliers, buyers } = useMemo(() => {
    const rng = makeRng(state.seed, state.turn + 77);
    const validSuppliers = currentTrade.suppliers.filter((s: any) => {
      if (s.req.minRepBranza && state.company.reputation.opiniaBranza < s.req.minRepBranza) return false;
      if (s.req.minRepMafia && state.company.reputation.opiniaMafia < s.req.minRepMafia) return false;
      return true;
    });
    const validBuyers = currentTrade.buyers.filter((b: any) => {
      if (b.req.minRepPubliczna && state.company.reputation.opiniaPubliczna < b.req.minRepPubliczna) return false;
      return true;
    });
    return {
      suppliers: [...validSuppliers].sort(() => rng.next() - 0.5).slice(0, 3),
      buyers: [...validBuyers].sort(() => rng.next() - 0.5).slice(0, 3)
    };
  }, [state.seed, state.turn, state.company.reputation]);

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

  // Obliczanie pojemności magazynu
  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity = state.company.warehouseCapacity || 50;
  const isFull = currentStock >= capacity;

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
              <button onClick={() => changeCompanySize('up')} disabled={state.company.finances.stateKonta < nextConfig.cost} className="px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800 transition text-sm font-semibold disabled:opacity-50">
                Zwiększ na {COMPANY_SIZE_CONFIG[nextSize]?.label} ({nextConfig.cost.toLocaleString()} PLN)
              </button>
            )}
          </div>
        </div>
        {['large', 'very_large', 'corporation'].includes(state.company.size) && (
          <div className="border-t border-stone-200 pt-4 mt-2 flex justify-between items-center">
            <div><h3 className="font-bold text-sm">Ekspansja (Filie)</h3></div>
            <button onClick={buildBranch} disabled={state.company.finances.stateKonta < BRANCH_COST} className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-xs font-semibold disabled:opacity-50">Zbuduj filię ({BRANCH_COST.toLocaleString()} PLN)</button>
          </div>
        )}
      </div>

      {/* MAGAZYN */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Magazyn: {currentStock} / {capacity} szt.</h2>
          <p className="text-sm text-stone-600">Pojemność magazynu pozwala na składowanie towarów.</p>
        </div>
        <button 
          onClick={rentWarehouse} 
          disabled={state.company.finances.stateKonta < 10000}
          className="px-4 py-2 border border-stone-300 text-stone-700 bg-stone-100 rounded hover:bg-stone-200 transition text-sm font-semibold disabled:opacity-50"
        >
          Wynajmij +50 miejsca (10 000 PLN)
        </button>
      </div>

      {/* HANDEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ZAKUP */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Sprowadź towar</h2>
          <div className="space-y-3">
            {suppliers.map((sup: any) => (
              <div key={sup.id} className="border rounded p-3 hover:bg-stone-50 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm">{sup.name}</div>
                    <div className="text-xs text-stone-500">{sup.desc}</div>
                    <div className="text-xs font-semibold text-blue-700">Jakość: {sup.quality}/10</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => buyGoods(sup, 1)} disabled={isFull || state.company.finances.stateKonta < sup.price} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-xs font-bold disabled:opacity-50">1 szt.</button>
                  <button onClick={() => buyGoods(sup, 10)} disabled={currentStock + 10 > capacity || state.company.finances.stateKonta < sup.price * 9} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-1 rounded text-xs font-bold disabled:opacity-50">10 szt. (-10%)</button>
                  <button onClick={() => buyGoods(sup, 100)} disabled={currentStock + 100 > capacity || state.company.finances.stateKonta < sup.price * 75} className="flex-1 bg-blue-800 hover:bg-blue-900 text-white py-1 rounded text-xs font-bold disabled:opacity-50">100 szt. (-25%)</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SPRZEDAŻ */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Sprzedaj towar</h2>
          <div className="space-y-3">
            {buyers.map((buy: any) => (
              <div key={buy.id} className="border rounded p-3">
                <div className="font-bold text-sm">{buy.name}</div>
                <div className="text-xs text-stone-500 mb-2">{buy.desc} (x{buy.multiplier})</div>
                
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {Object.entries(state.company.resources || {}).map(([resId, amount]) => {
                    const amt = amount as number;
                    if (amt <= 0) return null;
                    const quality = parseInt(resId.split('_')[1]) || 1;
                    const baseVal = 100;
                    
                    return (
                      <div key={resId} className="flex gap-1 mb-1">
                        <div className="flex-1 text-xs bg-stone-100 p-1.5 rounded flex items-center">Jakość {quality} (Masz: {amt})</div>
                        <button onClick={() => sellGoods(buy, resId, 1, baseVal)} disabled={amt < 1} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50">1x</button>
                        <button onClick={() => sellGoods(buy, resId, 10, baseVal)} disabled={amt < 10} className="bg-green-700 hover:bg-green-800 text-white px-2 py-1 rounded text-xs disabled:opacity-50">10x</button>
                        <button onClick={() => sellGoods(buy, resId, 100, baseVal)} disabled={amt < 100} className="bg-green-800 hover:bg-green-900 text-white px-2 py-1 rounded text-xs disabled:opacity-50">100x</button>
                      </div>
                    );
                  })}
                  {currentStock === 0 && <div className="text-xs text-stone-400 italic">Brak towaru</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRANSAKCJE W TOKU */}
      {state.pendingSales?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-bold text-amber-800 mb-2">🚚 Transakcje w toku (rozliczenie w następnej turze)</h2>
          <div className="space-y-1">
            {state.pendingSales.map((sale: any) => (
              <div key={sale.id} className="text-sm bg-white p-2 rounded shadow-sm flex justify-between">
                <span>Sprzedaż {sale.amount} szt. (Jakość {sale.quality}) do: {sale.buyerName}</span>
                <span className="font-mono text-amber-700">~{sale.estimatedRevenue.toLocaleString()} PLN</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REKLAMY */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Kampanie Reklamowe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={() => buyAd('radio')} disabled={state.company.finances.stateKonta < 5000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">📻 Radio</span><span className="text-xs text-stone-500">5 000 PLN</span></button>
          <button onClick={() => buyAd('internet')} disabled={state.company.finances.stateKonta < 15000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">🌐 Internet</span><span className="text-xs text-stone-500">15 000 PLN</span></button>
          <button onClick={() => buyAd('tv')} disabled={state.company.finances.stateKonta < 50000} className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"><span className="text-lg">📺 Telewizja</span><span className="text-xs text-stone-500">50 000 PLN</span></button>
        </div>
      </div>

      {/* ZMIANA BRANŻY */}
      <h2 className="text-xl font-bold mb-2">Zmiana profilu działalności</h2>
      <div className="space-y-2">
        {visibleActivities.map(a => {
          const isCurrent = state.company.activity === a.id;
          return (
            <div key={a.id} className={`bg-white rounded-lg shadow-sm p-4 border-2 ${isCurrent ? 'border-stone-900 bg-stone-50' : 'border-transparent'}`}>
              <div className="flex justify-between items-start gap-3">
                <div><div className="font-bold text-stone-900">{a.name} {isCurrent && <span className="text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded ml-1">obecna</span>}</div></div>
                <button onClick={() => changeActivity(a.id)} disabled={isCurrent || !canChange} className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm disabled:opacity-30">{isCurrent ? 'Wybrana' : 'Wybierz'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}