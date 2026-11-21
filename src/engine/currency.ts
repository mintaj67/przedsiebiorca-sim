import type { GameState } from './types';

type CurrencyContext = Pick<GameState, 'denominated' | 'year'> | boolean | null | undefined;

export function isDenominated(ctx: CurrencyContext): boolean {
  if (typeof ctx === 'boolean') return ctx;
  if (!ctx) return true;
  if (typeof ctx.denominated === 'boolean') return ctx.denominated;
  return typeof ctx.year === 'number' ? ctx.year >= 1995 : true;
}

function formatScaledUnit(absValue: number, divisor: number, unit: string): string {
  const scaled = absValue / divisor;
  const maxDigits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const formatted = scaled.toLocaleString('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
  return `${formatted} ${unit}`;
}

/**
 * Formatuje kwotę z silnika na walutę widoczną dla gracza:
 * - przed denominacją (1989–1994): mnoży ×10 000 i używa skrótów (tys. / mln / mld zł),
 * - po denominacji (1995+): wyświetla w PLN (opcjonalnie kompaktowo).
 */
export function formatMoney(
  amount: number,
  ctx: CurrencyContext,
  opts?: { compact?: boolean; signed?: boolean }
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = safeAmount < 0 ? '-' : opts?.signed && safeAmount > 0 ? '+' : '';
  const denominated = isDenominated(ctx);

  if (!denominated) {
    const absOld = Math.abs(Math.round(safeAmount * 10_000));
    if (absOld >= 1_000_000_000_000) return `${sign}${formatScaledUnit(absOld, 1_000_000_000_000, 'bln zł')}`;
    if (absOld >= 1_000_000_000) return `${sign}${formatScaledUnit(absOld, 1_000_000_000, 'mld zł')}`;
    if (absOld >= 1_000_000) return `${sign}${formatScaledUnit(absOld, 1_000_000, 'mln zł')}`;
    if (absOld >= 10_000) return `${sign}${formatScaledUnit(absOld, 1_000, 'tys. zł')}`;
    return `${sign}${absOld.toLocaleString('pl-PL')} zł`;
  }

  const absNew = Math.abs(Math.round(safeAmount));
  if (opts?.compact) {
    if (absNew >= 1_000_000_000) return `${sign}${formatScaledUnit(absNew, 1_000_000_000, 'mld PLN')}`;
    if (absNew >= 1_000_000) return `${sign}${formatScaledUnit(absNew, 1_000_000, 'mln PLN')}`;
  }
  return `${sign}${absNew.toLocaleString('pl-PL')} PLN`;
}

export function formatMoneyRange(min: number, max: number, ctx: CurrencyContext): string {
  return `${formatMoney(min, ctx)} – ${formatMoney(max, ctx)}`;
}