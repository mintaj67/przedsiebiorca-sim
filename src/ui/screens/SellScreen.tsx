import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { generateTradeBuyers } from '../../engine/tradeHelper';
import type { InstallmentOption } from '../../engine/types';

export function SellScreen() {
  const { state, sellGoods } = useGameStore();
  const [installments, setInstallments] = useState<InstallmentOption>(1);

  if (!state) return null;

  const buyers = useMemo(() => {
    return generateTradeBuyers(state);
  }, [state.seed, state.turn, state.company.reputation, state.company.activity, state.macroStats?.development, state.competitors]);

  const stockEntries = Object.entries(state.company.resources || {}).filter(
    ([_, amount]) => (amount as number) > 0
  );

  return (
    <div className="p-4 md:p-6">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-2xl font-bold">Sprzedawaj Towar (Odbiorcy)</h1>
          <p className="text-sm text-stone-600">
            Wybierz odbiorcę. Odbiorcy o wyższej renomie odmawiają zakupu towarów niskiej jakości.
          </p>
        </div>
      </div>

      {/* Raty przy sprzedaży */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-stone-200 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-sm block">Warunki płatności dla odbiorcy:</span>
          <span className="text-xs text-stone-500">
            Zgoda na rozliczenie ratalne podnosi końcową cenę sprzedaży (+5% na próg rat).
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
              {inst === 1 ? 'Płatność w 1 turę' : `${inst} raty (+${inst === 2 ? 5 : inst === 6 ? 10 : inst === 12 ? 15 : 20}%)`}
            </button>
          ))}
        </div>
      </div>

      {/* TRANSAKCJE W TOKU */}
      {state.pendingSales?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-bold text-amber-900 mb-2">
            🚚 Transakcje w toku (rozliczenie i wpływ gotówki w następnym kwartale)
          </h2>
          <div className="space-y-1.5">
            {state.pendingSales.map((sale: any) => (
              <div
                key={sale.id}
                className="text-xs sm:text-sm bg-white p-2.5 rounded shadow-sm border border-amber-100 flex justify-between items-center"
              >
                <span>
                  Sprzedaż <strong>{sale.amount} szt.</strong> (Jakość {sale.quality}) do: <strong>{sale.buyerName}</strong>
                  {sale.installments && sale.installments > 1 && (
                    <span className="ml-2 text-stone-500 text-xs">({sale.installments} raty)</span>
                  )}
                </span>
                <span className="font-mono font-bold text-amber-800">
                  ~{sale.estimatedRevenue.toLocaleString('pl-PL')} PLN
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista odbiorców (maks. 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {buyers.map((buy) => {
          const isCompetitor = buy.id.startsWith('comp_');
          const minReqQuality = buy.req?.minQuality ?? 1;

          return (
            <div
              key={buy.id}
              className={`bg-white rounded-lg shadow-sm border p-4 flex flex-col justify-between ${
                isCompetitor ? 'border-amber-300 bg-amber-50/20' : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-bold text-base text-stone-900">{buy.name}</h3>
                  {isCompetitor && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                      Konkurencja
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mb-3 min-h-[32px]">{buy.desc}</p>

                <div className="bg-stone-50 border border-stone-200 rounded p-2.5 mb-4 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Mnożnik zbytu:</span>
                    <span className="font-bold text-green-700">x{buy.multiplier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Wymagana jakość:</span>
                    <span className={`font-bold ${minReqQuality > 1 ? 'text-amber-800' : 'text-stone-600'}`}>
                      {minReqQuality > 1 ? `Min. ${minReqQuality}/10` : 'Dowolna (brak wymagań)'}
                    </span>
                  </div>
                  {buy.complaints && (
                    <div className="text-[11px] text-red-600 italic">
                      ⚠ Ryzyko reklamacji przy marnej jakości!
                    </div>
                  )}
                </div>
              </div>

              {/* Wybór towaru z magazynu */}
              <div>
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  Zmagazynowany towar:
                </div>

                {stockEntries.length === 0 ? (
                  <div className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded text-center border border-dashed border-stone-200">
                    Twój magazyn jest pusty. Sprowadź towar w zakładce KUPUJ.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {stockEntries.map(([resId, amount]) => {
                      const amt = amount as number;
                      const parts = resId.split('_');
                      const quality = parseInt(parts[parts.length - 1], 10) || 1;
                      const baseVal = quality * 120 + 80;
                      const unitSellingPrice = Math.round(baseVal * buy.multiplier);
                      const isRefused = quality < minReqQuality;

                      return (
                        <div
                          key={resId}
                          className={`p-2.5 rounded border text-xs ${
                            isRefused ? 'bg-red-50/40 border-red-200' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-stone-800">
                              Jakość {quality}/10 (Masz: {amt} szt.)
                            </span>
                            {!isRefused ? (
                              <span className="font-mono text-stone-600 font-bold">
                                ~{unitSellingPrice.toLocaleString('pl-PL')} PLN/szt.
                              </span>
                            ) : (
                              <span className="text-[10px] text-red-700 font-bold uppercase bg-red-100 px-1 py-0.5 rounded">
                                Odrzuca jakość
                              </span>
                            )}
                          </div>

                          {isRefused ? (
                            <div className="text-[11px] text-red-600 italic">
                              Kontrahent nie przyjmuje towaru o jakości poniżej {minReqQuality}.
                            </div>
                          ) : (
                            <div className="flex gap-1.5 pt-1">
                              <button
                                onClick={() => sellGoods(buy, resId, 1, baseVal, installments)}
                                disabled={amt < 1}
                                className="flex-1 bg-green-700 hover:bg-green-800 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                              >
                                1x
                              </button>
                              <button
                                onClick={() => sellGoods(buy, resId, 10, baseVal, installments)}
                                disabled={amt < 10}
                                className="flex-1 bg-green-800 hover:bg-green-900 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                              >
                                10x
                              </button>
                              <button
                                onClick={() => sellGoods(buy, resId, 50, baseVal, installments)}
                                disabled={amt < 50}
                                className="flex-1 bg-green-900 hover:bg-black text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                              >
                                50x
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
