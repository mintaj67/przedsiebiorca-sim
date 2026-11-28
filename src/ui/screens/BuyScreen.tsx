import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import {
  generateTradeSuppliers,
  getTradeThroughputLimit,
  getRemainingTradeBuyLimit,
  getRemainingOfferStock,
  getSeasonInfo,
} from '../../engine/tradeHelper';
import { getAllianceTradeDiscount } from '../../engine/competition';
import { calculateInstallmentPrice } from '../../engine/actions';
import { formatMoney } from '../../engine/currency';
import { scaleByInflation } from '../../engine/economy';
import type { InstallmentOption, TradeSpecialCategory } from '../../engine/types';

const INSTALLMENT_OPTIONS: InstallmentOption[] = [1, 2, 6, 12, 24];

const SPECIAL_BADGES: Record<TradeSpecialCategory, { label: string; className: string }> = {
  hit_sezonu: {
    label: '🔥 HIT SEZONU',
    className: 'bg-orange-100 text-orange-900 border-orange-300',
  },
  deficytowy: {
    label: '⚠️ TOWAR DEFICYTOWY',
    className: 'bg-red-100 text-red-900 border-red-300',
  },
  bialy_kruk: {
    label: '💎 BIAŁY KRUK',
    className: 'bg-purple-100 text-purple-900 border-purple-300',
  },
};

export function BuyScreen() {
  const { state, buyGoods, rentWarehouse } = useGameStore();
  const [installmentsByOffer, setInstallmentsByOffer] = useState<Record<string, InstallmentOption>>({});

  if (!state) return null;

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity =
    state.company.warehouseCapacity ||
    COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity ||
    50;
  const freeWarehouse = Math.max(0, capacity - currentStock);
  const isFull = freeWarehouse <= 0;
  const warehouseCost = scaleByInflation(10000, state);

  const buyLimit = getTradeThroughputLimit(state);
  const boughtThisTurn = state.tradeBoughtThisTurn ?? 0;
  const remainingBuy = getRemainingTradeBuyLimit(state);
  const allianceDiscount = getAllianceTradeDiscount(state);
  const season = getSeasonInfo(state.quarter);

  const suppliers = useMemo(() => {
    return generateTradeSuppliers(state);
  }, [
    state.seed,
    state.turn,
    state.quarter,
    state.company.reputation,
    state.company.activity,
    state.company.activities,
    state.macroStats?.development,
    state.macroStats?.priceIndex,
    state.competitors,
  ]);

  const getInst = (offerKey: string): InstallmentOption => installmentsByOffer[offerKey] ?? 1;
  const setInst = (offerKey: string, val: InstallmentOption) =>
    setInstallmentsByOffer(prev => ({ ...prev, [offerKey]: val }));

  const calcTotal = (unitPrice: number, amount: number, inst: InstallmentOption) => {
    const bulkDiscount = amount >= 50 ? 0.25 : amount >= 10 ? 0.10 : 0;
    const totalDiscount = Math.min(0.45, bulkDiscount + allianceDiscount);
    const base = Math.round(unitPrice * amount * (1 - totalDiscount));
    return calculateInstallmentPrice(base, inst);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛒 Kupuj Towar (Dostawcy)</h1>
          <p className="text-sm text-stone-600">
            Wybieraj konkretne produkty pod bieżący sezon ({season.icon} <b>{season.name}</b>). Ceny i popyt zmieniają się co kwartał.
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
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Limit kupna / kw.</div>
            <div className={`text-base font-bold font-mono ${remainingBuy === 0 ? 'text-red-600' : 'text-stone-900'}`}>
              {boughtThisTurn} / {buyLimit} szt.
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Magazyn</div>
            <div className={`text-base font-bold font-mono ${isFull ? 'text-red-600' : 'text-stone-900'}`}>
              {currentStock} / {capacity} szt.
            </div>
          </div>

          <button
            onClick={rentWarehouse}
            disabled={state.company.finances.stanKonta < warehouseCost}
            className="bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-40"
          >
            +50 miejsc ({formatMoney(warehouseCost, state)})
          </button>
        </div>
      </div>

      {remainingBuy === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-lg p-3.5 mb-5 text-xs sm:text-sm">
          ⚠ Wykorzystałeś całą przepustowość zakupową na ten kwartał ({buyLimit} szt.). Zatrudnij więcej pracowników w zakładce <b>Pracownicy</b>, aby zwiększyć limit obrotu.
        </div>
      )}

      {allianceDiscount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-lg px-3.5 py-2 mb-5 text-xs">
          🤝 Aktywny rabat sojuszniczy: <strong>-{Math.round(allianceDiscount * 100)}%</strong> (wliczony w kwoty na przyciskach poniżej).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {suppliers.map((sup) => {
          const isCompetitor = sup.id.startsWith('comp_');
          const products = sup.products ?? [];

          return (
            <div
              key={sup.id}
              className={`bg-white rounded-lg shadow-sm border p-4 flex flex-col justify-between ${
                isCompetitor ? 'border-amber-300 bg-amber-50/20' : 'border-stone-200'
              }`}
            >
              {/* Nagłówek kontrahenta — wyłącznie opisy słowne */}
              <div className="mb-3">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-bold text-base text-stone-900">{sup.name}</h3>
                  {isCompetitor && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                      Konkurencja
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mb-2">{sup.desc}</p>
                {sup.qualityDesc && (
                  <div className="text-xs bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-stone-700">
                    <span className="text-stone-500">Jakość asortymentu: </span>
                    <span className="font-semibold text-stone-900">{sup.qualityDesc}</span>
                  </div>
                )}
              </div>

              {/* Konkretne produkty z cyferkami */}
              <div className="space-y-3 border-t border-stone-100 pt-3">
                {products.map((offer) => {
                  const offerInst = getInst(offer.offerKey);
                  const remainingOfferStock = getRemainingOfferStock(state, offer);
                  const isSoldOut = remainingOfferStock !== null && remainingOfferStock <= 0;

                  const maxCanBuyNow = Math.min(
                    freeWarehouse,
                    remainingBuy,
                    remainingOfferStock ?? Number.MAX_SAFE_INTEGER
                  );

                  const cost1 = calcTotal(offer.buyPrice, 1, offerInst);
                  const cost10 = calcTotal(offer.buyPrice, 10, offerInst);
                  const cost50 = calcTotal(offer.buyPrice, 50, offerInst);
                  const costAllLimited =
                    remainingOfferStock !== null && remainingOfferStock > 1
                      ? calcTotal(offer.buyPrice, Math.min(remainingOfferStock, maxCanBuyNow), offerInst)
                      : 0;

                  const badge = offer.specialCategory ? SPECIAL_BADGES[offer.specialCategory] : null;
                  const demandColor =
                    offer.demandPercent >= 120
                      ? 'text-emerald-700'
                      : offer.demandPercent <= 85
                        ? 'text-red-700'
                        : 'text-stone-800';

                  return (
                    <div
                      key={offer.offerKey}
                      className={`rounded-lg border p-3 text-xs ${
                        isSoldOut
                          ? 'bg-stone-100 border-stone-200 opacity-60'
                          : offer.specialCategory === 'bialy_kruk'
                            ? 'bg-purple-50/40 border-purple-200'
                            : offer.specialCategory === 'hit_sezonu'
                              ? 'bg-orange-50/40 border-orange-200'
                              : offer.specialCategory === 'deficytowy'
                                ? 'bg-red-50/40 border-red-200'
                                : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="font-bold text-stone-900 text-sm">{offer.name}</span>
                        {badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                        {offer.isExclusive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-900 border-amber-300">
                            ★ Ekskluzywny
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-stone-600 mb-2">{offer.desc}</p>

                      {/* Twarde cyferki produktu */}
                      <div className="grid grid-cols-3 gap-1.5 bg-white border border-stone-200 rounded p-2 mb-2 text-center">
                        <div>
                          <div className="text-[10px] text-stone-500">Jakość</div>
                          <div className="font-mono font-bold text-blue-800">{offer.quality}/10</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-stone-500">Popyt ({season.icon})</div>
                          <div className={`font-mono font-bold ${demandColor}`}>{offer.demandPercent}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-stone-500">Cena / 1 szt.</div>
                          <div className="font-mono font-bold text-stone-900">
                            {formatMoney(offer.buyPrice, state)}
                          </div>
                        </div>
                      </div>

                      {remainingOfferStock !== null && (
                        <div className="text-[11px] font-semibold text-red-800 mb-2">
                          {isSoldOut
                            ? 'Wyprzedano u tego dostawcy w tej turze.'
                            : `Ograniczony zapas u dostawcy: ${remainingOfferStock} / ${offer.availableStock} szt.`}
                        </div>
                      )}

                      {!isSoldOut && (
                        <>
                          {/* Wybór liczby rat */}
                          <div className="mb-2">
                            <div className="text-[10px] text-stone-500 uppercase font-semibold mb-1">
                              Liczba rat:
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                              {INSTALLMENT_OPTIONS.map((inst) => (
                                <button
                                  key={inst}
                                  type="button"
                                  onClick={() => setInst(offer.offerKey, inst)}
                                  className={`py-1 rounded text-[10px] font-semibold border transition ${
                                    offerInst === inst
                                      ? 'bg-stone-900 text-white border-stone-900'
                                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                  }`}
                                >
                                  {inst === 1 ? '1 (Got.)' : `${inst}r.`}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => buyGoods(sup, offer, 1, offerInst)}
                              disabled={
                                maxCanBuyNow < 1 ||
                                (offerInst === 1 && state.company.finances.stanKonta < cost1)
                              }
                              className="w-full flex justify-between items-center bg-white hover:bg-stone-100 border border-stone-300 px-2.5 py-1.5 rounded transition disabled:opacity-40"
                            >
                              <span className="font-bold">Kup 1 szt.</span>
                              <span className="font-mono font-semibold">{formatMoney(cost1, state)}</span>
                            </button>

                            {remainingOfferStock !== null ? (
                              remainingOfferStock > 1 && maxCanBuyNow > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    buyGoods(sup, offer, Math.min(remainingOfferStock, maxCanBuyNow), offerInst)
                                  }
                                  disabled={
                                    offerInst === 1 && state.company.finances.stanKonta < costAllLimited
                                  }
                                  className="w-full flex justify-between items-center bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1.5 rounded font-semibold transition disabled:opacity-40"
                                >
                                  <span>
                                    Kup maks. ({Math.min(remainingOfferStock, maxCanBuyNow)} szt.)
                                  </span>
                                  <span className="font-mono font-bold">
                                    {formatMoney(costAllLimited, state)}
                                  </span>
                                </button>
                              )
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => buyGoods(sup, offer, 10, offerInst)}
                                  disabled={
                                    maxCanBuyNow < 10 ||
                                    (offerInst === 1 && state.company.finances.stanKonta < cost10)
                                  }
                                  className="w-full flex justify-between items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 px-2.5 py-1.5 rounded transition disabled:opacity-40"
                                >
                                  <div>
                                    <span className="font-bold">Kup 10 szt.</span>
                                    <span className="text-[10px] text-blue-700 font-semibold ml-1 bg-blue-100 px-1 py-0.5 rounded">
                                      -10%
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold">{formatMoney(cost10, state)}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => buyGoods(sup, offer, 50, offerInst)}
                                  disabled={
                                    maxCanBuyNow < 50 ||
                                    (offerInst === 1 && state.company.finances.stanKonta < cost50)
                                  }
                                  className="w-full flex justify-between items-center bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1.5 rounded font-semibold transition disabled:opacity-40"
                                >
                                  <div>
                                    <span>Kup 50 szt.</span>
                                    <span className="text-[10px] text-blue-200 font-semibold ml-1 bg-blue-800/80 px-1 py-0.5 rounded">
                                      -25%
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold">{formatMoney(cost50, state)}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}