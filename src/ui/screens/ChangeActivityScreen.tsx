import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  ACTIVITY_CHANGE_COOLDOWN,
  COMPANY_EXPANSION_CONFIG,
  BRANCH_COST,
  COMPANY_SIZE_CONFIG,
} from '../../engine/constants';
import {
  getCompanyActivities,
  getCategoryIdsForActivities,
  computeStartingActivityStats,
  getRequiredWorkers,
} from '../../engine/activityHelper';
import branchesData from '../../data/branches.json';
import type { ActivityCategory, CompanySize, Complaint } from '../../engine/types';

interface ChangeActivityScreenProps {
  onNavigateToBuy?: () => void;
  onNavigateToSell?: () => void;
  onNavigateToProduction?: () => void;
  onNavigateToServices?: () => void;
}

const RAW_CATEGORIES = branchesData as ActivityCategory[];

export function ChangeActivityScreen({
  onNavigateToBuy,
  onNavigateToSell,
  onNavigateToProduction,
  onNavigateToServices,
}: ChangeActivityScreenProps) {
  const {
    state,
    changeActivity,
    changeCompanySize,
    buildBranch,
    resolveComplaint,
    buyAd,
  } = useGameStore();

  if (!state) return null;

  const currentActivities = getCompanyActivities(state.company);
  const activeCategories = getCategoryIdsForActivities(currentActivities);

  const hasTrade = activeCategories.includes('handel');
  const hasProduction = activeCategories.includes('produkcja');
  const hasGoodsTrade = hasTrade || hasProduction;
  const hasServices = activeCategories.includes('uslugi');

  const totalWorkers =
    state.company.employees.bezUmowy +
    state.company.employees.zlecenie +
    state.company.employees.uop;
  const currentRequiredWorkers = getRequiredWorkers(state.company.size, activeCategories.length);

  const availableCategories = useMemo(() => {
    return RAW_CATEGORIES.map(cat => ({
      ...cat,
      activities: cat.activities.filter(
        act => !act.locked || state.ceo.flags.includes(`unlock_${act.id}`)
      ),
    }));
  }, [state.ceo.flags]);

  const [checkedCategories, setCheckedCategories] = useState<Record<string, boolean>>({});
  const [subByCategory, setSubByCategory] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextChecked: Record<string, boolean> = {
      handel: false,
      produkcja: false,
      uslugi: false,
    };
    const nextSubs: Record<string, string> = {};

    for (const cat of availableCategories) {
      if (cat.activities[0]) {
        nextSubs[cat.id] = cat.activities[0].id;
      }
      const matchingAct = cat.activities.find(a => currentActivities.includes(a.id));
      if (matchingAct) {
        nextChecked[cat.id] = true;
        nextSubs[cat.id] = matchingAct.id;
      }
    }

    setCheckedCategories(nextChecked);
    setSubByCategory(nextSubs);
  }, [state.company.activity, state.company.activities, availableCategories]);

  const draftCategoryIds = availableCategories
    .map(c => c.id)
    .filter(id => checkedCategories[id]);
  const draftActivities = draftCategoryIds
    .map(catId => subByCategory[catId])
    .filter(Boolean);

  const hasChanges =
    draftActivities.length !== currentActivities.length ||
    draftActivities.some(id => !currentActivities.includes(id));

  const toggleDraftCategory = (catId: string) => {
    setCheckedCategories(prev => {
      const nextVal = !prev[catId];
      const nextState = { ...prev, [catId]: nextVal };

      if (nextVal && catId === 'handel') {
        nextState.produkcja = false;
      } else if (nextVal && catId === 'produkcja') {
        nextState.handel = false;
      }

      const activeCount = Object.values(nextState).filter(Boolean).length;
      if (activeCount === 0) return prev;
      return nextState;
    });
  };

  const draftStats = computeStartingActivityStats(draftActivities);
  const draftRequiredWorkers = getRequiredWorkers(state.company.size, draftCategoryIds.length);

  const sizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'very_large', 'corporation'];
  const currentSizeIndex = sizes.indexOf(state.company.size);
  const nextSize = sizes[currentSizeIndex + 1];
  const nextConfig = nextSize ? COMPANY_EXPANSION_CONFIG[nextSize] : null;

  const turnsSinceChange = state.turn - state.company.lastActivityChangeTurn;
  const canChange = turnsSinceChange >= ACTIVITY_CHANGE_COOLDOWN;
  const turnsLeft = Math.max(0, ACTIVITY_CHANGE_COOLDOWN - turnsSinceChange);

  const currentStock = Object.values(state.company.resources || {}).reduce((a, b) => a + b, 0);
  const capacity =
    state.company.warehouseCapacity ||
    COMPANY_SIZE_CONFIG[state.company.size]?.warehouseCapacity ||
    50;

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">Zarządzanie Działalnością</h1>
        <div
          className={`text-xs px-3 py-1.5 rounded font-semibold ${
            totalWorkers >= currentRequiredWorkers
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-red-100 text-red-900'
          }`}
        >
          Pracownicy: {totalWorkers} / {currentRequiredWorkers} wymaganych ({activeCategories.length}{' '}
          {activeCategories.length === 1 ? 'filar' : 'filary'})
        </div>
      </div>

      {/* 1. ROZMIAR FIRMY I FILIE (NAJWYŻEJ) */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-stone-900">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <div>
            <h2 className="text-lg font-bold">
              Rozmiar firmy: {COMPANY_SIZE_CONFIG[state.company.size]?.label}
            </h2>
            <p className="text-sm text-stone-600">Filie: {state.company.branches}</p>
          </div>
          <div className="flex gap-2">
            {currentSizeIndex > 0 && (
              <button
                onClick={() => changeCompanySize('down')}
                className="px-4 py-2 border border-red-200 text-red-700 bg-red-50 rounded hover:bg-red-100 transition text-sm font-semibold"
              >
                Zmniejsz
              </button>
            )}
            {nextConfig && (
              <button
                onClick={() => changeCompanySize('up')}
                disabled={state.company.finances.stanKonta < nextConfig.cost}
                className="px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800 transition text-sm font-semibold disabled:opacity-50"
              >
                Zwiększ na {COMPANY_SIZE_CONFIG[nextSize]?.label} ({nextConfig.cost.toLocaleString()} PLN)
              </button>
            )}
          </div>
        </div>
        {['large', 'very_large', 'corporation'].includes(state.company.size) && (
          <div className="border-t border-stone-200 pt-4 mt-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm">Ekspansja (Filie)</h3>
            </div>
            <button
              onClick={buildBranch}
              disabled={state.company.finances.stanKonta < BRANCH_COST}
              className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-xs font-semibold disabled:opacity-50"
            >
              Zbuduj filię ({BRANCH_COST.toLocaleString()} PLN)
            </button>
          </div>
        )}
      </div>

      {/* REKLAMACJE */}
      {state.pendingComplaints?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-800 mb-2">⚠ Reklamacje klientów</h2>
          <div className="space-y-2">
            {state.pendingComplaints.map((comp: Complaint) => (
              <div
                key={comp.id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded shadow-sm gap-3"
              >
                <div>
                  <div className="font-semibold text-sm">{comp.buyerName} zwraca towar</div>
                  <div className="text-xs text-stone-500">
                    Zbyt niska jakość. Żądają zwrotu pieniędzy.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveComplaint(comp.id, true)}
                    className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded text-xs font-semibold"
                  >
                    Uznaj (-5k PLN)
                  </button>
                  <button
                    onClick={() => resolveComplaint(comp.id, false)}
                    className="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded text-xs font-semibold"
                  >
                    Odrzuć (-{comp.penalty} rep.)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. AKTYWNE FILARY OPERACYJNE */}
      <div className="space-y-4 mb-6">
        {hasGoodsTrade && (
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">🛒 Dział Handlowy i Magazyn</h2>
                <p className="text-sm text-stone-600">
                  Stan magazynu: <strong>{currentStock} / {capacity} szt.</strong> (Tu sprzedajesz także gotowe wyroby z produkcji).
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
        )}

        {hasProduction && (
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-amber-600">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">🏭 Zakład Produkcyjny</h2>
                <p className="text-sm text-stone-600">
                  Zakup surowców i linia produkcyjna. Wytworzone wyroby trafiają do wspólnego magazynu.
                </p>
              </div>
              <button
                onClick={onNavigateToProduction}
                className="w-full md:w-auto px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded shadow transition text-sm"
              >
                🏭 PRODUKCJA →
              </button>
            </div>
          </div>
        )}

        {hasServices && (
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-600">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">🛎️ Katalog Świadczonych Usług</h2>
                <p className="text-sm text-stone-600">
                  Włączaj i wyłączaj usługi oferowane na stałe w zależności od reputacji, rozmiaru firmy i kadry.
                </p>
              </div>
              <button
                onClick={onNavigateToServices}
                className="w-full md:w-auto px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded shadow transition text-sm"
              >
                🛎️ USŁUGI →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. REKLAMY */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Kampanie Reklamowe</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => buyAd('radio')}
            disabled={state.company.finances.stanKonta < 5000}
            className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"
          >
            <span className="text-lg">📻 Radio</span>
            <span className="text-xs text-stone-500">5 000 PLN</span>
          </button>
          <button
            onClick={() => buyAd('internet')}
            disabled={state.company.finances.stanKonta < 15000}
            className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"
          >
            <span className="text-lg">🌐 Internet</span>
            <span className="text-xs text-stone-500">15 000 PLN</span>
          </button>
          <button
            onClick={() => buyAd('tv')}
            disabled={state.company.finances.stanKonta < 50000}
            className="bg-stone-100 hover:bg-stone-200 px-3 py-3 rounded text-sm font-semibold text-left flex flex-col disabled:opacity-50"
          >
            <span className="text-lg">📺 Telewizja</span>
            <span className="text-xs text-stone-500">50 000 PLN</span>
          </button>
        </div>
      </div>

      {/* 4. ZMIANA PROFILU DZIAŁALNOŚCI */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-xl font-bold">Profil działalności (Przebranżowienie)</h2>
            <p className="text-xs text-stone-500">
              Możesz łączyć Handel z Usługami albo Produkcję + Handel z Usługami. Zmiana możliwa raz na {ACTIVITY_CHANGE_COOLDOWN} kwartały.
            </p>
          </div>
          {!canChange && (
            <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded font-semibold">
              Dostępne za {turnsLeft} {turnsLeft === 1 ? 'turę' : 'tury'}
            </span>
          )}
        </div>

        <div className="space-y-3 mb-4">
          {availableCategories.map(cat => {
            const isChecked = !!checkedCategories[cat.id];
            const isLastActive = isChecked && draftCategoryIds.length <= 1;

            return (
              <div
                key={cat.id}
                className={`border rounded-lg p-3 transition ${
                  isChecked ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex items-center gap-2 font-semibold cursor-pointer min-w-[175px]">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLastActive || !canChange}
                      onChange={() => toggleDraftCategory(cat.id)}
                      className="w-4 h-4 accent-stone-900 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span>{cat.name}</span>
                  </label>

                  {isChecked ? (
                    <select
                      value={subByCategory[cat.id] ?? ''}
                      disabled={!canChange}
                      onChange={e =>
                        setSubByCategory(prev => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      className="flex-1 border p-2 rounded bg-white text-sm disabled:opacity-60"
                    >
                      {cat.activities.map(act => (
                        <option key={act.id} value={act.id}>
                          {act.name} (Rep. branży: {act.rep}, Mafia: {act.mafia})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-stone-400 italic">
                      {cat.id === 'handel' || cat.id === 'produkcja'
                        ? `Zaznacz, aby przejść na ${cat.name} (zastąpi drugi filar towarowy)`
                        : 'Zaznacz, aby rozszerzyć firmę o usługi'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`p-3 rounded-lg border text-xs mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
            draftStats.related
              ? 'bg-stone-100 border-stone-300 text-stone-800'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div>
            {draftActivities.length === 1 ? (
              <span>Wybrano <b>1 filar</b> działalności.</span>
            ) : draftStats.related ? (
              <span>
                ✓ <b>Powiązane branże:</b> brak kary do reputacji branżowej.
              </span>
            ) : (
              <span>
                ⚠ <b>Niepowiązane branże:</b> <b>-20%</b> do reputacji branżowej i reset opinii u mafii na <b>50%</b>.
              </span>
            )}
          </div>
          <div className="flex gap-4 font-semibold shrink-0">
            <span>Nowa rep. branży: {draftStats.branza}%</span>
            <span>Mafia: {draftStats.mafia}%</span>
            <span>Wymagani pracownicy: {draftRequiredWorkers}</span>
          </div>
        </div>

        <button
          onClick={() => changeActivity(draftActivities.join(','))}
          disabled={!canChange || !hasChanges}
          className="px-5 py-2.5 bg-stone-900 text-white rounded font-semibold text-sm hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {!hasChanges
            ? 'Profil aktualnie aktywny'
            : !canChange
              ? `Odczekaj ${turnsLeft} tur`
              : 'Zatwierdź nowy profil działalności'}
        </button>
      </div>
    </div>
  );
}