import type { GameState, Reputation } from './types';
import { REPUTATION_WEIGHTS, MAFIA_PUBLIC_THRESHOLD, PARTY_INFLUENCE_WEIGHTS } from './constants';

const clamp = (x: number) => Math.max(0, Math.min(100, x));

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

  let sum = 0;
  for (const [key, weight] of Object.entries(REPUTATION_WEIGHTS)) {
    sum += (r as any)[key] * weight;
  }
  r.ogolna = clamp(sum);

  return r;
}