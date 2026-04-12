import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isArtikelVipFromLocalStorage, useGameStore } from '../store/useGameStore';

type CoinShopSheetProps = {
  open: boolean;
  onClose: () => void;
};

const PRO_MAILTO = 'mailto:artikelmatch@gmail.com?subject=PRO%20subscription';

const linkAsBtn =
  'inline-flex shrink-0 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition active:scale-[0.98]';

export function CoinShopSheet({ open, onClose }: CoinShopSheetProps) {
  const { t } = useTranslation();
  const coins = useGameStore((s) => s.coins);
  const [isVip, setIsVip] = useState(() => isArtikelVipFromLocalStorage());

  useEffect(() => {
    if (!open) return;
    setIsVip(isArtikelVipFromLocalStorage());
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 backdrop-blur-sm sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-shop-title"
      onClick={onClose}
    >
      <div
        className="app-sheet-panel relative w-full max-w-[380px] rounded-2xl border border-amber-400/25 bg-[#14141f]/95 p-5 pb-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-lg text-artikl-caption hover:bg-white/10 hover:text-artikl-text"
          aria-label={t('coin_shop.close_sheet')}
        >
          ✕
        </button>

        <div className="mb-4 flex items-center gap-2 pr-10">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/90 text-lg" aria-hidden>
            ⚡
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-artikl-caption">{t('coin_shop.balance_label')}</p>
            <p className="text-lg font-bold text-artikl-text">{isVip ? '∞' : coins}</p>
          </div>
        </div>

        <h2 id="coin-shop-title" className="text-base font-bold text-[#7C3AED] dark:text-amber-100">
          {t('coin_shop.title')}
        </h2>

        <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wide text-artikl-caption">
          {t('coin_shop.section_extra')}
        </p>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/40 bg-violet-950/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">✨ {t('coin_shop.pro_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.pro_sub')}</p>
            </div>
            <a
              href={PRO_MAILTO}
              className={`${linkAsBtn} bg-violet-600 text-white hover:bg-violet-500`}
            >
              PRO üçün əlaqə saxla
            </a>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-950/25 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">☕ {t('coin_shop.coffee_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.coffee_sub')}</p>
            </div>
            <a
              href="https://ko-fi.com/artikelmatch"
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkAsBtn} bg-amber-500 text-stone-950 hover:bg-amber-400`}
            >
              {t('coin_shop.coffee_cta')}
            </a>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 opacity-70">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">📺 {t('coin_shop.video_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.video_sub')}</p>
            </div>
            <span className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-artikl-caption">
              Tezliklə
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] leading-snug text-artikl-caption">{t('coin_shop.footer_note')}</p>
      </div>
    </div>
  );
}
