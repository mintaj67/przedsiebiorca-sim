import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_DESCRIPTIONS, COMPANY_SIZE_CONFIG } from '../../engine/constants';
import {
  computeStartingActivityStats,
  getRequiredWorkers,
  getCompanyPrefix,
  formatCompanyName,
  canSelfSellProducedGoods,
} from '../../engine/activityHelper';
import branchesData from '../../data/branches.json';
import type { Difficulty, CompanySize, ActivityCategory } from '../../engine/types';

const SUFFIXES = ['', '-EX', '-POL'];
const SIZES: CompanySize[] = ['micro', 'small', 'medium'];
const CATEGORIES = (branchesData as ActivityCategory[]).map(cat => ({
  ...cat,
  activities: cat.activities.filter(act => !act.locked),
}));

export function StartScreen() {
  const { newGame, setScreen, pendingSlotId } = useGameStore();

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [companyName, setCompanyName] = useState('Moja Firma');
  const [suffix, setSuffix] = useState('');
  const [usePrefix, setUsePrefix] = useState(true);
  const [size, setSize] = useState<CompanySize>('micro');
  const [inPZPR, setInPZPR] = useState(false);

  const [checkedCategories, setCheckedCategories] = useState<Record<string, boolean>>({
    handel: true,
    produkcja: false,
    uslugi: false,
  });

  const [subByCategory, setSubByCategory] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      if (cat.activities[0]) {
        init[cat.id] = cat.activities[0].id;
      }
    }
    return init;
  });

  const activeCategoryIds = CATEGORIES.map(c => c.id).filter(id => checkedCategories[id]);
  const selectedActivities = activeCategoryIds
    .map(catId => subByCategory[catId])
    .filter(Boolean);

  const toggleCategory = (catId: string) => {
    setCheckedCategories(prev => {
      const nextValue = !prev[catId];
      const nextState = { ...prev, [catId]: nextValue };

      const activeCount = Object.values(nextState).filter(Boolean).length;
      if (activeCount === 0) {
        return prev;
      }
      return nextState;
    });
  };

  const { branza, mafia, related } = computeStartingActivityStats(selectedActivities);
  const requiredWorkers = getRequiredWorkers(size, activeCategoryIds.length);
  const prefix = getCompanyPrefix(selectedActivities);
  const fullNamePreview = formatCompanyName({
    name: companyName.trim() || 'Moja Firma',
    suffix,
    usePrefix,
    activity: selectedActivities[0] ?? '',
    activities: selectedActivities,
  });

  const hasBothProdAndTrade =
    activeCategoryIds.includes('produkcja') && activeCategoryIds.includes('handel');
  const canSelfSell = hasBothProdAndTrade && canSelfSellProducedGoods(selectedActivities);

  return (
    <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-6 md:p-8">
        <button
          onClick={() => setScreen('menu')}
          className="text-sm text-stone-500 hover:text-stone-900 mb-4"
        >
          ← Powrót do menu
        </button>

        <h1 className="text-3xl font-bold mb-1">Nowa gra</h1>
        <p className="text-stone-600 mb-6">1 stycznia 1989. Reforma Wilczka wchodzi w życie.</p>

        {/* Nazwa firmy */}
        <h2 className="font-bold mb-2">Nazwa firmy</h2>
        <div className="flex flex-row gap-2 mb-2">
          {usePrefix && prefix && (
            <div className="px-3 py-2 rounded border border-stone-300 bg-stone-100 font-bold text-stone-900 flex items-center shrink-0">
              {prefix}
            </div>
          )}
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="flex-1 min-w-0 border p-2 rounded"
            placeholder="np. Inter-Fruit"
          />
          <select
            value={suffix}
            onChange={e => setSuffix(e.target.value)}
            className="w-[110px] sm:w-32 shrink-0 border p-2 rounded bg-white"
          >
            {SUFFIXES.map(s => (
              <option key={s} value={s}>{s || '(bez sufiksu)'}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 text-xs text-stone-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={usePrefix}
              onChange={e => setUsePrefix(e.target.checked)}
              className="w-4 h-4 accent-stone-900 cursor-pointer"
            />
            <span>Dodawaj automatyczny skrót profilu przed nazwą ({prefix || 'P...'})</span>
          </label>
          <span>
            Podgląd: <strong className="text-stone-900">{fullNamePreview}</strong>
          </span>
        </div>
            
        {/* Działalność (3 niezależne filary) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
          <h2 className="font-bold">Działalność (Handel, Produkcja, Usługi)</h2>
          <span className="text-xs text-stone-500">
            Możesz łączyć dowolne filary (od 1 do 3 naraz)
          </span>
        </div>

        <div className="space-y-3 mb-3">
          {CATEGORIES.map(cat => {
            const isChecked = !!checkedCategories[cat.id];
            const isLastActive = isChecked && activeCategoryIds.length <= 1;

            return (
              <div
                key={cat.id}
                className={`border rounded-lg p-3 transition ${
                  isChecked ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="flex items-center gap-2 font-semibold cursor-pointer min-w-[140px]">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLastActive}
                      onChange={() => toggleCategory(cat.id)}
                      className="w-4 h-4 accent-stone-900 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span>{cat.name}</span>
                  </label>

                  {isChecked ? (
                    <select
                      value={subByCategory[cat.id] ?? ''}
                      onChange={e =>
                        setSubByCategory(prev => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      className="flex-1 border p-2 rounded bg-white text-sm"
                    >
                      {cat.activities.map(act => (
                        <option key={act.id} value={act.id}>
                          {act.name} (Reputacja: {act.rep}, Mafia: {act.mafia})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-stone-400 italic">
                      Zaznacz, aby dodać filar: {cat.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Podsumowanie synergii i wymogów */}
        <div
          className={`p-3 rounded-lg border text-xs mb-6 space-y-1.5 ${
            related
              ? 'bg-stone-100 border-stone-300 text-stone-800'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              {selectedActivities.length === 1 ? (
                <span>Wybrano <b>1 filar</b> działalności (skrót: <b>{prefix}</b>).</span>
              ) : related ? (
                <span>
                  ✓ <b>Spójny profil działalności ({prefix}):</b> wybrane branże są ze sobą powiązane (brak kary do reputacji).
                </span>
              ) : (
                <span>
                  ⚠ <b>Niespójny profil ({prefix}):</b> niepowiązane podkategorie dają <b>-20%</b> do reputacji branżowej i ustawiają startową opinię u mafii na <b>50%</b>.
                </span>
              )}
            </div>
            <div className="flex gap-4 font-semibold shrink-0">
              <span>Reputacja branży: {branza}%</span>
              <span>Mafia (start): {mafia}%</span>
              <span>Wymagani pracownicy: {requiredWorkers}</span>
            </div>
          </div>

          {hasBothProdAndTrade && (
            <div className={`pt-1 border-t ${related ? 'border-stone-200' : 'border-amber-200'}`}>
              {canSelfSell ? (
                <span className="text-emerald-800 font-semibold">
                  ✓ Profil handlowy pasuje do produkcji — własne wyroby będziesz mógł sprzedawać także samodzielnie w zakładce Sprzedawaj.
                </span>
              ) : (
                <span>
                  ℹ Wybrany profil handlowy nie pokrywa się branżowo z produkcją — własne wyroby zbędziesz hurtowo na ekranie Produkcja.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rozmiar firmy */}
        <h2 className="font-bold mb-2">Rozmiar firmy</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
          {SIZES.map(sz => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
              className={`py-2 rounded border text-center font-semibold text-sm ${
                size === sz ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {COMPANY_SIZE_CONFIG[sz].label}
            </button>
          ))}
        </div>

        {/* Poziom trudności */}
        <h2 className="font-bold mb-2">Poziom trudności</h2>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`py-2 rounded border text-center font-semibold text-sm ${
                difficulty === d ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {DIFFICULTY_DESCRIPTIONS[d].title}
            </button>
          ))}
        </div>

        {/* Przynależność polityczna */}
        <h2 className="font-bold mb-2">Przynależność polityczna</h2>
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setInPZPR(false)}
            className={`flex-1 py-2 rounded border font-semibold text-sm ${
              !inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Bezpartyjny
          </button>
          <button
            onClick={() => setInPZPR(true)}
            className={`flex-1 py-2 rounded border font-semibold text-sm ${
              inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Członek PZPR
          </button>
        </div>

        <button
          onClick={() => {
            if (!pendingSlotId) {
              alert('Nie wybrano slotu. Wróć do menu i wybierz slot.');
              return;
            }
            newGame(
              {
                difficulty,
                inPZPR,
                activity: selectedActivities.join(','),
                activities: selectedActivities,
                companyName: companyName.trim() || 'Moja Firma',
                suffix,
                usePrefix,
                size,
              },
              pendingSlotId
            );
          }}
          className="w-full bg-stone-900 text-white py-3 rounded text-lg font-bold hover:bg-stone-800 transition"
        >
          Zacznij: 1 stycznia 1989 →
        </button>
      </div>
    </div>
  );
}