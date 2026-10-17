import { useGameStore } from '../../store/gameStore';

export function CombatScreen() {
  const { state, combatMove, dismissCombat } = useGameStore();
  if (!state || !state.activeCombat) return null;
  const c = state.activeCombat;

  const canLawyer = state.company.finances.stateKonta >= 20000;
  const canInfluence = state.company.reputation.opiniaPolitycy > 60;
  const canMafia = state.ceo.inMafia;  

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-stone-900 text-stone-100 rounded-lg shadow-2xl max-w-2xl w-full p-6 border-4 border-stone-700">
        
        {/* Nagłówek */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-red-500 uppercase tracking-widest mb-1">
            Wizyta Urzędnika
          </h2>
          <p className="text-stone-400 text-sm">Runda {c.round} / 10</p>
        </div>

        {/* Paski życia */}
        <div className="flex justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-green-400">Twoja Siła Argumentów</span>
              <span>{c.playerHp} / {c.playerHpMax}</span>
            </div>
            <div className="h-4 bg-stone-800 rounded overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(c.playerHp / c.playerHpMax) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-red-400">Cierpliwość Urzędnika</span>
              <span>{c.enemyHp} / {c.enemyHpMax}</span>
            </div>
            <div className="h-4 bg-stone-800 rounded overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(c.enemyHp / c.enemyHpMax) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Log walki */}
        <div className="bg-black/50 p-4 rounded h-48 overflow-y-auto mb-6 text-sm font-mono space-y-2">
          {c.log.map((entry, i) => (
            <div key={i} className={
              entry.type === 'player' ? 'text-green-300' :
              entry.type === 'enemy' ? 'text-red-300' : 'text-stone-400'
            }>
              {entry.type === 'player' ? '> ' : entry.type === 'enemy' ? '< ' : '* '}
              {entry.text}
            </div>
          ))}
        </div>

        {/* Akcje / Koniec */}
        {!c.finished ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => combatMove('wspolpraca')} className="bg-stone-700 hover:bg-stone-600 p-3 rounded text-left">
              <div className="font-bold">Współpraca</div>
              <div className="text-xs text-stone-400">Zawsze działa. (-10 cierpliwości)</div>
            </button>
            <button onClick={() => combatMove('adwokat')} disabled={!canLawyer} className="bg-stone-700 hover:bg-stone-600 p-3 rounded text-left disabled:opacity-50">
              <div className="font-bold">Wezwij adwokata</div>
              <div className="text-xs text-stone-400">Silny cios. (-20k PLN, -25 cierpliwości)</div>
            </button>
            <button onClick={() => combatMove('klamstwo')} className="bg-stone-700 hover:bg-stone-600 p-3 rounded text-left">
              <div className="font-bold">Kłamstwo</div>
              <div className="text-xs text-stone-400">Bardzo silny cios. 30% szans na obrażenia własne. (-30 cierpliwości)</div>
            </button>
            <button onClick={() => combatMove('wplywy')} disabled={!canInfluence} className="bg-stone-700 hover:bg-stone-600 p-3 rounded text-left disabled:opacity-50">
              <div className="font-bold">Wpływy</div>
              <div className="text-xs text-stone-400">Cios ostateczny. Wymaga opinii polityków &gt;60. (-40 cierpliwości)</div>
            </button>
            <button onClick={() => combatMove('mafia')} disabled={!canMafia} className="bg-stone-700 hover:bg-stone-600 p-3 rounded text-left disabled:opacity-50">
              <div className="font-bold">Wpływy mafii</div>
              <div className="text-xs text-stone-400">Cios ostateczny. Wymaga bycia w mafii. (-50 cierpliwości)</div>
            </button>
          </div>
        ) : (
          <button onClick={dismissCombat} className="w-full bg-stone-100 text-stone-900 py-3 rounded font-bold text-lg hover:bg-white">
            Wyjdź z gabinetu
          </button>
        )}
      </div>
    </div>
  );
}