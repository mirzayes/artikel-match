/**
 * Gələcəkdə region/API əsasında valyuta seçimi üçün nümunə xəritə.
 * Hazırda yalnız `formatRegionalPrice` istifadə olunur.
 */
export type PriceCurrencyCode = 'USD' | 'EUR' | 'INR' | 'TRY' | 'AZN';

export const REGIONAL_CURRENCY_PRESETS: Record<string, PriceCurrencyCode> = {
  US: 'USD',
  EU: 'EUR',
  IN: 'INR',
  TR: 'TRY',
  AZ: 'AZN',
};

export function formatRegionalPrice(
  amountMajorUnits: number,
  currency: PriceCurrencyCode,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: amountMajorUnits % 1 === 0 ? 0 : 2,
  }).format(amountMajorUnits);
}
