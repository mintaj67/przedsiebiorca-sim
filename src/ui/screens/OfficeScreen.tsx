import { useGameStore } from '../../store/gameStore';

export function OfficeScreen() {
  const { state, toggleAccountant } = useGameStore();
  if (!state) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Biuro</h1>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold">
              Pani Grażyna (Księgowa)
              {state.company.hasAccountant && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Zatrudniona</span>}
            </div>
            <div className="text-xs text-stone-600 mt-1">Koszt: 3 000 PLN / kwartał. Zwiększa opinię w Urzędzie Skarbowym o +3 co turę.</div>
          </div>
          <button onClick={toggleAccountant} className={`px-4 py-2 rounded text-sm font-semibold ${state.company.hasAccountant ? 'bg-red-100 text-red-800' : 'bg-stone-900 text-white'}`}>
            {state.company.hasAccountant ? 'Zwolnij' : 'Zatrudnij'}
          </button>
        </div>
      </div>
    </div>
  );
}