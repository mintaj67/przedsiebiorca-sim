import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { StatisticsScreen } from './screens/StatisticsScreen';
import { PartyScreen } from './screens/PartyScreen';
import { MarketingScreen } from './screens/MarketingScreen';
import { EventScreen } from './screens/EventScreen';
import { ConsequenceScreen } from './screens/ConsequenceScreen';
import { ElectionScreen } from './screens/ElectionScreen';
import { PresidentialElectionScreen } from './screens/PresidentialElectionScreen';
import { NewsScreen, isCompanyInboxItem } from './screens/NewsScreen';
import { GlobalNewsScreen } from './screens/GlobalNewsScreen';
import { ChangeActivityScreen } from './screens/ChangeActivityScreen';
import { BuyScreen } from './screens/BuyScreen';
import { SellScreen } from './screens/SellScreen';
import { CombatScreen } from './screens/CombatScreen';
import { EmployeesScreen } from './screens/EmployeesScreen';
import { OfficeScreen } from './screens/OfficeScreen';
import { RankingsScreen } from './screens/RankingsScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { IntroScreen } from './screens/IntroScreen';
import { ChaseScreen } from './screens/ChaseScreen';
import { StatsScreen } from './screens/StatsScreen';
import { MafiaActivityScreen } from './screens/MafiaActivityScreen';
import { OptionsModal } from './components/OptionsModal';
import { WarVictoryModal } from './components/WarVictoryModal';
import { partyLabel } from './ui-labels';
import { COMPANY_SIZE_CONFIG, BANKRUPT_EMERGENCY_LOAN } from '../engine/constants';
import { formatMoney } from '../engine/currency';
import { getInflationRate, getLoanQuarterlyRate, scaleByInflation } from '../engine/economy';
import { ProductionScreen } from './screens/ProductionScreen';
import { ServicesScreen } from './screens/ServicesScreen';
import {
  getActivityFullInfo,
  getCompanyActivities,
  getCategoryIdsForActivities,
  formatCompanyName,
} from '../engine/activityHelper';
import type { TurnActionTarget } from '../engine/types';

type MainTab = 'main' | 'news' | 'management' | 'global';
type ManagementTab =
  | 'changeActivity'
  | 'buy'
  | 'sell'
  | 'production'
  | 'services'
  | 'marketing'
  | 'party'
  | 'employees'
  | 'office'
  | 'statistics'
  | 'mafiaActivity';
type GlobalTab = 'rankings' | 'globalNews' | 'achievements' | 'stats';

const TARGET_LABELS: Record<TurnActionTarget, string> = {
  main: 'Główny',
  news: 'Wiadomości',
  changeActivity: 'Działalność',
  buy: 'Kupuj',
  sell: 'Sprzedawaj',
  production: 'Produkcja',
  services: 'Usługi',
  marketing: 'Marketing',
  party: 'Polityka',
  competition: 'Rankingi',
  employees: 'Pracownicy',
  office: 'Biuro',
  activity: 'Marketing',
  statistics: 'Statystyki',
  mafiaActivity: 'Mafia',
  rankings: 'Rankingi',
  achievements: 'Osiągnięcia',
  stats: 'Makro',
};

export function Dashboard() {
  const {
    state,
    doTurn,
    undoLastAction,
    takeEmergencyLoan,
    dismissElection,
    dismissPresidentialResult,
    debugSendTestMessage,
    debugStartTaxCombat,
    debugStartChase,
  } = useGameStore();

  const debugMode = useSettingsStore(s => s.debugMode);

  const [mainTab, setMainTab] = useState<MainTab>('main');
  const [mgmtTab, setMgmtTab] = useState<ManagementTab>('changeActivity');
  const [globalTab, setGlobalTab] = useState<GlobalTab>('rankings');
  const [showOptions, setShowOptions] = useState(false);
  const [showDebugMinigames, setShowDebugMinigames] = useState(false);
  const [turnBarExpanded, setTurnBarExpanded] = useState(false);

  if (!state) return <div className="p-8">Ładowanie...</div>;

  if (state.showIntro) return <IntroScreen />;
  if (state.lastPresidentialResult) return <PresidentialElectionScreen onClose={dismissPresidentialResult} />;
  if (state.lastElectionResult) return <ElectionScreen onClose={dismissElection} />;
  if (state.lastChoiceResult) return <ConsequenceScreen />;
  if (state.pendingEvents.length > 0) return <EventScreen />;
  if (state.activeCombat) return <CombatScreen />;
  if (state.activeChase) return <ChaseScreen />;

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

  if (state.pendingWarResolution) return <WarVictoryModal />;

  const party = partyLabel(state.ceo.currentPartyId);
  const totalWorkers =
    state.company.employees.bezUmowy +
    state.company.employees.zlecenie +
    state.company.employees.uop;
  const staffSummary = state.company.hasAccountant
    ? `${totalWorkers} os. + księgowa`
    : `${totalWorkers} os.`;

  const inboxItems = state.news.filter(isCompanyInboxItem);
  const unreadInboxCount = inboxItems.filter(
    n => !n.read || (n.choices && !n.resolved)
  ).length;
  const unreadGlobalNewsCount = state.news.filter(
    n => !isCompanyInboxItem(n) && !n.read
  ).length;

  const companyActivities = getCompanyActivities(state.company);
  const activeCategories = getCategoryIdsForActivities(companyActivities);
  const hasTrade = activeCategories.includes('handel');
  const hasProduction = activeCategories.includes('produkcja');
  const hasServices = activeCategories.includes('uslugi');

  const displayCompanyName = formatCompanyName(state.company);
  const activityInfo = getActivityFullInfo(companyActivities);
  const sizeLabel = COMPANY_SIZE_CONFIG[state.company.size]?.label || state.company.size;

  const isInsideActivitySubscreen =
    mgmtTab === 'buy' || mgmtTab === 'sell' || mgmtTab === 'production';

  const emergencyLoanAmount = scaleByInflation(BANKRUPT_EMERGENCY_LOAN.amount, state);
  const emergencyLoanRatePct = (
    Math.max(
      BANKRUPT_EMERGENCY_LOAN.interestRate,
      getLoanQuarterlyRate('szara_strefa', getInflationRate(state)) + 0.03
    ) * 100
  ).toFixed(1);

  const turnActions = state.turnActions ?? [];
  const latestAction = turnActions.length > 0 ? turnActions[turnActions.length - 1] : null;
  const undoCount = state.undoStack?.length ?? 0;

  const navigateToTarget = (target: TurnActionTarget) => {
    setTurnBarExpanded(false);

    if (target === 'main') {
      setMainTab('main');
      return;
    }
    if (target === 'news') {
      setMainTab('news');
      return;
    }
    if (
      target === 'rankings' ||
      target === 'achievements' ||
      target === 'stats' ||
      target === 'competition'
    ) {
      setMainTab('global');
      setGlobalTab(target === 'competition' ? 'rankings' : target);
      return;
    }

    setMainTab('management');
    if (target === 'activity') {
      setMgmtTab('marketing');
      return;
    }
    if ((target === 'buy' || target === 'sell') && !hasTrade) {
      setMgmtTab('changeActivity');
      return;
    }
    if (target === 'production' && !hasProduction) {
      setMgmtTab('changeActivity');
      return;
    }
    if (target === 'services' && !hasServices) {
      setMgmtTab('changeActivity');
      return;
    }
    if (target === 'mafiaActivity' && !state.ceo.inMafia) {
      setMainTab('main');
      return;
    }

    setMgmtTab(target as ManagementTab);
  };

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-4">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold truncate max-w-[300px] sm:max-w-md md:max-w-xl"
            title={displayCompanyName}
          >
            {displayCompanyName}
          </h1>
          <p className="text-sm text-stone-600">
            {state.year} Q{state.quarter} · {state.phase} {state.ceo.inMafia && ' · <mafia>'}
          </p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-left md:text-right">
            <p className="text-xl md:text-2xl font-mono">
              {formatMoney(state.company.finances.stanKonta, state)}
            </p>
            <p className="text-xs md:text-sm text-stone-600">
              Reputacja: {Math.round(state.company.reputation.ogolna)}%
            </p>
          </div>
          <button
            onClick={() => setShowOptions(true)}
            className="bg-white border px-3 py-2 rounded text-sm hover:bg-stone-50 shrink-0"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Pasek trybu debugowania */}
      {debugMode && (
        <div className="w-full bg-amber-50 border border-amber-300 text-amber-950 rounded-lg p-2.5 mb-3 flex flex-wrap items-center gap-2 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-200 rounded">
            🛠 DEBUG
          </span>

          <button
            onClick={() => debugSendTestMessage()}
            className="text-xs bg-white border border-amber-300 px-2.5 py-1 rounded hover:bg-amber-100 font-medium"
          >
            ✉ Wyślij testową wiadomość
          </button>

          <button
            onClick={() => setShowDebugMinigames(v => !v)}
            className={`text-xs border border-amber-300 px-2.5 py-1 rounded font-medium ${
              showDebugMinigames ? 'bg-amber-200' : 'bg-white hover:bg-amber-100'
            }`}
          >
            🎮 Minigry {showDebugMinigames ? '▲' : '▼'}
          </button>

          {showDebugMinigames && (
            <div className="flex flex-wrap items-center gap-1.5 pl-1 border-l border-amber-300">
              <button
                onClick={() => {
                  setShowDebugMinigames(false);
                  debugStartTaxCombat();
                }}
                className="text-xs bg-white border border-amber-300 px-2.5 py-1 rounded hover:bg-amber-100"
              >
                ⚔️ Walka ze skarbówką
              </button>
              <button
                onClick={() => {
                  setShowDebugMinigames(false);
                  debugStartChase();
                }}
                className="text-xs bg-white border border-amber-300 px-2.5 py-1 rounded hover:bg-amber-100"
              >
                🚗 Pościg mafii
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rozwijany dziennik rundy + Cofnij ruch */}
      <div className="w-full bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg mb-3 shadow-sm overflow-hidden">
        <div className="w-full px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setTurnBarExpanded(v => !v)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition"
          >
            <span className="text-base shrink-0">📋</span>
            <span className="text-xs sm:text-sm font-bold shrink-0">
              Dziennik rundy
            </span>
            <span className="text-[11px] font-bold bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full shrink-0">
              Ruchy: {turnActions.length}
            </span>
            {latestAction && !turnBarExpanded && (
              <span className="hidden md:inline text-xs text-emerald-900/80 truncate ml-1">
                · Ostatnio: {latestAction.icon} {latestAction.text}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {undoCount > 0 && (
              <button
                type="button"
                onClick={() => undoLastAction()}
                title="Cofnij ostatni ruch w tej rundzie"
                className="text-[11px] bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 px-2.5 py-1 rounded font-bold transition"
              >
                ↩ Cofnij ({undoCount})
              </button>
            )}
            {latestAction && !turnBarExpanded && (
              <button
                type="button"
                onClick={() => navigateToTarget(latestAction.target)}
                className="text-[11px] bg-white border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded hover:bg-emerald-100 font-semibold transition"
              >
                {TARGET_LABELS[latestAction.target]} →
              </button>
            )}
            <button
              type="button"
              onClick={() => setTurnBarExpanded(v => !v)}
              className="text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2.5 py-1 rounded transition"
            >
              {turnBarExpanded ? 'Zwiń ▲' : 'Rozwiń ▼'}
            </button>
          </div>
        </div>

        {turnBarExpanded && (
          <div className="border-t border-emerald-200 bg-white/90 px-3 py-2.5">
            {turnActions.length === 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-600 py-1">
                <span>W tej rundzie nie wykonano jeszcze żadnych działań.</span>
                <button
                  type="button"
                  onClick={() => navigateToTarget('changeActivity')}
                  className="self-start sm:self-auto px-2.5 py-1 bg-stone-900 text-white rounded text-xs font-semibold hover:bg-stone-800"
                >
                  Przejdź do Działalności →
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-emerald-100 max-h-60 overflow-y-auto">
                {[...turnActions].reverse().map((entry, idx) => (
                  <li
                    key={entry.id}
                    className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-stone-400 font-mono shrink-0">
                        #{turnActions.length - idx}
                      </span>
                      <span className="shrink-0">{entry.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded shrink-0">
                        {entry.category}
                      </span>
                      <span className="text-stone-800 break-words">{entry.text}</span>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      {idx === 0 && undoCount > 0 && (
                        <button
                          type="button"
                          onClick={() => undoLastAction()}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 rounded font-bold transition"
                        >
                          ↩ Cofnij
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigateToTarget(entry.target)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded font-semibold transition"
                      >
                        {TARGET_LABELS[entry.target]} →
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Szybkie skróty do głównych ekranów rundy */}
            <div className="mt-2.5 pt-2 border-t border-emerald-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-stone-500 font-semibold mr-1">Szybki skok:</span>
              {hasProduction && (
                <QuickJumpButton onClick={() => navigateToTarget('production')}>
                  🏭 Produkcja
                </QuickJumpButton>
              )}
              {hasTrade && (
                <>
                  <QuickJumpButton onClick={() => navigateToTarget('buy')}>
                    🛒 Kupuj
                  </QuickJumpButton>
                  <QuickJumpButton onClick={() => navigateToTarget('sell')}>
                    💰 Sprzedawaj
                  </QuickJumpButton>
                </>
              )}
              {hasServices && (
                <QuickJumpButton onClick={() => navigateToTarget('services')}>
                  🛎️ Usługi
                </QuickJumpButton>
              )}
              <QuickJumpButton onClick={() => navigateToTarget('marketing')}>
                📣 Marketing
              </QuickJumpButton>
              <QuickJumpButton onClick={() => navigateToTarget('employees')}>
                👥 Pracownicy
              </QuickJumpButton>
              <QuickJumpButton onClick={() => navigateToTarget('rankings')}>
                🏆 Rankingi ({state.interactionPoints} pkt)
              </QuickJumpButton>
            </div>
          </div>
        )}
      </div>

      {unreadInboxCount > 0 && mainTab !== 'news' && (
        <button
          onClick={() => setMainTab('news')}
          className="w-full bg-blue-100 border border-blue-300 text-blue-900 rounded-lg p-3 mb-4 text-left hover:bg-blue-200 transition flex items-center gap-3"
        >
          <span className="text-2xl">✉</span>
          <div>
            <div className="font-bold">Masz {unreadInboxCount} nieprzeczytanych wiadomości w skrzynce</div>
            <div className="text-xs">Kliknij, aby przejść do skrzynki odbiorczej →</div>
          </div>
        </button>
      )}

      <nav className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <NavButton active={mainTab === 'main'} onClick={() => setMainTab('main')}>Główny</NavButton>
        <NavButton active={mainTab === 'news'} onClick={() => setMainTab('news')}>
          Wiadomości{unreadInboxCount > 0 ? ` (${unreadInboxCount})` : ''}
        </NavButton>
        <NavButton active={mainTab === 'management'} onClick={() => setMainTab('management')}>Zarządzanie</NavButton>
        <NavButton active={mainTab === 'global'} onClick={() => setMainTab('global')}>
          Globalne{unreadGlobalNewsCount > 0 ? ' •' : ''}
        </NavButton>
      </nav>

      {/* ZARZĄDZANIE */}
      {mainTab === 'management' && (
        <div className="flex gap-2 mb-4 border-b border-stone-300 pb-2 overflow-x-auto">
          <SubNavButton
            active={mgmtTab === 'changeActivity' || isInsideActivitySubscreen}
            onClick={() => setMgmtTab('changeActivity')}
          >
            Działalność
          </SubNavButton>

          {hasServices && (
            <SubNavButton active={mgmtTab === 'services'} onClick={() => setMgmtTab('services')}>
              🛎️ Usługi
            </SubNavButton>
          )}

          <SubNavButton active={mgmtTab === 'marketing'} onClick={() => setMgmtTab('marketing')}>Marketing</SubNavButton>
          <SubNavButton active={mgmtTab === 'party'} onClick={() => setMgmtTab('party')}>Polityka</SubNavButton>
          <SubNavButton active={mgmtTab === 'employees'} onClick={() => setMgmtTab('employees')}>Pracownicy</SubNavButton>
          <SubNavButton active={mgmtTab === 'office'} onClick={() => setMgmtTab('office')}>Biuro</SubNavButton>
          <SubNavButton active={mgmtTab === 'statistics'} onClick={() => setMgmtTab('statistics')}>Statystyki</SubNavButton>

          {state.ceo.inMafia && (
            <SubNavButton active={mgmtTab === 'mafiaActivity'} onClick={() => setMgmtTab('mafiaActivity')}>
              Aktywność mafijna
            </SubNavButton>
          )}
        </div>
      )}

      {/* GLOBALNE */}
      {mainTab === 'global' && (
        <div className="flex gap-2 mb-4 border-b border-stone-300 pb-2 overflow-x-auto">
          <SubNavButton active={globalTab === 'rankings'} onClick={() => setGlobalTab('rankings')}>Rankingi</SubNavButton>
          <SubNavButton active={globalTab === 'globalNews'} onClick={() => setGlobalTab('globalNews')}>
            📰 Newsy{unreadGlobalNewsCount > 0 ? ` (${unreadGlobalNewsCount})` : ''}
          </SubNavButton>
          <SubNavButton active={globalTab === 'achievements'} onClick={() => setGlobalTab('achievements')}>Osiągnięcia</SubNavButton>
          <SubNavButton active={globalTab === 'stats'} onClick={() => setGlobalTab('stats')}>Makro</SubNavButton>
        </div>
      )}

      {mainTab === 'main' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <InfoCard label="Działalność" value={activityInfo.subcategory || state.company.activity} />
          <InfoCard label="Rozmiar" value={sizeLabel} />
          <div className="bg-stone-900 text-white rounded-lg shadow-md p-3 border-b-4 border-amber-500 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-wide text-stone-400 mb-1">Kondycja</div>
            <div className="text-2xl leading-none flex items-center h-6">
              {state.profitabilityTrend === 'up2' ? '⬆️⬆️' :
               state.profitabilityTrend === 'up1' ? '⬆️' :
               state.profitabilityTrend === 'down2' ? '⬇️⬇️' :
               state.profitabilityTrend === 'down1' ? '⬇️' : '➡️'}
            </div>
          </div>
        </div>
      )}

      {state.bankruptWarningTurns > 0 && state.company.finances.stanKonta < 0 && (
        <div className="bg-red-100 border border-red-500 p-3 rounded mb-4 mt-4">
          <p className="font-bold">⚠ Bankructwo za {2 - state.bankruptWarningTurns} tur!</p>
          <button onClick={takeEmergencyLoan} className="mt-2 bg-red-600 text-white px-3 py-1 rounded">
            Weź kredyt ratunkowy ({formatMoney(emergencyLoanAmount, state)}, {emergencyLoanRatePct}% / kw.)
          </button>
        </div>
      )}

      <div className="mt-4">
        {mainTab === 'main' && (
          <div>
            <OfficeView
              companyName={displayCompanyName}
              year={state.year}
              quarter={state.quarter}
              inMafia={state.ceo.inMafia}
              inventory={state.company.inventory}
            />
            <div className="flex flex-col md:flex-row gap-3 items-stretch mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <InfoCard label="Załoga" value={staffSummary} muted={totalWorkers === 0 && !state.company.hasAccountant} />
                <InfoCard label="Partia" value={party} />
                <InfoCard label="Mafia" value={state.ceo.inMafia ? 'Członek' : 'Brak'} muted={!state.ceo.inMafia} />
              </div>
              <button
                onClick={() => {
                  setTurnBarExpanded(false);
                  doTurn();
                }}
                className="bg-stone-900 text-white px-6 py-3 rounded hover:bg-stone-800 text-lg font-bold shadow-md whitespace-nowrap"
              >
                Następna tura →
              </button>
            </div>
          </div>
        )}

        {mainTab === 'news' && <NewsScreen />}

        {mainTab === 'management' && (
          <>
            {isInsideActivitySubscreen && (
              <div className="mb-2 px-4 md:px-6">
                <button
                  onClick={() => setMgmtTab('changeActivity')}
                  className="text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 bg-white border border-stone-300 px-3 py-1.5 rounded shadow-sm"
                >
                  ← Powrót do zarządzania działalnością
                </button>
              </div>
            )}

            {mgmtTab === 'changeActivity' && (
              <ChangeActivityScreen
                onNavigateToBuy={() => setMgmtTab('buy')}
                onNavigateToSell={() => setMgmtTab('sell')}
                onNavigateToProduction={() => setMgmtTab('production')}
                onNavigateToServices={() => setMgmtTab('services')}
              />
            )}
            {mgmtTab === 'buy' && hasTrade && <BuyScreen />}
            {mgmtTab === 'sell' && hasTrade && <SellScreen />}
            {mgmtTab === 'production' && hasProduction && (
              <ProductionScreen
                onNavigateToSell={hasTrade ? () => setMgmtTab('sell') : undefined}
              />
            )}
            {mgmtTab === 'services' && hasServices && <ServicesScreen />}
            {mgmtTab === 'marketing' && <MarketingScreen />}
            {mgmtTab === 'party' && <PartyScreen />}
            {mgmtTab === 'employees' && <EmployeesScreen />}
            {mgmtTab === 'office' && <OfficeScreen />}
            {mgmtTab === 'statistics' && <StatisticsScreen />}
            {mgmtTab === 'mafiaActivity' && <MafiaActivityScreen />}
          </>
        )}

        {mainTab === 'global' && (
          <>
            {globalTab === 'rankings' && <RankingsScreen />}
            {globalTab === 'globalNews' && <GlobalNewsScreen />}
            {globalTab === 'achievements' && <AchievementsScreen />}
            {globalTab === 'stats' && <StatsScreen />}
          </>
        )}
      </div>

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}

function QuickJumpButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded font-medium transition"
    >
      {children}
    </button>
  );
}

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
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
        active ? 'bg-stone-900 text-white' : 'bg-white border hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

function SubNavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm whitespace-nowrap rounded-md transition ${
        active ? 'bg-stone-200 font-bold text-stone-900' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  );
}

function OfficeView({ companyName, year, quarter, inMafia, inventory }: any) {
  const [view, setView] = useState<'outside' | 'inside'>('outside');

  let seasonBg = 'from-stone-200 via-stone-100 to-stone-300';
  let windowEmoji = '🌤️';
  if (quarter === 1) { seasonBg = 'from-green-200 via-green-100 to-green-300'; windowEmoji = '🌱'; }
  if (quarter === 2) { seasonBg = 'from-yellow-200 via-yellow-100 to-yellow-300'; windowEmoji = '☀️'; }
  if (quarter === 3) { seasonBg = 'from-orange-200 via-orange-100 to-orange-300'; windowEmoji = '🍂'; }
  if (quarter === 4) { seasonBg = 'from-blue-200 via-blue-100 to-blue-300'; windowEmoji = '❄️'; }

  return (
    <div className={`relative bg-gradient-to-b ${seasonBg} rounded-lg shadow-sm overflow-hidden mb-4 h-40 md:h-64 border border-stone-200`}>
      <div className="absolute top-3 left-3 z-20">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-1 flex text-[10px] md:text-xs font-semibold shadow-sm border border-stone-300">
          <button
            onClick={() => setView('outside')}
            className={`px-2 md:px-3 py-1 rounded-md transition ${
              view === 'outside' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            Zewnątrz
          </button>
          <button
            onClick={() => setView('inside')}
            className={`px-2 md:px-3 py-1 rounded-md transition ${
              view === 'inside' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            Wnętrze
          </button>
        </div>
      </div>

      {view === 'outside' ? (
        <>
          <div className={`absolute top-0 left-0 right-0 h-3/4 bg-gradient-to-b ${seasonBg} opacity-50`} />
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0 w-20 md:w-28 h-14 md:h-20 bg-gradient-to-br from-sky-200 to-sky-100 border-4 border-stone-400 rounded-sm shadow-inner flex items-center justify-center text-2xl">
            {windowEmoji}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-stone-400 -translate-x-1/2" />
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-400 -translate-y-1/2" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-amber-800/60" />
          <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-900/40 to-transparent" />
          <div className="absolute bottom-10 md:bottom-16 left-1/2 -translate-x-1/2 w-48 md:w-64 h-2 bg-amber-900 rounded-sm shadow-md" />

          <div className="absolute top-3 md:top-4 right-3 md:right-4 text-right z-10">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Siedziba firmy</div>
            <div className="text-xs md:text-sm font-bold text-stone-900 drop-shadow-sm">{companyName}</div>
            <div className="text-[10px] md:text-xs text-stone-600 font-mono">{year} Q{quarter}</div>
            {inMafia && <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-red-700 font-bold mt-1">⚠ powiązania</div>}
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-stone-300" />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-amber-800/80" />
          <div className="absolute bottom-1/4 left-1/4 w-1/2 h-3 md:h-4 bg-stone-700 rounded-sm shadow-lg" />

          {inventory?.includes('komputer') && <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-10 md:w-12 h-8 md:h-10 bg-stone-900 border-2 border-stone-800 rounded-t-md flex items-center justify-center text-[10px] text-green-500">PC</div>}
          {inventory?.includes('ekspres') && <div className="absolute bottom-[30%] left-1/4 translate-x-4 text-2xl md:text-3xl">☕</div>}
          {inventory?.includes('kwiat') && <div className="absolute bottom-2 md:bottom-4 left-4 md:left-8 text-4xl md:text-5xl">🪴</div>}
          {inventory?.includes('sejf') && <div className="absolute bottom-2 md:bottom-4 right-4 md:right-8 text-4xl md:text-5xl">🔐</div>}
          {inventory?.includes('kapeć_hipnotyzera') && <div className="absolute top-12 left-4 md:left-8 text-3xl md:text-4xl transform -rotate-12">🥿</div>}
          {inventory?.includes('tygodnik_opinii') && <div className="absolute top-16 right-6 text-3xl">📰</div>}

          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-10 border-4 border-amber-900 bg-sky-200 flex items-center justify-center text-xl">
            {windowEmoji}
          </div>
        </>
      )}
    </div>
  );
}