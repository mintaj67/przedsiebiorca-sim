import { useGameStore, SLOT_IDS, MAX_SLOTS } from '../../store/gameStore';
import type { SaveSlot } from '../../store/gameStore';

export function SavesScreen() {
  const {
    savesMode, pendingSlotId, savesVersion,
    setScreen, setPendingSlotId,
    loadGame, deleteSave, getSlots,
  } = useGameStore();

  // savesVersion wymusza rerender po delete/save
  void savesVersion;

  const slots = getSlots();
  const title = savesMode === 'new' ? 'Wybierz slot na nową grę' : 'Wczytaj zapis';

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleClick = (slotId: string) => {
    const slot = slots[slotId];
    if (savesMode === 'new') {
      if (slot) {
        const confirmed = confirm(`Slot "${slot.name}" jest zajęty (${slot.state.year} Q${slot.state.quarter}). Nadpisać?`);
        if (!confirmed) return;
      }
      setPendingSlotId(slotId);
      setScreen('start');
    } else {
      if (!slot) return;
      loadGame(slotId);
    }
  };

  const handleDelete = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    const slot = slots[slotId];
    if (!slot) return;
    const confirmed = confirm(`Usunąć zapis "${slot.name}"? Nie da się cofnąć.`);
    if (confirmed) deleteSave(slotId);
  };

  return (
    <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{title}</h1>
          <button
            onClick={() => setScreen('menu')}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Powrót
          </button>
        </div>

        {savesMode === 'new' && pendingSlotId && (
          <p className="text-xs text-stone-500 mb-3">
            Wybrano slot — kontynuuj w ekranie startowym.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SLOT_IDS.map((slotId, idx) => {
            const slot: SaveSlot | null = slots[slotId] ?? null;
            return (
              <div
                key={slotId}
                className={`border-2 rounded-lg p-4 transition ${
                  slot
                    ? savesMode === 'load'
                      ? 'border-stone-300 hover:border-stone-900 cursor-pointer'
                      : 'border-stone-300 hover:border-stone-900'
                    : 'border-dashed border-stone-300'
                }`}
                onClick={() => handleClick(slotId)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
                    Slot {idx + 1}
                  </div>
                  {slot && (
                    <button
                      onClick={(e) => handleDelete(e, slotId)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Usuń
                    </button>
                  )}
                </div>

                {slot ? (
                  <>
                    <div className="font-bold text-stone-900">
                      {slot.state.company.name}{slot.state.company.suffix}
                    </div>
                    <div className="text-xs text-stone-600 mb-1">
                      Rok {slot.state.year} Q{slot.state.quarter} · {slot.state.phase}
                    </div>
                    <div className="text-xs text-stone-500 font-mono">
                      Ostatnio: {formatDate(slot.lastPlayed)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-stone-400 italic">
                    Pusty slot
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-stone-400 mt-4 text-center">
          Maksymalnie {MAX_SLOTS} zapisów.
          {savesMode === 'load' && !Object.keys(slots).length && ' Brak zapisów do wczytania.'}
        </p>
      </div>
    </div>
  );
}