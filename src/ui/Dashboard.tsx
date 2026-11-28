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

type ActiveView =
  | 'main'
  | 'news'
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
  | 'mafiaActivity'
  | 'rankings'
  | 'globalNews'
  | 'achievements'
  | 'stats';

const TARGET_LABELS: Record<TurnActionTarget, string> = {
  main: 'Pulpit',
  news: 'Skrzynka',
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

const VIEW_TITLES: Record<ActiveView, string> = {
  main: 'Pulpit Prezesa',
  news: 'Skrzynka odbiorcza',
  changeActivity: 'Działalność firmy',
  buy: 'Handel — Zakupy',
  sell: 'Handel — Sprzedaż',
  production: 'Hala produkcyjna',
  services: 'Usługi',
  marketing: 'Marketing i reklama',
  party: 'Polityka',
  employees: 'Kadry i pracownicy',
  office: 'Biuro i wyposażenie',
  statistics: 'Finanse i statystyki',
  mafiaActivity: 'Aktywność mafijna',
  rankings: 'Liga i rankingi firm',
  globalNews: 'Prasa i doniesienia',
  achievements: 'Osiągnięcia',
  stats: 'Makroekonomia',
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

  const [activeView, setActiveView] = useState<ActiveView>('main');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      <div className="min-h-screen fm-shell flex items-center justify-center p-4">
        <div className="fm-panel max-w-md w-full overflow-hidden">
          <div className="fm-panel-header">
            <span>Koniec kadencji</span>
            <span className="font-mono">{state.year} Q{state.quarter}</span>
          </div>
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold mb-3 uppercase tracking-wide">Koniec gry</h1>
            <p className="mb-4 text-sm text-stone-600 leading-relaxed">{state.gameOver.reason}</p>
            <p className="text-xs font-mono text-stone-500">
              Przetrwałeś do {state.year} Q{state.quarter}.
            </p>
          </div>
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
  const companyMonogram = (state.company.name || 'PP')
    .replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'PP';
  const activityInfo = getActivityFullInfo(companyActivities);
  const sizeLabel = COMPANY_SIZE_CONFIG[state.company.size]?.label || state.company.size;

  const isInsideActivitySubscreen =
    activeView === 'buy' || activeView === 'sell' || activeView === 'production';

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

  const repRounded = Math.round(state.company.reputation.ogolna);
  const isNegativeBalance = state.company.finances.stanKonta < 0;

  const trendMeta =
    state.profitabilityTrend === 'up2'
      ? { icon: '▲▲', label: 'Silny wzrost', color: 'text-emerald-400' }
      : state.profitabilityTrend === 'up1'
        ? { icon: '▲', label: 'Wzrost', color: 'text-emerald-400' }
        : state.profitabilityTrend === 'down2'
          ? { icon: '▼▼', label: 'Głęboki spadek', color: 'text-red-400' }
          : state.profitabilityTrend === 'down1'
            ? { icon: '▼', label: 'Spadek', color: 'text-amber-400' }
            : { icon: '▶', label: 'Stabilna', color: 'text-stone-500' };

  const selectView = (view: ActiveView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const navigateToTarget = (target: TurnActionTarget) => {
    setTurnBarExpanded(false);
    setMobileMenuOpen(false);

    if (target === 'main') return selectView('main');
    if (target === 'news') return selectView('news');
    if (target === 'competition' || target === 'rankings') return selectView('rankings');
    if (target === 'achievements') return selectView('achievements');
    if (target === 'stats') return selectView('stats');
    if (target === 'activity' || target === 'marketing') return selectView('marketing');
    if ((target === 'buy' || target === 'sell') && !hasTrade) return selectView('changeActivity');
    if (target === 'production' && !hasProduction) return selectView('changeActivity');
    if (target === 'services' && !hasServices) return selectView('changeActivity');
    if (target === 'mafiaActivity' && !state.ceo.inMafia) return selectView('main');

    selectView(target as ActiveView);
  };

  const handleEndTurn = () => {
    setTurnBarExpanded(false);
    setMobileMenuOpen(false);
    doTurn();
  };

  const recentNews = state.news.slice(0, 5);

  const sidebarContent = (
    <nav className="p-2 flex flex-col gap-0.5 select-none">
      <div className="fm-nav-section">Biuro Prezesa</div>
      <SidebarItem
        active={activeView === 'main'}
        onClick={() => selectView('main')}
        icon="🏛️"
        label="Pulpit"
      />
      <SidebarItem
        active={activeView === 'news'}
        onClick={() => selectView('news')}
        icon="✉"
        label="Skrzynka"
        badge={unreadInboxCount > 0 ? String(unreadInboxCount) : undefined}
        badgeTone="alert"
      />
      <SidebarItem
        active={activeView === 'statistics'}
        onClick={() => selectView('statistics')}
        icon="📊"
        label="Finanse i statystyki"
      />

      <div className="fm-nav-section mt-2">Operacje i firma</div>
      <SidebarItem
        active={activeView === 'changeActivity'}
        onClick={() => selectView('changeActivity')}
        icon="🏭"
        label="Działalność"
      />
      {hasProduction && (
        <SidebarItem
          active={activeView === 'production'}
          onClick={() => selectView('production')}
          icon="⚙"
          label="Produkcja"
          sub
        />
      )}
      {hasTrade && (
        <>
          <SidebarItem
            active={activeView === 'buy'}
            onClick={() => selectView('buy')}
            icon="🛒"
            label="Kupuj"
            sub
          />
          <SidebarItem
            active={activeView === 'sell'}
            onClick={() => selectView('sell')}
            icon="💰"
            label="Sprzedawaj"
            sub
          />
        </>
      )}
      {hasServices && (
        <SidebarItem
          active={activeView === 'services'}
          onClick={() => selectView('services')}
          icon="🛎️"
          label="Usługi"
          sub
        />
      )}
      <SidebarItem
        active={activeView === 'marketing'}
        onClick={() => selectView('marketing')}
        icon="📣"
        label="Marketing"
      />
      <SidebarItem
        active={activeView === 'employees'}
        onClick={() => selectView('employees')}
        icon="👥"
        label="Pracownicy"
        badge={totalWorkers > 0 ? String(totalWorkers) : undefined}
      />
      <SidebarItem
        active={activeView === 'office'}
        onClick={() => selectView('office')}
        icon="🪑"
        label="Biuro"
      />

      <div className="fm-nav-section mt-2">Wpływy</div>
      <SidebarItem
        active={activeView === 'party'}
        onClick={() => selectView('party')}
        icon="🏛"
        label="Polityka"
      />
      {state.ceo.inMafia && (
        <SidebarItem
          active={activeView === 'mafiaActivity'}
          onClick={() => selectView('mafiaActivity')}
          icon="🕶️"
          label="Mafia"
          badgeTone="danger"
          badge="!"
        />
      )}

      <div className="fm-nav-section mt-2">Świat i liga</div>
      <SidebarItem
        active={activeView === 'rankings'}
        onClick={() => selectView('rankings')}
        icon="🏆"
        label="Rankingi"
        badge={state.interactionPoints > 0 ? `${state.interactionPoints} pkt` : undefined}
        badgeTone="gold"
      />
      <SidebarItem
        active={activeView === 'globalNews'}
        onClick={() => selectView('globalNews')}
        icon="📰"
        label="Prasa / Newsy"
        badge={unreadGlobalNewsCount > 0 ? String(unreadGlobalNewsCount) : undefined}
        badgeTone="info"
      />
      <SidebarItem
        active={activeView === 'stats'}
        onClick={() => selectView('stats')}
        icon="📈"
        label="Makroekonomia"
      />
      <SidebarItem
        active={activeView === 'achievements'}
        onClick={() => selectView('achievements')}
        icon="🏅"
        label="Osiągnięcia"
      />
    </nav>
  );

  return (
    <div className="min-h-screen fm-shell flex flex-col">
      {/* STAŁY GÓRNY PASEK HUD (CM / FM) */}
      <header className="fm-topbar sticky top-0 z-30">
        <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2.5">
          {/* Lewa strona: menu mobilne + herb firmy + nazwa i data */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Otwórz nawigację"
              className="lg:hidden fm-btn px-2.5 py-1.5 text-sm font-bold shrink-0"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>

            <button
              type="button"
              onClick={() => selectView('main')}
              title="Powrót na Pulpit Prezesa"
              className="w-9 h-9 shrink-0 fm-kpi flex items-center justify-center font-mono font-bold text-sm tracking-tight border-2 hover:brightness-110 transition"
              style={{ color: 'var(--accent)' }}
            >
              {companyMonogram}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1
                  className="text-sm sm:text-base md:text-lg font-bold truncate max-w-[200px] sm:max-w-xs md:max-w-md leading-tight"
                  title={displayCompanyName}
                >
                  {displayCompanyName}
                </h1>
                {state.ceo.inMafia && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-red-600 text-white shrink-0">
                    MAFIA
                  </span>
                )}
              </div>
              <p className="fm-topbar-sub text-[11px] sm:text-xs text-stone-500 font-mono truncate">
                {state.year} Q{state.quarter} · {sizeLabel}
              </p>
            </div>
          </div>

          {/* Prawa strona: czytniki KPI + Opcje + NASTĘPNA TURA */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="fm-kpi text-right">
              <div className="text-[9px] uppercase tracking-wider text-stone-500 leading-none mb-0.5">
                Stan konta
              </div>
              <div
                className={`text-sm sm:text-base font-mono font-bold leading-tight ${
                  isNegativeBalance ? 'text-red-400' : ''
                }`}
              >
                {formatMoney(state.company.finances.stanKonta, state)}
              </div>
            </div>

            <div className="fm-kpi hidden sm:block min-w-[92px]">
              <div className="flex justify-between text-[9px] uppercase tracking-wider text-stone-500 leading-none mb-1">
                <span>Reputacja</span>
                <span className="font-mono font-bold text-stone-900">{repRounded}%</span>
              </div>
              <div className="h-1.5 bg-stone-200 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, repRounded))}%`,
                    backgroundColor: 'var(--bar-fill)',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOptions(true)}
              title="Opcje gry"
              className="fm-btn px-2.5 py-2 text-sm font-bold shrink-0"
            >
              ⚙
            </button>

            <button
              type="button"
              onClick={handleEndTurn}
              className="fm-btn-continue px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
            >
              Następna tura ▶
            </button>
          </div>
        </div>
      </header>

      {/* MOBILNY DRAWER NAWIGACJI */}
      {mobileMenuOpen && (
        <div className="lg:hidden fm-sidebar border-b-2 border-stone-300 shadow-lg">
          {sidebarContent}
        </div>
      )}

      {/* GŁÓWNY OBSZAR: LEWY SIDEBAR + PRAWA PRZESTRZEŃ ROBOCZA */}
      <div className="flex-1 flex min-h-0">
        {/* Stały lewy sidebar na desktopie */}
        <aside className="hidden lg:flex lg:flex-col w-56 xl:w-60 shrink-0 fm-sidebar">
          <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
        </aside>

        {/* Prawa kolumna robocza */}
        <main className="flex-1 min-w-0 p-3 md:p-4 lg:p-5 overflow-x-hidden">
          <div className="max-w-6xl mx-auto">
            {/* Pasek trybu debugowania */}
            {debugMode && (
              <div className="w-full bg-amber-50 border border-amber-300 text-amber-950 p-2 mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-200">
                  🛠 DEBUG
                </span>

                <button
                  onClick={() => debugSendTestMessage()}
                  className="text-xs bg-white border border-amber-300 px-2.5 py-1 hover:bg-amber-100 font-medium"
                >
                  ✉ Wyślij testową wiadomość
                </button>

                <button
                  onClick={() => setShowDebugMinigames(v => !v)}
                  className={`text-xs border border-amber-300 px-2.5 py-1 font-medium ${
                    showDebugMinigames ? 'bg-amber-200' : 'bg-white hover:bg-amber-100'
                  }`}
                >
                  🎮 Minigry {showDebugMinigames ? '▲' : '▼'}
                </button>

                {showDebugMinigames && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-amber-300">
                    <button
                      onClick={() => {
                        setShowDebugMinigames(false);
                        debugStartTaxCombat();
                      }}
                      className="text-xs bg-white border border-amber-300 px-2.5 py-1 hover:bg-amber-100"
                    >
                      ⚔️ Walka ze skarbówką
                    </button>
                    <button
                      onClick={() => {
                        setShowDebugMinigames(false);
                        debugStartChase();
                      }}
                      className="text-xs bg-white border border-amber-300 px-2.5 py-1 hover:bg-amber-100"
                    >
                      🚗 Pościg mafii
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Alert bankructwa */}
            {state.bankruptWarningTurns > 0 && isNegativeBalance && (
              <div className="bg-red-100 border-2 border-red-500 p-3 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-red-900">
                    ⚠ ALARM PŁYNNOŚCI: Bankructwo za {2 - state.bankruptWarningTurns} tur!
                  </p>
                  <p className="text-xs text-red-800">
                    Ujemny stan konta grozi natychmiastową likwidacją firmy.
                  </p>
                </div>
                <button
                  onClick={takeEmergencyLoan}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold shrink-0"
                >
                  Kredyt ratunkowy ({formatMoney(emergencyLoanAmount, state)}, {emergencyLoanRatePct}% / kw.)
                </button>
              </div>
            )}

            {/* Kompaktowy pasek: ścieżka ekranu + Dziennik rundy + Cofnij */}
            <div className="fm-panel mb-3 overflow-hidden">
              <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
                    {VIEW_TITLES[activeView]}
                  </span>
                  <span className="text-stone-400 hidden sm:inline">|</span>
                  <button
                    type="button"
                    onClick={() => setTurnBarExpanded(v => !v)}
                    className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-85 transition"
                  >
                    <span className="text-xs font-semibold text-stone-600 shrink-0">
                      📋 Dziennik:
                    </span>
                    <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 shrink-0">
                      {turnActions.length}
                    </span>
                    {latestAction && !turnBarExpanded && (
                      <span className="hidden md:inline text-xs text-stone-500 truncate">
                        {latestAction.icon} {latestAction.text}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {unreadInboxCount > 0 && activeView !== 'news' && (
                    <button
                      type="button"
                      onClick={() => selectView('news')}
                      className="text-[11px] bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-900 px-2 py-1 font-bold transition"
                    >
                      ✉ Poczta ({unreadInboxCount})
                    </button>
                  )}

                  {undoCount > 0 && (
                    <button
                      type="button"
                      onClick={() => undoLastAction()}
                      title="Cofnij ostatni ruch w tej rundzie"
                      className="text-[11px] bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 px-2 py-1 font-bold transition"
                    >
                      ↩ Cofnij ({undoCount})
                    </button>
                  )}

                  {latestAction && !turnBarExpanded && (
                    <button
                      type="button"
                      onClick={() => navigateToTarget(latestAction.target)}
                      className="hidden sm:inline-block fm-btn text-[11px] px-2 py-1 font-semibold"
                    >
                      {TARGET_LABELS[latestAction.target]} →
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setTurnBarExpanded(v => !v)}
                    className="fm-btn text-[11px] font-semibold px-2.5 py-1"
                  >
                    {turnBarExpanded ? 'Zwiń ▲' : 'Dziennik ▼'}
                  </button>
                </div>
              </div>

              {turnBarExpanded && (
                <div className="border-t border-stone-200 fm-recessed px-3 py-2.5">
                  {turnActions.length === 0 ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-600 py-1">
                      <span>W tej rundzie nie wykonano jeszcze żadnych działań.</span>
                      <button
                        type="button"
                        onClick={() => navigateToTarget('changeActivity')}
                        className="self-start sm:self-auto px-2.5 py-1 bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
                      >
                        Przejdź do Działalności →
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100 max-h-56 overflow-y-auto">
                      {[...turnActions].reverse().map((entry, idx) => (
                        <li
                          key={entry.id}
                          className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="text-stone-400 font-mono shrink-0">
                              #{turnActions.length - idx}
                            </span>
                            <span className="shrink-0">{entry.icon}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-900 px-1.5 py-0.5 shrink-0">
                              {entry.category}
                            </span>
                            <span className="text-stone-800 break-words">{entry.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                            {idx === 0 && undoCount > 0 && (
                              <button
                                type="button"
                                onClick={() => undoLastAction()}
                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 font-bold transition"
                              >
                                ↩ Cofnij
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigateToTarget(entry.target)}
                              className="fm-btn px-2 py-0.5 font-semibold"
                            >
                              {TARGET_LABELS[entry.target]} →
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Szybkie skróty do głównych ekranów rundy */}
                  <div className="mt-2 pt-2 border-t border-stone-200 flex flex-wrap items-center gap-1.5">
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

            {/* POWRÓT Z PODEKRANÓW DZIAŁALNOŚCI */}
            {isInsideActivitySubscreen && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => selectView('changeActivity')}
                  className="fm-btn text-xs font-semibold px-3 py-1.5 inline-flex items-center gap-1.5"
                >
                  ← Powrót do zarządzania działalnością
                </button>
              </div>
            )}

            {/* =========================================
                PULPIT PREZESA (EKRAN GŁÓWNY)
                ========================================= */}
            {activeView === 'main' && (
              <div className="space-y-4">
                {/* 4 kafelki KPI u góry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <InfoCard
                    label="Profil działalności"
                    value={activityInfo.subcategory || state.company.activity}
                  />
                  <InfoCard label="Skala firmy" value={sizeLabel} />
                  <InfoCard
                    label="Załoga"
                    value={staffSummary}
                    muted={totalWorkers === 0 && !state.company.hasAccountant}
                  />
                  <div className="fm-panel p-3 flex flex-col justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                      Kondycja firmy
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-mono text-base font-bold ${trendMeta.color}`}>
                        {trendMeta.icon}
                      </span>
                      <span className="text-xs font-semibold text-stone-600">{trendMeta.label}</span>
                    </div>
                  </div>
                </div>

                {/* Układ 2-kolumnowy: lewa = Biuro + szybkie operacje, prawa = Status + Poczta/Prasa */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                  {/* Lewa kolumna */}
                  <div className="xl:col-span-7 space-y-4">
                    <OfficeView
                      companyName={displayCompanyName}
                      year={state.year}
                      quarter={state.quarter}
                      inMafia={state.ceo.inMafia}
                      inventory={state.company.inventory}
                    />

                    {/* Panel szybkich operacji w kwartale */}
                    <div className="fm-panel overflow-hidden">
                      <div className="fm-panel-header">
                        <span>Szybkie akcje kwartału</span>
                        <span className="font-mono text-[10px] opacity-80">
                          PKT LIGI: {state.interactionPoints}
                        </span>
                      </div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {hasProduction && (
                          <button
                            type="button"
                            onClick={() => selectView('production')}
                            className="fm-btn p-2.5 text-left"
                          >
                            <div className="text-xs font-bold">🏭 Produkcja</div>
                            <div className="text-[11px] text-stone-500">Partia i zbyt</div>
                          </button>
                        )}
                        {hasTrade && (
                          <>
                            <button
                              type="button"
                              onClick={() => selectView('buy')}
                              className="fm-btn p-2.5 text-left"
                            >
                              <div className="text-xs font-bold">🛒 Zakupy</div>
                              <div className="text-[11px] text-stone-500">Towar do magazynu</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => selectView('sell')}
                              className="fm-btn p-2.5 text-left"
                            >
                              <div className="text-xs font-bold">💰 Sprzedaż</div>
                              <div className="text-[11px] text-stone-500">Kontrahenci</div>
                            </button>
                          </>
                        )}
                        {hasServices && (
                          <button
                            type="button"
                            onClick={() => selectView('services')}
                            className="fm-btn p-2.5 text-left"
                          >
                            <div className="text-xs font-bold">🛎️ Usługi</div>
                            <div className="text-[11px] text-stone-500">Stała oferta</div>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => selectView('rankings')}
                          className="fm-btn p-2.5 text-left"
                        >
                          <div className="text-xs font-bold">🏆 Rankingi</div>
                          <div className="text-[11px] text-stone-500">Rywale i sojusze</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectView('statistics')}
                          className="fm-btn p-2.5 text-left"
                        >
                          <div className="text-xs font-bold">📊 Finanse</div>
                          <div className="text-[11px] text-stone-500">Bilans i kredyty</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Prawa kolumna */}
                  <div className="xl:col-span-5 space-y-4">
                    {/* Karta Prezesa */}
                    <div className="fm-panel overflow-hidden">
                      <div className="fm-panel-header">
                        <span>Karta Prezesa</span>
                        <span className="font-mono text-[10px]">CEO</span>
                      </div>
                      <div className="p-3 divide-y divide-stone-100 text-xs">
                        <div className="py-1.5 flex justify-between items-center gap-2">
                          <span className="text-stone-500 uppercase tracking-wide text-[11px]">
                            Reputacja ogólna
                          </span>
                          <span className="font-mono font-bold text-sm">{repRounded}%</span>
                        </div>
                        <div className="py-1.5 flex justify-between items-center gap-2">
                          <span className="text-stone-500 uppercase tracking-wide text-[11px]">
                            Przynależność partyjna
                          </span>
                          <button
                            type="button"
                            onClick={() => selectView('party')}
                            className="font-semibold hover:underline"
                          >
                            {party} →
                          </button>
                        </div>
                        <div className="py-1.5 flex justify-between items-center gap-2">
                          <span className="text-stone-500 uppercase tracking-wide text-[11px]">
                            Półświatek / Mafia
                          </span>
                          <span
                            className={`font-semibold ${
                              state.ceo.inMafia ? 'text-red-400' : 'text-stone-400'
                            }`}
                          >
                            {state.ceo.inMafia ? 'Członek' : 'Brak powiązań'}
                          </span>
                        </div>
                        <div className="py-1.5 flex justify-between items-center gap-2">
                          <span className="text-stone-500 uppercase tracking-wide text-[11px]">
                            Nieprzeczytana poczta
                          </span>
                          <button
                            type="button"
                            onClick={() => selectView('news')}
                            className={`font-mono font-bold hover:underline ${
                              unreadInboxCount > 0 ? 'text-blue-700' : 'text-stone-500'
                            }`}
                          >
                            {unreadInboxCount} {unreadInboxCount > 0 ? '→' : ''}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Najnowsze doniesienia */}
                    <div className="fm-panel overflow-hidden">
                      <div className="fm-panel-header">
                        <span>Najnowsze doniesienia</span>
                        <button
                          type="button"
                          onClick={() => selectView('globalNews')}
                          className="text-[10px] underline hover:opacity-80"
                        >
                          Prasa →
                        </button>
                      </div>
                      {recentNews.length === 0 ? (
                        <div className="p-4 text-xs text-stone-500 italic">
                          Brak doniesień. Rynek jeszcze nie zauważył Twojej firmy.
                        </div>
                      ) : (
                        <ul className="divide-y divide-stone-100">
                          {recentNews.map(item => {
                            const inbox = isCompanyInboxItem(item);
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => selectView(inbox ? 'news' : 'globalNews')}
                                  className="w-full px-3 py-2 text-left hover:bg-stone-50 transition flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      {!item.read && (
                                        <span
                                          className="w-1.5 h-1.5 rounded-full shrink-0"
                                          style={{ backgroundColor: 'var(--accent)' }}
                                        />
                                      )}
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                        {inbox ? '✉ Poczta' : '📰 Prasa'}
                                      </span>
                                    </div>
                                    <p className="text-xs font-semibold text-stone-900 truncate mt-0.5">
                                      {item.headline}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-mono text-stone-400 shrink-0 mt-0.5">
                                    {item.year} Q{item.quarter}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================
                POZOSTAŁE EKRANY GRY
                ========================================= */}
            {activeView === 'news' && <NewsScreen />}

            {activeView === 'changeActivity' && (
              <ChangeActivityScreen
                onNavigateToBuy={() => selectView('buy')}
                onNavigateToSell={() => selectView('sell')}
                onNavigateToProduction={() => selectView('production')}
                onNavigateToServices={() => selectView('services')}
              />
            )}
            {activeView === 'buy' && hasTrade && <BuyScreen />}
            {activeView === 'sell' && hasTrade && <SellScreen />}
            {activeView === 'production' && hasProduction && (
              <ProductionScreen
                onNavigateToSell={hasTrade ? () => selectView('sell') : undefined}
              />
            )}
            {activeView === 'services' && hasServices && <ServicesScreen />}
            {activeView === 'marketing' && <MarketingScreen />}
            {activeView === 'party' && <PartyScreen />}
            {activeView === 'employees' && <EmployeesScreen />}
            {activeView === 'office' && <OfficeScreen />}
            {activeView === 'statistics' && <StatisticsScreen />}
            {activeView === 'mafiaActivity' && state.ceo.inMafia && <MafiaActivityScreen />}

            {activeView === 'rankings' && <RankingsScreen />}
            {activeView === 'globalNews' && <GlobalNewsScreen />}
            {activeView === 'achievements' && <AchievementsScreen />}
            {activeView === 'stats' && <StatsScreen />}
          </div>
        </main>
      </div>

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeTone = 'neutral',
  sub = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string;
  badgeTone?: 'neutral' | 'alert' | 'gold' | 'info' | 'danger';
  sub?: boolean;
}) {
  const badgeStyle =
    badgeTone === 'alert'
      ? 'bg-red-600 text-white'
      : badgeTone === 'danger'
        ? 'bg-red-700 text-white'
        : badgeTone === 'gold'
          ? 'bg-amber-100 text-amber-950 border border-amber-400'
          : badgeTone === 'info'
            ? 'bg-blue-600 text-white'
            : 'bg-stone-200 text-stone-700';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`fm-nav-item ${active ? 'fm-nav-item-active' : ''} ${sub ? 'fm-nav-sub' : ''}`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-xs shrink-0 w-4 text-center">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 shrink-0 ${badgeStyle}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function QuickJumpButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fm-btn text-[11px] px-2 py-1 font-medium"
    >
      {children}
    </button>
  );
}

function InfoCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="fm-panel p-3 flex flex-col justify-between">
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
        {label}
      </div>
      <div className={`text-sm font-bold truncate ${muted ? 'text-stone-400' : 'text-stone-900'}`} title={value}>
        {value}
      </div>
    </div>
  );
}

interface OfficeViewProps {
  companyName: string;
  year: number;
  quarter: number;
  inMafia: boolean;
  inventory?: string[];
}

function OfficeView({ companyName, year, quarter, inMafia, inventory }: OfficeViewProps) {
  const [view, setView] = useState<'outside' | 'inside'>('outside');

  let seasonBg = 'from-slate-700 via-slate-600 to-slate-800';
  let windowEmoji = '🌤️';
  if (quarter === 1) {
    seasonBg = 'from-emerald-900/90 via-teal-800/80 to-slate-900';
    windowEmoji = '🌱';
  }
  if (quarter === 2) {
    seasonBg = 'from-sky-800 via-amber-700/60 to-slate-900';
    windowEmoji = '☀️';
  }
  if (quarter === 3) {
    seasonBg = 'from-amber-900/90 via-orange-900/70 to-slate-900';
    windowEmoji = '🍂';
  }
  if (quarter === 4) {
    seasonBg = 'from-slate-800 via-blue-950 to-slate-950';
    windowEmoji = '❄️';
  }

  return (
    <div className="fm-panel overflow-hidden">
      <div className="fm-panel-header">
        <span>Siedziba firmy</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView('outside')}
            className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
              view === 'outside'
                ? 'bg-stone-900 text-white border-stone-400'
                : 'bg-transparent text-stone-300 border-stone-500 hover:bg-stone-800'
            }`}
          >
            Zewnątrz
          </button>
          <button
            type="button"
            onClick={() => setView('inside')}
            className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
              view === 'inside'
                ? 'bg-stone-900 text-white border-stone-400'
                : 'bg-transparent text-stone-300 border-stone-500 hover:bg-stone-800'
            }`}
          >
            Wnętrze
          </button>
        </div>
      </div>

      <div className={`relative bg-gradient-to-b ${seasonBg} overflow-hidden h-44 md:h-56`}>
        {view === 'outside' ? (
          <>
            <div className={`absolute top-0 left-0 right-0 h-3/4 bg-gradient-to-b ${seasonBg} opacity-60`} />
            <div className="absolute top-5 left-6 w-20 md:w-24 h-14 md:h-16 bg-gradient-to-br from-sky-200 to-sky-100 border-4 border-stone-500 shadow-inner flex items-center justify-center text-2xl">
              {windowEmoji}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-stone-500 -translate-x-1/2" />
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-500 -translate-y-1/2" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-amber-950/80" />
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-10 md:bottom-14 left-1/2 -translate-x-1/2 w-48 md:w-64 h-2 bg-amber-900 shadow-md" />

            <div className="absolute top-4 right-4 text-right z-10 bg-black/45 px-3 py-2 border border-white/15">
              <div className="text-[9px] uppercase tracking-widest text-amber-300 font-bold">
                Centrala
              </div>
              <div className="text-xs md:text-sm font-bold text-white">{companyName}</div>
              <div className="text-[10px] md:text-xs text-slate-300 font-mono">
                {year} Q{quarter}
              </div>
              {inMafia && (
                <div className="text-[9px] uppercase tracking-widest text-red-400 font-bold mt-1">
                  ⚠ powiązania
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-slate-800" />
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-amber-950/85" />
            <div className="absolute bottom-1/4 left-1/4 w-1/2 h-3 md:h-4 bg-stone-700 shadow-lg border-t border-stone-500" />

            {inventory?.includes('komputer') && (
              <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-10 md:w-12 h-8 md:h-10 bg-black border-2 border-slate-500 flex items-center justify-center text-[10px] font-mono text-green-400">
                PC
              </div>
            )}
            {inventory?.includes('ekspres') && (
              <div className="absolute bottom-[30%] left-1/4 translate-x-4 text-2xl md:text-3xl">☕</div>
            )}
            {inventory?.includes('kwiat') && (
              <div className="absolute bottom-2 md:bottom-4 left-4 md:left-8 text-4xl md:text-5xl">🪴</div>
            )}
            {inventory?.includes('sejf') && (
              <div className="absolute bottom-2 md:bottom-4 right-4 md:right-8 text-4xl md:text-5xl">🔐</div>
            )}
            {inventory?.includes('kapeć_hipnotyzera') && (
              <div className="absolute top-10 left-4 md:left-8 text-3xl md:text-4xl transform -rotate-12">
                🥿
              </div>
            )}
            {inventory?.includes('tygodnik_opinii') && (
              <div className="absolute top-12 right-6 text-3xl">📰</div>
            )}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-10 border-4 border-amber-900 bg-sky-200 flex items-center justify-center text-xl">
              {windowEmoji}
            </div>
          </>
        )}
      </div>
    </div>
  );
}