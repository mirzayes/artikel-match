export type PayCurrency = 'AZN' | 'EUR';

const STORAGE_KEY = 'artikl-pay-currency';

function readStored(): PayCurrency | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'AZN' || v === 'EUR') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * AZN: Bakı TZ və ya brauzer dil siyahısında `az*`.
 * Əks halda EUR (Avropa və qalan dünya).
 */
export function inferDefaultPayCurrency(): PayCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Baku') return 'AZN';
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const list =
      navigator.languages?.length ? [...navigator.languages] : [navigator.language];
    for (const lang of list) {
      const base = lang?.split?.('-')?.[0]?.toLowerCase();
      if (base === 'az') return 'AZN';
    }
  }
  return 'EUR';
}

export function getPayCurrency(): PayCurrency {
  return readStored() ?? inferDefaultPayCurrency();
}

export function setPayCurrencyPersisted(c: PayCurrency): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function flipPayCurrency(current: PayCurrency): PayCurrency {
  return current === 'AZN' ? 'EUR' : 'AZN';
}

export function payCurrencySymbol(c: PayCurrency): string {
  return c === 'AZN' ? '₼' : '€';
}
