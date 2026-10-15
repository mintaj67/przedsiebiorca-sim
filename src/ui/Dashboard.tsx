import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ReputationScreen } from './screens/ReputationScreen';
import { FinanceScreen } from './screens/FinanceScreen';
import { PartyScreen } from './screens/PartyScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { EventScreen } from './screens/EventScreen';
import { ConsequenceScreen } from './screens/ConsequenceScreen';
import { ElectionScreen } from './screens/ElectionScreen';
import { PresidentialElectionScreen } from './screens/PresidentialElectionScreen';
import { NewsScreen } from './screens/NewsScreen';
import { OptionsModal } from './components/OptionsModal';
import { partyLabel } from './labels';

type Screen = 'main' | 'news' | 'reputation' | 'finance' | 'party' | 'activity';

export function Dashboard() {
  const { state, doTurn, changeActivity, takeEmergencyLoan, dismissElection, dismissPresidentialResult } = useGameStore();
  const [screen, setScreen] = useState<Screen>('main');
  const [showOptions, setShowOptions] = useState(false);

  if (!state) return <div className="p-8">Ładowanie...</div>;

  if (state.lastPresidentialResult) {
    return <PresidentialElectionScreen onClose={dismissPresidentialResult} />;
  }

  if (state.lastElectionResult) {
    return <ElectionScreen onClose={dismissElection} />;
  }

  if (state.lastChoiceResult) return <ConsequenceScreen />;
  if (state.pendingEvents.length > 0) return <EventScreen />;

  if (state.gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Koniec gry</h1>
          <p className="mb-4">{state.gameOver.reason}</p>
          <p className="text-sm text-stone-600">
            Przetrwałeś do {state.year} Q{state.quarter}.
          </p>
        </div>
      </div>
    );
  }

  const party = partyLabel(state.ceo.currentPartyId);
  const chosenActivityLabel = state.chosenActivityThisTurn ?? 'brak';

  const SCREEN_LABELS: Record<Screen, string> = {
    main: 'Główny',
    news: 'Wiadomości',
    reputation: 'Reputacja',
    finance: 'Finanse',
    party: 'Partia',
    activity: 'Aktywności',
  };

  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {state.company.name}{state.company.suffix}
          </h1>
          <p className="text-sm text-stone-600">
            {state.year} Q{state.quarter} · {state.phase}
            {state.ceo.inMafia && ' · <mafia>'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-mono">
              {state.company.finances.stateKonta.toLocaleString('pl-PL')} PLN
            </p>
            <p className="text-sm text-stone-600">
              Reputacja: {Math.round(state.company.reputation.ogolna)}%
            </p>
          </div>
          <button
            onClick={() => setShowOptions(true)}
            className="bg-white border px-3 py-2 rounded text-sm hover:bg-stone-50"
          >
            ⚙ Opcje
          </button>
        </div>
      </header>

      <nav className="flex gap-2 mb-6">
        {(['main', 'news', 'reputation', 'finance', 'party', 'activity'] as Screen[]).map(s => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            className={`px-3 py-1.5 rounded text-sm ${
              screen === s ? 'bg-stone-900 text-white' : 'bg-white border hover:bg-stone-50'
            }`}
          >
            {SCREEN_LABELS[s]}
          </button>
        ))}
      </nav>

      {state.bankruptWarningTurns > 0 && state.company.finances.stateKonta < 0 && (
        <div className="bg-red-100 border border-red-500 p-3 rounded mb-4">
          <p className="font-bold">
            ⚠ Bankructwo za {2 - state.bankruptWarningTurns} tur!
          </p>
          <button
            onClick={takeEmergencyLoan}
            className="mt-2 bg-red-600 text-white px-3 py-1 rounded"
          >
            Weź kredyt ratunkowy (50 000 PLN, 15%)
          </button>
        </div>
      )}

            {screen === 'main' && (
        <div>
          <OfficeView
            companyName={`${state.company.name}${state.company.suffix}`}
            year={state.year}
            quarter={state.quarter}
            inMafia={state.ceo.inMafia}
          />

          <div className="grid grid-cols-3 gap-4 mb-6">
            <InfoCard label="Partia" value={party} />
            <InfoCard label="Działalność" value={state.company.activity} />
            <InfoCard
              label="Aktywność w tej turze"
              value={chosenActivityLabel}
              muted={!state.chosenActivityThisTurn}
            />
          </div>

          {state.turn - state.company.lastActivityChangeTurn >= 2 && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <h3 className="font-bold mb-2">Zmień działalność</h3>
              <div className="flex flex-wrap gap-2">
                {['handel', 'produkcja', 'uslugi', 'it', 'budowlanka'].map(a => (
                  <button
                    key={a}
                    onClick={() => changeActivity(a)}
                    disabled={state.company.activity === a}
                    className="border px-3 py-1 rounded text-sm disabled:opacity-30 hover:bg-stone-50"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => doTurn()}
            className="bg-stone-900 text-white px-6 py-3 rounded hover:bg-stone-800 text-lg font-bold"
          >
            Następna tura →
          </button>
        </div>
      )}

      {screen === 'news' && <NewsScreen />}
      {screen === 'reputation' && <ReputationScreen />}
      {screen === 'finance' && <FinanceScreen />}
      {screen === 'party' && <PartyScreen />}
      {screen === 'activity' && <ActivityScreen />}

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}

function InfoCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3">
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">{label}</div>
      <div className={`font-semibold ${muted ? 'text-stone-400' : 'text-stone-900'}`}>
        {value}
      </div>
    </div>
  );
}

function OfficeView({
  companyName,
  year,
  quarter,
  inMafia,
}: {
  companyName: string;
  year: number;
  quarter: number;
  inMafia: boolean;
}) {
  return (
    <div className="relative bg-gradient-to-b from-stone-200 via-stone-100 to-stone-300 rounded-lg shadow-sm overflow-hidden mb-6 h-64 border border-stone-200">
      {/* Ściana (górna część) */}
      <div className="absolute top-0 left-0 right-0 h-3/4 bg-gradient-to-b from-stone-100 to-stone-200" />

      {/* Okno */}
      <div className="absolute top-6 left-8 w-28 h-20 bg-gradient-to-br from-sky-200 to-sky-100 border-4 border-stone-400 rounded-sm shadow-inner">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-stone-400 -translate-x-1/2" />
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-400 -translate-y-1/2" />
      </div>

      {/* Obrazek na ścianie */}
      <div className="absolute top-8 right-32 w-16 h-12 bg-amber-100 border-2 border-stone-400 rounded-sm flex items-center justify-center text-lg">
        🏆
      </div>

      {/* Podłoga */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-amber-800/60" />
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-900/40 to-transparent" />

      {/* Biurko */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 h-2 bg-amber-900 rounded-sm shadow-md" />

      {/* Monitor */}
      <div className="absolute bottom-18 left-1/2 -translate-x-1/2 -translate-x-12 w-16 h-12 bg-stone-800 rounded-sm border-2 border-stone-700">
        <div className="w-full h-full bg-gradient-to-br from-green-900 to-green-700 opacity-60" />
      </div>
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 -translate-x-12 w-6 h-2 bg-stone-700 mx-auto ml-5" />

      {/* Telefon */}
      <div className="absolute bottom-18 left-1/2 -translate-x-1/2 translate-x-12 w-8 h-5 bg-stone-900 rounded-sm" />

      {/* Krzesło */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 translate-x-20 w-12 h-16 bg-stone-800 rounded-t-xl opacity-80" />

      {/* Info overlay (prawy górny róg) */}
      <div className="absolute top-4 right-4 text-right z-10">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
          Siedziba firmy
        </div>
        <div className="text-sm font-bold text-stone-900 drop-shadow-sm">
          {companyName}
        </div>
        <div className="text-xs text-stone-600 font-mono">
          {year} Q{quarter}
        </div>
        {inMafia && (
          <div className="text-[10px] uppercase tracking-widest text-red-700 font-bold mt-1">
            ⚠ powiązania
          </div>
        )}
      </div>
    </div>
  );
}