import { useGameStore } from '../../store/gameStore';

export function EventScreen() {
  const { state, resolveEvent } = useGameStore();
  if (!state || state.pendingEvents.length === 0) return null;

  const event = state.pendingEvents[0];

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white max-w-3xl w-full rounded-lg shadow-lg p-8">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">
          Wydarzenie · {state.year} Q{state.quarter}
        </div>
        <h1 className="text-2xl font-bold mb-4">{event.title}</h1>
        <p className="text-stone-700 mb-6">{event.description}</p>
        <div className="flex flex-col gap-2">
          {event.choices.map(c => (
            <button
              key={c.id}
              onClick={() => resolveEvent(event.id, c.id)}
              className="border p-4 rounded text-left hover:bg-stone-50 transition"
            >
              <div className="font-semibold">{c.label}</div>
              {c.description && (
                <div className="text-sm text-stone-600 mt-1">{c.description}</div>
              )}
              {c.gamble && (
                <div className="text-xs text-amber-700 mt-1">
                  ⚠ Wynik losowy (szansa na sukces: {Math.round(c.gamble.winChance * 100)}%)
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}