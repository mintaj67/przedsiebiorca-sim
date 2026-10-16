import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  DIFFICULTY_DESCRIPTIONS, DIFFICULTY_CONFIG,
  ACTIVITY_REPUTATION, COMPANY_SIZE_CONFIG,
} from '../../engine/constants';
import type { Difficulty, CompanySize } from '../../engine/types';

const ACTIVITIES = [
  { id: 'handel', label: 'Handel' },
  { id: 'produkcja', label: 'Produkcja' },
  { id: 'uslugi', label: 'Usługi' },
  { id: 'it', label: 'IT' },
  { id: 'budowlanka', label: 'Budowlanka' },
  { id: 'gastronomia', label: 'Gastronomia' },
  { id: 'transport', label: 'Transport' },
  { id: 'edukacja', label: 'Edukacja' },
  { id: 'windykacja', label: 'Windykacja' },
];

const SUFFIXES = ['', '-EX', '-POL'];
const SIZES: CompanySize[] = ['micro', 'small', 'medium'];

export function StartScreen() {
  const { newGame, setScreen } = useGameStore();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [companyName, setCompanyName] = useState('Moja Firma');
  const [suffix, setSuffix] = useState('');
  const [activity, setActivity] = useState('handel');
  const [size, setSize] = useState<CompanySize>('micro');
  const [inPZPR, setInPZPR] = useState(false);

  const startCash = Math.round(
    DIFFICULTY_CONFIG[difficulty].startingCash * COMPANY_SIZE_CONFIG[size].cashMultiplier
  );

  return (
    <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-6 md:p-8">
        <button
          onClick={() => setScreen('menu')}
          className="text-sm text-stone-500 hover:text-stone-900 mb-4"
        >
          ← Powrót do menu
        </button>

        <h1 className="text-3xl font-bold mb-1">Nowa gra</h1>
        <p className="text-stone-600 mb-6">1 stycznia 1989. Reforma Wilczka wchodzi w życie.</p>

        {/* Nazwa firmy */}
        <h2 className="font-bold mb-2">Nazwa firmy</h2>
        <div className="flex gap-2 mb-6">
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="flex-1 border p-2 rounded"
            placeholder="np. Inter-Fruit"
          />
          <select
            value={suffix}
            onChange={e => setSuffix(e.target.value)}
            className="border p-2 rounded bg-white"
          >
            {SUFFIXES.map(s => (
              <option key={s} value={s}>{s || '(bez sufiksu)'}</option>
            ))}
          </select>
        </div>

        {/* Działalność */}
        <h2 className="font-bold mb-2">Działalność</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {ACTIVITIES.map(a => (
            <button
              key={a.id}
              onClick={() => setActivity(a.id)}
              className={`px-3 py-1.5 rounded text-sm border ${
                activity === a.id ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {a.label} ({ACTIVITY_REPUTATION[a.id] ?? 50})
            </button>
          ))}
        </div>

        {/* Rozmiar firmy */}
        <h2 className="font-bold mb-2">Rozmiar firmy</h2>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {SIZES.map(sz => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
              className={`py-3 rounded border text-center font-semibold ${
                size === sz ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {COMPANY_SIZE_CONFIG[sz].label}
            </button>
          ))}
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded p-3 mb-6 text-sm text-stone-700">
          <div className="text-xs text-stone-500 mb-1">
            Wymaganych pracowników: <b>{COMPANY_SIZE_CONFIG[size].requiredWorkers}</b> ·
            Mnożnik kapitału: <b>×{COMPANY_SIZE_CONFIG[size].cashMultiplier}</b>
          </div>
          {COMPANY_SIZE_CONFIG[size].description}
        </div>

        {/* Poziom trudności */}
        <h2 className="font-bold mb-2">Poziom trudności</h2>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`py-3 rounded border text-center font-semibold ${
                difficulty === d ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {DIFFICULTY_DESCRIPTIONS[d].title}
            </button>
          ))}
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded p-3 mb-6 text-sm text-stone-700">
          <div className="text-xs text-stone-500 mb-1">
            Startowy kapitał: <b>{startCash.toLocaleString('pl-PL')} PLN</b>
          </div>
          {DIFFICULTY_DESCRIPTIONS[difficulty].description}
        </div>

        {/* Przynależność polityczna */}
        <h2 className="font-bold mb-2">Przynależność polityczna</h2>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setInPZPR(false)}
            className={`flex-1 py-3 rounded border font-semibold ${
              !inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Bezpartyjny
          </button>
          <button
            onClick={() => setInPZPR(true)}
            className={`flex-1 py-3 rounded border font-semibold ${
              inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Członek PZPR
          </button>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded p-3 mb-6 text-sm text-stone-700">
          {inPZPR
            ? 'Dostęp do postkomunistycznych ugrupowań i znajomości w aparacie. Ale po 1989 możesz zostać rozliczony.'
            : 'Czysty życiorys. Trudniejszy start, ale żadnych obciążeń po transformacji.'}
        </div>

        <button
          onClick={() => newGame({
            difficulty, inPZPR, activity,
            companyName: companyName.trim() || 'Moja Firma',
            suffix, size,
          })}
          className="w-full bg-stone-900 text-white py-3 rounded text-lg font-bold hover:bg-stone-800"
        >
          Zacznij: 1 stycznia 1989 →
        </button>
      </div>
    </div>
  );
}