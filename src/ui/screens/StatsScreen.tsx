import { useGameStore } from '../../store/gameStore';
import { makeRng } from '../../engine/rng';
import branchesData from '../../data/branches.json';
import partiesData from '../../data/parties.json';
import { partyLabel } from '../ui-labels';

const IDEOLOGY_MAP: Record<string, string> = {
  radical_left: 'lewica', moderate_left: 'lewica', center: 'centrum',
  moderate_right: 'prawica', radical_right: 'prawica'
};

export function StatsScreen() {
  const { state } = useGameStore();
  if (!state) return null;

  const hasTygodnik = state.company.inventory.includes('tygodnik_opinii');
  const rng = makeRng(state.seed, state.year * 13 + 7);
  const macro = state.macroStats || { unemployment: 10, development: 40 }; // Zabezpieczenie

  const presId = state.politics.president?.partyId;
  const premId = state.politics.premierId;
  let cohesion = 0;
  let cohesionText = 'Brak rządu';
  
  if (presId && premId) {
    if (presId === premId) { cohesion = 100; cohesionText = 'Pełna (ta sama partia)'; }
    else {
      const presParty = (partiesData as any[]).find(p => p.id === presId);
      const premParty = (partiesData as any[]).find(p => p.id === premId);
      if (presParty && premParty) {
        const presIdeology = IDEOLOGY_MAP[presParty.ideology];
        const premIdeology = IDEOLOGY_MAP[premParty.ideology];
        if (presIdeology === premIdeology) { cohesion = 60; cohesionText = 'Umiarkowana (ta sama strona)'; }
        else { cohesion = 20; cohesionText = 'Niska (konflikt)'; }
      }
    }
  }

  const rulingParty = (partiesData as any[]).find(p => p.id === premId);
  const econView = rulingParty?.economicView ?? 0;
  const programText = econView > 0 ? `Wolnorynkowy (+${econView})` : econView < 0 ? `Socjalny (${econView})` : 'Centrowy';

  const allCategories = branchesData as any[];
  const promCat = rng.pick(allCategories);
  const unpromCat = rng.pick(allCategories.filter(c => c.id !== promCat.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Statystyki Globalne</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Sytuacja Polityczna</h2>
          <div className="mb-4">
            <div className="text-sm text-stone-500 mb-1">Prezydent: <b className="text-stone-900">{state.politics.president?.name || 'Brak'}</b></div>
            <div className="text-sm text-stone-500 mb-3">Premier: <b className="text-stone-900">{partyLabel(premId)}</b></div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Zgodność rządu</span>
              <span className="font-semibold">{cohesionText}</span>
            </div>
            <div className="h-2 bg-stone-200 rounded">
              <div className={`h-full rounded ${cohesion > 80 ? 'bg-green-500' : cohesion > 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${cohesion}%` }} />
            </div>
          </div>

          <div>
            <div className="text-sm mb-1">Program rządu: <b className="text-stone-900">{programText}</b></div>
            <div className="h-2 bg-stone-200 rounded relative">
              <div className="absolute top-0 bottom-0 w-2 bg-stone-900 rounded-full" style={{ left: `${((econView + 2) / 4) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              <span>Socjalizm</span>
              <span>Wolny Rynek</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Gospodarka</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Rozwój kraju</span>
                <span>{macro.development}%</span>
              </div>
              <div className="h-2 bg-stone-200 rounded"><div className="h-full bg-blue-500 rounded" style={{ width: `${macro.development}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Bezrobocie</span>
                <span>{macro.unemployment}%</span>
              </div>
              <div className="h-2 bg-stone-200 rounded"><div className="h-full bg-red-500 rounded" style={{ width: `${macro.unemployment}%` }} /></div>
              <p className="text-xs text-stone-500 mt-1">
                {macro.unemployment > 15 ? 'Wysokie bezrobocie: łatwiej o tanich pracowników.' : 'Niskie bezrobocie: pracownicy będą żądać lepszych umów.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Prognozy rynkowe</h2>
      {!hasTygodnik ? (
        <div className="bg-stone-100 border border-stone-300 p-4 rounded-lg text-center text-stone-500 text-sm">
          Kup "Tygodnik Opinii" w zakładce Biuro, aby odblokować prognozy i dodatkowe statystyki.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h3 className="font-bold text-green-800 mb-1">Perspektywiczna branża</h3>
            <p className="text-sm text-green-700">W tym roku rynek łaskawie patrzy na: <b>{promCat.name}</b>. Inwestycja tutaj da dodatkowe premie i oferty.</p>
          </div>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h3 className="font-bold text-red-800 mb-1">Nierokująca branża</h3>
            <p className="text-sm text-red-700">Unikaj w tym roku: <b>{unpromCat.name}</b>. Panuje tam zastój i trudno o zysk.</p>
          </div>
        </div>
      )}
    </div>
  );
}