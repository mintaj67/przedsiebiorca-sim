import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { NewsCategory, NewsItem } from '../../engine/types';

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
  economy: 'Raport',
  custom: 'Wiadomość',
};

/**
 * Rozdziela korespondencję prywatną/firmową (Skrzynka odbiorcza w Wiadomościach)
 * od prasy i doniesień publicznych (Newsy / Periodyki w Globalnych).
 */
export function isCompanyInboxItem(item: NewsItem): boolean {
  if (item.choices && item.choices.length > 0) return true;
  if (item.category === 'custom') return true;
  if (
    item.id.startsWith('sales_report_') ||
    item.id.startsWith('services_report_') ||
    item.id.startsWith('hires_joined_') ||
    item.id.startsWith('debug_msg_')
  ) {
    return true;
  }
  return false;
}

export function NewsScreen() {
  const { state, markNewsRead, resolveNewsChoice } = useGameStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inboxItems = state ? state.news.filter(isCompanyInboxItem) : [];
  const selected: NewsItem | null =
    inboxItems.find(n => n.id === selectedId) ?? inboxItems[0] ?? null;

  useEffect(() => {
    if (selected && !selected.read && !(selected.choices && !selected.resolved)) {
      markNewsRead(selected.id);
    }
  }, [selected?.id, selected?.read, selected?.resolved, markNewsRead]);

  if (!state) return null;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">✉ Skrzynka odbiorcza</h1>
          <p className="text-sm text-stone-600">
            Korespondencja firmowa, raporty rozliczeń i sprawy wymagające decyzji. Prasę i plotki znajdziesz w zakładce <b>Globalne → Newsy</b>.
          </p>
        </div>
        <span className="text-xs font-semibold bg-stone-200 text-stone-800 px-3 py-1 rounded-full self-start sm:self-auto">
          Wiadomości: {inboxItems.length}
        </span>
      </div>

      {inboxItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-stone-500">
          Skrzynka odbiorcza jest pusta.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lista po lewej */}
          <div className="md:col-span-1 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {inboxItems.map(item => {
                const isSelected = selected?.id === item.id;
                const hasPendingAction = !!(item.choices && !item.resolved);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
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