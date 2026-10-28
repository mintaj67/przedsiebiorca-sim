export type Phase = 'chaos' | 'duopol' | 'invasion';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Pace = 'quarter' | 'year';
export type CompanySize = 'micro' | 'small' | 'medium';
export type AppScreen = 'menu' | 'start' | 'game' | 'options' | 'about' | 'saves';
export type PoliticalSide = 'PZPR' | 'independent' | 'opposition' | 'none';
export type Ideology = 'radical_right' | 'moderate_right' | 'center' | 'moderate_left' | 'radical_left';
export type PartySize = 'very_small' | 'small' | 'medium' | 'large' | 'very_large';
export type LegalForm = 'cywilna' | 'zoo' | 'sa' | 'holding';
export type ContractType = 'bezUmowy' | 'zlecenie' | 'uop';

export interface Reputation {
  branza: number;
  opiniaPubliczna: number;
  opiniaPracownicy: number;
  opiniaBranza: number;
  opiniaMafia: number;
  opiniaMedia: number;
  opiniaPolitycy: number;
  opiniaSkarbowa: number;
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

export interface Finances {
  stateKonta: number;
  wplywy: Wplywy;
  wydatki: Wydatki;
}

export interface Employees {
  bezUmowy: number;
  zlecenie: number;
  uop: number;
}

export interface Loan {
  id: string;
  source: 'bank' | 'szara_strefa';
  principal: number;
  remaining: number;
  interestRate: number;
  quartersLeft: number;
}

export interface Company {
  name: string;
  suffix: string;
  size: CompanySize;
  legalForm: LegalForm;
  activity: string;
  employees: Employees;
  finances: Finances;
  reputation: Reputation;
  loans: Loan[];
  lastActivityChangeTurn: number;
  hasAccountant: boolean;
  inventory: string[]; // <-- Nowe pole na przyszłe przedmioty
}

export interface PartySizeSchedule {
  from: number;
  to: number;
  size: PartySize;
}

export interface Party {
  id: string;
  name: string;
  descriptions: string[]; // Tablica na Opis 1, Opis 2 itd.
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

export interface Party {
  id: string;
  name: string;
  description: string;
  ideology: Ideology;
  size: PartySize;
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

// --- Eventy i Akcje ---
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
  minStateKonta?: number;
  maxStateKonta?: number;
  legalForm?: LegalForm[];
  activities?: string[];
  flags?: string[];
  notFlags?: string[];
  hasParty?: boolean;
  hasItem?: string; // <-- Nowe pole na przyszłe przedmioty
}

export interface EventEffects {
  reputation?: Partial<Reputation>;
  stateKonta?: number;
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
  addItem?: string; // <-- Nowe pole na przyszłe przedmioty
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
}

export interface ActivityCategory {
  id: string;
  name: string;
  activities: ActivityItem[];
}

// --- System Wiadomości ---
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

// --- Stany (Walka, Wyniki) ---
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
  grid: number[][]; // 0 = puste, 1 = zamalowane
  turn: number;
  maxTurns: number;
  finished: boolean;
  result: 'escaped' | 'caught' | null;
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
  


  ceo: CEO;
  company: Company;
  politics: PoliticsState;
  pendingEvents: GameEvent[];
  currentActivities: string[];
  history: string[];
  bankruptWarningTurns: number;
  lastChoiceResult: ChoiceResult | null;
  chosenActivityThisTurn: string | null;
  lastElectionResult: ElectionResult | null;
  lastPresidentialResult: any | null;
  activeCombat: CombatState | null;
  skarbowkaVisitTurn: number | null;
  news: NewsItem[];
  activeChase: ChaseState | null;
  showIntro: boolean;
  
  gameOver: null | { reason: string };
}