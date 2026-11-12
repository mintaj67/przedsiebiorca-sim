import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_DESCRIPTIONS, COMPANY_SIZE_CONFIG } from '../../engine/constants';
import branchesData from '../../data/branches.json';
import type { Difficulty, CompanySize } from '../../engine/types';

const SUFFIXES = ['', '-EX', '-POL'];
const SIZES: CompanySize[] = ['micro', 'small', 'medium'];

export function StartScreen() {
  const { newGame, setScreen, pendingSlotId } = useGameStore();
  
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [companyName, setCompanyName] = useState('Moja Firma');
  const [suffix, setSuffix] = useState('');
  const [size, setSize] = useState<CompanySize>('micro');
  const [inPZPR, setInPZPR] = useState(false);
  
  // Domyślna kategoria i działalność
  const [selectedCategory, setSelectedCategory] = useState(branchesData[0].id);
  const [activity, setActivity] = useState(branchesData[0].activities[0].id);

  const currentCategoryData = branchesData.find((c: any) => c.id === selectedCategory);

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
        <div className="flex flex-row gap-2 mb-6">
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="flex-1 min-w-0 border p-2 rounded"
            placeholder="np. Inter-Fruit"
          />
          <select
            value={suffix}
            onChange={e => setSuffix(e.target.value)}
            className="w-[110px] sm:w-32 shrink-0 border p-2 rounded bg-white"
          >
            {SUFFIXES.map(s => (
              <option key={s} value={s}>{s || '(bez sufiksu)'}</option>
            ))}
          </select>
        </div>

        {/* Działalność (Kategoria + Podkategoria) */}
        <h2 className="font-bold mb-2">Działalność</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              const firstSub = branchesData.find((c: any) => c.id === e.target.value)?.activities[0];
              if (firstSub) setActivity(firstSub.id);
            }}
            className="w-full border p-2 rounded bg-white font-semibold"
          >
            {branchesData.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          
          <select
            value={activity}
            onChange={e => setActivity(e.target.value)}
            className="w-full border p-2 rounded bg-white"
          >
            {currentCategoryData?.activities.map((act: any) => (
              <option key={act.id} value={act.id}>
                {act.name} (Reputacja: {act.rep})
              </option>
            ))}
          </select>
        </div>

        {/* Rozmiar firmy */}
        <h2 className="font-bold mb-2">Rozmiar firmy</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
          {SIZES.map(sz => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
              className={`py-2 rounded border text-center font-semibold text-sm ${
                size === sz ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {COMPANY_SIZE_CONFIG[sz].label}
            </button>
          ))}
        </div>

        {/* Poziom trudności */}
        <h2 className="font-bold mb-2">Poziom trudności</h2>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`py-2 rounded border text-center font-semibold text-sm ${
                difficulty === d ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
              }`}
            >
              {DIFFICULTY_DESCRIPTIONS[d].title}
            </button>
          ))}
        </div>

        {/* Przynależność polityczna */}
        <h2 className="font-bold mb-2">Przynależność polityczna</h2>
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setInPZPR(false)}
            className={`flex-1 py-2 rounded border font-semibold text-sm ${
              !inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Bezpartyjny
          </button>
          <button
            onClick={() => setInPZPR(true)}
            className={`flex-1 py-2 rounded border font-semibold text-sm ${
              inPZPR ? 'bg-stone-900 text-white' : 'bg-white hover:bg-stone-50'
            }`}
          >
            Członek PZPR
          </button>
        </div>

        <button
          onClick={() => {
            if (!pendingSlotId) {
              alert('Nie wybrano slotu. Wróć do menu i wybierz slot.');
              return;
            }
            newGame({
              difficulty, inPZPR, activity,
              companyName: companyName.trim() || 'Moja Firma',
              suffix, size,
            }, pendingSlotId);
          }}
          className="w-full bg-stone-900 text-white py-3 rounded text-lg font-bold hover:bg-stone-800 transition"
        >
          Zacznij: 1 stycznia 1989 →
        </button>
      </div>
    </div>
  );
}