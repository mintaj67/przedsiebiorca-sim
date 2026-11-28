export type Phase = 'chaos' | 'duopol' | 'invasion';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Pace = 'quarter' | 'year';
export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | 'very_large' | 'corporation';
export type AppScreen = 'menu' | 'start' | 'game' | 'options' | 'about' | 'saves' | 'achievements';
export type PoliticalSide = 'PZPR' | 'independent' | 'opposition' | 'none';
export type Ideology = 'radical_right' | 'moderate_right' | 'center' | 'moderate_left' | 'radical_left';
export type PartySize = 'very_small' | 'small' | 'medium' | 'large' | 'very_large';
export type LegalForm = 'cywilna' | 'zoo' | 'sa' | 'holding';
export type ContractType = 'bezUmowy' | 'zlecenie' | 'uop';
export type MainCategoryId = 'handel' | 'produkcja' | 'uslugi';

export interface PendingHire {
  id: string;
  contract: ContractType;
  count: number;
  hiredOnTurn: number;
}

export type TurnActionTarget =
  | 'main'
  | 'news'
  | 'changeActivity'
  | 'buy'
  | 'sell'
  | 'production'
  | 'services'
  | 'marketing'
  | 'party'
  | 'competition'
  | 'employees'
  | 'office'
  | 'activity'
  | 'statistics'
  | 'mafiaActivity'
  | 'rankings'
  | 'achievements'
  | 'stats';

export interface TurnActionEntry {
  id: string;
  icon: string;
  category: string;
  text: string;
  target: TurnActionTarget;
  canUndo?: boolean;
}

export interface Reputation {
  branza: number;
  opiniaPubliczna: number;
  opiniaPracownicy: number;
  opiniaBranza: number;
  opiniaMafia: number;
  opiniaMedia: number;
  opiniaPolitycy: number;
  opiniaSkarbowa: number;
  dokladnoscPrzewidywan: number;
  bazowaDokladnosc?: number;
  ogolna: number;
}

export interface Wplywy {
  przychodyZDzialalnosci: number;
  srodkiZKredytow: number;
  dofinansowania: number;
  dofinansowaniaSzaraStrefa: number;
  dochodPasywny: number;
  splatyZobowiazan: number;
}

export interface Wydatki {
  splacaneKredyty: number;
  pracownicy: number;
  czynsz: number;
  podatki: number;
  kary: number;
  wydatkiNieplanowane: number;
  zakupy: number;
  inne: number;
}

export interface FinanceHistoryEntry {
  turn: number;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  stanKonta: number;
  wplywy: Wplywy;
  wydatki: Wydatki;
}

export interface Finances {
  stanKonta: number;
  wplywy: Wplywy;
  wydatki: Wydatki;
  /** Historia zamkniętych kwartałów (do podglądu Kwartał / Ostatnie 4 kwartały / Całokształt) */
  history?: FinanceHistoryEntry[];
}

export interface Employees {
  bezUmowy: number;
  zlecenie: number;
  uop: number;
}

export interface Loan {
  id: string;
  source: 'bank' | 'szara_strefa' | 'zakup_raty' | 'sojusznik';
  principal: number;
  remaining: number;
  interestRate: number;
  quartersLeft: number;
  lenderId?: string;
}

export interface ExternalEquityStake {
  holderId: string;
  percent: number;
  acquiredTurn: number;
}

export interface Company {
  name: string;
  suffix: string;
  /** Czy dodawać automatyczny skrót przed nazwą firmy (PP, PH, PU, PPH, PPU, PHU, PPHU) */
  usePrefix?: boolean;
  size: CompanySize;
  legalForm: LegalForm;
  /** Główna (pierwsza) wybrana podkategoria — dla kompatybilności wstecznej */
  activity: string;
  /** Wszystkie wybrane podkategorie działalności */
  activities?: string[];
  employees: Employees;
  finances: Finances;
  reputation: Reputation;
  loans: Loan[];
  lastActivityChangeTurn: number;
  hasAccountant: boolean;
  inventory: string[];
  /** Narzędzia produkcyjne kupione na stałe */
  ownedTools?: string[];
  branches: number;
  resources: Record<string, number>;
  warehouseCapacity: number;
  /** Udziały firmy gracza posiadane przez inne firmy */
  externalEquity?: ExternalEquityStake[];
  /** ID głównej spółki-matki (gdy udział zewnętrzny >= 25%) */
  parentCompanyId?: string | null;
  /** Irytacja spółki-matki (0-100; przy >= 100 i pakiecie >50% odwołanie CEO) */
  parentDispleasure?: number;
}

export interface PartySizeSchedule {
  from: number;
  to: number;
  size: PartySize;
}

export interface Party {
  id: string;
  name: string;
  descriptions: string[];
  descriptionAfterJoin: string;
  ideology: Ideology;
  sizeSchedule: PartySizeSchedule[];
  pzprAvailable: 'yes' | 'no' | 'both';
  isPSL?: boolean;
  special?: string;
  economicView: number;
  socialView: number;
  activeFrom: number;
  activeTo: number;
}

export interface President {
  id: string;
  name: string;
  partyId: string | null;
  termStart: number;
  termEnd: number;
}

export interface ElectionResult {
  year: number;
  seats: Record<string, number>;
  coalition: string[];
  premierId: string | null;
}

export interface PresidentialCandidate {
  id: string;
  name: string;
  partyId: string | null;
  partyLabel?: string;
  votesPercent: number;
}

export interface PresidentialResult {
  year: number;
  candidates: PresidentialCandidate[];
  winner: PresidentialCandidate;
  secondRound: boolean;
  secondRoundCandidates?: PresidentialCandidate[];
}

export interface PoliticsState {
  parties: Party[];
  president: President | null;
  premierId: string | null;
  rulingCoalition: string[];
  lastElection: ElectionResult | null;
  nextParliamentaryElection: number;
  nextPresidentialElection: number;
  pslAvailable: boolean;
  partySchedule: Record<string, { from: number; to: number }>;
}

export interface CEO {
  party: PoliticalSide;
  currentPartyId: string | null;
  inMafia: boolean;
  partySwitchesByPhase: Record<Phase, number>;
  flags: string[];
  lastMafiaInvitationTurn: number | null;
}

export interface EventConditions {
  yearMin?: number;
  yearMax?: number;
  phase?: Phase[];
  difficulty?: Difficulty[];
  party?: PoliticalSide[];
  currentPartyId?: string[];
  rulingParty?: string[];
  mafiaMember?: boolean;
  minReputation?: Partial<Reputation>;
  maxReputation?: Partial<Reputation>;
  minStanKonta?: number;
  maxStanKonta?: number;
  legalForm?: LegalForm[];
  activities?: string[];
  flags?: string[];
  notFlags?: string[];
  hasParty?: boolean;
  hasItem?: string;
}

export interface EventEffects {
  reputation?: Partial<Reputation>;
  stanKonta?: number;
  wplywy?: Partial<Wplywy>;
  wydatki?: Partial<Wydatki>;
  flagsAdd?: string[];
  flagsRemove?: string[];
  joinMafia?: boolean;
  leaveMafia?: boolean;
  setParty?: PoliticalSide;
  setCurrentPartyId?: string;
  divideFinances?: boolean;
  employeesDelta?: { bezUmowy?: number; zlecenie?: number; uop?: number };
  addItem?: string;
  /** Efekty dyplomatyczne, wojenne i zależności kapitałowej (używane m.in. przez ActionableNews) */
  parentDispleasureDelta?: number;
  joinWarAsAlly?: { warId: string; allyId: string };
  refuseWarCall?: { allyId: string };
  sellEquityTo?: { holderId: string; percent: number; cashReceived: number };
  addTribute?: {
    payerId: 'player' | string;
    receiverId: 'player' | string;
    amountPerQuarter: number;
    quartersLeft: number;
  };
  payReparationsTo?: { compId: string; amount: number };
  startWarWith?: string;
}

export interface Gamble {
  winChance: number;
  onWin: EventEffects;
  onLose: EventEffects;
  winText?: string;
  loseText?: string;
}

export interface EventOutcome {
  weight: number;
  description: string;
  effects: EventEffects;
}

export interface EventChoice {
  id: string;
  label: string;
  description?: string;
  effects?: EventEffects;
  gamble?: Gamble;
  outcomes?: EventOutcome[];
  requires?: EventConditions;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  weight: number;
  once?: boolean;
  conditions: EventConditions;
  choices: EventChoice[];
}

export interface Activity {
  id: string;
  label: string;
  description: string;
  weight: number;
  conditions: EventConditions;
  effects: EventEffects;
}

export interface ActivityItem {
  id: string;
  name: string;
  rep: number;
  mafia: number;
  synergyGroups?: string[];
  locked?: boolean;
}

export interface ActivityCategory {
  id: MainCategoryId | string;
  name: string;
  activities: ActivityItem[];
}

export type NewsCategory = 'rumor' | 'poll' | 'party' | 'economy' | 'custom';

export interface NewsChoice {
  id: string;
  label: string;
  description?: string;
  effects?: EventEffects;
  requires?: EventConditions;
}

export interface NewsItem {
  id: string;
  turn: number;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  headline: string;
  body?: string;
  category: NewsCategory;
  read: boolean;
  choices?: NewsChoice[];
  expiresAtTurn?: number;
  resolved?: boolean;
  resolvedChoiceId?: string;
  onExpireEffects?: EventEffects;
}

export interface ChoiceResult {
  eventId: string;
  eventTitle: string;
  choiceId: string;
  choiceLabel: string;
  consequenceLines: string[];
  gambleResult?: 'win' | 'lose';
  outcomeDescription?: string;
}

export interface CombatLogEntry {
  text: string;
  type: 'player' | 'enemy' | 'system';
}

export interface CombatState {
  type: 'skarbowka';
  playerHp: number;
  playerHpMax: number;
  enemyHp: number;
  enemyHpMax: number;
  round: number;
  log: CombatLogEntry[];
  finished: boolean;
  result: 'win' | 'lose' | 'draw' | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface ChaseState {
  player: Point;
  enemies: Point[];
  gridSize: number;
  grid: number[][];
  turn: number;
  maxTurns: number;
  finished: boolean;
  result: 'escaped' | 'caught' | null;
}

// --- Handel i Produkcja ---
export type InstallmentOption = 1 | 2 | 6 | 12 | 24;
export type TradeSpecialCategory = 'hit_sezonu' | 'deficytowy' | 'bialy_kruk';

export interface TradeProductDefinition {
  id: string;
  name: string;
  desc: string;
  basePrice: number;
  quality: number;
  /** Popyt sezonowy dla [Q1 Wiosna, Q2 Lato, Q3 Jesień, Q4 Zima], np. [1.0, 1.35, 0.9, 0.7] */
  seasonalDemand?: [number, number, number, number];
  /** Lista dostawców, u których ten produkt może się pojawić */
  supplierIds?: string[];
  /** Jeśli podano, produkt występuje ekskluzywnie u tego jednego dostawcy */
  exclusiveSupplierId?: string;
  /** Jeśli produkt z natury należy do kategorii specjalnej (np. zawsze biały kruk) */
  alwaysSpecial?: TradeSpecialCategory;
  req?: {
    minRepBranza?: number;
    minRepPubliczna?: number;
    minRepMafia?: number;
  };
}

export interface TradeProductOffer {
  offerKey: string;
  productId: string;
  name: string;
  desc: string;
  quality: number;
  /** Cena zakupu 1 szt. u tego dostawcy (już po inflacji i sezonie) */
  buyPrice: number;
  /** Bieżący popyt sezonowy w % (np. 135 oznacza 135%) */
  demandPercent: number;
  /** Specjalna kategoria wylosowana lub przypisana w tym kwartale */
  specialCategory: TradeSpecialCategory | null;
  /** Czy produkt jest ekskluzywny dla tego sprzedawcy */
  isExclusive: boolean;
  /** Limit sztuk dostępnych u dostawcy w tym kwartale (null = brak twardego limitu u dostawcy) */
  availableStock: number | null;
}

export interface TradeSupplier {
  id: string;
  name: string;
  desc: string;
  /** Słowne określenie jakości asortymentu tego dostawcy */
  qualityDesc?: string;
  /** @deprecated Zachowane wyłącznie dla kompatybilności starszych pomocników */
  quality: number;
  /** @deprecated Zachowane wyłącznie dla kompatybilności starszych pomocników */
  price: number;
  /** Konkretne produkty dostępne u tego dostawcy w bieżącej turze */
  products?: TradeProductOffer[];
  req?: {
    minRepBranza?: number;
    minRepMafia?: number;
  };
}

export interface TradeBuyer {
  id: string;
  name: string;
  desc: string;
  /** Wewnętrzny profil cenowy odbiorcy (np. 0.88–1.22; bez mnożników x2–x4, niewyświetlany jako liczba) */
  priceBias?: number;
  /** Słowny opis hojności cenowej odbiorcy */
  priceTierDesc?: string;
  /** Słowny opis wymagań jakościowych odbiorcy */
  minQualityDesc?: string;
  /** @deprecated Zastąpione przez priceBias — zachowane opcjonalnie dla kompatybilności */
  multiplier?: number;
  complaints: boolean;
  req?: {
    minRepPubliczna?: number;
    minQuality?: number;
  };
}

export interface ProductionIngredient {
  id: string;
  name: string;
  desc: string;
  quality: number;
  unitCost: number;
  baseWholesalePrice: number;
  req?: {
    minRepBranza?: number;
    minRepMafia?: number;
  };
}

export interface ProductionTool {
  id: string;
  name: string;
  desc: string;
  cost: number;
  unitsPerWorker: number;
  qualityBonus: number;
  req?: {
    minSize?: CompanySize;
    minRepBranza?: number;
  };
}

export interface ProductionDataFile {
  ingredients: ProductionIngredient[];
  tools: ProductionTool[];
  default?: {
    suppliers: TradeSupplier[];
    buyers: TradeBuyer[];
  };
}

export interface Complaint {
  id: string;
  itemName: string;
  buyerName: string;
  penalty: number;
}

export interface PendingSale {
  id: string;
  buyerName: string;
  resId: string;
  productName?: string;
  specialCategory?: TradeSpecialCategory | null;
  amount: number;
  estimatedRevenue: number;
  minRevenue?: number;
  maxRevenue?: number;
  quality: number;
  hasComplaints: boolean;
  installments?: InstallmentOption;
}

// --- Konkurencja, dyplomacja, wojny i przejęcia ---
export type Trend = -1 | 0 | 1;
export type CompetitorCharacter = 'aggressive' | 'neutral' | 'peaceful';
export type CompetitorStatus = 'active' | 'bankrupt' | 'acquired';
export type AcquiredMode = 'branch' | 'liquidated' | 'subsidiary';
export type WarDemandType = 'reparations' | 'tribute' | 'subjugate' | 'acquire';

export interface CompetitorTrend {
  value: Trend;
  reputation: Trend;
  condition: Trend;
}

export interface Competitor {
  id: string;
  name: string;
  description: string;
  /** Wylosowane motto z puli 3 haseł szablonu */
  motto: string;
  /** Charakter firmy wpływający na wojny, zdrady i werdykty */
  character: CompetitorCharacter;
  /** Branże firmy (np. ['handel'], ['produkcja', 'uslugi']) */
  categories: string[];
  /** Status rynkowy firmy */
  status: CompetitorStatus;
  size: CompanySize;
  reputation: number;
  value: number;
  condition: number;
  opinionOfPlayer: number;
  baseReputation: number;
  baseCondition: number;
  baseOpinion: number;
  trend: CompetitorTrend;
  /** Zgody z innymi firmami AI (ID firm) */
  allies: string[];
  /** Kosy z innymi firmami AI (ID firm) */
  rivals: string[];
  /** Formalny sojusz z graczem */
  isAlliedWithPlayer: boolean;
  /** Aktywna wojna z graczem */
  atWarWithPlayer: boolean;
  /** Czy firma jest uzależniona od gracza (lub innej firmy AI) */
  dependentOn?: 'player' | string | null;
  /** Informacje po przejęciu */
  acquiredBy?: 'player' | string | null;
  acquiredMode?: AcquiredMode | null;
  /** Kwartalny dochód pasywny, gdy firma jest spółką zależną gracza */
  subsidiaryIncome?: number;
}

export interface WarActionDefinition {
  id: string;
  label: string;
  description: string;
  baseCost: number;
  warScoreGain: number;
  enemyConditionDelta: number;
  enemyReputationDelta: number;
  requiresMafia?: boolean;
  reputationEffects?: Partial<Reputation>;
}

export interface ActiveWar {
  id: string;
  attackerId: 'player' | string;
  defenderId: 'player' | string;
  /**
   * Pasek przewagi wojennej (-100 do +100).
   * W wojnach z udziałem gracza: > 0 oznacza przewagę gracza, < 0 przewagę wroga.
   * W wojnach AI-AI: > 0 oznacza przewagę atakującego, < 0 obrońcy.
   */
  warScore: number;
  startedTurn: number;
  maxTurns: number;
  attackerAllies: string[];
  defenderAllies: string[];
  actionsUsedThisTurn?: string[];
}

export interface PendingWarResolution {
  warId: string;
  loserId: string;
  loserName: string;
  reparationsAmount: number;
  tributePerQuarter: number;
  tributeQuarters: number;
  canAcquire: boolean;
  finalWarScore: number;
}

export interface TributeObligation {
  id: string;
  payerId: 'player' | string;
  receiverId: 'player' | string;
  amountPerQuarter: number;
  quartersLeft: number;
}

export interface PlayerSnapshot {
  value: number;
  reputation: number;
  condition: number;
  rank: number;
}

// --- Usługi (Stała oferta usług) ---
export interface ServiceRequirements {
  minSize?: CompanySize;
  minWorkers?: number;
  minRepPubliczna?: number;
  minRepBranza?: number;
  minRepMafia?: number;
}

export interface ServiceDefinition {
  id: string;
  title: string;
  desc: string;
  basePayout: number;
  workersRequired: number;
  risk: number;
  repGain: number;
  req?: ServiceRequirements;
  activities?: string[];
}

/** Alias zachowany dla kompatybilności wstecznej */
export type ServiceOrder = ServiceDefinition;

export interface ActiveServiceContract {
  id: string;
  orderId: string;
  title: string;
  client: string;
  payout: number;
  workersRequired: number;
  risk: number;
  repGain: number;
}

export interface GameState {
  schemaVersion: number;
  seed: string;
  turn: number;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  phase: Phase;
  difficulty: Difficulty;
  pace: Pace;
  /** Czy przeszła denominacja złotego (przed: wyświetlanie ×10 000 w starych zł) */
  denominated: boolean;
  ceo: CEO;
  company: Company;
  politics: PoliticsState;
  pendingEvents: GameEvent[];
  lastEventTurn?: number | null;
  currentActivities: string[];
  history: string[];
  bankruptWarningTurns: number;
  lastChoiceResult: ChoiceResult | null;
  chosenActivityThisTurn: string | null;
  lastElectionResult: ElectionResult | null;
  lastPresidentialResult: PresidentialResult | null;
  activeCombat: CombatState | null;
  skarbowkaVisitTurn: number | null;
  news: NewsItem[];
  activeChase: ChaseState | null;
  showIntro: boolean;
  profitabilityScore: number;
  profitabilityTrend: 'up2' | 'up1' | 'neutral' | 'down1' | 'down2';
  pendingComplaints: Complaint[];
  pendingSales: PendingSale[];
  /** Pracownicy zakontraktowani w tej turze — dołączają do załogi w kolejnej turze */
  pendingHires?: PendingHire[];
  /** Lista ID usług uruchomionych na stałe przez gracza */
  activeServiceIds?: string[];
  /** @deprecated Zastąpione przez activeServiceIds */
  activeServiceContracts?: ActiveServiceContract[];

  /** Lista akcji wykonanych przez gracza w bieżącej turze (zerowana w nextTurn) */
  turnActions?: TurnActionEntry[];
  /** Migawki stanu z bieżącej tury umożliwiające cofnięcie ruchu */
  undoStack?: GameState[];
  /** @deprecated Zastąpione przez turnActions */
  lastTradeNotice?: string | null;
  /** Liczba pracowników przydzielonych do produkcji w tej turze */
  productionWorkersUsedThisTurn?: number;
  /** @deprecated Poprzedni licznik sztuk mocy przerobowych */
  productionUsedThisTurn?: number;
  /** Liczba sztuk towaru kupionych w tej turze (oddzielny limit przepustowości handlowej) */
  tradeBoughtThisTurn?: number;
  /** Liczba sztuk towaru sprzedanych w tej turze (oddzielny limit przepustowości handlowej) */
  tradeSoldThisTurn?: number;
  /** Ile sztuk z danej limitowanej oferty (deficyt / biały kruk) kupiono w tej turze */
  tradeOfferPurchasedThisTurn?: Record<string, number>;
  interactionPoints: number;
  competitors: Competitor[];
  competitionCategory: string;
  playerPrev: PlayerSnapshot | null;
  /** Aktywne wojny (gracz-AI oraz AI-AI) */
  activeWars?: ActiveWar[];
  /** Aktywne daniny kwartalne */
  tributes?: TributeObligation[];
  /** Oczekujący wybór warunków zwycięstwa po wygranej wojnie gracza */
  pendingWarResolution?: PendingWarResolution | null;

  macroStats: {
    unemployment: number;
    development: number;
    /** Roczna stopa inflacji w % (np. 36.0) */
    inflationRate: number;
    /** Skumulowany mnożnik cen (1989: 0.25, ~1995: 1.0) */
    priceIndex: number;
  };
  gameOver: null | { reason: string };
}