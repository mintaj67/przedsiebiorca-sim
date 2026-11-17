import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { generateTradeSuppliers } from '../../engine/tradeHelper';
import { calculateInstallmentPrice } from '../../engine/actions';
import type { InstallmentOption } from '../../engine/types';

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 6, 12, 24];

export function BuyScreen() {
  const { state, buyGoods, rentWarehouse } = useGameStore();
  const [installmentsBySupplier, setInstallmentsBySupplier] = useState<Record<string, InstallmentOption>>({});

  if (!state) return null;

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity =
    state.company.warehouseCapacity ||
    COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity ||
    50;
  const isFull = currentStock >= capacity;

  const suppliers = useMemo(() => {
    return generateTradeSuppliers(state);
  }, [
    state.seed,
    state.turn,
    state.company.reputation,
    state.company.activity,
    state.company.activities,
    state.macroStats?.development,
    state.competitors,
  ]);

  const getInst = (supId: string): InstallmentOption => installmentsBySupplier[supId] ?? 1;
  const setInst = (supId: string, val: InstallmentOption) =>
    setInstallmentsBySupplier(prev => ({ ...prev, [supId]: val }));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛒 Kupuj Towar (Dostawcy)</h1>
          <p className="text-sm text-stone-600">
            Wybierz dostawcę oraz formę płatności (gotówka lub raty) oddzielnie dla każdego zamówienia.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Magazyn</div>
            <div className={`text-base font-bold font-mono ${isFull ? 'text-red-600' : 'text-stone-900'}`}>
              {currentStock} / {capacity} szt.
            </div>
          </div>
          <button
            onClick={rentWarehouse}
            disabled={state.company.finances.stanKonta < 10000}
            className="bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
          >
            +50 miejsc (10k PLN)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {suppliers.map((sup) => {
          const isCompetitor = sup.id.startsWith('comp_');
          const supInst = getInst(sup.id);

          const cost1 = calculateInstallmentPrice(sup.price, supInst);
          const cost10 = calculateInstallmentPrice(Math.round(sup.price * 10 * 0.90), supInst);
          const cost50 = calculateInstallmentPrice(Math.round(sup.price * 50 * 0.75), supInst);

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

                <div className="bg-stone-50 border border-stone-200 rounded p-2.5 mb-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Jakość towaru:</span>
                    <span className="font-bold text-blue-700">{sup.quality} / 10</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Cena bazowa:</span>
                    <span className="font-mono font-bold text-stone-900">{sup.price.toLocaleString('pl-PL')} PLN</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-stone-100 pt-3">
                {/* Indywidualny wybór rat dla tego dostawcy */}
                <div className="mb-1">
                  <div className="text-[10px] text-stone-500 uppercase font-semibold mb-1">
                    Forma płatności u tego dostawcy:
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {INSTALLMENT_OPTIONS.map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setInst(sup.id, inst)}
                        className={`py-1 rounded text-[10px] font-semibold border transition ${
                          supInst === inst
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {inst === 1 ? 'Got.' : `${inst}r.`}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => buyGoods(sup, 1, supInst)}
                  disabled={isFull || (supInst === 1 && state.company.finances.stanKonta < cost1)}
                  className="w-full flex justify-between items-center bg-stone-100 hover:bg-stone-200 border border-stone-300 px-3 py-2 rounded text-xs transition disabled:opacity-40"
                >
                  <span className="font-bold">1 szt. towaru</span>
                  <span className="font-mono font-semibold">{cost1.toLocaleString('pl-PL')} PLN</span>
                </button>

                <button
                  onClick={() => buyGoods(sup, 10, supInst)}
                  disabled={currentStock + 10 > capacity || (supInst === 1 && state.company.finances.stanKonta < cost10)}
                  className="w-full flex justify-between items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 px-3 py-2 rounded text-xs transition disabled:opacity-40"
                >
                  <div>
                    <span className="font-bold">10 szt. towaru</span>
                    <span className="text-[10px] text-blue-700 font-semibold ml-1.5 bg-blue-100 px-1 py-0.5 rounded">-10%</span>
                  </div>
                  <span className="font-mono font-bold">{cost10.toLocaleString('pl-PL')} PLN</span>
                </button>

                <button
                  onClick={() => buyGoods(sup, 50, supInst)}
                  disabled={currentStock + 50 > capacity || (supInst === 1 && state.company.finances.stanKonta < cost50)}
                  className="w-full flex justify-between items-center bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded text-xs transition font-semibold disabled:opacity-40 shadow-sm"
                >
                  <div>
                    <span>50 szt. towaru</span>
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