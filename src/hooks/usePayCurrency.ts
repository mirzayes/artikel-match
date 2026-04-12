import { useCallback, useState } from 'react';
import {
  flipPayCurrency,
  getPayCurrency,
  setPayCurrencyPersisted,
  type PayCurrency,
} from '../lib/payCurrencyPreference';

export function usePayCurrency() {
  const [currency, setCurrency] = useState<PayCurrency>(() => getPayCurrency());

  const toggleCurrency = useCallback(() => {
    setCurrency((prev) => {
      const next = flipPayCurrency(prev);
      setPayCurrencyPersisted(next);
      return next;
    });
  }, []);

  return { currency, setCurrency, toggleCurrency };
}

