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
import { ChangeActivityScreen } from './screens/ChangeActivityScreen';
import { CombatScreen } from './screens/CombatScreen';
import { EmployeesScreen } from './screens/EmployeesScreen';
import { OfficeScreen } from './screens/OfficeScreen';
import { RankingsScreen } from './screens/RankingsScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { OptionsModal } from './components/OptionsModal';
import { partyLabel } from './ui-labels';

// Definiujemy dostępne ekrany
type MainTab = 'main' | 'news' | 'management' | 'global';
type ManagementTab = 'changeActivity' | 'finance' | 'employees' | 'office' | 'activity';
type GlobalTab = 'party' | 'rankings' | 'achievements' | 'reputation';

export function Dashboard() {
  const {
    state, doTurn, takeEmergencyLoan, dismissElection, dismissPresidentialResult,
  } = useGameStore();
  
  const [mainTab, setMainTab] = useState<MainTab>('main');
  const [mgmtTab, setMgmtTab] = useState<ManagementTab>('finance');
  const [globalTab, setGlobalTab] = useState<GlobalTab>('party');
  const [showOptions, setShowOptions] = useState(false);

  if (!state) return <div className="p-8">Ładowanie...</div>;

  if (state.lastPresidentialResult) return <PresidentialElectionScreen onClose={dismissPresidentialResult} />;
  if (state.lastElectionResult) return <ElectionScreen onClose={dismissElection} />;
  if (state.lastChoiceResult) return <ConsequenceScreen />;
  if (state.pendingEvents.length > 0) return <EventScreen />;
  if (state.activeCombat) return <CombatScreen />;

  if (state.gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Koniec gry</h1>
          <p className="mb-4">{state.gameOver.reason}</p>
          <p className="text-sm text-stone-600">Przetrwałeś do {state.year} Q{state.quarter}.</p>
        </div>
      </div>
    );
  }

  const party = partyLabel(state.ceo.currentPartyId);
  const chosenActivityLabel = state.chosenActivityThisTurn ?? 'brak';
  const unreadCount = state.news.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-6">
      {/* NAGŁÓWEK */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold truncate max-w-[300px] sm:max-w-md md:max-w-xl" title={`${state.company.name}${state.company.suffix}`}>
            {state.company.name}{state.company.suffix}
          </h1>
          <p className="text-sm text-stone-600">{state.year} Q{state.quarter} · {state.phase} {state.ceo.inMafia && ' · <mafia>'}</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-left md:text-right">
            <p className="text-xl md:text-2xl font-mono">{state.company.finances.stateKonta.toLocaleString('pl-PL')} PLN</p>
            <p className="text-xs md:text-sm text-stone-600">Reputacja: {Math.round(state.company.reputation.ogolna)}%</p>
          </div>
          <button onClick={() => setShowOptions(true)} className="bg-white border px-3 py-2 rounded text-sm hover:bg-stone-50 shrink-0">⚙</button>
        </div>
      </header>

      {unreadCount > 0 && mainTab !== 'news' && (
        <button onClick={() => setMainTab('news')} className="w-full bg-blue-100 border border-blue-300 text-blue-900 rounded-lg p-3 mb-4 text-left hover:bg-blue-200 transition flex items-center gap-3">
          <span className="text-2xl">✉</span>
          <div>
            <div className="font-bold">Masz {unreadCount} nieprzeczytanych wiadomości</div>
            <div className="text-xs">Kliknij, aby przejść do skrzynki →</div>
          </div>
        </button>
      )}

      {mainTab === 'main' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <InfoCard label="Partia" value={party} />
          <InfoCard label="Działalność" value={state.company.activity} />
          <InfoCard label="Aktywność w tej turze" value={chosenActivityLabel} muted={!state.chosenActivityThisTurn} />
          <InfoCard label="Mafia" value={state.ceo.inMafia ? 'Członek' : 'Brak powiązań'} muted={!state.ceo.inMafia} />
        </div>
      )}

      {/* GŁÓWNA NAWIGACJA - 4 przyciski */}
      <nav className="flex gap-2 mb-2 overflow-x-auto pb-1">
        <NavButton active={mainTab === 'main'} onClick={() => setMainTab('main')}>Główny</NavButton>
        <NavButton active={mainTab === 'news'} onClick={() => setMainTab('news')}>Wiadomości</NavButton>
        <NavButton active={mainTab === 'management'} onClick={() => setMainTab('management')}>Zarządzanie</NavButton>
        <NavButton active={mainTab === 'global'} onClick={() => setMainTab('global')}>Globalne</NavButton>
      </nav>

      {/* PODZAKŁADKI */}
      {mainTab === 'management' && (
        <div className="flex gap-2 mb-4 border-b border-stone-300 pb-2 overflow-x-auto">
          <SubNavButton active={mgmtTab === 'finance'} onClick={() => setMgmtTab('finance')}>Finanse</SubNavButton>
          <SubNavButton active={mgmtTab === 'employees'} onClick={() => setMgmtTab('employees')}>Pracownicy</SubNavButton>
          <SubNavButton active={mgmtTab === 'office'} onClick={() => setMgmtTab('office')}>Biuro</SubNavButton>
          <SubNavButton active={mgmtTab === 'changeActivity'} onClick={() => setMgmtTab('changeActivity')}>Działalność</SubNavButton>
          <SubNavButton active={mgmtTab === 'activity'} onClick={() => setMgmtTab('activity')}>Aktywności</SubNavButton>
        </div>
      )}

      {mainTab === 'global' && (
        <div className="flex gap-2 mb-4 border-b border-stone-300 pb-2 overflow-x-auto">
          <SubNavButton active={globalTab === 'party'} onClick={() => setGlobalTab('party')}>Polityka</SubNavButton>
          <SubNavButton active={globalTab === 'reputation'} onClick={() => setGlobalTab('reputation')}>Reputacja</SubNavButton>
          <SubNavButton active={globalTab === 'rankings'} onClick={() => setGlobalTab('rankings')}>Rankingi</SubNavButton>
          <SubNavButton active={globalTab === 'achievements'} onClick={() => setGlobalTab('achievements')}>Osiągnięcia</SubNavButton>
        </div>
      )}

      {/* ZAWARTOŚĆ EKRANÓW */}
      {state.bankruptWarningTurns > 0 && state.company.finances.stateKonta < 0 && (
        <div className="bg-red-100 border border-red-500 p-3 rounded mb-4 mt-4">
          <p className="font-bold">⚠ Bankructwo za {2 - state.bankruptWarningTurns} tur!</p>
          <button onClick={takeEmergencyLoan} className="mt-2 bg-red-600 text-white px-3 py-1 rounded">Weź kredyt ratunkowy (50 000 PLN, 15%)</button>
        </div>
      )}

      <div className="mt-4">
        {mainTab === 'main' && (
          <div>
            <OfficeView companyName={`${state.company.name}${state.company.suffix}`} year={state.year} quarter={state.quarter} inMafia={state.ceo.inMafia} />
            <button onClick={() => doTurn()} className="bg-stone-900 text-white px-6 py-3 rounded hover:bg-stone-800 text-lg font-bold">Następna tura →</button>
          </div>
        )}

        {mainTab === 'news' && <NewsScreen />}

        {/* ZARZĄDZANIE */}
        {mainTab === 'management' && (
          <>
            {mgmtTab === 'changeActivity' && <ChangeActivityScreen />}
            {mgmtTab === 'finance' && <FinanceScreen />}
            {mgmtTab === 'employees' && <EmployeesScreen />}
            {mgmtTab === 'office' && <OfficeScreen />}
            {mgmtTab === 'activity' && <ActivityScreen />}
          </>
        )}

        {/* GLOBALNE */}
        {mainTab === 'global' && (
          <>
            {globalTab === 'party' && <PartyScreen />}
            {globalTab === 'rankings' && <RankingsScreen />}
            {globalTab === 'achievements' && <AchievementsScreen />}
            {globalTab === 'reputation' && <ReputationScreen />}
          </>
        )}
      </div>

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}

// Komponenty pomocnicze dla nawigacji
function InfoCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3">
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">{label}</div>
      <div className={`font-semibold ${muted ? 'text-stone-400' : 'text-stone-900'}`}>{value}</div>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${active ? 'bg-stone-900 text-white' : 'bg-white border hover:bg-stone-50'}`}>
      {children}
    </button>
  );
}

function SubNavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 text-sm whitespace-nowrap rounded-md transition ${active ? 'bg-stone-200 font-bold text-stone-900' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
      {children}
    </button>
  );
}

function OfficeView({ companyName, year, quarter, inMafia }: any) {
  return (
    <div className="relative bg-gradient-to-b from-stone-200 via-stone-100 to-stone-300 rounded-lg shadow-sm overflow-hidden mb-4 h-40 md:h-64 border border-stone-200">
      <div className="absolute top-0 left-0 right-0 h-3/4 bg-gradient-to-b from-stone-100 to-stone-200" />
      <div className="absolute top-4 md:top-6 left-4 md:left-8 w-20 md:w-28 h-14 md:h-20 bg-gradient-to-br from-sky-200 to-sky-100 border-4 border-stone-400 rounded-sm shadow-inner">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-stone-400 -translate-x-1/2" />
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-400 -translate-y-1/2" />
      </div>
      <div className="hidden md:flex absolute top-8 right-32 w-16 h-12 bg-amber-100 border-2 border-stone-400 rounded-sm items-center justify-center text-lg">🏆</div>
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-amber-800/60" />
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-900/40 to-transparent" />
      <div className="absolute bottom-10 md:bottom-16 left-1/2 -translate-x-1/2 w-48 md:w-64 h-2 bg-amber-900 rounded-sm shadow-md" />
      <div className="hidden md:block absolute bottom-20 left-1/2 -translate-x-1/2 -translate-x-12 w-16 h-12 bg-stone-800 rounded-sm border-2 border-stone-700">
        <div className="w-full h-full bg-gradient-to-br from-green-900 to-green-700 opacity-60" />
      </div>
      <div className="hidden md:block absolute bottom-20 left-1/2 -translate-x-1/2 translate-x-12 w-8 h-5 bg-stone-900 rounded-sm" />
      <div className="hidden md:block absolute bottom-10 left-1/2 -translate-x-1/2 translate-x-20 w-12 h-16 bg-stone-800 rounded-t-xl opacity-80" />
      <div className="absolute top-3 md:top-4 right-3 md:right-4 text-right z-10">
        <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Siedziba firmy</div>
        <div className="text-xs md:text-sm font-bold text-stone-900 drop-shadow-sm">{companyName}</div>
        <div className="text-[10px] md:text-xs text-stone-600 font-mono">{year} Q{quarter}</div>
        {inMafia && <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-red-700 font-bold mt-1">⚠ powiązania</div>}
      </div>
    </div>
  );
}