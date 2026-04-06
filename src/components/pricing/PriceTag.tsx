import { formatRegionalPrice, type PriceCurrencyCode } from '../../lib/regionalPrice';

export interface PriceTagProps {
  /** Major units, e.g. 1 for $1, 100 for ₹100 */
  amount: number;
  currency: PriceCurrencyCode;
  /** BCP 47 locale; affects grouping and symbol position */
  locale?: string;
  className?: string;
}

/**
 * Placeholder for regional pricing UI. Wire `locale` / `currency` from your region API later.
 */
export function PriceTag({ amount, currency, locale, className }: PriceTagProps) {
  const text = formatRegionalPrice(amount, currency, locale);
  return <span className={['tabular-nums font-semibold tracking-tight', className].filter(Boolean).join(' ')}>{text}</span>;
}
