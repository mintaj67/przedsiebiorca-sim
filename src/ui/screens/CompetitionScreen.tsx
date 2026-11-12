import { useGameStore } from '../../store/gameStore';
import { INTERACTIONS_PER_TURN } from '../../engine/competition';

export function CompetitionScreen() {
  const { state, interactCompetitor } = useGameStore();
  if (!state) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold">Konkurencja</h1>
          <p className="text-sm text-stone-500">Wpływaj na rynek i dbaj o swoją pozycję.</p>
        </div>
        <div className="bg-stone-900 text-white px-3 py-1 rounded-full text-sm font-bold">
          Pozostałe interakcje: {state.interactionPoints} / {INTERACTIONS_PER_TURN}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(state.competitors ?? []).map((comp) => {
          const rep = Math.round(comp.reputation);
          return (
            <div key={comp.id} className="bg-white p-4 rounded-lg shadow-sm border border-stone-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg">{comp.name}</h3>
                <p className="text-xs text-stone-500 mb-3">{comp.description}</p>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-600">Ich reputacja:</span>
                  <span className="font-semibold">{rep}%</span>
                </div>
                <div className="h-2 bg-stone-200 rounded mb-4">
                  <div className="h-full bg-stone-400 rounded" style={{ width: `${rep}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => interactCompetitor(comp.id, 'positive')}
                  disabled={state.interactionPoints <= 0}
                  className="flex-1 bg-green-100 text-green-800 text-xs py-2 rounded font-semibold hover:bg-green-200 disabled:opacity-50"
                >
                  Współpraca (+Ich rep, +Twoja)
                </button>
                <button
                  onClick={() => interactCompetitor(comp.id, 'negative')}
                  disabled={state.interactionPoints <= 0}
                  className="flex-1 bg-red-100 text-red-800 text-xs py-2 rounded font-semibold hover:bg-red-200 disabled:opacity-50"
                >
                  Sabotaż (Ryzyko)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
