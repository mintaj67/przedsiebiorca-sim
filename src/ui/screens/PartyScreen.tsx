import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getPartySize } from '../../engine/politics';
import { makeRng } from '../../engine/rng';
import partiesData from '../../data/parties.json';
import type { Party } from '../../engine/types';

const IDEOLOGY_LABELS: Record<string, string> = {
  radical_right: 'Skrajna prawica',
  moderate_right: 'Umiarkowana prawica',
  center: 'Centrum',
  moderate_left: 'Umiarkowana lewica',
  radical_left: 'Skrajna lewica',
};

const SIZE_LABELS: Record<string, string> = {
  very_small: 'Bardzo mała',
  small: 'Mała',
  medium: 'Średnia',
  large: 'Duża',
  very_large: 'Bardzo duża',
};

export function PartyScreen() {
  const { state, joinParty } = useGameStore();

  if (!state) return null;

  const is1989 = state.year <= 1989;
  const switchesLeft = 3 - state.ceo.partySwitchesByPhase[state.phase];
  const myParty = (partiesData as Party[]).find(p => p.id === state.ceo.currentPartyId) ?? null;

  // Ustalamy limit partii (bazowo 4, z komputerem 6)
  const maxChoices = state.company.inventory.includes('komputer') ? 6 : 4;

  // Logika losowania partii (zapewniająca różnorodność)
  const visibleParties = useMemo(() => {
    if (is1989) return []; // W 1989 nie ma wyboru

    // 1. Pobieramy wszystkie dostępne partie
    const active = (partiesData as Party[]).filter(p => {
      if (p.isPSL && !state.politics.pslAvailable) return false;
      const sched = state.politics.partySchedule[p.id];
      const isYearValid = sched ? (state.year >= sched.from && state.year <= sched.to) : (state.year >= p.activeFrom && state.year <= p.activeTo);
      if (!isYearValid) return false;

      if (p.pzprAvailable !== 'both') {
        const playerIsPzpr = state.ceo.party === 'PZPR';
        if (playerIsPzpr && p.pzprAvailable === 'no') return false;
        if (!playerIsPzpr && p.pzprAvailable === 'yes') return false;
      }
      return true;
    });

    // 2. Dzielimy na pule ideologiczne
    const left = active.filter(p => ['radical_left', 'moderate_left'].includes(p.ideology));
    const center = active.filter(p => p.ideology === 'center');
    const right = active.filter(p => ['radical_right', 'moderate_right'].includes(p.ideology));

    // 3. Używamy seedowanego RNG, żeby lista nie zmieniała się przy każdym kliknięciu (tylko co turę)
    const rng = makeRng(state.seed, state.turn * 13 + 7);
    const selected: Party[] = [];

    const addFromPool = (pool: Party[]) => {
      if (selected.length >= maxChoices || pool.length === 0) return;
      const shuffled = [...pool].sort(() => rng.next() - 0.5);
      const pick = shuffled.find(p => !selected.some(s => s.id === p.id));
      if (pick) selected.push(pick);
    };

    // Gwarantujemy po jednej z każdej opcji (jeśli istnieją)
    addFromPool(left);
    addFromPool(center);
    addFromPool(right);

    // Dobijamy resztę wolnymi miejscami (z puli pozostałych partii)
    const remaining = active.filter(p => !selected.some(s => s.id === p.id));
    const shuffledRemaining = [...remaining].sort(() => rng.next() - 0.5);
    
    while (selected.length < maxChoices && shuffledRemaining.length > 0) {
      selected.push(shuffledRemaining.pop()!);
    }

    // Mieszamy ostateczną listę, żeby kolejność na ekranie była losowa
    return selected.sort(() => rng.next() - 0.5);
  }, [state.year, state.turn, state.ceo.party, state.politics.pslAvailable, maxChoices, is1989]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Partie polityczne</h1>

      {is1989 && (
        <div className="bg-amber-100 border border-amber-300 text-amber-900 p-4 rounded-lg mb-6">
          <p className="font-bold">Okres przejściowy</p>
          <p className="text-sm">W 1989 roku trwa Sejm kontraktowy. Dołączanie do partii politycznych będzie możliwe po pierwszych wolnych wyborach w 1990 roku.</p>
        </div>
      )}

      {myParty && (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">Twoja partia</h2>
          <div className="bg-stone-900 text-white rounded-lg p-5">
            <div className="font-bold text-lg">{myParty.name}</div>
            <div className="text-xs text-stone-300 mb-3">
              {IDEOLOGY_LABELS[myParty.ideology]} · {SIZE_LABELS[getPartySize(myParty, state.year)]}
              {state.politics.rulingCoalition.includes(myParty.id) && ' · w koalicji rządzącej'}
            </div>
            <p className="text-sm text-stone-400 italic mb-4">"{myParty.descriptionAfterJoin}"</p>
            <p className="text-xs text-stone-500 border-t border-stone-700 pt-2">
              W tej fazie zmieniłeś partię {state.ceo.partySwitchesByPhase[state.phase]} / 3 razy.
            </p>
          </div>
        </section>
      )}

      {!myParty && !is1989 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8 text-stone-600">
          <p>Nie należysz do żadnej partii.</p>
          <p className="text-xs mt-1">Możesz zmienić partię jeszcze {switchesLeft} razy w tej fazie.</p>
        </div>
      )}

      {!is1989 && (
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-sm uppercase tracking-wide text-stone-500">
              Dostępne opcje (rok {state.year})
            </h2>
            {maxChoices > 4 && (
              <span className="text-xs text-green-700 font-semibold bg-green-100 px-2 py-1 rounded">
                Dzięki komputerowi widzisz więcej partii
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleParties.map(p => {
              const isMine = p.id === state.ceo.currentPartyId;
              const isRuling = state.politics.rulingCoalition.includes(p.id);
              const currentSize = getPartySize(p, state.year);
              const randomDesc = p.descriptions[Math.floor(Math.random() * p.descriptions.length)];

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-lg shadow-sm p-4 border-2 flex flex-col justify-between transition ${
                    isMine ? 'border-stone-900 ring-2 ring-stone-900/20' : isRuling ? 'border-amber-500' : 'border-transparent hover:border-stone-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold leading-tight">{p.name}</h3>
                      <div className="flex gap-1 shrink-0">
                        {isMine && <span className="text-[10px] bg-stone-900 text-white px-1.5 py-0.5 rounded">twoja</span>}
                        {isRuling && !isMine && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded">rządzi</span>}
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 font-semibold mb-2">
                      {IDEOLOGY_LABELS[p.ideology]} · {SIZE_LABELS[currentSize]}
                    </p>
                    <p className="text-xs text-stone-600 italic mb-4">
                      "{randomDesc}"
                    </p>
                  </div>
                  <button
                    onClick={() => joinParty(p.id)}
                    disabled={switchesLeft <= 0 || isMine}
                    className="text-sm bg-stone-900 text-white px-3 py-1.5 rounded disabled:opacity-30 w-full mt-auto"
                  >
                    {isMine ? 'Należysz' : 'Dołącz'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}