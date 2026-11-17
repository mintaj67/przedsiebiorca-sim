import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  getAvailableServices,
  getTotalServiceWorkerSlots,
  getBusyServiceWorkers,
} from '../../engine/servicesHelper';

export function ServicesScreen() {
  const { state, toggleService } = useGameStore();

  if (!state) return null;

  const totalSlots = getTotalServiceWorkerSlots(state);
  const busySlots = getBusyServiceWorkers(state);
  const freeSlots = Math.max(0, totalSlots - busySlots);

  const services = useMemo(
    () => getAvailableServices(state),
    [
      state.company.size,
      state.company.employees,
      state.company.reputation,
      state.company.activity,
      state.company.activities,
      state.macroStats?.development,
      state.activeServiceIds,
    ]
  );

  const activeServices = services.filter(s => s.isActive);
  const totalMinPayout = activeServices.reduce((sum, s) => sum + s.minPayout, 0);
  const totalMaxPayout = activeServices.reduce((sum, s) => sum + s.maxPayout, 0);

  return (
    <div className="p-4 md:p-6">
      {/* Nagłówek i zasoby kadrowe */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛎️ Katalog Świadczonych Usług</h1>
          <p className="text-sm text-stone-600">
            Wybierz usługi oferowane na stałe przez Twoją firmę. Dostępność usług zależy od reputacji, rozmiaru firmy oraz liczby zatrudnionych pracowników.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg px-4 py-2.5 shadow-sm text-right shrink-0">
          <div className="text-[10px] text-stone-500 uppercase font-semibold">Wolne moce kadrowe</div>
          <div className={`text-lg font-bold font-mono ${freeSlots === 0 ? 'text-red-600' : 'text-purple-800'}`}>
            {freeSlots} / {totalSlots} osób
          </div>
        </div>
      </div>

      {/* PODSUMOWANIE AKTYWNYCH USŁUG */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-purple-950">
            📋 Aktywne usługi stałe: {activeServices.length}
          </h2>
          <p className="text-xs text-purple-800">
            Przychód ze stałych usług rozliczany jest automatycznie na początku każdego kwartału.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[10px] uppercase font-semibold text-purple-700">
            Łączny orientacyjny przychód / kwartał
          </div>
          <div className="font-mono font-bold text-base text-green-700">
            {activeServices.length > 0
              ? `${totalMinPayout.toLocaleString('pl-PL')} – ${totalMaxPayout.toLocaleString('pl-PL')} PLN`
              : '0 PLN'}
          </div>
        </div>
      </div>

      {/* KATALOG USŁUG DO WYBORU */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {services.map(srv => {
          const hasEnoughSlots = freeSlots >= srv.workersRequired;
          const canActivate = srv.meetsRequirements && hasEnoughSlots;
          const riskPercent = Math.round(srv.risk * 100);

          return (
            <div
              key={srv.id}
              className={`bg-white rounded-lg shadow-sm border p-5 flex flex-col justify-between transition ${
                srv.isActive
                  ? 'border-purple-600 ring-1 ring-purple-600 bg-purple-50/10'
                  : !srv.meetsRequirements
                    ? 'border-stone-200 opacity-75'
                    : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-bold text-base text-stone-900">{srv.title}</h3>
                  {srv.isActive ? (
                    <span className="text-[10px] bg-purple-700 text-white px-2 py-0.5 rounded font-bold uppercase shrink-0">
                      Aktywna na stałe
                    </span>
                  ) : !srv.meetsRequirements ? (
                    <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                      Zablokowana
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                      Dostępna
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-600 mb-4">{srv.desc}</p>

                <div className="bg-stone-50 border border-stone-200 rounded p-3 mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Orientacyjny dochód / kw.:</span>
                    <span className="font-mono font-bold text-green-700">
                      {srv.minPayout.toLocaleString('pl-PL')} – {srv.maxPayout.toLocaleString('pl-PL')} PLN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Angażuje kadrę:</span>
                    <span
                      className={`font-bold ${
                        srv.isActive || hasEnoughSlots ? 'text-stone-900' : 'text-red-600'
                      }`}
                    >
                      {srv.workersRequired} {srv.workersRequired === 1 ? 'etat' : 'etaty'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Wpływ na reputację:</span>
                    <span className="font-semibold text-blue-700">+{srv.repGain} rep. branży / kw.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Ryzyko reklamacji:</span>
                    <span className={`font-semibold ${riskPercent >= 25 ? 'text-amber-700' : 'text-stone-600'}`}>
                      {riskPercent}%
                    </span>
                  </div>
                </div>

                {/* Niespełnione wymagania */}
                {!srv.meetsRequirements && srv.missingReasons.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 mb-4 text-xs text-amber-900">
                    <div className="font-bold mb-1">Wymagania do odblokowania:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {srv.missingReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {srv.isActive ? (
                <button
                  onClick={() => toggleService(srv.id)}
                  className="w-full py-2.5 rounded text-xs font-bold transition shadow-sm bg-red-600 hover:bg-red-700 text-white"
                >
                  Wstrzymaj świadczenie usługi (zwolnij {srv.workersRequired} os.)
                </button>
              ) : (
                <button
                  onClick={() => toggleService(srv.id)}
                  disabled={!canActivate}
                  className={`w-full py-2.5 rounded text-xs font-bold transition shadow-sm ${
                    !srv.meetsRequirements
                      ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                      : !hasEnoughSlots
                        ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                        : 'bg-purple-700 hover:bg-purple-800 text-white'
                  }`}
                >
                  {!srv.meetsRequirements
                    ? 'Nie spełniasz wymagań'
                    : !hasEnoughSlots
                      ? `Brak wolnych rąk do pracy (wym. ${srv.workersRequired})`
                      : 'Uruchom usługę na stałe'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}