import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { isCompanyInboxItem } from './NewsScreen';
import type { NewsCategory, NewsItem } from '../../engine/types';

type PeriodicalId = 'all' | 'politics' | 'economy' | 'rumors';

interface PeriodicalDef {
  id: PeriodicalId;
  title: string;
  subtitle: string;
  badge: string;
  categories: NewsCategory[];
}

const PERIODICALS: PeriodicalDef[] = [
  {
    id: 'all',
    title: 'Przegląd Prasy',
    subtitle: 'Wszystkie bieżące wydania i doniesienia z kraju',
    badge: 'Wszystkie',
    categories: ['poll', 'party', 'economy', 'rumor'],
  },
  {
    id: 'politics',
    title: 'Kurier Polityczny',
    subtitle: 'Sondaże, przetasowania i nowe ugrupowania',
    badge: 'Polityka',
    categories: ['poll', 'party'],
  },
  {
    id: 'economy',
    title: 'Gazeta Gospodarcza',
    subtitle: 'Sytuacja rynkowa i wiadomości ekonomiczne',
    badge: 'Gospodarka',
    categories: ['economy'],
  },
  {
    id: 'rumors',
    title: 'Kuluary & Plotki',
    subtitle: 'Nieoficjalne doniesienia i pogłoski z miasta',
    badge: 'Plotki',
    categories: ['rumor'],
  },
];

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
  custom: 'Prasa',
};

function getPeriodicalNameForItem(item: NewsItem): string {
  if (item.category === 'rumor') return 'Kuluary & Plotki';
  if (item.category === 'economy') return 'Gazeta Gospodarcza';
  if (item.category === 'poll' || item.category === 'party') return 'Kurier Polityczny';
  return 'Przegląd Prasy';
}

export function GlobalNewsScreen() {
  const { state, markNewsRead } = useGameStore();
  const [activePeriodical, setActivePeriodical] = useState<PeriodicalId>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const publicNews = state ? state.news.filter(n => !isCompanyInboxItem(n)) : [];
  const currentDef = PERIODICALS.find(p => p.id === activePeriodical) ?? PERIODICALS[0];
  const filtered = publicNews.filter(n => currentDef.categories.includes(n.category));
  const selected: NewsItem | null =
    filtered.find(n => n.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [activePeriodical]);

  useEffect(() => {
    if (selected && !selected.read) {
      markNewsRead(selected.id);
    }
  }, [selected?.id, selected?.read, markNewsRead]);

  if (!state) return null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">📰 Newsy i Periodyki</h1>
        <p className="text-sm text-stone-600">
          Kiosk prasowy: doniesienia z kraju, sondaże, zmiany na scenie politycznej oraz kuluarowe plotki.
        </p>
      </div>

      {/* Wybór periodyku */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PERIODICALS.map(per => {
          const isActive = activePeriodical === per.id;
          const itemsForPer = publicNews.filter(n => per.categories.includes(n.category));
          const unreadForPer = itemsForPer.filter(n => !n.read).length;

          return (
            <button
              key={per.id}
              type="button"
              onClick={() => setActivePeriodical(per.id)}
              className={`text-left p-3.5 rounded-lg border-2 transition flex flex-col justify-between ${
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-400 text-stone-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">{per.title}</span>
                  {unreadForPer > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                      {unreadForPer} nowe
                    </span>
                  )}
                </div>
                <p className={`text-xs ${isActive ? 'text-stone-300' : 'text-stone-500'}`}>
                  {per.subtitle}
                </p>
              </div>
              <div className={`text-[11px] font-mono mt-2 pt-2 border-t ${isActive ? 'border-stone-700 text-stone-300' : 'border-stone-100 text-stone-400'}`}>
                Artykuły: {itemsForPer.length}
              </div>
            </button>
          );
        })}
      </div>

      {/* Czytelnia wybranego periodyku */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 text-center text-stone-500">
          Brak wydań w dziale <strong>{currentDef.title}</strong>. Zajrzyj tu w kolejnym kwartale.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Spis artykułów */}
          <div className="md:col-span-1 bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-stone-100 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-700">
              {currentDef.title} · Wydania ({filtered.length})
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {filtered.map(item => {
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3.5 py-3 border-b border-stone-100 last:border-b-0 transition ${
                      isSelected ? 'bg-stone-100 border-l-4 border-l-stone-900' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">
                        {item.year} Q{item.quarter}
                      </span>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 ml-auto" />
                      )}
                    </div>
                    <div className={`text-sm ${isSelected || !item.read ? 'font-bold' : 'font-medium'} text-stone-900`}>
                      {item.headline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Artykuł w stylu periodyku */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-sm border border-stone-200 p-5 md:p-7">
            {selected ? (
              <article>
                <div className="border-b-2 border-stone-900 pb-3 mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-700">
                    {getPeriodicalNameForItem(selected)}
                  </div>
                  <div className="text-xs font-mono text-stone-500">
                    Wydanie: {selected.year} · Kwartał {selected.quarter}
                  </div>
                </div>

                <div className="mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${CATEGORY_COLORS[selected.category]}`}>
                    {CATEGORY_LABELS[selected.category]}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-stone-900 mb-4 leading-snug">
                  {selected.headline}
                </h2>

                <p className="text-stone-700 leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {selected.body ?? 'Krótka notatka agencyjna — brak dodatkowych szczegółów.'}
                </p>
              </article>
            ) : (
              <p className="text-stone-500 text-sm">Wybierz artykuł z listy po lewej.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}