import { useGameStore } from '../../store/gameStore';
import partiesData from '../../data/parties.json';
import type { Party } from '../../engine/types';
import { partyLabel } from '../ui-labels';

export function ElectionScreen({ onClose }: { onClose: () => void }) {
  const { state } = useGameStore();
  if (!state || !state.lastElectionResult) return null;

  const result = state.lastElectionResult;
  const allParties = partiesData as Party[];

  const sorted = Object.entries(result.seats)
    .sort(([, a], [, b]) => b - a)
    .map(([id, seats]) => ({
      id,
      seats,
      party: allParties.find(p => p.id === id),
    }));

  const totalSeats = Object.values(result.seats).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 my-8">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">
          Wyniki wyborów
        </div>
        <h1 className="text-3xl font-bold mb-1">
          Wybory parlamentarne {result.year}
        </h1>
        <p className="text-sm text-stone-600 mb-6">
          Nowy Sejm wybrany
        </p>

        <div className="space-y-2 mb-6">
          {sorted.map(({ id, seats, party }) => {
            const percent = (seats / totalSeats) * 100;
            const isMine = state.ceo.currentPartyId === id;
            const inCoalition = result.coalition.includes(id);
            return (
              <div key={id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">
                    {party?.name ?? id}
                    {isMine && <span className="ml-2 text-xs text-stone-500">(twoja partia)</span>}
                    {inCoalition && <span className="ml-2 text-xs text-amber-600">· w koalicji</span>}
                  </span>
                  <span className="font-mono">
                    {seats} mandatów · {percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-stone-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${isMine ? 'bg-stone-900' : inCoalition ? 'bg-amber-500' : 'bg-stone-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-stone-100 rounded p-4 mb-6 text-sm">
          <p className="mb-1">
            <b>Koalicja rządząca:</b> {result.coalition.map(partyLabel).join(', ') || 'brak'}
          </p>
          <p>
            <b>Nowy premier:</b> {partyLabel(result.premierId)}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-stone-900 text-white py-3 rounded font-bold hover:bg-stone-800"
        >
          OK
        </button>
      </div>
    </div>
  );
}