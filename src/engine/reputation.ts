import type { GameState, Reputation, CompanySize } from './types';
import { REPUTATION_WEIGHTS, MAFIA_PUBLIC_THRESHOLD, PARTY_INFLUENCE_WEIGHTS } from './constants';

const clamp = (x: number) => Math.max(0, Math.min(100, x));

const SIZE_ACCURACY_BONUS: Record<CompanySize, number> = {
  micro: 0,
  small: 3,
  medium: 6,
  large: 10,
  very_large: 14,
  corporation: 18,
};

export function politicianWeight(state: GameState): number {
  const ourParty = state.ceo.currentPartyId;
  if (!ourParty) return 0.2;
  const inCoalition = state.politics.rulingCoalition.includes(ourParty);
  if (inCoalition) {
    const isPremier = state.politics.premierId === ourParty;
    const isPresident = state.politics.president?.partyId === ourParty;
    if (isPremier && isPresident) return PARTY_INFLUENCE_WEIGHTS.bothPresidentAndPremier;
    if (isPresident) return PARTY_INFLUENCE_WEIGHTS.onlyPresident;
    if (isPremier) return PARTY_INFLUENCE_WEIGHTS.onlyPremier;
  }
  return PARTY_INFLUENCE_WEIGHTS.opposition;
}

export function recomputeReputation(state: GameState): Reputation {
  const r = { ...state.company.reputation };

  r.branza = clamp(r.branza);
  r.opiniaPubliczna = clamp(r.opiniaPubliczna);
  r.opiniaPracownicy = clamp(r.opiniaPracownicy);
  r.opiniaBranza = clamp(r.opiniaBranza);
  r.opiniaMafia = clamp(r.opiniaMafia);
  r.opiniaMedia = clamp(r.opiniaMedia);
  r.opiniaPolitycy = clamp(r.opiniaPolitycy);
  r.opiniaSkarbowa = clamp(r.opiniaSkarbowa);
  r.bazowaDokladnosc = clamp(r.bazowaDokladnosc ?? 50);

  const mediaInf = (r.opiniaMedia - 50) * 0.1;
  const polWeight = politicianWeight(state);
  const polInf = (r.opiniaPolitycy - 50) * polWeight * 0.15;

  r.opiniaPubliczna = clamp(r.opiniaPubliczna + mediaInf + polInf);
  r.opiniaBranza    = clamp(r.opiniaBranza    + mediaInf * 0.5 + polInf * 0.5);
  r.opiniaMafia     = clamp(r.opiniaMafia     + mediaInf * 0.3 + polInf * 0.3);

  if (r.opiniaMafia > MAFIA_PUBLIC_THRESHOLD) {
    const overshoot = r.opiniaMafia - MAFIA_PUBLIC_THRESHOLD;
    r.opiniaPubliczna = clamp(r.opiniaPubliczna - overshoot * 0.3);
  }

  // Dynamiczne wyliczanie Dokładności Przewidywań (baza + pracownicy + księgowa + rozmiar + branża + biuro + cynk rynkowy od sojuszników)
  const emp = state.company.employees;
  const uopBonus = Math.min(15, emp.uop * 1.5);
  const zlecenieBonus = Math.min(6, emp.zlecenie * 0.5);
  const bezUmowyPenalty = Math.min(15, emp.bezUmowy * 1.5);
  const accountantBonus = state.company.hasAccountant ? 15 : 0;
  const sizeBonus = SIZE_ACCURACY_BONUS[state.company.size] ?? 0;
  const branzaMod = (r.opiniaBranza - 50) * 0.25;
  const inventoryBonus = Math.min(10, (state.company.inventory?.length ?? 0) * 2);

  // Cynk rynkowy: im wyższa reputacja konkretnego sojusznika, tym dokładniejsze informacje (0..6 pkt na sojusznika, max 18)
  const activeAllies = (state.competitors ?? []).filter(
    (c) => (c.status ?? 'active') === 'active' && c.isAlliedWithPlayer
  );
  const allyIntelBonus = Math.min(
    18,
    activeAllies.reduce((sum, ally) => sum + Math.round((clamp(ally.reputation) / 100) * 6), 0)
  );

  r.dokladnoscPrzewidywan = clamp(
    Math.round(
      r.bazowaDokladnosc +
      uopBonus +
      zlecenieBonus -
      bezUmowyPenalty +
      accountantBonus +
      sizeBonus +
      branzaMod +
      inventoryBonus +
      allyIntelBonus
    )
  );

  let sum = 0;
  for (const [key, weight] of Object.entries(REPUTATION_WEIGHTS)) {
    sum += (r as any)[key] * weight;
  }
  r.ogolna = clamp(sum);

  return r;
}