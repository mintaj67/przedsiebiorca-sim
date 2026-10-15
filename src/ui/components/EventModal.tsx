import type { GameEvent } from '../../engine/types';

export function EventModal({ event, onChoose }: { event: GameEvent; onChoose: (choiceId: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white max-w-lg w-full rounded-lg p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-2">{event.title}</h2>
        <p className="text-stone-700 mb-4">{event.description}</p>
        <div className="flex flex-col gap-2">
          {event.choices.map(c => (
            <button
              key={c.id}
              onClick={() => onChoose(c.id)}
              className="border p-3 rounded text-left hover:bg-stone-50"
            >
              {c.label}
              {c.description && <span className="block text-xs text-stone-500 mt-1">{c.description}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}