import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalDate } from '../lib/dateKeys';
import { LESSON_DAILY_COIN_CAP, useGameStore } from '../store/useGameStore';
import { CoinShopSheet } from './CoinShopSheet';

type CoinBalanceMeterProps = {
  className?: string;
  /** Daha kompakt (məs. öyrənmə topbar) */
  compact?: boolean;
  /** Balans yanında [+] — Artik mağazası */
  showCoinShop?: boolean;
};

export function CoinBalanceMeter({ className = '', compact = false, showCoinShop = false }: CoinBalanceMeterProps) {
  const { t } = useTranslation();
  const [shopOpen, setShopOpen] = useState(false);
  const coins = useGameStore((s) => s.coins);
  const today = formatLocalDate(new Date());
  const lessonEarned = useGameStore((s) =>
    s.lessonCoinsYmd === today ? s.lessonCoinsEarnedToday : 0,
  );
  const cap = LESSON_DAILY_COIN_CAP;
  const pct = cap > 0 ? Math.min(100, (lessonEarned / cap) * 100) : 0;
  const full = lessonEarned >= cap;
  const ratio = cap > 0 ? lessonEarned / cap : 0;
  const warn = !full && ratio >= 0.75;

  const fillClass = full
    ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600'
    : warn
      ? 'bg-gradient-to-r from-orange-400 via-amber-500 to-orange-500'
      : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400';

  return (
    <>
      <div
        className={`coin-balance-meter-root flex flex-col items-center gap-0.5 ${className}`}
        title={`Öyrənmə: ${lessonEarned} / ${cap} (günlük)`}
      >
        <span
          className={[
            'coin-balance-meter-chip flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 tabular-nums font-bold text-[#7C3AED] dark:text-amber-200',
            compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          ].join(' ')}
        >
          <span className="tabular-nums">{t('common.balance_display', { amount: coins })}</span>
          {showCoinShop ? (
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              className="ml-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/20 text-[12px] font-black leading-none text-[#7C3AED] transition-colors hover:bg-amber-500/35 dark:text-amber-100"
              aria-label="+"
            >
              +
            </button>
          ) : null}
        </span>
        <div
          className={[
            'coin-balance-meter-track w-full overflow-hidden rounded-full bg-white/[0.08]',
            compact ? 'h-[3px] max-w-[52px]' : 'h-1 max-w-[64px]',
          ].join(' ')}
          role="progressbar"
          aria-valuenow={lessonEarned}
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-label={`Günlük öyrənmə limiti ${lessonEarned} / ${cap}`}
        >
          <div
            className={[
              'coin-balance-meter-fill h-full rounded-full transition-[width,background-color] duration-500 ease-out',
              fillClass,
            ].join(' ')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {showCoinShop ? <CoinShopSheet open={shopOpen} onClose={() => setShopOpen(false)} /> : null}
    </>
  );
}
