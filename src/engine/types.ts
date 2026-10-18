export type Phase = 'chaos' | 'duopol' | 'invasion';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Pace = 'quarter' | 'year';
export type CompanySize = 'micro' | 'small' | 'medium';
export type AppScreen = 'menu' | 'start' | 'game' | 'options' | 'about' | 'saves';

export type PoliticalSide = 'PZPR' | 'independent' | 'opposition' | 'none';

export type Ideology =
  | 'radical_left'
  | 'moderate_left'
  | 'center'
  | 'center_right'
  | 'extreme_right';

export type PartySize = 'large' | 'medium' | 'small';
export type LegalForm = 'cywilna' | 'zoo' | 'sa' | 'holding';
export type ContractType = 'bezUmowy' | 'zlecenie' | 'uop';

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
  Wplywy: Wplywy;
  Wydatki: Wydatki;
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
}

export interface Party {
  id: string;
  name: string;
  ideology: Ideology;
  size: PartySize;
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
  minStateKonta?: number;
  maxStateKonta?: number;
  legalForm?: LegalForm[];
  activities?: string[];
  flags?: string[];
  notFlags?: string[];
  hasParty?: boolean;
}

export interface EventEffects {
  reputation?: Partial<Reputation>;
  stateKonta?: number;
  Wplywy?: Partial<Wplywy>;
  Wydatki?: Partial<Wydatki>;
  flagsAdd?: string[];
  flagsRemove?: string[];
  joinMafia?: boolean;
  leaveMafia?: boolean;
  setParty?: PoliticalSide;
  setCurrentPartyId?: string;
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

export interface ChoiceResult {
  eventId: string;
  eventTitle: string;
  choiceId: string;
  choiceLabel: string;
  consequenceLines: string[];
  gambleResult?: 'win' | 'lose';
  outcomeDescription?: string;
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
  lastPresidentialResult: PresidentialResult | null;
  news: NewsItem[];
  skarbowkaVisitTurn: number | null;

  activeCombat: CombatState | null;

  gameOver: null | { reason: string };
}

export type PlayerAction =
  | { type: 'do_nothing' }
  | { type: 'do_activity'; activityId: string }
  | { type: 'resolve_event'; eventId: string; choiceId: string }
  | { type: 'hire'; contract: ContractType; count: number }
  | { type: 'fire'; contract: ContractType; count: number }
  | { type: 'take_loan'; source: 'bank' | 'szara_strefa'; amount: number }
  | { type: 'set_pace'; pace: Pace }
  | { type: 'join_party'; partyId: string }
  | { type: 'leave_party' }
  | { type: 'change_activity'; activity: string }
  | { type: 'take_emergency_loan' };

export interface CombatLogEntry {
  text: string;
  type: 'player' | 'enemy' | 'system';
}

export interface CombatState {
  type: 'skarbowka';
  playerHp: number; // Siła argumentów
  playerHpMax: number;
  enemyHp: number; // Cierpliwość urzędnika
  enemyHpMax: number;
  round: number;
  log: CombatLogEntry[];
  finished: boolean;
  result: 'win' | 'lose' | 'draw' | null;
}