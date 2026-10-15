import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { NewsCategory, NewsItem } from '../../engine/types';

type Tab = 'news' | 'inbox';

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

const NEWS_CATEGORIES: NewsCategory[] = ['poll', 'party', 'economy', 'rumor'];
const INBOX_CATEGORIES: NewsCategory[] = ['custom'];

export function NewsScreen() {
  const { state } = useGameStore();
  const [tab, setTab] = useState<Tab>('news');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!state) return null;

  const allItems = state.news;
  const filtered = allItems.filter(n =>
    tab === 'news' ? NEWS_CATEGORIES.includes(n.category) : INBOX_CATEGORIES.includes(n.category)
  );

  // Auto-select pierwszy news, jak nic nie wybrano lub wybrany nie pasuje
  const selected: NewsItem | null =
    filtered.find(n => n.id === selectedId) ?? filtered[0] ?? null;

  // Reset zaznaczenia przy zmianie zakładki
  useEffect(() => {
    setSelectedId(null);
  }, [tab]);

  const newsCount = allItems.filter(n => NEWS_CATEGORIES.includes(n.category)).length;
  const inboxCount = allItems.filter(n => INBOX_CATEGORIES.includes(n.category)).length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Korespondencja</h1>
      <p className="text-sm text-stone-600 mb-4">
        Doniesienia z ostatnich kwartałów. Plotki często zwiastują ważne wydarzenia.
      </p>

      {/* Zakładki */}
      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'news'} onClick={() => setTab('news')}>
          📰 Newsy {newsCount > 0 && <span className="opacity-60 ml-1">({newsCount})</span>}
        </TabButton>
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')}>
          ✉ Skrzynka odbiorcza {inboxCount > 0 && <span className="opacity-60 ml-1">({inboxCount})</span>}
        </TabButton>
      </div>

      {/* Split layout */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-stone-500">
          {tab === 'news'
            ? 'Brak doniesień. Świat jeszcze nie zauważył twojej firmy.'
            : 'Skrzynka odbiorcza jest pusta.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lista po lewej */}
          <div className="md:col-span-1 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {filtered.map(item => {
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-3 border-b border-stone-100 last:border-b-0 transition ${
                      isSelected ? 'bg-stone-100 border-l-4 border-l-stone-900' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">
                        {item.year} Q{item.quarter}
                      </span>
                    </div>
                    <div className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'} text-stone-900 line-clamp-2`}>
                      {item.headline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Treść po prawej */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-sm p-6">
            {selected ? (
              <article>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${CATEGORY_COLORS[selected.category]}`}>
                    {CATEGORY_LABELS[selected.category]}
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    {selected.year} Q{selected.quarter}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-3">{selected.headline}</h2>
                <p className="text-stone-700 leading-relaxed">
                  {selected.body ?? 'Brak dodatkowych szczegółów.'}
                </p>
              </article>
            ) : (
              <p className="text-stone-500 text-sm">Wybierz wiadomość z listy po lewej.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition ${
        active
          ? 'bg-stone-900 text-white'
          : 'bg-white border border-stone-200 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}