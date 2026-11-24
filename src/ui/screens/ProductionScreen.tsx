import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import {
  getProductionActivityId,
  getProductionIngredients,
  getProductionTools,
  getTotalProductionWorkers,
  getAvailableProductionWorkers,
  getProductionMarketFactors,
  estimateProductionBatch,
  estimateStoredProducedItem,
} from '../../engine/productionHelper';
import {
  getActivityName,
  getCompanyActivities,
  getMatchingTradeActivitiesForProduction,
} from '../../engine/activityHelper';
import { getRevenueRange } from '../../engine/tradeHelper';
import { scaleByInflation } from '../../engine/economy';
import { formatMoney, formatMoneyRange } from '../../engine/currency';

interface ProductionScreenProps {
  onNavigateToSell?: () => void;
}

export function ProductionScreen({ onNavigateToSell }: ProductionScreenProps) {
  const {
    state,
    buyProductionTool,
    runProductionBatch,
    sellProducedStock,
    rentWarehouse,
    undoLastAction,
  } = useGameStore();

  const debugMode = useSettingsStore(s => s.debugMode);

  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('ing_krajowe');
  const [selectedToolId, setSelectedToolId] = useState<string>('tool_basic');
  const [workersCount, setWorkersCount] = useState<number>(1);
  const [sellPercentMode, setSellPercentMode] = useState<'all' | 'half' | 'store' | 'custom'>('all');
  const [customSellAmount, setCustomSellAmount] = useState<number>(0);
  const [stockSellAmounts, setStockSellAmounts] = useState<Record<string, number>>({});

  if (!state) return null;

  const prodActivityName = getActivityName(getProductionActivityId(state));
  const companyActivities = getCompanyActivities(state.company);
  const matchingTradeItems = getMatchingTradeActivitiesForProduction(companyActivities);
  const canSelfSell = matchingTradeItems.length > 0 && Boolean(onNavigateToSell);

  const totalWorkers = getTotalProductionWorkers(state);
  const availableWorkers = getAvailableProductionWorkers(state);

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity =
    state.company.warehouseCapacity ||
    COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity ||
    50;
  const freeWarehouseSpace = Math.max(0, capacity - currentStock);
  const warehouseRentCost = scaleByInflation(10000, state);

  const marketFactors = useMemo(() => getProductionMarketFactors(state), [state]);
  const ingredients = useMemo(() => getProductionIngredients(state), [state]);
  const tools = useMemo(() => getProductionTools(state), [state]);

  const activeIngredient =
    ingredients.find(i => i.id === selectedIngredientId && i.meetsRequirements) ??
    ingredients.find(i => i.meetsRequirements) ??
    ingredients[0];

  const activeTool =
    tools.find(t => t.id === selectedToolId && t.owned) ??
    tools.find(t => t.owned) ??
    tools[0];

  const safeWorkers =
    availableWorkers > 0 ? Math.min(Math.max(1, workersCount), availableWorkers) : 1;

  const estimate =
    activeIngredient && activeTool
      ? estimateProductionBatch(state, activeIngredient.id, activeTool.id, safeWorkers)
      : null;

  const sellNowAmount = useMemo(() => {
    if (!estimate) return 0;
    if (sellPercentMode === 'all') return estimate.units;
    if (sellPercentMode === 'store') return 0;
    if (sellPercentMode === 'half') return Math.floor(estimate.units / 2);
    return Math.max(0, Math.min(estimate.units, Math.floor(customSellAmount)));
  }, [estimate, sellPercentMode, customSellAmount]);

  const toStoreAmount = estimate ? estimate.units - sellNowAmount : 0;
  const canFitInWarehouse = toStoreAmount <= freeWarehouseSpace;
  const canAffordBatch = estimate ? state.company.finances.stanKonta >= estimate.totalCost : false;

  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const sellNowRange = estimate
    ? getRevenueRange(Math.round(estimate.estimatedUnitPrice * sellNowAmount), accuracy)
    : null;

  const emp = state.company.employees;
  const hiredWorkers = emp.bezUmowy + emp.zlecenie + emp.uop;
  const hasUopBonus = hiredWorkers > 0 && emp.uop / hiredWorkers >= 0.5;

  const storedProducedItems = Object.entries(state.company.resources || {})
    .filter(([resId, amt]) => resId.startsWith('prod_') && (amt as number) > 0)
    .map(([resId]) => estimateStoredProducedItem(state, resId));

  const getStockQty = (resId: string, maxStock: number) => {
    const val = stockSellAmounts[resId];
    if (val === undefined) return maxStock;
    return Math.max(1, Math.min(maxStock, Math.floor(val)));
  };

  const setStockQty = (resId: string, qty: number) => {
    setStockSellAmounts(prev => ({ ...prev, [resId]: qty }));
  };

  const pendingProdSales = (state.pendingSales ?? []).filter(s => s.resId.startsWith('prod_'));
  const undoCount = state.undoStack?.length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* NAGŁÓWEK I ZASOBY */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide">🏭 PRODUKCJA</h1>
          <p className="text-sm text-stone-600">
            Zakład: <strong className="text-stone-900">{prodActivityName}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {undoCount > 0 && (
            <button
              type="button"
              onClick={() => undoLastAction()}
              className="px-3 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 rounded-lg text-xs font-bold shadow-sm transition"
            >
              ↩ Cofnij ostatni ruch
            </button>
          )}
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right">
            <div className="text-[10px] text-stone-500 uppercase font-semibold">Wolna załoga</div>
            <div className={`text-base font-bold font-mono ${availableWorkers === 0 ? 'text-red-600' : 'text-amber-800'}`}>
              {availableWorkers} / {totalWorkers} os.
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2 shadow-sm text-right flex items-center gap-3">
            <div>
              <div className="text-[10px] text-stone-500 uppercase font-semibold">Magazyn</div>
              <div className={`text-base font-bold font-mono ${freeWarehouseSpace === 0 ? 'text-red-600' : 'text-stone-900'}`}>
                {currentStock} / {capacity} szt.
              </div>
            </div>
            <button
              type="button"
              onClick={rentWarehouse}
              disabled={state.company.finances.stanKonta < warehouseRentCost}
              className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-[11px] font-semibold text-stone-800 disabled:opacity-40"
              title={`Powiększ magazyn o +50 szt. za ${formatMoney(warehouseRentCost, state)}`}
            >
              +50 szt. ({formatMoney(warehouseRentCost, state)})
            </button>
          </div>
        </div>
      </div>

      {/* CZYNNIKI RYNKOWE — WIDOCZNE WYŁĄCZNIE W TRYBIE DEBUG */}
      {debugMode && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-lg p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-200 rounded">
                🛠 DEBUG
              </span>
              <span className="text-xs font-bold uppercase tracking-wide">
                Czynniki ceny zbytu
              </span>
            </div>
            <span className="text-xs font-mono font-bold">
              Mnożnik: ×{marketFactors.combinedMultiplier.toFixed(2)} · Indeks cen: {marketFactors.priceIndex.toFixed(2)} · Rozrzut: ±{estimate?.spreadPercent ?? 0}%
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-white border border-amber-200 rounded p-2">
              <div className="text-[10px] text-stone-500 uppercase">Jakość</div>
              <div className="font-bold text-amber-800">{estimate ? `${estimate.quality} / 10` : '—'}</div>
            </div>
            <div className="bg-white border border-amber-200 rounded p-2">
              <div className="text-[10px] text-stone-500 uppercase">Popyt ({marketFactors.demandScore}%)</div>
              <div className="font-bold text-stone-900">
                {marketFactors.demandLabel} (×{marketFactors.demandMultiplier.toFixed(2)})
              </div>
            </div>
            <div className="bg-white border border-amber-200 rounded p-2">
              <div className="text-[10px] text-stone-500 uppercase">Reputacja</div>
              <div className="font-bold text-stone-900">
                {marketFactors.reputationScore}% (×{marketFactors.reputationMultiplier.toFixed(2)})
              </div>
            </div>
            <div className="bg-white border border-amber-200 rounded p-2">
              <div className="text-[10px] text-stone-500 uppercase">Reputacja w branży</div>
              <div className="font-bold text-stone-900">
                {marketFactors.branchRepScore}% (×{marketFactors.branchRepMultiplier.toFixed(2)})
              </div>
            </div>
            <div className="bg-white border border-amber-200 rounded p-2 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-stone-500 uppercase">Inflacja</div>
              <div className="font-bold text-stone-900">{marketFactors.inflationRate.toFixed(1)}% r/r</div>
            </div>
          </div>
        </div>
      )}

      {/* KONFIGURATOR PARTII PRODUKCYJNEJ */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
          <h2 className="text-lg font-bold">1. Konfiguracja produkcji</h2>
          <span
            className={`text-xs px-3 py-1 rounded font-semibold ${
              hasUopBonus ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {hasUopBonus
              ? '★ Premia załogi UoP: +1 do jakości'
              : 'Min. 50% załogi na UoP daje +1 do jakości'}
          </span>
        </div>

        {/* KROK A: SKŁADNIK (LOSOWA PULA W DANYM KWARTALE) */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-stone-700">
              Składnik (oferty w tym kwartale)
            </h3>
            <span className="text-[11px] text-stone-500">
              Pula składników zmienia się co turę
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ingredients.map((ing) => {
              const isSelected = activeIngredient?.id === ing.id;
              return (
                <button
                  key={ing.id}
                  type="button"
                  disabled={!ing.meetsRequirements}
                  onClick={() => setSelectedIngredientId(ing.id)}
                  className={`text-left p-3.5 rounded-lg border-2 transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-stone-900 bg-amber-50/50 shadow-sm'
                      : ing.isCompetitor
                        ? 'border-amber-300 bg-amber-50/20 hover:border-amber-500'
                        : ing.meetsRequirements
                          ? 'border-stone-200 bg-white hover:border-stone-400'
                          : 'border-stone-200 bg-stone-50 opacity-55 cursor-not-allowed'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <span className="font-bold text-sm text-stone-900">{ing.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {ing.isCompetitor && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
                            Konkurencja
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] bg-stone-900 text-white px-1.5 py-0.5 rounded font-bold">
                            WYBRANO
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 mb-2.5">{ing.desc}</p>
                  </div>
                  <div className="text-xs space-y-0.5 border-t border-stone-200/70 pt-2">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Jakość:</span>
                      <span className="font-bold text-amber-800">{ing.quality}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Koszt / szt.:</span>
                      <span className="font-mono font-bold text-stone-900">
                        {formatMoney(ing.effectiveUnitCost, state)}
                      </span>
                    </div>
                    {!ing.meetsRequirements && (
                      <div className="text-[11px] text-red-700 font-semibold pt-1">
                        Wymaga: {ing.missingReasons.join(', ')}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* KROK B: NARZĘDZIA */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-700 mb-2">
            Narzędzia
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tools.map((tool) => {
              const isSelected = tool.owned && activeTool?.id === tool.id;
              const canBuy =
                !tool.owned &&
                tool.meetsRequirements &&
                state.company.finances.stanKonta >= tool.effectiveCost;

              return (
                <div
                  key={tool.id}
                  className={`p-3.5 rounded-lg border-2 flex flex-col justify-between transition ${
                    isSelected
                      ? 'border-stone-900 bg-amber-50/40 shadow-sm'
                      : tool.owned
                        ? 'border-stone-200 bg-white'
                        : 'border-dashed border-stone-300 bg-stone-50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-sm text-stone-900">{tool.name}</span>
                      {tool.owned && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            isSelected ? 'bg-stone-900 text-white' : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {isSelected ? 'AKTYWNE' : 'POSIADANE'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 mb-2.5">{tool.desc}</p>
                    <div className="text-xs space-y-0.5 mb-3">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Wydajność:</span>
                        <span className="font-bold text-stone-900">{tool.unitsPerWorker} szt. / os.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Premia jakości:</span>
                        <span className="font-bold text-amber-800">+{tool.qualityBonus}</span>
                      </div>
                    </div>
                  </div>

                  {tool.owned ? (
                    <button
                      type="button"
                      onClick={() => setSelectedToolId(tool.id)}
                      className={`w-full py-1.5 rounded text-xs font-bold transition ${
                        isSelected
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                      }`}
                    >
                      {isSelected ? '✓ Wybrane' : 'Wybierz'}
                    </button>
                  ) : (
                    <div>
                      {!tool.meetsRequirements && (
                        <div className="text-[11px] text-red-700 font-semibold mb-1.5">
                          Wymaga: {tool.missingReasons.join(', ')}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!canBuy}
                        onClick={() => {
                          buyProductionTool(tool.id);
                          setSelectedToolId(tool.id);
                        }}
                        className="w-full py-1.5 rounded text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Kup ({formatMoney(tool.effectiveCost, state)})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* KROK C: LICZBA PRACOWNIKÓW */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-stone-700">
                Pracownicy
              </h3>
              <p className="text-xs text-stone-500">
                Dostępni w tym kwartale: {availableWorkers} os. (wliczając Prezesa).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={availableWorkers <= 0 || safeWorkers <= 1}
                onClick={() => setWorkersCount(w => Math.max(1, w - 1))}
                className="w-8 h-8 rounded border border-stone-300 bg-white font-bold hover:bg-stone-100 disabled:opacity-40"
              >
                -
              </button>
              <span className="min-w-[64px] text-center font-mono font-bold text-base">
                {availableWorkers > 0 ? `${safeWorkers} os.` : '0 os.'}
              </span>
              <button
                type="button"
                disabled={availableWorkers <= 0 || safeWorkers >= availableWorkers}
                onClick={() => setWorkersCount(w => Math.min(availableWorkers, w + 1))}
                className="w-8 h-8 rounded border border-stone-300 bg-white font-bold hover:bg-stone-100 disabled:opacity-40"
              >
                +
              </button>
              <button
                type="button"
                disabled={availableWorkers <= 0}
                onClick={() => setWorkersCount(Math.max(1, Math.floor(availableWorkers / 2)))}
                className="px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-semibold hover:bg-stone-100 disabled:opacity-40"
              >
                50%
              </button>
              <button
                type="button"
                disabled={availableWorkers <= 0}
                onClick={() => setWorkersCount(availableWorkers)}
                className="px-2.5 py-1.5 rounded border border-stone-900 bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-40"
              >
                Max ({availableWorkers})
              </button>
            </div>
          </div>

          {availableWorkers > 1 && (
            <input
              type="range"
              min={1}
              max={availableWorkers}
              value={safeWorkers}
              onChange={e => setWorkersCount(Number(e.target.value))}
              className="w-full accent-stone-900 cursor-pointer"
            />
          )}
        </div>

        {/* PODSUMOWANIE PARTII */}
        {estimate && (
          <div className="bg-amber-50/70 border-2 border-amber-300 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-md p-3 border border-amber-200">
                <div className="text-[11px] text-stone-500 uppercase font-semibold">
                  Orientacyjna kwota za sztukę
                </div>
                <div className="text-lg font-mono font-bold text-emerald-800 mt-0.5">
                  {formatMoneyRange(estimate.unitMinPrice, estimate.unitMaxPrice, state)}
                </div>
                {debugMode && (
                  <div className="text-[10px] text-stone-500">
                    DEBUG: środek {formatMoney(estimate.estimatedUnitPrice, state)} (±{estimate.spreadPercent}%)
                  </div>
                )}
              </div>

              <div className="bg-white rounded-md p-3 border border-amber-200">
                <div className="text-[11px] text-stone-500 uppercase font-semibold">
                  Wielkość partii
                </div>
                <div className="text-lg font-mono font-bold text-stone-900 mt-0.5">
                  {estimate.units} szt.
                </div>
                <div className="text-[10px] text-stone-500">
                  {safeWorkers} os. × {estimate.tool.unitsPerWorker} szt./os.
                </div>
              </div>

              <div className="bg-white rounded-md p-3 border border-amber-200">
                <div className="text-[11px] text-stone-500 uppercase font-semibold">
                  Jakość wyrobu
                </div>
                <div className="text-lg font-mono font-bold text-amber-800 mt-0.5">
                  {estimate.quality} / 10
                </div>
                <div className="text-[10px] text-stone-500">
                  Składnik {estimate.ingredient.quality} + narzędzie +{estimate.tool.qualityBonus}
                  {hasUopBonus ? ' + UoP +1' : ''}
                </div>
              </div>

              <div className="bg-white rounded-md p-3 border border-amber-200">
                <div className="text-[11px] text-stone-500 uppercase font-semibold">
                  Koszt składników
                </div>
                <div className={`text-lg font-mono font-bold mt-0.5 ${canAffordBatch ? 'text-stone-900' : 'text-red-700'}`}>
                  {formatMoney(estimate.totalCost, state)}
                </div>
                <div className="text-[10px] text-stone-500">
                  {formatMoney(estimate.unitCost, state)} × {estimate.units} szt.
                </div>
              </div>
            </div>

            {/* ZBYT LUB MAGAZYN */}
            <div className="bg-white rounded-md p-3.5 border border-amber-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-stone-700">
                  Przeznaczenie partii ({estimate.units} szt.):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSellPercentMode('all')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                      sellPercentMode === 'all'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-300'
                    }`}
                  >
                    Zbyj całość
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellPercentMode('half')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                      sellPercentMode === 'half'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-300'
                    }`}
                  >
                    Po połowie (50% / 50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellPercentMode('store')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                      sellPercentMode === 'store'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-300'
                    }`}
                  >
                    Do magazynu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSellPercentMode('custom');
                      setCustomSellAmount(Math.min(estimate.units, Math.max(1, Math.floor(estimate.units / 2))));
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                      sellPercentMode === 'custom'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-300'
                    }`}
                  >
                    Własna ilość
                  </button>
                </div>
              </div>

              {sellPercentMode === 'custom' && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-stone-600 shrink-0">Do zbytu:</span>
                  <input
                    type="range"
                    min={0}
                    max={estimate.units}
                    value={sellNowAmount}
                    onChange={e => setCustomSellAmount(Number(e.target.value))}
                    className="flex-1 accent-stone-900"
                  />
                  <span className="font-mono font-bold text-xs min-w-[60px] text-right">
                    {sellNowAmount} / {estimate.units}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1 border-t border-stone-100">
                <div className="space-y-0.5">
                  <div>
                    Zbyt: <strong>{sellNowAmount} szt.</strong>
                    {sellNowAmount > 0 && sellNowRange && (
                      <span className="ml-1.5 font-mono font-bold text-emerald-800">
                        (ok. {formatMoneyRange(sellNowRange.min, sellNowRange.max, state)}, rozliczenie w nast. turze)
                      </span>
                    )}
                  </div>
                  <div>
                    Do magazynu: <strong>{toStoreAmount} szt.</strong>{' '}
                    <span className={canFitInWarehouse ? 'text-stone-500' : 'text-red-700 font-bold'}>
                      (wolne miejsce: {freeWarehouseSpace} szt.)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    availableWorkers <= 0 ||
                    !canAffordBatch ||
                    !canFitInWarehouse ||
                    !activeIngredient?.meetsRequirements ||
                    !activeTool?.owned
                  }
                  onClick={() => {
                    runProductionBatch(
                      activeIngredient.id,
                      activeTool.id,
                      safeWorkers,
                      sellNowAmount
                    );
                  }}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded font-bold text-sm shadow transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {availableWorkers <= 0
                    ? 'Brak wolnej załogi'
                    : !canAffordBatch
                      ? 'Za mało gotówki'
                      : !canFitInWarehouse
                        ? 'Brak miejsca w magazynie'
                        : `⚙️ Produkuj ${estimate.units} szt. (-${formatMoney(estimate.totalCost, state)})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAGAZYN PRODUKCJI */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
          <h2 className="text-lg font-bold">2. Magazyn produkcji</h2>
          {canSelfSell && onNavigateToSell && (
            <button
              type="button"
              onClick={onNavigateToSell}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded text-xs font-bold shadow-sm transition shrink-0"
            >
              💰 Sprzedawaj samodzielnie →
            </button>
          )}
        </div>

        {storedProducedItems.length === 0 ? (
          <div className="text-center py-6 text-stone-500 text-sm bg-stone-50 rounded border border-dashed border-stone-300">
            Brak wyprodukowanych towarów w magazynie.
          </div>
        ) : (
          <div className="space-y-3">
            {storedProducedItems.map((item) => {
              const qty = getStockQty(item.resId, item.stock);
              const totalRange = getRevenueRange(
                Math.round(item.estimatedUnitPrice * qty),
                accuracy
              );

              return (
                <div
                  key={item.resId}
                  className="p-4 bg-stone-50 border border-stone-200 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-sm text-stone-900">
                      {item.label} — Jakość {item.quality}/10
                    </div>
                    <div className="text-xs text-stone-600 mt-0.5">
                      W magazynie: <strong>{item.stock} szt.</strong> · Orientacyjnie:{' '}
                      <span className="font-mono font-bold text-emerald-800">
                        {formatMoneyRange(item.unitMinPrice, item.unitMaxPrice, state)} / szt.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStockQty(item.resId, Math.max(1, Math.floor(item.stock * 0.25)))}
                        className="px-2 py-1 text-[11px] bg-white border border-stone-300 rounded hover:bg-stone-100 font-semibold"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockQty(item.resId, Math.max(1, Math.floor(item.stock * 0.5)))}
                        className="px-2 py-1 text-[11px] bg-white border border-stone-300 rounded hover:bg-stone-100 font-semibold"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockQty(item.resId, item.stock)}
                        className="px-2 py-1 text-[11px] bg-white border border-stone-300 rounded hover:bg-stone-100 font-semibold"
                      >
                        Całość
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.stock}
                        value={qty}
                        onChange={e =>
                          setStockQty(
                            item.resId,
                            Math.max(1, Math.min(item.stock, Number(e.target.value) || 1))
                          )
                        }
                        className="w-16 px-2 py-1 text-xs font-mono border border-stone-300 rounded bg-white text-center"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => sellProducedStock(item.resId, qty)}
                      className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-bold transition whitespace-nowrap"
                    >
                      🚛 Zbyj {qty} szt. ({formatMoneyRange(totalRange.min, totalRange.max, state)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ZBYT OCZEKUJĄCY NA ROZLICZENIE */}
        {pendingProdSales.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="text-xs font-bold text-amber-900">
                🚛 Wysłane do zbytu (rozliczenie w nast. turze):
              </div>
              {undoCount > 0 && (
                <button
                  type="button"
                  onClick={() => undoLastAction()}
                  className="text-[11px] px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-400 text-amber-950 rounded font-bold transition"
                >
                  ↩ Cofnij ostatnią operację
                </button>
              )}
            </div>
            <div className="space-y-1">
              {pendingProdSales.map((sale) => {
                const fallback = getRevenueRange(sale.estimatedRevenue, accuracy);
                return (
                  <div key={sale.id} className="text-xs flex justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-amber-100">
                    <span>
                      <strong>{sale.amount} szt.</strong> (Jakość {sale.quality}/10)
                    </span>
                    <span className="font-mono font-bold text-amber-900">
                      {formatMoneyRange(sale.minRevenue ?? fallback.min, sale.maxRevenue ?? fallback.max, state)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}