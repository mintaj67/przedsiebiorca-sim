import { useGameStore } from '../../store/gameStore';

export function MainMenu() {
  const { setScreen, loadGame, hasSave } = useGameStore();
  const saveExists = hasSave();

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-10 max-w-md w-full text-center">
        {/* Logo placeholder */}
        <div className="w-48 h-28 mx-auto mb-6 bg-stone-100 border-2 border-dashed border-stone-300 rounded flex items-center justify-center">
          <span className="text-stone-400 text-xs uppercase tracking-widest">Logo</span>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setScreen('start')}
            className="bg-stone-900 text-white py-3 rounded font-bold hover:bg-stone-800"
          >
            Nowa gra
          </button>

          <button
            onClick={() => loadGame()}
            disabled={!saveExists}
            className="border py-3 rounded font-bold hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Wczytaj
          </button>

          <button
            onClick={() => setScreen('options')}
            className="border py-3 rounded font-bold hover:bg-stone-50"
          >
            Opcje
          </button>

          <button
            onClick={() => setScreen('about')}
            className="border py-3 rounded font-bold hover:bg-stone-50"
          >
            O grze
          </button>

          <a
            href="https://patronite.pl/"
            target="_blank"
            rel="noreferrer"
            className="bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 mt-4"
          >
            ⚙ Wesprzyj na Patronite
          </a>
        </div>

        <div className="text-xs text-stone-400 mt-8 space-y-0.5">
          <p>wersja 0.67</p>
          <p>© by HZ GAMES 2026</p>
        </div>
      </div>
    </div>
  );
} 