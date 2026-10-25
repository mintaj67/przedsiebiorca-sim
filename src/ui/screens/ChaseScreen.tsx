import { useGameStore } from '../../store/gameStore';

export function ChaseScreen() {
  const { state, chaseMove, dismissChase } = useGameStore();
  if (!state || !state.activeChase) return null;
  const c = state.activeChase;

  const renderCell = (x: number, y: number) => {
    const isPlayer = c.player.x === x && c.player.y === y;
    const isEnemy = c.enemies.some(e => e.x === x && e.y === y);
    const isPainted = c.grid[y][x] === 1;

    let content = '';
    let bg = isPainted ? 'bg-green-800' : 'bg-stone-800'; // Zielone dla zamalowanych
    
    if (isPlayer) { content = '🏃'; bg = 'bg-blue-600'; }
    else if (isEnemy) { content = '🥷'; bg = 'bg-red-700'; }

    return (
      <div key={`${x}-${y}`} className={`aspect-square flex items-center justify-center text-lg md:text-2xl border border-stone-900 ${bg}`}>
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
          <p className="text-stone-400 text-sm">Tura {c.turn} / {c.maxTurns}</p>
          <p className="text-xs text-stone-500 mt-1">Zamaluj 40% planszy, zanim cię dopadną!</p>
        </div>

        {/* Plansza */}
        <div className="grid grid-cols-8 gap-0.5 mb-6 bg-stone-950 p-1 rounded border border-stone-800">
          {Array.from({ length: c.gridSize }).map((_, y) => (
            Array.from({ length: c.gridSize }).map((_, x) => renderCell(x, y))
          ))}
        </div>

        {/* Sterowanie */}
        {!c.finished ? (
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => chaseMove(0, -1)} className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl">↑</button>
            <div className="flex gap-2">
              <button onClick={() => chaseMove(-1, 0)} className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl">←</button>
              <button onClick={() => chaseMove(0, 1)} className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl">↓</button>
              <button onClick={() => chaseMove(1, 0)} className="bg-stone-700 hover:bg-stone-600 w-16 h-12 rounded font-bold text-xl">→</button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`text-xl font-bold mb-4 ${c.result === 'escaped' ? 'text-green-400' : 'text-red-400'}`}>
              {c.result === 'escaped' ? 'Zamalowałeś ich! Uciekli.' : 'Dopadli cię...'}
            </div>
            <button onClick={dismissChase} className="bg-stone-100 text-stone-900 w-full py-3 rounded font-bold hover:bg-white">
              Wróć do biura
            </button>
          </div>
        )}
      </div>
    </div>
  );
}