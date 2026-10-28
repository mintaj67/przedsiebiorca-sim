import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ACTIVITY_CHANGE_COOLDOWN } from '../../engine/constants';
import { makeRng } from '../../engine/rng';
import activitiesData from '../../data/activities.json';
import type { ActivityCategory } from '../../engine/types';

export function ChangeActivityScreen() {
  const { state, changeActivity } = useGameStore();
  if (!state) return null;

  const canChange = state.turn - state.company.lastActivityChangeTurn >= ACTIVITY_CHANGE_COOLDOWN;
  const cooldownLeft = ACTIVITY_CHANGE_COOLDOWN - (state.turn - state.company.lastActivityChangeTurn);

  // Losowanie opcji
  const visibleActivities = useMemo(() => {
    const categories = activitiesData as unknown as ActivityCategory[];
    const rng = makeRng(state.seed, state.turn + 50);
    
    // 1. Wybierz główną kategorię
    const mainCat = rng.pick(categories);
    
    // 2. Wybierz 3 opcje z głównej kategorii
    const mainChoices = [...mainCat.activities]
      .sort(() => rng.next() - 0.5)
      .slice(0, 3);
      
    // 3. Wybierz 1 (lub 2) opcje z innych kategorii
    const otherActivities = categories
      .filter(c => c.id !== mainCat.id)
      .flatMap(c => c.activities);
    
    const extraCount = state.company.inventory.includes('komputer') ? 2 : 1;
    const extraChoices = [...otherActivities]
      .sort(() => rng.next() - 0.5)
      .slice(0, extraCount);

    // 4. Połącz i przetasuj, żeby główna kategoria nie była zawsze na górze
    return [...mainChoices, ...extraChoices].sort(() => rng.next() - 0.5);
  }, [state.seed, state.turn, state.company.inventory]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Zmień działalność</h1>
      <p className="text-sm text-stone-600 mb-6">
        {canChange
          ? 'Rynek się zmienia. Wybierz nową branżę, w którą chcesz zainwestować.'
          : `Zmiana działalności będzie możliwa za ${cooldownLeft} ${cooldownLeft === 1 ? 'turę' : 'tury'}.`}
      </p>

      <div className="space-y-2">
        {visibleActivities.map(a => {
          const isCurrent = state.company.activity === a.id;
          return (
            <div
              key={a.id}
              className={`bg-white rounded-lg shadow-sm p-4 border-2 ${
                isCurrent ? 'border-stone-900 bg-stone-50' : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div>
                  <div className="font-bold text-stone-900">
                    {a.name}
                    {isCurrent && <span className="ml-2 text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded">obecna</span>}
                  </div>
                  <div className="text-xs text-stone-500">
                    Reputacja branżowa: {a.rep}% · Powiązania mafijne: {a.mafia}%
                  </div>
                </div>
                <button
                  onClick={() => changeActivity(a.id)}
                  disabled={isCurrent || !canChange}
                  className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {isCurrent ? 'Wybrana' : 'Wybierz'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}