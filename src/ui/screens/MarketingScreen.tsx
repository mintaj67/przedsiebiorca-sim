import { useGameStore } from '../../store/gameStore';
import { scaleByInflation } from '../../engine/economy';
import { formatMoney } from '../../engine/currency';

const CAMPAIGNS = [
  {
    id: 'radio' as const,
    icon: '📻',
    title: 'Reklama radiowa',
    baseCost: 5000,
    desc: 'Lokalne rozgłośnie i pasma poranne. Tani sposób na utrzymanie rozpoznawalności.',
    effects: '+2 Opinia publiczna · +2 Opinia w mediach',
  },
  {
    id: 'internet' as const,
    icon: '🌐',
    title: 'Kampania internetowa',
    baseCost: 15000,
    desc: 'Banery, katalogi firm i pierwsze portale. Średni zasięg w dobrej cenie.',
    effects: '+4 Opinia publiczna · +5 Opinia w mediach',
  },
  {
    id: 'tv' as const,
    icon: '📺',
    title: 'Spot telewizyjny',
    baseCost: 50000,
    desc: 'Ogólnopolski blok reklamowy przed głównym wydaniem wiadomości. Maksymalny rozgłos.',
    effects: '+8 Opinia publiczna · +10 Opinia w mediach',
  },
];

export function MarketingScreen() {
  const { state, buyAd } = useGameStore();
  if (!state) return null;

  const cash = state.company.finances.stanKonta;
  const publicRep = Math.round(state.company.reputation.opiniaPubliczna);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">📣 Marketing</h1>
          <p className="text-sm text-stone-600">
            Buduj rozpoznawalność firmy poprzez kampanie reklamowe. Dobra prasa przekłada się na reputację i dostęp do lepszych kontrahentów.
          </p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg px-4 py-2 shadow-sm text-right shrink-0">
          <div className="text-[10px] uppercase font-semibold text-stone-500">Opinia publiczna</div>
          <div className="text-lg font-bold font-mono text-stone-900">{publicRep}%</div>
        </div>
      </div>

      {/* KAMPANIE REKLAMOWE */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Kampanie reklamowe</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CAMPAIGNS.map((camp) => {
            const cost = scaleByInflation(camp.baseCost, state);
            const canAfford = cash >= cost;

            return (
              <div
                key={camp.id}
                className="bg-white rounded-lg shadow-sm border border-stone-200 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-lg font-bold text-stone-900">
                      <span className="mr-1.5">{camp.icon}</span>
                      {camp.title}
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 mb-3">{camp.desc}</p>
                  <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                    {camp.effects}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => buyAd(camp.id)}
                  disabled={!canAfford}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold transition flex items-center justify-between ${
                    canAfford
                      ? 'bg-stone-900 text-white hover:bg-stone-800'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span>{canAfford ? 'Wykup kampanię' : 'Brak środków'}</span>
                  <span className="font-mono">{formatMoney(cost, state)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* MIEJSCE NA PRZYSZŁE DZIAŁANIA MARKETINGOWE */}
      <section className="bg-stone-50 border border-dashed border-stone-300 rounded-lg p-5 text-xs text-stone-500">
        <div className="font-semibold text-stone-700 mb-1">Dalszy rozwój działu marketingu</div>
        Kolejne akcje wizerunkowe (sponsoring, PR, promocje cenowe) pojawią się w tym miejscu w przyszłych aktualizacjach.
      </section>
    </div>
  );
}