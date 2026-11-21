import type { GameState, ServiceDefinition, CompanySize } from './types';
import { getCompanyActivities } from './activityHelper';
import { getRevenueRange } from './tradeHelper';
import { getPriceIndex } from './economy';
import servicesData from '../data/services_data.json';

const BASE_CEO_SLOTS = 1;

const SIZE_ORDER: CompanySize[] = [
  'micro',
  'small',
  'medium',
  'large',
  'very_large',
  'corporation',
];

const SIZE_LABELS: Record<CompanySize, string> = {
  micro: 'Mikro',
  small: 'Mała',
  medium: 'Średnia',
  large: 'Duża',
  very_large: 'Bardzo duża',
  corporation: 'Korporacja',
};

export interface EvaluatedService extends ServiceDefinition {
  calculatedPayout: number;
  minPayout: number;
  maxPayout: number;
  isActive: boolean;
  meetsRequirements: boolean;
  missingReasons: string[];
}

/** Łączna liczba pracowników w firmie (bez prezesa). */
export function getTotalEmployeeCount(state: GameState): number {
  const emp = state.company.employees;
  return emp.bezUmowy + emp.zlecenie + emp.uop;
}

/** Łączna liczba slotów kadrowych na usługi (1 za prezesa + 1 za każdego pracownika). */
export function getTotalServiceWorkerSlots(state: GameState): number {
  return BASE_CEO_SLOTS + getTotalEmployeeCount(state);
}

/** Liczba pracowników aktualnie zaangażowanych w uruchomione na stałe usługi. */
export function getBusyServiceWorkers(state: GameState): number {
  const activeIds = state.activeServiceIds ?? [];
  const allServices = servicesData as ServiceDefinition[];
  return activeIds.reduce((sum, id) => {
    const srv = allServices.find(s => s.id === id);
    return sum + (srv ? srv.workersRequired : 0);
  }, 0);
}

/** Sprawdza, czy firma spełnia wymagania dla danej usługi (rozmiar, pracownicy, reputacja). */
export function checkServiceRequirements(
  state: GameState,
  service: ServiceDefinition
): { meets: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const req = service.req;

  if (req) {
    if (req.minSize) {
      const currentIdx = SIZE_ORDER.indexOf(state.company.size);
      const reqIdx = SIZE_ORDER.indexOf(req.minSize);
      if (currentIdx < reqIdx) {
        reasons.push(`Wielkość firmy: min. ${SIZE_LABELS[req.minSize]}`);
      }
    }
    if (req.minWorkers !== undefined) {
      const totalEmp = getTotalEmployeeCount(state);
      if (totalEmp < req.minWorkers) {
        reasons.push(`Pracownicy: min. ${req.minWorkers} os.`);
      }
    }
    if (req.minRepPubliczna !== undefined && state.company.reputation.opiniaPubliczna < req.minRepPubliczna) {
      reasons.push(`Opinia publiczna: min. ${req.minRepPubliczna}`);
    }
    if (req.minRepBranza !== undefined && state.company.reputation.opiniaBranza < req.minRepBranza) {
      reasons.push(`Opinia w branży: min. ${req.minRepBranza}`);
    }
    if (req.minRepMafia !== undefined && state.company.reputation.opiniaMafia < req.minRepMafia) {
      reasons.push(`Wpływy w mafii: min. ${req.minRepMafia}`);
    }
  }

  return {
    meets: reasons.length === 0,
    reasons,
  };
}

/** Zwraca pełny katalog usług dla podkategorii gracza wraz ze statusem odblokowania i widełkami przychodu. */
export function getAvailableServices(state: GameState): EvaluatedService[] {
  const allServices = servicesData as ServiceDefinition[];
  const companyActs = getCompanyActivities(state.company);
  const serviceActs = companyActs.filter(id => id.startsWith('usl_') || id.startsWith('gast_'));
  const targetActs = serviceActs.length > 0 ? serviceActs : companyActs;

  const priceIndex = getPriceIndex(state);
  const dev = state.macroStats?.development ?? 40;
  const devMultiplier = 1 + Math.max(-0.15, (dev - 40) * 0.004);
  const repMultiplier = 1 + Math.max(-0.1, (state.company.reputation.opiniaBranza - 50) * 0.003);
  const accuracy = state.company.reputation.dokladnoscPrzewidywan ?? 50;
  const activeIds = state.activeServiceIds ?? [];

  return allServices
    .filter(srv => {
      const acts = srv.activities ?? ['*'];
      return acts.includes('*') || acts.some(a => targetActs.includes(a));
    })
    .map(srv => {
      const base = srv.basePayout ?? (srv as any).payout ?? 10000;
      const calculatedPayout = Math.round(base * priceIndex * devMultiplier * repMultiplier);
      const range = getRevenueRange(calculatedPayout, accuracy);
      const { meets, reasons } = checkServiceRequirements(state, srv);

      return {
        ...srv,
        basePayout: base,
        calculatedPayout,
        minPayout: range.min,
        maxPayout: range.max,
        isActive: activeIds.includes(srv.id),
        meetsRequirements: meets,
        missingReasons: reasons,
      };
    });
}