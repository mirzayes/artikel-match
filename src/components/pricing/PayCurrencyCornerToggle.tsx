import { useTranslation } from 'react-i18next';
import type { PayCurrency } from '../../lib/payCurrencyPreference';

type Props = {
  currency: PayCurrency;
  onToggle: () => void;
  className?: string;
};

/** Tək valyuta göstərimi; ikiqat qiymət tabu deyil — yalnız keçid. */
export function PayCurrencyCornerToggle({ currency, onToggle, className }: Props) {
  const { t } = useTranslation();
  const label =
    currency === 'AZN' ? t('coin_shop.currency_switch_to_eur') : t('coin_shop.currency_switch_to_azn');

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1 text-[10px] font-semibold leading-tight text-white/65 shadow-sm backdrop-blur-sm transition hover:border-white/15 hover:bg-black/45 hover:text-white/90 active:scale-[0.98]',
        className ?? '',
      ].join(' ')}
      aria-label={t('coin_shop.currency_switch_aria')}
    >
      {label}
    </button>
  );
}
