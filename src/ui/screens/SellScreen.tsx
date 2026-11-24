import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { generateTradeBuyers, getRevenueRange } from '../../engine/tradeHelper';
import { estimateStoredProducedItem } from '../../engine/productionHelper';
import {
  getCompanyActivities,
  canSelfSellProducedGoods,
} from '../../engine/activityHelper';
import { calculateInstallmentPrice } from '../../engine/actions';
import { formatMoneyRange } from '../../engine/currency';
import { scaleByInflation } from '../../engine/economy';
import type { InstallmentOption, PendingSale } from '../../engine/types';

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 6, 12, 24];

export function SellScreen() {
  const { state, sellGoods } = useGameStore();
  // Osobny stan rat dla każdej pary (odbiorca + towar): klucz `${buy.id}_${resId}`
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, InstallmentOption>>({});

  if (!state) return null;

  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const companyActivities = getCompanyActivities(state.company);
  const canSelfSellProduction = canSelfSellProducedGoods(companyActivities);

  const buyers = useMemo(() => {
    return generateTradeBuyers(state);
  }, [
    state.seed,
    state.turn,
    state.company.reputation,
    state.company.activity,
    state.company.activities,
    state.macroStats?.development,
    state.competitors,
  ]);

  const allNonRawEntries = Object.entries(state.company.resources || {}).filter(
    ([resId, amount]) => !resId.startsWith('raw_') && (amount as number) > 0
  );

  const blockedProducedCount = canSelfSellProduction
    ? 0
    : allNonRawEntries
        .filter(([resId]) => resId.startsWith('prod_'))
        .reduce((sum, [, amt]) => sum + (amt as number), 0);

  const stockEntries = allNonRawEntries.filter(([resId]) => {
    if (resId.startsWith('prod_')) return canSelfSellProduction;
    return true;
  });

  const getInst = (key: string): InstallmentOption => installmentsMap[key] ?? 1;
  const setInst = (key: string, val: InstallmentOption) =>
    setInstallmentsMap(prev => ({ ...prev, [key]: val }));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            💰 Sprzedawaj {canSelfSellProduction ? 'Towar i Wyroby Własne' : 'Towar'} (Odbiorcy)
          </h1>
          <p className="text-sm text-stone-600">
            Przy kontrahentach widnieje orientacyjny przedział przychodu. Warunki ratalne ustalasz osobno dla każdej transakcji.
          </p>
        </div>
      </div>

      {blockedProducedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-lg p-3.5 mb-6 text-xs sm:text-sm">
          ℹ W magazynie znajduje się <strong>{blockedProducedCount} szt.</strong> wyrobów z własnej produkcji, ale obecny profil handlowy nie pasuje do profilu produkcyjnego — możesz zbyć je hurtowo na ekranie <b>🏭 Produkcja</b>.
        </div>
      )}

      {/* TRANSAKCJE W TOKU */}
      {state.pendingSales?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-bold text-amber-900 mb-2">
            🚚 Zamówienia wysłane do kontrahentów (ostateczne rozliczenie w wiadomości w następnej turze)
          </h2>
          <div className="space-y-1.5">
            {state.pendingSales.map((sale: PendingSale) => {
              const fallback = getRevenueRange(sale.estimatedRevenue, accuracy);
              const minRev = sale.minRevenue ?? fallback.min;
              const maxRev = sale.maxRevenue ?? fallback.max;

              return (
                <div
                  key={sale.id}
                  className="text-xs sm:text-sm bg-white p-2.5 rounded shadow-sm border border-amber-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1"
                >
                  <span>
                    Sprzedaż <strong>{sale.amount} szt.</strong> (Jakość {sale.quality}) do: <strong>{sale.buyerName}</strong>
                    {sale.installments && sale.installments > 1 && (
                      <span className="ml-2 text-stone-500 text-xs">({sale.installments} raty)</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-amber-800">
                    Orientacyjnie: {formatMoneyRange(minRev, maxRev, state)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista odbiorców */}
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

              <div>
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  {canSelfSellProduction ? 'Towary i wyroby własne w magazynie:' : 'Zmagazynowane towary:'}
                </div>

                {stockEntries.length === 0 ? (
                  <div className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded text-center border border-dashed border-stone-200">
                    Brak towarów do sprzedaży. Sprowadź towar w zakładce KUPUJ
                    {canSelfSellProduction ? ' lub złóż wyroby w magazynie na ekranie PRODUKCJA.' : '.'}
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {stockEntries.map(([resId, amount]) => {
                      const amt = amount as number;
                      const isProduced = resId.startsWith('prod_');

                      let quality = 1;
                      let baseVal = 100;
                      let itemTitle = '';

                      if (isProduced) {
                        const prodInfo = estimateStoredProducedItem(state, resId);
                        quality = prodInfo.quality;
                        baseVal = prodInfo.retailBaseUnitPrice;
                        itemTitle = `🏭 ${prodInfo.label}`;
                      } else {
                        const parts = resId.split('_');
                        quality = parseInt(parts[parts.length - 1], 10) || 1;
                        baseVal = Math.max(5, scaleByInflation(quality * 120 + 80, state));
                        itemTitle = '📦 Towar';
                      }

                      const paymentKey = `${buy.id}_${resId}`;
                      const itemInstallments = getInst(paymentKey);

                      const estUnit = calculateInstallmentPrice(
                        Math.round(baseVal * buy.multiplier),
                        itemInstallments
                      );
                      const unitRange = getRevenueRange(estUnit, accuracy);
                      const isRefused = quality < minReqQuality;

                      return (
                        <div
                          key={resId}
                          className={`p-2.5 rounded border text-xs ${
                            isRefused ? 'bg-red-50/40 border-red-200' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1 gap-2">
                            <span className="font-semibold text-stone-800">
                              {itemTitle} · J.{quality}/10 ({amt} szt.)
                            </span>
                            {isRefused && (
                              <span className="text-[10px] text-red-700 font-bold uppercase bg-red-100 px-1 py-0.5 rounded shrink-0">
                                Odrzuca jakość
                              </span>
                            )}
                          </div>

                          {isRefused ? (
                            <div className="text-[11px] text-red-600 italic">
                              Kontrahent nie przyjmuje partii o jakości poniżej {minReqQuality}.
                            </div>
                          ) : (
                            <>
                              <div className="text-[11px] text-stone-600 mb-2">
                                Orientacyjnie za 1 szt.:{' '}
                                <span className="font-mono font-bold text-green-800">
                                  {formatMoneyRange(unitRange.min, unitRange.max, state)}
                                </span>
                              </div>

                              {/* Indywidualny wybór rat dla tej płatności */}
                              <div className="mb-2">
                                <div className="text-[10px] text-stone-500 mb-1">Płatność od odbiorcy:</div>
                                <div className="grid grid-cols-5 gap-1">
                                  {INSTALLMENT_OPTIONS.map((inst) => (
                                    <button
                                      key={inst}
                                      type="button"
                                      onClick={() => setInst(paymentKey, inst)}
                                      className={`py-1 rounded text-[10px] font-semibold border transition ${
                                        itemInstallments === inst
                                          ? 'bg-stone-900 text-white border-stone-900'
                                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                      }`}
                                    >
                                      {inst === 1 ? '1x' : `${inst}r.`}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-1.5 pt-1">
                                <button
                                  onClick={() => sellGoods(buy, resId, 1, baseVal, itemInstallments)}
                                  disabled={amt < 1}
                                  className="flex-1 bg-green-700 hover:bg-green-800 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                                >
                                  Sprzedaj 1x
                                </button>
                                <button
                                  onClick={() => sellGoods(buy, resId, 10, baseVal, itemInstallments)}
                                  disabled={amt < 10}
                                  className="flex-1 bg-green-800 hover:bg-green-900 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                                >
                                  10x
                                </button>
                                <button
                                  onClick={() => sellGoods(buy, resId, 50, baseVal, itemInstallments)}
                                  disabled={amt < 50}
                                  className="flex-1 bg-green-900 hover:bg-black text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                                >
                                  50x
                                </button>
                              </div>
                            </>
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