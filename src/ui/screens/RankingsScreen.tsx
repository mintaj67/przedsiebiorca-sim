import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { computeRanking, SIZE_ORDER } from '../../engine/competition';
import type { RankingRow } from '../../engine/competition';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import type { Trend } from '../../engine/types';

type SortKey = 'rank' | 'name' | 'size' | 'reputation' | 'value' | 'condition' | 'opinion';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'rank', label: '#', align: 'left' },
  { key: 'name', label: 'Firma', align: 'left' },
  { key: 'size', label: 'Rozmiar', align: 'left' },
  { key: 'reputation', label: 'Reputacja', align: 'right' },
  { key: 'value', label: 'Wartość', align: 'right' },
  { key: 'condition', label: 'Kondycja', align: 'right' },
  { key: 'opinion', label: 'Opinia o Tobie', align: 'right' },
];

function sortValue(row: RankingRow, key: SortKey): number | string {
  switch (key) {
    case 'rank': return row.rank;
    case 'name': return row.name.toLocaleLowerCase('pl');
    case 'size': return SIZE_ORDER.indexOf(row.size);
    case 'reputation': return row.reputation;
    case 'value': return row.value;
    case 'condition': return row.condition;
    case 'opinion': return row.opinionOfPlayer ?? -1;
  }
}

function formatValue(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} mld`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} mln`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString('pl-PL')} tys.`;
  return v.toLocaleString('pl-PL');
}

function TrendMark({ t }: { t: Trend }) {
  if (t === 1) return <span aria-label="Wzrost">⬆️</span>;
  if (t === -1) return <span aria-label="Spadek">⬇️</span>;
  return <span aria-label="Bez zmian" className="opacity-40">➡️</span>;
}

export function RankingsScreen() {
  const { state } = useGameStore();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'rank', dir: 'asc' });

  const rows = useMemo(() => (state ? computeRanking(state) : []), [state]);

  const sortedRows = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'pl') : (va as number) - (vb as number);
      return cmp * factor || a.rank - b.rank;
    });
  }, [rows, sort]);

  if (!state) return null;

  const me = rows.find((r) => r.isPlayer);
  const prevRank = state.playerPrev?.rank ?? null;
  const rankDelta = me && prevRank !== null ? prevRank - me.rank : 0;

  const toggleSort = (key: SortKey) => {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'rank' || key === 'name' ? 'asc' : 'desc' },
    );
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-6">
        <h1 className="text-2xl font-bold">Rankingi</h1>
        {me && (
          <div className="bg-stone-900 text-white px-3 py-1 rounded-full text-sm font-bold self-start sm:self-auto">
            Twoje miejsce: {me.rank} / {rows.length}
            {rankDelta !== 0 && (
              <span className="ml-2">{rankDelta > 0 ? `⬆️ +${rankDelta}` : `⬇️ ${rankDelta}`}</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600">
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`p-0 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={`w-full px-3 py-2 hover:bg-stone-50 ${col.align === 'right' ? 'text-right' : 'text-left'} ${active ? 'text-stone-900' : ''}`}
                    >
                      {col.label}
                      {active && <span className="ml-1">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-stone-100 last:border-b-0 ${row.isPlayer ? 'bg-amber-50 font-semibold' : ''}`}
              >
                <td className="px-3 py-2 font-mono">{row.rank}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{COMPANY_SIZE_CONFIG[row.size]?.label ?? row.size}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {Math.round(row.reputation)}% <TrendMark t={row.trend.reputation} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-mono">
                  {formatValue(row.value)} <TrendMark t={row.trend.value} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {Math.round(row.condition)}% <TrendMark t={row.trend.condition} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {row.opinionOfPlayer === null ? (
                    <span className="text-stone-400">—</span>
                  ) : (
                    `${Math.round(row.opinionOfPlayer)}%`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
