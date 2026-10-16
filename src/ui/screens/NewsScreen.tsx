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
    const { state, markNewsRead, resolveNewsChoice, devAddTestNews } = useGameStore();
  const [tab, setTab] = useState<Tab>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!state) return null;

  const allItems = state.news;
  const filtered = allItems.filter(n =>
    tab === 'news' ? NEWS_CATEGORIES.includes(n.category) : INBOX_CATEGORIES.includes(n.category)
  );

  const selected: NewsItem | null =
    filtered.find(n => n.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [tab]);

  // Auto-mark as read when opened, ale tylko jeśli nie ma pending action
  useEffect(() => {
    if (selected && !selected.read && !(selected.choices && !selected.resolved)) {
      markNewsRead(selected.id);
    }
  }, [selected?.id]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const newsCount = allItems.filter(n => NEWS_CATEGORIES.includes(n.category)).length;
  const inboxCount = allItems.filter(n => INBOX_CATEGORIES.includes(n.category)).length;

  const unreadNews = allItems.filter(n =>
    NEWS_CATEGORIES.includes(n.category) &&
    (!n.read || (n.choices && !n.resolved))
  ).length;
  const unreadInbox = allItems.filter(n =>
    INBOX_CATEGORIES.includes(n.category) &&
    (!n.read || (n.choices && !n.resolved))
  ).length;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-1">Korespondencja</h1>
      <p className="text-sm text-stone-600 mb-4">
        Doniesienia z ostatnich kwartałów. Wiadomości z akcją wymagają decyzji.
      </p>

     <button
      onClick={devAddTestNews}
      className="mb-4 bg-red-600 text-white px-3 py-1 rounded text-xs"
     >
        🧪 DEV: Dodaj testową wiadomość
     </button>

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} unread={unreadInbox}>
          ✉ Skrzynka odbiorcza {inboxCount > 0 && <span className="opacity-60 ml-1">({inboxCount})</span>}
        </TabButton>
        <TabButton active={tab === 'news'} onClick={() => setTab('news')} unread={unreadNews}>
          📰 Newsy {newsCount > 0 && <span className="opacity-60 ml-1">({newsCount})</span>}
        </TabButton>
      </div>

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
                const hasPendingAction = !!(item.choices && !item.resolved);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full text-left px-3 py-3 border-b border-stone-100 last:border-b-0 transition ${
                      isSelected ? 'bg-stone-100 border-l-4 border-l-stone-900' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {hasPendingAction && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-500 text-white">
                          AKCJA
                        </span>
                      )}
                      <span className="text-xs text-stone-400 font-mono">
                        {item.year} Q{item.quarter}
                      </span>
                      {(!item.read || hasPendingAction) && (
                        <span className={`w-2 h-2 rounded-full ml-auto ${hasPendingAction ? 'bg-red-500' : 'bg-blue-500'}`} />
                      )}
                    </div>
                    <div className={`text-sm ${isSelected ? 'font-bold' : item.read && !hasPendingAction ? 'font-medium' : 'font-bold'} text-stone-900`}>
                      {item.headline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Treść po prawej */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-sm p-4 md:p-6">
            {selected ? (
              <article>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${CATEGORY_COLORS[selected.category]}`}>
                    {CATEGORY_LABELS[selected.category]}
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    {selected.year} Q{selected.quarter}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-3">{selected.headline}</h2>
                <p className="text-stone-700 leading-relaxed whitespace-pre-line">
                  {selected.body ?? 'Brak dodatkowych szczegółów.'}
                </p>

                {/* Decyzje — jeśli są i nie rozwiązane */}
                {selected.choices && !selected.resolved && (
                  <div className="mt-6 border-t border-stone-200 pt-4">
                    <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">
                      Wymaga decyzji
                      {selected.expiresAtTurn !== undefined && (
                        <span className="ml-2 text-red-600">
                          (wygasa za {Math.max(0, selected.expiresAtTurn - state.turn)} tur)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {selected.choices.map(c => (
                        <button
                          key={c.id}
                          onClick={() => resolveNewsChoice(selected.id, c.id)}
                          className="text-left border-2 border-stone-200 rounded-lg p-3 hover:border-stone-900 hover:bg-stone-50 transition"
                        >
                          <div className="font-semibold">{c.label}</div>
                          {c.description && (
                            <div className="text-xs text-stone-600 mt-1">{c.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Po decyzji — pokaż co wybrałeś */}
                {selected.resolved && selected.resolvedChoiceId && (
                  <div className="mt-6 border-t border-stone-200 pt-4">
                    {selected.resolvedChoiceId === '__expired__' ? (
                      <p className="text-sm text-stone-500 italic">
                        Zignorowano. Sprawa się przedawniła.
                      </p>
                    ) : (
                      <p className="text-sm text-stone-500 italic">
                        Decyzja: {selected.choices?.find(c => c.id === selected.resolvedChoiceId)?.label ?? selected.resolvedChoiceId}
                      </p>
                    )}
                  </div>
                )}
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
  unread,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  unread?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 rounded text-sm font-medium transition ${
        active
          ? 'bg-stone-900 text-white'
          : 'bg-white border border-stone-200 hover:bg-stone-50'
      }`}
    >
      {children}
      {unread !== undefined && unread > 0 && (
        <span className="ml-2 inline-block bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle">
          {unread}
        </span>
      )}
    </button>
  );
}