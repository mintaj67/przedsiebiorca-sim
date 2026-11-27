import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  computeRanking,
  SIZE_ORDER,
  MAX_PLAYER_ALLIANCES,
  getPlayerAllies,
  getPlayerParentInfo,
} from '../../engine/competition';
import type { RankingRow } from '../../engine/competition';
import { COMPANY_SIZE_CONFIG } from '../../engine/constants';
import { formatMoney } from '../../engine/currency';
import { CompetitorProfile } from '../components/CompetitorProfile';
import type { Trend } from '../../engine/types';

type SortKey = 'rank' | 'name' | 'size' | 'value';
type SortDir = 'asc' | 'desc';
type FilterMode = 'all' | 'branch' | 'inactive';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'rank', label: '#', align: 'left' },
  { key: 'name', label: 'Firma', align: 'left' },
  { key: 'size', label: 'Rozmiar', align: 'left' },
  { key: 'value', label: 'Wartość / Stan konta', align: 'right' },
];

const CATEGORY_SHORT: Record<string, string> = {
  handel: 'H',
  produkcja: 'P',
  uslugi: 'U',
};

function sortValue(row: RankingRow, key: SortKey): number | string {
  switch (key) {
    case 'rank':
      return row.rank;
    case 'name':
      return row.name.toLocaleLowerCase('pl');
    case 'size':
      return SIZE_ORDER.indexOf(row.size);
    case 'value':
      return row.value;
  }
}

function TrendMark({ t }: { t: Trend }) {
  if (t === 1) return <span aria-label="Wzrost">⬆️</span>;
  if (t === -1) return <span aria-label="Spadek">⬇️</span>;
  return <span aria-label="Bez zmian" className="opacity-40">➡️</span>;
}

export function RankingsScreen() {
  const { state } = useGameStore();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'rank', dir: 'asc' });
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  const rows = useMemo(() => (state ? computeRanking(state) : []), [state]);

  const filteredRows = useMemo(() => {
    if (filter === 'branch') {
      return rows.filter((r) => r.isPlayer || r.inPlayerBranch);
    }
    return rows;
  }, [rows, filter]);

  const sortedRows = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, 'pl')
          : (va as number) - (vb as number);
      return cmp * factor || a.rank - b.rank;
    });
  }, [filteredRows, sort]);

  if (!state) return null;

  if (selectedCompId) {
    return (
      <CompetitorProfile
        compId={selectedCompId}
        onBack={() => setSelectedCompId(null)}
        onSelectCompany={(id) => setSelectedCompId(id)}
      />
    );
  }

  const me = rows.find((r) => r.isPlayer);
  const prevRank = state.playerPrev?.rank ?? null;
  const rankDelta = me && prevRank !== null ? prevRank - me.rank : 0;

  const allies = getPlayerAllies(state);
  const parentInfo = getPlayerParentInfo(state);
  const playerWars = (state.activeWars ?? []).filter(
    (w) => w.attackerId === 'player' || w.defenderId === 'player'
  );
  const inactiveComps = (state.competitors ?? []).filter(
    (c) => (c.status ?? 'active') !== 'active'
  );

  const toggleSort = (key: SortKey) => {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'rank' || key === 'name' ? 'asc' : 'desc' }
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Rankingi i firmy</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Kliknij nazwę dowolnej firmy, aby otworzyć jej profil, relacje, sojusze, wojny i przejęcia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-white border border-stone-300 px-3 py-1 rounded-full text-xs font-semibold">
            Interakcje: <span className="font-mono font-bold">{state.interactionPoints}</span>
          </span>
          <span className="bg-white border border-stone-300 px-3 py-1 rounded-full text-xs font-semibold">
            Sojusze: <span className="font-mono font-bold">{allies.length}/{MAX_PLAYER_ALLIANCES}</span>
          </span>
          {me && (
            <div className="bg-stone-900 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
              Twoje miejsce: {me.rank} / {rows.length}
              {rankDelta !== 0 && (
                <span className="ml-2">{rankDelta > 0 ? `⬆️ +${rankDelta}` : `⬇️ ${rankDelta}`}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Paski szybkiego podglądu aktywnych wojen lub spółki-matki */}
      {(playerWars.length > 0 || parentInfo) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {playerWars.map((w) => {
            const enemyId = w.attackerId === 'player' ? w.defenderId : w.attackerId;
            const enemy = state.competitors.find((c) => c.id === enemyId);
            if (!enemy) return null;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedCompId(enemy.id)}
                className="text-xs bg-red-100 hover:bg-red-200 border border-red-300 text-red-950 px-3 py-1.5 rounded-lg font-bold transition"
              >
                ⚔️ Wojna z {enemy.name} (stan: {w.warScore > 0 ? `+${w.warScore}` : w.warScore}) →
              </button>
            );
          })}
          {parentInfo && (
            <button
              type="button"
              onClick={() => setSelectedCompId(parentInfo.parent.id)}
              className="text-xs bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-950 px-3 py-1.5 rounded-lg font-bold transition"
            >
              👑 Spółka-matka: {parentInfo.parent.name} ({parentInfo.percent}% udziałów, irytacja {Math.round(state.company.parentDispleasure ?? 0)}/100) →
            </button>
          )}
        </div>
      )}

      {/* Filtry */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
            filter === 'all'
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          Wszystkie firmy ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('branch')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
            filter === 'branch'
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          Moja branża ({rows.filter((r) => r.isPlayer || r.inPlayerBranch).length})
        </button>
        {inactiveComps.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter('inactive')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              filter === 'inactive'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            Przejęte / Bankruci ({inactiveComps.length})
          </button>
        )}
      </div>

      {/* Tabela aktywnych firm lub archiwum */}
      {filter === 'inactive' ? (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 divide-y divide-stone-100">
          {inactiveComps.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCompId(c.id)}
              className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center justify-between gap-2 transition"
            >
              <div>
                <div className="font-semibold text-sm text-stone-900">{c.name}</div>
                <div className="text-xs text-stone-500">
                  {c.status === 'bankrupt'
                    ? '💀 Zbankrutowała'
                    : c.acquiredBy === 'player'
                      ? `🏛️ Przejęta przez Ciebie${c.subsidiaryIncome ? ` (+${formatMoney(c.subsidiaryIncome, state)}/kw.)` : ''}`
                      : '🏛️ Przejęta przez rywala'}
                </div>
              </div>
              <span className="text-xs text-stone-500 font-semibold">Profil →</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
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
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`w-full px-3 py-2.5 hover:bg-stone-50 ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${active ? 'text-stone-900' : ''}`}
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
                  onClick={() => {
                    if (!row.isPlayer) setSelectedCompId(row.id);
                  }}
                  className={`border-b border-stone-100 last:border-b-0 transition ${
                    row.isPlayer
                      ? 'bg-amber-50 font-semibold'
                      : 'hover:bg-stone-50 cursor-pointer'
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-stone-600">{row.rank}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          row.isPlayer
                            ? 'text-stone-950 font-bold'
                            : 'text-stone-900 font-medium underline-offset-2 hover:underline'
                        }
                      >
                        {row.name}
                      </span>

                      {row.isPlayer && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">
                          Ty
                        </span>
                      )}
                      {row.atWarWithPlayer && (
                        <span
                          title="Stan wojny"
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white"
                        >
                          ⚔️ Wojna
                        </span>
                      )}
                      {row.isAlliedWithPlayer && (
                        <span
                          title="Formalny sojusz"
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white"
                        >
                          🤝 Sojusz
                        </span>
                      )}
                      {row.isPlayerParent && (
                        <span
                          title="Twoja spółka-matka"
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-700 text-white"
                        >
                          👑 Matka
                        </span>
                      )}
                      {row.isSubordinateToPlayer && (
                        <span
                          title="Uzależniona od Ciebie"
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white"
                        >
                          🔗 Zależna
                        </span>
                      )}

                      {!row.isPlayer && row.categories && (
                        <span className="text-[10px] font-mono text-stone-400">
                          [{row.categories.map((c) => CATEGORY_SHORT[c] ?? c).join('/')}]
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-stone-700 whitespace-nowrap">
                    {COMPANY_SIZE_CONFIG[row.size]?.label ?? row.size}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono">
                    {formatMoney(row.value, state)} <TrendMark t={row.trend.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}