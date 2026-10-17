import { useGameStore } from '../../store/gameStore';
import partiesData from '../../data/parties.json';
import type { Party } from '../../engine/types';
import { partyLabel } from '../ui-labels';

export function PartyScreen() {
  const { state, joinParty } = useGameStore();
  if (!state) return null;

  const activeParties = (partiesData as Party[]).filter(p => {
    if (p.isPSL && !state.politics.pslAvailable) return false;
    const sched = state.politics.partySchedule[p.id];
    if (!sched) return false;
    return state.year >= sched.from && state.year <= sched.to;
  });
  const myParty = activeParties.find(p => p.id === state.ceo.currentPartyId) ?? null;
  const rulingParties = activeParties.filter(p => state.politics.rulingCoalition.includes(p.id));
  const otherParties = activeParties.filter(
    p => p.id !== state.ceo.currentPartyId && !state.politics.rulingCoalition.includes(p.id)
  );

  const switchesLeft = 3 - state.ceo.partySwitchesByPhase[state.phase];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Partie polityczne</h1>

      {/* PANEL: Twoja partia */}
      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">Twoja partia</h2>
        {myParty ? (
          <div className="bg-stone-900 text-white rounded-lg p-4">
            <div className="font-bold text-lg">{myParty.name}</div>
            <div className="text-xs text-stone-300 mb-2">
              {myParty.ideology} · {myParty.size}
              {state.politics.rulingCoalition.includes(myParty.id) && ' · w koalicji rządzącej'}
            </div>
            <p className="text-xs text-stone-400">
              W tej fazie zmieniłeś partię {state.ceo.partySwitchesByPhase[state.phase]} / 3 razy.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-4 text-stone-600">
            <p>Nie należysz do żadnej partii.</p>
            <p className="text-xs mt-1">
              Możesz zmienić partię jeszcze {switchesLeft} razy w tej fazie.
            </p>
          </div>
        )}
      </section>

      {/* PANEL: Koalicja rządząca */}
      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">Koalicja rządząca</h2>
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-stone-600">Prezydent:</span>
            <b>{state.politics.president?.name ?? 'brak'}</b>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-stone-600">Premier:</span>
            <b>{partyLabel(state.politics.premierId)}</b>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-600">Partie w koalicji:</span>
            <b>{state.politics.rulingCoalition.map(partyLabel).join(', ') || 'brak'}</b>
          </div>
        </div>
      </section>

      {/* PANEL: Wszystkie partie */}
      <section>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">
          Wszystkie partie w grze ({state.year})
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {activeParties.map(p => {
            const isMine = p.id === state.ceo.currentPartyId;
            const isRuling = state.politics.rulingCoalition.includes(p.id);
            return (
              <div
                key={p.id}
                className={`bg-white rounded-lg shadow-sm p-3 border-2 ${
                  isMine ? 'border-stone-900' : isRuling ? 'border-amber-500' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold">{p.name}</h3>
                  {isMine && <span className="text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded">twoja</span>}
                  {isRuling && !isMine && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">rządzi</span>}
                </div>
                <p className="text-xs text-stone-500 mb-2">
                  {p.ideology} · {p.size}
                </p>
                <button
                  onClick={() => joinParty(p.id)}
                  disabled={switchesLeft <= 0 || isMine}
                  className="text-sm bg-stone-900 text-white px-3 py-1 rounded disabled:opacity-30 w-full"
                >
                  {isMine ? 'Należysz' : 'Dołącz'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}