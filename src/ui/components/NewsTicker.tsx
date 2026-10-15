import { useGameStore } from '../../store/gameStore';
import type { NewsCategory } from '../../engine/types';

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  rumor: 'bg-purple-100 text-purple-800',
  poll: 'bg-blue-100 text-blue-800',
  party: 'bg-amber-100 text-amber-800',
  economy: 'bg-green-100 text-green-800',
  custom: 'bg-stone-100 text-stone-700',
};

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  rumor: 'Plotka',
  poll: 'Sondaż',
  party: 'Partia',
  economy: 'Gospodarka',
  custom: 'Ciekawostka',
};

export function NewsTicker({ onOpenArchive }: { onOpenArchive: () => void }) {
  const { state } = useGameStore();
  if (!state) return null;

  const items = state.news.slice(0, 3);

  return (
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-stone-900 mb-6">
      <div className="flex justify-between items-center px-4 py-2 border-b border-stone-100">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
          Najnowsze doniesienia
        </h2>
        <button
          onClick={onOpenArchive}
          className="text-xs text-stone-500 hover:text-stone-900 underline"
        >
          Archiwum →
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400 italic">
          Brak doniesień. Świat jeszcze nie zauważył twojej firmy.
        </p>
      ) : (
        <ul>
          {items.map(item => (
            <li
              key={item.id}
              className="px-4 py-2 border-b border-stone-100 last:border-b-0 flex items-start gap-3"
            >
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold shrink-0 mt-0.5 ${CATEGORY_COLORS[item.category]}`}>
                {CATEGORY_LABELS[item.category]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">
                  {item.headline}
                </p>
                <p className="text-xs text-stone-400 font-mono">
                  {item.year} Q{item.quarter}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}