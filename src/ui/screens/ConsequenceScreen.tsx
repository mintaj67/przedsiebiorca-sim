import { useGameStore } from '../../store/gameStore';

export function ConsequenceScreen() {
  const { state, dismissConsequence } = useGameStore();
  if (!state || !state.lastChoiceResult) return null;
  const r = state.lastChoiceResult;

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white max-w-3xl w-full rounded-lg shadow-lg p-8">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">
          Konsekwencje · {r.eventTitle}
        </div>
                <h1 className="text-2xl font-bold mb-2">{r.choiceLabel}</h1>
        {r.outcomeDescription && (
          <p className="text-stone-700 italic mb-4">{r.outcomeDescription}</p>
        )}
        {r.gambleResult && (
          <div className={`inline-block text-sm px-2 py-1 rounded mb-4 ${
            r.gambleResult === 'win' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {r.gambleResult === 'win' ? '✓ Sukces' : '✗ Porażka'}
          </div>
        )}
        <ul className="mb-6 space-y-1">
          {r.consequenceLines.map((line, i) => (
            <li key={i} className="text-stone-800 border-b border-stone-200 py-1">
              {line}
            </li>
          ))}
        </ul>
        <button
          onClick={dismissConsequence}
          className="bg-stone-900 text-white px-6 py-2 rounded hover:bg-stone-800"
        >
          OK, wracam do biura
        </button>
      </div>
    </div>
  );
}