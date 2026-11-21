import { useGameStore } from '../../store/gameStore';
import { ACCOUNTANT_COST } from '../../engine/constants';
import { scaleByInflation } from '../../engine/economy';
import { formatMoney } from '../../engine/currency';
import officeItems from '../../data/office_items.json';

export function OfficeScreen() {
  const { state, toggleAccountant, buyOfficeItem } = useGameStore();
  if (!state) return null;

  const accountantCost = scaleByInflation(ACCOUNTANT_COST, state);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Biuro</h1>

      {/* KSIĘGOWA */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold">
              Pani Grażyna (Księgowa)
              {state.company.hasAccountant && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Zatrudniona
                </span>
              )}
            </div>
            <div className="text-xs text-stone-600 mt-1">
              Koszt: {formatMoney(accountantCost, state)} / kwartał. Zwiększa opinię w Urzędzie Skarbowym o +3 co turę.
            </div>
          </div>
          <button
            onClick={toggleAccountant}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              state.company.hasAccountant ? 'bg-red-100 text-red-800' : 'bg-stone-900 text-white'
            }`}
          >
            {state.company.hasAccountant ? 'Zwolnij' : 'Zatrudnij'}
          </button>
        </div>
      </div>

      {/* SKLEP Z PRZEDMIOTAMI */}
      <h2 className="font-bold mb-3">Wyposażenie biura</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(officeItems as Array<{ id: string; name: string; price: number; description: string }>).map(item => {
          const scaledPrice = scaleByInflation(item.price, state);
          const owned = state.company.inventory.includes(item.id);
          const canAfford = state.company.finances.stanKonta >= scaledPrice;

          return (
            <div key={item.id} className="bg-white rounded-lg shadow-sm p-4 flex flex-col justify-between">
              <div>
                <div className="font-semibold flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-mono text-stone-600">{formatMoney(scaledPrice, state)}</span>
                </div>
                <p className="text-xs text-stone-500 mt-1 mb-3">{item.description}</p>
              </div>
              <button
                onClick={() => buyOfficeItem(item.id, scaledPrice)}
                disabled={owned || !canAfford}
                className={`w-full py-2 rounded text-sm font-semibold transition ${
                  owned
                    ? 'bg-green-100 text-green-800 cursor-default'
                    : canAfford
                      ? 'bg-stone-900 text-white hover:bg-stone-800'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {owned ? '✓ Posiadasz' : canAfford ? 'Kup' : 'Brak środków'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}