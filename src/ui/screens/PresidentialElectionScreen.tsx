import { useGameStore } from '../../store/gameStore';
import partiesData from '../../data/parties.json';
import type { Party } from '../../engine/types';

function displayPartyLabel(partyId: string | null, partyLabel: string | undefined): string {
  if (partyLabel) return partyLabel;
  if (!partyId) return 'niezależny';
  return partyId.replace(/_/g, ' ');
}

export function PresidentialElectionScreen({ onClose }: { onClose: () => void }) {
  const { state } = useGameStore();
  if (!state || !state.lastPresidentialResult) return null;

  const r = state.lastPresidentialResult;
  const allParties = partiesData as Party[];

  const firstRoundSorted = [...r.candidates].sort((a, b) => b.votesPercent - a.votesPercent);

  const partyNameFor = (partyId: string | null) => {
  if (!partyId) return 'niezależny';
  const p = allParties.find(x => x.id === partyId);
  if (p) return p.name;
  return partyId.replace(/_/g, ' ');
};

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 my-8">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">
          Wyniki wyborów
        </div>
        <h1 className="text-3xl font-bold mb-1">
          Wybory prezydenckie {r.year}
        </h1>
        <p className="text-sm text-stone-600 mb-6">
          {r.secondRound ? 'Rozstrzygnięcie w II turze' : 'Rozstrzygnięcie w I turze'}
        </p>

        <div className="bg-stone-900 text-white rounded-lg p-5 mb-6">
          <div className="text-xs uppercase tracking-wide text-stone-400 mb-1">
            {r.secondRound ? 'Zwycięzca II tury' : 'Zwycięzca'}
          </div>
          <div className="text-2xl font-bold">{r.winner.name}</div>
          <div className="text-sm text-stone-300">
            {partyNameFor(r.winner.partyId)}
          </div>
        </div>

        <h2 className="font-bold mb-3 text-stone-800">I tura</h2>
        <div className="space-y-2 mb-6">
          {firstRoundSorted.map(c => {
            const isWinner = c.id === r.winner.id;
            const inSecondRound = r.secondRoundCandidates?.some(x => x.id === c.id);
            return (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={isWinner ? 'font-bold' : ''}>
                    {c.name}
                    <span className="ml-2 text-xs text-stone-500">
                      {partyNameFor(c.partyId)}
                    </span>
                    {inSecondRound && (
                      <span className="ml-2 text-xs text-amber-600">· II tura</span>
                    )}
                  </span>
                  <span className="font-mono">{c.votesPercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-stone-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${isWinner ? 'bg-stone-900' : inSecondRound ? 'bg-amber-500' : 'bg-stone-400'}`}
                    style={{ width: `${c.votesPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {r.secondRound && r.secondRoundCandidates && (
          <>
            <h2 className="font-bold mb-3 text-stone-800">II tura</h2>
            <div className="bg-stone-50 rounded-lg p-4 mb-6 text-sm">
              <p className="mb-2 text-stone-600">
                Żaden kandydat nie zdobył ponad 50% w I turze. Do II tury weszli:
              </p>
              {r.secondRoundCandidates.map(c => (
                <div key={c.id} className="flex justify-between py-1 border-b border-stone-200 last:border-b-0">
                  <span className={c.id === r.winner.id ? 'font-bold' : ''}>
                    {c.name} {c.id === r.winner.id && '(zwycięzca)'}
                  </span>
                  <span className="font-mono">{partyNameFor(c.partyId)}</span>
                </div>
              ))}
            </div>
          </>
        )}

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