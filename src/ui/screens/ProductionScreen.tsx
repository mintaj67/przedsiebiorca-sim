import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import {
  generateProductionSuppliers,
  getProductionCapacity,
} from '../../engine/productionHelper';
import { calculateInstallmentPrice } from '../../engine/actions';
import type { InstallmentOption } from '../../engine/types';

type ProdTab = 'raw' | 'line';

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 6, 12, 24];

interface ProductionScreenProps {
  onNavigateToSell?: () => void;
}

export function ProductionScreen({ onNavigateToSell }: ProductionScreenProps) {
  const { state, buyRawMaterials, produceGoods } = useGameStore();
  const [subTab, setSubTab] = useState<ProdTab>('raw');
  const [installmentsBySupplier, setInstallmentsBySupplier] = useState<Record<string, InstallmentOption>>({});

  if (!state) return null;

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity =
    state.company.warehouseCapacity ||
    COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity ||
    50;
  const isFull = currentStock >= capacity;

  const maxProdCapacity = getProductionCapacity(state);
  const usedProdCapacity = state.productionUsedThisTurn ?? 0;
  const freeProdCapacity = Math.max(0, maxProdCapacity - usedProdCapacity);

  const suppliers = useMemo(
    () => generateProductionSuppliers(state),
    [
      state.seed,
      state.turn,
      state.company.reputation,
      state.company.activity,
      state.company.activities,
      state.macroStats?.development,
      state.competitors,
    ]
  );

  const rawEntries = Object.entries(state.company.resources || {}).filter(
    ([resId, amt]) => resId.startsWith('raw_') && (amt as number) > 0
  );

  const finishedCount = Object.entries(state.company.resources || {})
    .filter(([resId, amt]) => resId.startsWith('prod_') && (amt as number) > 0)
    .reduce((sum, [, amt]) => sum + (amt as number), 0);

  const emp = state.company.employees;
  const totalWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  const hasQualityBonus = totalWorkers > 0 && emp.uop / totalWorkers >= 0.5;

  const getInst = (supId: string): InstallmentOption => installmentsBySupplier[supId] ?? 1;
  const setInst = (supId: string, val: InstallmentOption) =>
    setInstallmentsBySupplier(prev => ({ ...prev, [supId]: val }));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold">🏭 Zakład Produkcyjny</h1>
          <p className="text-sm text-stone-600">
            Kupuj surowce i przerabiaj je na wyroby gotowe. Gotowy towar sprzedasz w widoku <b>💰 Sprzedawaj</b>.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Moce w kwartale</div>
            <div className="text-base font-bold font-mono text-amber-800">
              {freeProdCapacity} / {maxProdCapacity} szt.
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Magazyn</div>
            <div className={`text-base font-bold font-mono ${isFull ? 'text-red-600' : 'text-stone-900'}`}>
              {currentStock} / {capacity} szt.
            </div>
          </div>
        </div>
      </div>

      {finishedCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="text-xs sm:text-sm text-emerald-950">
            📦 W magazynie czeka <strong>{finishedCount} szt.</strong> gotowych wyrobów własnych do sprzedaży.
          </div>
          {onNavigateToSell && (
            <button
              onClick={onNavigateToSell}
              className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded text-xs font-bold transition shrink-0"
            >
              💰 Przejdź do Sprzedawaj →
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6 bg-stone-200/70 p-1.5 rounded-lg w-fit">
        <button
          onClick={() => setSubTab('raw')}
          className={`px-4 py-2 rounded-md text-sm font-bold transition ${
            subTab === 'raw' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-700 hover:bg-white/60'
          }`}
        >
          🧱 Surowce ({rawEntries.reduce((s, [, a]) => s + (a as number), 0)})
        </button>
        <button
          onClick={() => setSubTab('line')}
          className={`px-4 py-2 rounded-md text-sm font-bold transition ${
            subTab === 'line' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-700 hover:bg-white/60'
          }`}
        >
          ⚙️ Linia produkcyjna
        </button>
      </div>

      {/* WIDOK 1: ZAKUP SUROWCÓW */}
      {subTab === 'raw' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <span className="text-stone-500">Jakość surowca:</span>
                      <span className="font-bold text-amber-700">{sup.quality} / 10</span>
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
                    onClick={() => buyRawMaterials(sup, 1, supInst)}
                    disabled={isFull || (supInst === 1 && state.company.finances.stanKonta < cost1)}
                    className="w-full flex justify-between items-center bg-stone-100 hover:bg-stone-200 border border-stone-300 px-3 py-2 rounded text-xs transition disabled:opacity-40"
                  >
                    <span className="font-bold">1 szt. surowca</span>
                    <span className="font-mono font-semibold">{cost1.toLocaleString('pl-PL')} PLN</span>
                  </button>

                  <button
                    onClick={() => buyRawMaterials(sup, 10, supInst)}
                    disabled={currentStock + 10 > capacity || (supInst === 1 && state.company.finances.stanKonta < cost10)}
                    className="w-full flex justify-between items-center bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 px-3 py-2 rounded text-xs transition disabled:opacity-40"
                  >
                    <div>
                      <span className="font-bold">10 szt. surowca</span>
                      <span className="text-[10px] text-amber-700 font-semibold ml-1.5 bg-amber-100 px-1 py-0.5 rounded">-10%</span>
                    </div>
                    <span className="font-mono font-bold">{cost10.toLocaleString('pl-PL')} PLN</span>
                  </button>

                  <button
                    onClick={() => buyRawMaterials(sup, 50, supInst)}
                    disabled={currentStock + 50 > capacity || (supInst === 1 && state.company.finances.stanKonta < cost50)}
                    className="w-full flex justify-between items-center bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded text-xs transition font-semibold disabled:opacity-40 shadow-sm"
                  >
                    <div>
                      <span>50 szt. surowca</span>
                      <span className="text-[10px] text-amber-200 font-semibold ml-1.5 bg-amber-800/80 px-1 py-0.5 rounded">-25%</span>
                    </div>
                    <span className="font-mono font-bold">{cost50.toLocaleString('pl-PL')} PLN</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WIDOK 2: LINIA PRODUKCYJNA */}
      {subTab === 'line' && (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-4 border-b border-stone-200">
            <div>
              <h2 className="text-lg font-bold">Przerób surowców na wyroby gotowe</h2>
              <p className="text-xs text-stone-600">
                1 szt. surowca = 1 szt. wyrobu gotowego. Zatrudniaj więcej pracowników, aby zwiększyć moc przerobową (obecnie: {maxProdCapacity} szt./kwartał).
              </p>
            </div>
            <div className={`text-xs px-3 py-1.5 rounded font-semibold ${hasQualityBonus ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-600'}`}>
              {hasQualityBonus
                ? '★ Premia załogi UoP: +1 do jakości wyrobu!'
                : 'Zatrudnij min. 50% załogi na UoP, aby podnieść jakość wyrobów o +1'}
            </div>
          </div>

          {rawEntries.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm bg-stone-50 rounded border border-dashed border-stone-300">
              Brak surowców w magazynie. Przejdź do zakładki <b>🧱 Surowce</b>, aby zamówić półprodukty.
            </div>
          ) : (
            <div className="space-y-3">
              {rawEntries.map(([rawResId, amount]) => {
                const amt = amount as number;
                const parts = rawResId.split('_');
                const rawQuality = parseInt(parts[parts.length - 1], 10) || 1;
                const outQuality = Math.min(10, rawQuality + (hasQualityBonus ? 1 : 0));

                return (
                  <div
                    key={rawResId}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-stone-50 border border-stone-200 rounded-lg"
                  >
                    <div>
                      <div className="font-bold text-sm text-stone-900">
                        Partia surowca — Jakość {rawQuality}/10 (Dostępne: {amt} szt.)
                      </div>
                      <div className="text-xs text-stone-600">
                        Po przetworzeniu powstanie: <b className="text-amber-800">Wyrób gotowy (Jakość {outQuality}/10)</b>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => produceGoods(rawResId, 1)}
                        disabled={amt < 1 || freeProdCapacity < 1}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Produkuj 1x
                      </button>
                      <button
                        onClick={() => produceGoods(rawResId, 5)}
                        disabled={amt < 5 || freeProdCapacity < 5}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Produkuj 5x
                      </button>
                      <button
                        onClick={() => produceGoods(rawResId, Math.min(amt, freeProdCapacity))}
                        disabled={amt < 1 || freeProdCapacity < 1}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Max ({Math.min(amt, freeProdCapacity)}x)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}