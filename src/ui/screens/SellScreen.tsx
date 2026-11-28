import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  generateTradeBuyers,
  getRevenueRange,
  getTradeThroughputLimit,
  getRemainingTradeSellLimit,
  estimateStoredTradeItem,
  calculateBuyerOfferUnitPrice,
  getSeasonInfo,
} from '../../engine/tradeHelper';
import { estimateStoredProducedItem } from '../../engine/productionHelper';
import {
  getCompanyActivities,
  canSelfSellProducedGoods,
} from '../../engine/activityHelper';
import { calculateInstallmentPrice } from '../../engine/actions';
import { formatMoneyRange } from '../../engine/currency';
import type { InstallmentOption, PendingSale, TradeSpecialCategory } from '../../engine/types';

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 6, 12, 24];

const SPECIAL_BADGES: Record<TradeSpecialCategory, { label: string; className: string }> = {
  hit_sezonu: {
    label: '🔥 HIT SEZONU',
    className: 'bg-orange-100 text-orange-900 border-orange-300',
  },
  deficytowy: {
    label: '⚠️ DEFICYTOWY',
    className: 'bg-red-100 text-red-900 border-red-300',
  },
  bialy_kruk: {
    label: '💎 BIAŁY KRUK',
    className: 'bg-purple-100 text-purple-900 border-purple-300',
  },
};

export function SellScreen() {
  const { state, sellGoods } = useGameStore();
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, InstallmentOption>>({});

  if (!state) return null;

  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const companyActivities = getCompanyActivities(state.company);
  const canSelfSellProduction = canSelfSellProducedGoods(companyActivities);

  const sellLimit = getTradeThroughputLimit(state);
  const soldThisTurn = state.tradeSoldThisTurn ?? 0;
  const remainingSell = getRemainingTradeSellLimit(state);
  const season = getSeasonInfo(state.quarter);

  const buyers = useMemo(() => {
    return generateTradeBuyers(state);
  }, [
    state.seed,
    state.turn,
    state.quarter,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            💰 Sprzedawaj {canSelfSellProduction ? 'Towar i Wyroby Własne' : 'Towar'} (Odbiorcy)
          </h1>
          <p className="text-sm text-stone-600">
            Ceny zbytu zależą od popytu w obecnym sezonie ({season.icon} <b>{season.name}</b>), jakości produktu i profilu odbiorcy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Pora roku</div>
            <div className="text-base font-bold text-stone-900">
              {season.icon} {season.name}
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Limit sprzedaży / kw.</div>
            <div className={`text-base font-bold font-mono ${remainingSell === 0 ? 'text-red-600' : 'text-stone-900'}`}>
              {soldThisTurn} / {sellLimit} szt.
            </div>
          </div>
        </div>
      </div>

      {remainingSell === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-lg p-3.5 mb-5 text-xs sm:text-sm">
          ⚠ Wykorzystałeś całą przepustowość sprzedażową na ten kwartał ({sellLimit} szt.). Zatrudnij więcej pracowników w zakładce <b>Pracownicy</b>, aby móc sprzedawać większe partie towaru.
        </div>
      )}

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
                    Sprzedaż <strong>{sale.amount} szt.</strong>{' '}
                    {sale.productName ? `„${sale.productName}” ` : ''}
                    (Jakość {sale.quality}/10) do: <strong>{sale.buyerName}</strong>
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

      {/* Lista odbiorców — opisy kontrahentów wyłącznie słowne */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                      Konkurencja
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mb-3 min-h-[32px]">{buy.desc}</p>

                <div className="bg-stone-50 border border-stone-200 rounded p-2.5 mb-4 space-y-1 text-xs">
                  {buy.minQualityDesc && (
                    <div className="flex justify-between gap-2">
                      <span className="text-stone-500">Wymagania:</span>
                      <span className="font-semibold text-stone-800 text-right">{buy.minQualityDesc}</span>
                    </div>
                  )}
                  {buy.priceTierDesc && (
                    <div className="flex justify-between gap-2">
                      <span className="text-stone-500">Stawki:</span>
                      <span className="font-semibold text-stone-800 text-right">{buy.priceTierDesc}</span>
                    </div>
                  )}
                  {buy.complaints && (
                    <div className="text-[11px] text-red-600 italic pt-0.5">
                      ⚠ Ryzyko reklamacji przy niskiej jakości towaru.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  {canSelfSellProduction ? 'Produkty i wyroby w magazynie:' : 'Produkty w magazynie:'}
                </div>

                {stockEntries.length === 0 ? (
                  <div className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded text-center border border-dashed border-stone-200">
                    Brak towarów do sprzedaży. Kup produkty w zakładce KUPUJ
                    {canSelfSellProduction ? ' lub złóż wyroby w magazynie na ekranie PRODUKCJA.' : '.'}
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {stockEntries.map(([resId, amount]) => {
                      const amt = amount as number;
                      const isProduced = resId.startsWith('prod_');

                      let quality = 1;
                      let marketUnitPrice = 100;
                      let itemTitle = '';
                      let demandPercent: number | null = null;
                      let specialCategory: TradeSpecialCategory | null = null;

                      if (isProduced) {
                        const prodInfo = estimateStoredProducedItem(state, resId);
                        quality = prodInfo.quality;
                        marketUnitPrice = prodInfo.retailBaseUnitPrice;
                        itemTitle = `🏭 ${prodInfo.label}`;
                      } else {
                        const tradeInfo = estimateStoredTradeItem(state, resId);
                        quality = tradeInfo.quality;
                        marketUnitPrice = tradeInfo.marketUnitPrice;
                        itemTitle = tradeInfo.name;
                        demandPercent = tradeInfo.demandPercent;
                        specialCategory = tradeInfo.specialCategory;
                      }

                      const offeredUnitPrice = calculateBuyerOfferUnitPrice(
                        marketUnitPrice,
                        buy,
                        quality
                      );

                      const paymentKey = `${buy.id}_${resId}`;
                      const itemInstallments = getInst(paymentKey);

                      const estUnit = calculateInstallmentPrice(offeredUnitPrice, itemInstallments);
                      const unitRange = getRevenueRange(estUnit, accuracy);
                      const isRefused = quality < minReqQuality;
                      const badge = specialCategory ? SPECIAL_BADGES[specialCategory] : null;

                      return (
                        <div
                          key={resId}
                          className={`p-2.5 rounded border text-xs ${
                            isRefused ? 'bg-red-50/40 border-red-200' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-stone-900">{itemTitle}</span>
                            {isRefused && (
                              <span className="text-[10px] text-red-700 font-bold uppercase bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                                Odrzuca jakość
                              </span>
                            )}
                          </div>

                          {badge && (
                            <div className="mb-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                          )}

                          {/* Konkretne cyferki produktu */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-600 mb-1.5">
                            <span>
                              Jakość: <strong className="font-mono text-blue-800">{quality}/10</strong>
                            </span>
                            <span>
                              Magazyn: <strong className="font-mono text-stone-900">{amt} szt.</strong>
                            </span>
                            {demandPercent !== null && (
                              <span>
                                Popyt ({season.icon}):{' '}
                                <strong
                                  className={`font-mono ${
                                    demandPercent >= 120
                                      ? 'text-emerald-700'
                                      : demandPercent <= 85
                                        ? 'text-red-700'
                                        : 'text-stone-800'
                                  }`}
                                >
                                  {demandPercent}%
                                </strong>
                              </span>
                            )}
                          </div>

                          {isRefused ? (
                            <div className="text-[11px] text-red-600 italic">
                              Ten kontrahent nie skupuje towaru tej klasy jakościowej.
                            </div>
                          ) : (
                            <>
                              <div className="text-[11px] text-stone-600 mb-2">
                                Orientacyjnie za 1 szt.:{' '}
                                <span className="font-mono font-bold text-green-800">
                                  {formatMoneyRange(unitRange.min, unitRange.max, state)}
                                </span>
                              </div>

                              {/* Wybór liczby rat */}
                              <div className="mb-2">
                                <div className="text-[10px] text-stone-500 mb-1">Liczba rat:</div>
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
                                  type="button"
                                  onClick={() =>
                                    sellGoods(
                                      buy,
                                      resId,
                                      1,
                                      offeredUnitPrice,
                                      itemInstallments,
                                      itemTitle,
                                      specialCategory
                                    )
                                  }
                                  disabled={amt < 1 || remainingSell < 1}
                                  className="flex-1 bg-green-700 hover:bg-green-800 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                                >
                                  Sprzedaj 1x
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    sellGoods(
                                      buy,
                                      resId,
                                      10,
                                      offeredUnitPrice,
                                      itemInstallments,
                                      itemTitle,
                                      specialCategory
                                    )
                                  }
                                  disabled={amt < 10 || remainingSell < 10}
                                  className="flex-1 bg-green-800 hover:bg-green-900 text-white py-1 rounded text-xs font-semibold disabled:opacity-40"
                                >
                                  10x
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    sellGoods(
                                      buy,
                                      resId,
                                      50,
                                      offeredUnitPrice,
                                      itemInstallments,
                                      itemTitle,
                                      specialCategory
                                    )
                                  }
                                  disabled={amt < 50 || remainingSell < 50}
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