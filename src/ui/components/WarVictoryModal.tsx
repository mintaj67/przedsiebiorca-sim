import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatMoney } from '../../engine/currency';
import type { AcquiredMode, WarDemandType } from '../../engine/types';

export function WarVictoryModal() {
  const { state, resolvePlayerWarVictory } = useGameStore();
  const pending = state?.pendingWarResolution;

  const [selectedDemands, setSelectedDemands] = useState<WarDemandType[]>(['reparations']);
  const [acquireMode, setAcquireMode] = useState<AcquiredMode>('subsidiary');

  if (!state || !pending) return null;

  const isAcquireSelected = selectedDemands.includes('acquire');

  const toggleStandardDemand = (demand: 'reparations' | 'tribute' | 'subjugate') => {
    setSelectedDemands((prev) => {
      const withoutAcquire = prev.filter((d) => d !== 'acquire');
      if (withoutAcquire.includes(demand)) {
        return withoutAcquire.filter((d) => d !== demand);
      }
      return [...withoutAcquire, demand];
    });
  };

  const selectAcquire = () => {
    setSelectedDemands((prev) => (prev.includes('acquire') ? ['reparations'] : ['acquire']));
  };

  const handleConfirm = () => {
    resolvePlayerWarVictory(pending.warId, selectedDemands, acquireMode);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-300 rounded-xl shadow-xl max-w-xl w-full p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded">
            🏆 Zwycięstwo w wojnie biznesowej
          </span>
          <span className="text-xs font-mono text-stone-500">
            Przewaga końcowa: +{pending.finalWarScore}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-stone-900 mb-1">
          Pokonałeś firmę {pending.loserName}
        </h1>
        <p className="text-sm text-stone-600 mb-5">
          Jako zwycięzca dyktujesz warunki zakończenia konfliktu. Możesz połączyć kilka kar albo całkowicie przejąć pokonanego rywala.
        </p>

        <div className="space-y-2.5 mb-5">
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedDemands.includes('reparations')
                ? 'bg-emerald-50 border-emerald-400'
                : 'bg-white border-stone-200 hover:bg-stone-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedDemands.includes('reparations')}
              onChange={() => toggleStandardDemand('reparations')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-sm text-stone-900">
                Jednorazowa kontrybucja ({formatMoney(pending.reparationsAmount, state)})
              </div>
              <div className="text-xs text-stone-600">
                Natychmiastowy przelew odszkodowania z kasy pokonanej firmy.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedDemands.includes('tribute')
                ? 'bg-emerald-50 border-emerald-400'
                : 'bg-white border-stone-200 hover:bg-stone-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedDemands.includes('tribute')}
              onChange={() => toggleStandardDemand('tribute')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-sm text-stone-900">
                Danina kwartalna ({formatMoney(pending.tributePerQuarter, state)} / kw. przez {pending.tributeQuarters} tur)
              </div>
              <div className="text-xs text-stone-600">
                Stałe wpływy co kwartał przez najbliższe półtora roku.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedDemands.includes('subjugate')
                ? 'bg-emerald-50 border-emerald-400'
                : 'bg-white border-stone-200 hover:bg-stone-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedDemands.includes('subjugate')}
              onChange={() => toggleStandardDemand('subjugate')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-sm text-stone-900">
                Uzależnienie kapitałowe
              </div>
              <div className="text-xs text-stone-600">
                Firma pozostaje w rankingu, ale płaci Ci stały dochód pasywny i znacznie taniej ją później przejmiesz.
              </div>
            </div>
          </label>

          {pending.canAcquire && (
            <div
              className={`p-3 rounded-lg border transition ${
                isAcquireSelected
                  ? 'bg-amber-50 border-amber-400'
                  : 'bg-white border-stone-200 hover:bg-stone-50'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAcquireSelected}
                  onChange={selectAcquire}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-sm text-stone-900">
                    🏛️ Przejęcie firmy (znika z rankingu)
                  </div>
                  <div className="text-xs text-stone-600">
                    Zamiast powyższych kar przejmujesz pokonanego rywala za darmo i decydujesz o jego losie.
                  </div>
                </div>
              </label>

              {isAcquireSelected && (
                <div className="mt-3 pl-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'branch', label: 'Filia', desc: '+1 filia i +6 rep. branży' },
                      { id: 'liquidated', label: 'Likwidacja', desc: '45% wartości w gotówce' },
                      { id: 'subsidiary', label: 'Spółka zależna', desc: 'Stały dochód pasywny' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAcquireMode(opt.id)}
                      className={`text-left p-2 rounded border text-xs transition ${
                        acquireMode === opt.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <div className="font-bold">{opt.label}</div>
                      <div className={acquireMode === opt.id ? 'text-stone-300' : 'text-stone-500'}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="w-full bg-stone-900 text-white py-2.5 rounded-lg font-bold hover:bg-stone-800 transition"
        >
          {selectedDemands.length === 0
            ? 'Zakończ wojnę bez roszczeń'
            : 'Zatwierdź warunki pokoju'}
        </button>
      </div>
    </div>
  );
}