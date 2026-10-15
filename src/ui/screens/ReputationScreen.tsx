import { useGameStore } from '../../store/gameStore';
import { StatBar } from '../components/StatBar';
import { REPUTATION_LABELS, REPUTATION_DESCRIPTIONS } from '../labels';
import { useSettingsStore } from '../../store/settingsStore';

export function ReputationScreen() {
  const { state } = useGameStore();
  const showHiddenStats = useSettingsStore(s => s.showHiddenStats);
  if (!state) return null;
  const r = state.company.reputation;

  const visible: (keyof typeof r)[] = [
    'branza', 'opiniaPubliczna', 'opiniaPracownicy',
    'opiniaBranza', 'opiniaMafia',
  ];
  const hidden: (keyof typeof r)[] = ['opiniaMedia', 'opiniaPolitycy'];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Reputacja</h1>
      <p className="text-sm text-stone-600 mb-6">
        Reputacja ogólna: <b>{Math.round(r.ogolna)}%</b> — wpływa na dostępne opcje, eventy i relacje z kontrahentami.
      </p>

      <h2 className="font-bold mb-3 text-stone-800">Widoczne statystyki</h2>
      <div className="grid gap-4 mb-8">
        {visible.map(k => (
          <div key={k} className="bg-white rounded-lg shadow-sm p-4">
            <StatBar
  label={REPUTATION_LABELS[k] ?? k}
  value={r[k]}
  hidden={!showHiddenStats}
/>
            <p className="text-xs text-stone-600 mb-3">
  {showHiddenStats
    ? 'Tryb debugowania: widzisz dokładne wartości.'
    : 'Nie widzisz dokładnych wartości — tylko przybliżony stan.'}
</p>
          </div>
        ))}
      </div>

      <h2 className="font-bold mb-3 text-stone-800">Statystyki ukryte</h2>
      <p className="text-xs text-stone-600 mb-3">
        Nie widzisz dokładnych wartości — tylko przybliżony stan. Wpływają na reputację publiczną i branżową.
      </p>
      <div className="grid gap-4">
        {hidden.map(k => (
          <div key={k} className="bg-white rounded-lg shadow-sm p-4">
            <StatBar label={REPUTATION_LABELS[k] ?? k} value={r[k]} hidden />
            <p className="text-xs text-stone-500 mt-2">{REPUTATION_DESCRIPTIONS[k]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}