import { useGameStore } from '../../store/gameStore';
import { ACTIVITY_REPUTATION, ACTIVITY_CHANGE_COOLDOWN } from '../../engine/constants';

const ACTIVITIES: { id: string; label: string; description: string }[] = [
  { id: 'handel', label: 'Handel', description: 'Sklep, hurtownia, dystrybucja. Niskie bariery wejścia, konkurencyjny rynek.' },
  { id: 'produkcja', label: 'Produkcja', description: 'Wytwarzanie towarów. Większe inwestycje, ale i wyższe marże.' },
  { id: 'uslugi', label: 'Usługi', description: 'Rzemiosło, naprawy, drobne usługi. Elastyczne, opłacalne przy dobrej opinii.' },
  { id: 'it', label: 'IT', description: 'Nowe technologie. Wysoka reputacja branżowa, ale wymaga wykwalifikowanych pracowników.' },
  { id: 'budowlanka', label: 'Budowlanka', description: 'Budowa i remonty. Sezonowa, ryzykowna, ale kontrakty są duże.' },
  { id: 'gastronomia', label: 'Gastronomia', description: 'Bary, restauracje, catering. Zależna od lokalizacji i mody.' },
  { id: 'transport', label: 'Transport', description: 'Przewóz towarów i osób. Kapitałochłonna, wrażliwa na ceny paliw.' },
  { id: 'edukacja', label: 'Edukacja', description: 'Szkoły, kursy, szkolenia. Wysoka reputacja, ale trudno skalować.' },
  { id: 'windykacja', label: 'Windykacja', description: 'Odzyskiwanie długów. Niska reputacja branżowa, ale szybkie zyski.' },
];

export function ChangeActivityScreen() {
  const { state, changeActivity } = useGameStore();
  if (!state) return null;

  const canChange = state.turn - state.company.lastActivityChangeTurn >= ACTIVITY_CHANGE_COOLDOWN;
  const cooldownLeft = ACTIVITY_CHANGE_COOLDOWN - (state.turn - state.company.lastActivityChangeTurn);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Zmień działalność</h1>
      <p className="text-sm text-stone-600 mb-6">
        {canChange
          ? 'Zmiana działalności wpływa na reputację branżową i przychody. Wybieraj świadomie.'
          : `Zmiana działalności będzie możliwa za ${cooldownLeft} ${cooldownLeft === 1 ? 'turę' : 'tury'}.`}
      </p>

      <div className="space-y-2">
        {ACTIVITIES.map(a => {
          const isCurrent = state.company.activity === a.id;
          const rep = ACTIVITY_REPUTATION[a.id] ?? 50;
          return (
            <div
              key={a.id}
              className={`bg-white rounded-lg shadow-sm p-4 border-2 ${
                isCurrent ? 'border-stone-900' : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div>
                  <div className="font-bold text-stone-900">
                    {a.label}
                    {isCurrent && <span className="ml-2 text-xs bg-stone-900 text-white px-1.5 py-0.5 rounded">obecna</span>}
                  </div>
                  <div className="text-xs text-stone-500">
                    Reputacja branżowa: {rep}%
                  </div>
                </div>
                <button
                  onClick={() => changeActivity(a.id)}
                  disabled={isCurrent || !canChange}
                  className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {isCurrent ? 'Wybrana' : 'Wybierz'}
                </button>
              </div>
              <p className="text-sm text-stone-600">{a.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}