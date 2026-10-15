import { useGameStore } from '../../store/gameStore';
import activitiesData from '../../data/activities.json';
import type { Activity, EventEffects } from '../../engine/types';
import { REPUTATION_LABELS } from '../labels';

function describeEffects(e: EventEffects | undefined): string[] {
  if (!e) return [];
  const lines: string[] = [];
  if (e.stateKonta) {
    lines.push(`${e.stateKonta > 0 ? '+' : ''}${e.stateKonta.toLocaleString('pl-PL')} PLN`);
  }
  if (e.reputation) {
    for (const [k, v] of Object.entries(e.reputation)) {
      if (v) lines.push(`${REPUTATION_LABELS[k] ?? k}: ${v > 0 ? '+' : ''}${v}`);
    }
  }
  return lines;
}

export function ActivityScreen() {
  const { state, consumeActivity } = useGameStore();
  if (!state) return null;

  const all = activitiesData as Activity[];
  const current = all.filter(a => state.currentActivities.includes(a.id));
  const alreadyChosen = !!state.chosenActivityThisTurn;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Aktywności</h1>
      <p className="text-sm text-stone-600 mb-6">
        {alreadyChosen
          ? `W tej turze wybrałeś już aktywność. Kliknij „Następna tura", aby przejść dalej.`
          : 'Wybierz jedną aktywność na tę turę. Wybór jest ostateczny.'}
      </p>
      <div className="grid gap-3">
        {current.map(a => {
          const chosen = state.chosenActivityThisTurn === a.id;
          const disabled = alreadyChosen;
          const effects = describeEffects(a.effects);
          return (
            <button
              key={a.id}
              onClick={() => !disabled && consumeActivity(a.id)}
              disabled={disabled}
              className={`bg-white rounded-lg shadow-sm border-2 p-4 text-left transition ${
                chosen
                  ? 'border-green-500 bg-green-50'
                  : disabled
                  ? 'opacity-40 cursor-not-allowed border-transparent'
                  : 'border-transparent hover:border-stone-300'
              }`}
            >
              <div className="font-bold">
                {chosen ? '✓ ' : ''}
                {a.label}
              </div>
              <div className="text-sm text-stone-600 mt-1">{a.description}</div>
              {effects.length > 0 && (
                <div className="text-xs text-stone-500 mt-2">
                  Skutki: {effects.join(' · ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}