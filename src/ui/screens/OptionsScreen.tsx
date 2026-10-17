import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { THEMES } from '../themes';

export function OptionsScreen() {
  const { setScreen } = useGameStore();
  const { autosave, defaultPace, showHiddenStats, language, theme, set, reset } = useSettingsStore();
  const [msg, setMsg] = useState('');

  return (
    <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full my-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Opcje</h1>
          <button
            onClick={() => setScreen('menu')}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Powrót
          </button>
        </div>

        <div className="space-y-5">
          <OptionRow
            label="Autozapis"
            description="Automatycznie zapisuje stan gry po każdej akcji."
          >
            <Toggle value={autosave} onChange={v => set('autosave', v)} />
          </OptionRow>

          <OptionRow
            label="Domyślne tempo"
            description="Czy nowa gra ma być rozgrywana w turach kwartalnych, czy rocznych."
          >
            <div className="flex gap-1">
              <SmallButton active={defaultPace === 'quarter'} onClick={() => set('defaultPace', 'quarter')}>
                Kwartał
              </SmallButton>
              <SmallButton active={defaultPace === 'year'} onClick={() => set('defaultPace', 'year')}>
                Rok
              </SmallButton>
            </div>
          </OptionRow>

          <OptionRow
            label="Pokazuj ukryte statystyki"
            description="Opinia w mediach i polityków staną się widoczne. Tryb debugowania."
          >
            <Toggle value={showHiddenStats} onChange={v => set('showHiddenStats', v)} />
          </OptionRow>

          <OptionRow
            label="Język"
            description="Angielska wersja jest w przygotowaniu."
          >
            <div className="flex gap-1">
              <SmallButton active={language === 'pl'} onClick={() => set('language', 'pl')}>
                Polski
              </SmallButton>
              <SmallButton active={language === 'en'} onClick={() => set('language', 'en')}>
                English
              </SmallButton>
            </div>
          </OptionRow>

          <hr className="border-stone-200" />

          <div>
            <label className="block font-semibold text-stone-900 mb-1">Skórka</label>
            <select
              value={theme}
              onChange={e => set('theme', e.target.value as any)}
              className="w-full border border-stone-300 rounded px-3 py-2 bg-white text-stone-900"
            >
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500 mt-2 italic">
              {THEMES.find(t => t.id === theme)?.description}
            </p>
          </div>

          <hr className="border-stone-200" />

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                reset();
                setMsg('Ustawienia przywrócone do domyślnych.');
              }}
              className="border py-2 rounded hover:bg-stone-50"
            >
              Przywróć domyślne ustawienia
            </button>
          </div>

          {msg && <p className="text-sm text-green-700 text-center">{msg}</p>}
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <div className="flex-1">
        <div className="font-semibold text-stone-900">{label}</div>
        <div className="text-xs text-stone-500">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition relative ${
        value ? 'bg-stone-900' : 'bg-stone-300'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${
          value ? 'left-6' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function SmallButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm border ${
        active ? 'bg-stone-900 text-white border-stone-900' : 'bg-white hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}