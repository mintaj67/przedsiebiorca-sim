import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export function ChaseScreen() {
  const { state, chaseMove, dismissChase } = useGameStore();
  if (!state || !state.activeChase) return null;
  const c = state.activeChase;

  let paintedCount = 0;
  for (let y = 0; y < c.gridSize; y++) {
    for (let x = 0; x < c.gridSize; x++) {
      if (c.grid[y][x] === 1) paintedCount++;
    }
  }
  const paintedPct = Math.round((paintedCount / (c.gridSize * c.gridSize)) * 100);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (c.finished) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dismissChase();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        chaseMove(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        chaseMove(0, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        chaseMove(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        chaseMove(1, 0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [c.finished, chaseMove, dismissChase]);

  const renderCell = (x: number, y: number) => {
    const isPlayer = c.player.x === x && c.player.y === y;
    const isEnemy = c.enemies.some(e => e.x === x && e.y === y);
    const isPainted = c.grid[y][x] === 1;

    let content = '';
    let bg = isPainted ? 'bg-green-800' : 'bg-stone-800';

    if (isPlayer) {
      content = '🏃';
      bg = 'bg-blue-600';
    } else if (isEnemy) {
      content = '🥷';
      bg = 'bg-red-700';
    }

    return (
      <div
        key={`${x}-${y}`}
        className={`aspect-square flex items-center justify-center text-lg md:text-2xl border border-stone-900 ${bg}`}
      >
        {content}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-stone-900 text-stone-100 rounded-lg shadow-2xl max-w-lg w-full p-6 border-4 border-red-900">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-green-500 uppercase tracking-widest mb-1">
            Odstrasz mafię
          </h2>
          <p className="text-stone-400 text-sm">
            Tura {Math.min(c.turn, c.maxTurns)} / {c.maxTurns} · Zamalowano: <b>{paintedPct}%</b> / 40%
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Zamaluj 40% planszy, zanim cię dopadną! (Strzałki lub WASD)
          </p>
        </div>

        {/* Plansza */}
        <div className="grid grid-cols-8 gap-0.5 mb-6 bg-stone-950 p-1 rounded border border-stone-800">
          {Array.from({ length: c.gridSize }).map((_, y) =>
            Array.from({ length: c.gridSize }).map((__, x) => renderCell(x, y))
          )}
        </div>

        {/* Sterowanie */}
        {!c.finished ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => chaseMove(0, -1)}
              className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl"
            >
              ↑
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => chaseMove(-1, 0)}
                className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => chaseMove(0, 1)}
                className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => chaseMove(1, 0)}
                className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl"
              >
                →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div
              className={`text-xl font-bold mb-2 ${
                c.result === 'escaped' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {c.result === 'escaped' ? 'Zamalowałeś ich! Uciekli.' : 'Dopadli cię...'}
            </div>
            <p className="text-xs text-stone-400 mb-4">
              {c.result === 'escaped'
                ? 'Zyskałeś +10 opinii publicznej, ale podpadłeś mafii (-10) i poniosłeś koszty ucieczki.'
                : 'Wysoka kara finansowa, spadek opinii publicznej (-15) i mocne pogorszenie relacji z mafią (-20).'}
            </p>
            <button
              type="button"
              onClick={dismissChase}
              className="bg-stone-100 text-stone-900 w-full py-3 rounded font-bold hover:bg-white"
            >
              Wróć do biura
            </button>
          </div>
        )}
      </div>
    </div>
  );
}