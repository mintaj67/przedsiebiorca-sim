import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { generateTradeSuppliers } from '../../engine/tradeHelper';
import type { InstallmentOption } from '../../engine/types';

export function BuyScreen() {
  const { state, buyGoods } = useGameStore();
  const [installments, setInstallments] = useState<InstallmentOption>(1);

  if (!state) return null;

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity = state.company.warehouseCapacity || COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity || 50;
  const isFull = currentStock >= capacity;

  const suppliers = useMemo(() => {
    return generateTradeSuppliers(state);
  }, [state.seed, state.turn, state.company.reputation, state.company.activity, state.macroStats?.development, state.competitors]);

  return (
    <div className="p-4 md:p-6">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kupuj Towar (Dostawcy)</h1>
          <p className="text-sm text-stone-600">
            Wybierz dostawcę. Ceny zależą od reputacji, rozwoju kraju oraz relacji z konkurencją.
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg px-4 py-2 shadow-sm text-right shrink-0">
          <div className="text-[11px] text-stone-500 uppercase font-semibold">Magazyn firmy</div>
          <div className={`text-lg font-bold font-mono ${isFull ? 'text-red-600' : 'text-stone-900'}`}>
            {currentStock} / {capacity} szt.
          </div>
        </div>
      </div>

      {/* Płatność w ratach */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-sm block">Forma płatności za dostawę:</span>
          <span className="text-xs text-stone-500">
            Zakup na raty pozwala zaopatrzyć magazyn bez pełnej gotówki od ręki (+5% narzutu na próg).
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 6, 12, 24] as InstallmentOption[]).map((inst) => (
            <button
              key={inst}
              onClick={() => setInstallments(inst)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition ${
                installments === inst
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border-stone-300'
              }`}
            >
              {inst === 1 ? 'Gotówka (100%)' : `${inst} raty (+${inst === 2 ? 5 : inst === 6 ? 10 : inst === 12 ? 15 : 20}%)`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista dostawców (maks. 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suppliers.map((sup) => {
          const isCompetitor = sup.id.startsWith('comp_');
          const unitPrice = sup.price;
          const cost1 = Math.round(unitPrice * (installments === 1 ? 1 : 1 + (installments === 2 ? 0.05 : installments === 6 ? 0.10 : installments === 12 ? 0.15 : 0.20)));
          const cost10 = Math.round(unitPrice * 10 * 0.90 * (installments === 1 ? 1 : 1 + (installments === 2 ? 0.05 : installments === 6 ? 0.10 : installments === 12 ? 0.15 : 0.20)));
          const cost50 = Math.round(unitPrice * 50 * 0.75 * (installments === 1 ? 1 : 1 + (installments === 2 ? 0.05 : installments === 6 ? 0.10 : installments === 12 ? 0.15 : 0.20)));

          return (
            <div
              key={sup.id}
              className={`bg-white rounded-lg shadow-sm border p-4 flex flex-col justify-between ${
                isCompetitor ? 'border-amber-300 bg-amber-50/20' : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-bold text-base text-stone-900">{sup.name}</h3>
                  {isCompetitor && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                      Konkurencja
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mb-3 min-h-[32px]">{sup.desc}</p>

                <div className="bg-stone-50 border border-stone-200 rounded p-2.5 mb-4 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Jakość towaru:</span>
                    <span className="font-bold text-blue-700">{sup.quality} / 10</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Cena za 1 sztukę:</span>
                    <span className="font-mono font-bold text-stone-900">{unitPrice.toLocaleString('pl-PL')} PLN</span>
                  </div>
                </div>
              </div>

              {/* Pakiety zakupu: 1, 10 (-10%), 50 (-25%) */}
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                  Wybierz pakiet:
                </div>

                <button
                  onClick={() => buyGoods(sup, 1, installments)}
                  disabled={isFull || (installments === 1 && state.company.finances.stanKonta < cost1)}
                  className="w-full flex justify-between items-center bg-stone-100 hover:bg-stone-200 border border-stone-300 px-3 py-2 rounded text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-bold">1 sztuka</span>
                  <span className="font-mono text-stone-800 font-semibold">{cost1.toLocaleString('pl-PL')} PLN</span>
                </button>

                <button
                  onClick={() => buyGoods(sup, 10, installments)}
                  disabled={currentStock + 10 > capacity || (installments === 1 && state.company.finances.stanKonta < cost10)}
                  className="w-full flex justify-between items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 px-3 py-2 rounded text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div>
                    <span className="font-bold">10 sztuk</span>
                    <span className="text-[10px] text-blue-700 font-semibold ml-1.5 bg-blue-100 px-1 py-0.5 rounded">-10%</span>
                  </div>
                  <span className="font-mono font-bold text-blue-900">{cost10.toLocaleString('pl-PL')} PLN</span>
                </button>

                <button
                  onClick={() => buyGoods(sup, 50, installments)}
                  disabled={currentStock + 50 > capacity || (installments === 1 && state.company.finances.stanKonta < cost50)}
                  className="w-full flex justify-between items-center bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded text-xs transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <div>
                    <span>50 sztuk</span>
                    <span className="text-[10px] text-blue-200 font-semibold ml-1.5 bg-blue-800/80 px-1 py-0.5 rounded">-25%</span>
                  </div>
                  <span className="font-mono font-bold">{cost50.toLocaleString('pl-PL')} PLN</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
