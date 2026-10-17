import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';

export function OptionsModal({ onClose }: { onClose: () => void }) {
  const { saveGame, setScreen } = useGameStore();
  const [msg, setMsg] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Opcje</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-900 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { saveGame(); setMsg('Gra zapisana.'); }}
            className="border py-2 rounded hover:bg-stone-50"
          >
            💾 Zapisz grę
          </button>

          <button
            onClick={() => {
              if (confirm('Wrócić do menu głównego? Gra zostanie automatycznie zapisana.')) {
                saveGame();
                setScreen('menu');
                onClose();
              }
            }}
            className="border py-2 rounded hover:bg-stone-50 text-red-700"
          >
            ← Powrót do menu głównego
          </button>

          {msg && <p className="text-sm text-green-700 text-center mt-2">{msg}</p>}
        </div>
      </div>
    </div>
  );
}