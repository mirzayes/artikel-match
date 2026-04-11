import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isArtikelVipFromLocalStorage, useGameStore } from '../store/useGameStore';
import { COIN_PACK_1000_AMOUNT, COIN_PACK_1000_PRICE_AZN } from '../lib/levelGate';

type CoinShopSheetProps = {
  open: boolean;
  onClose: () => void;
};

function openSupportPage(): boolean {
  const url = (import.meta.env.VITE_BUY_ME_A_COFFEE_URL ?? '').trim();
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function CoinShopSheet({ open, onClose }: CoinShopSheetProps) {
  const { t } = useTranslation();
  const purchaseCoinPack1000Demo = useGameStore((s) => s.purchaseCoinPack1000Demo);
  const coins = useGameStore((s) => s.coins);
  const [isVip, setIsVip] = useState(() => isArtikelVipFromLocalStorage());

  useEffect(() => {
    if (!open) return;
    setIsVip(isArtikelVipFromLocalStorage());
  }, [open]);

  if (!open) return null;

  const buy = () => {
    const ok = window.confirm(
      t('coin_shop.confirm_pack', { coins: COIN_PACK_1000_AMOUNT, price: COIN_PACK_1000_PRICE_AZN }),
    );
    if (!ok) return;
    purchaseCoinPack1000Demo();
    onClose();
  };

  const onSupportClick = () => {
    if (!openSupportPage()) {
      window.alert(t('coin_shop.support_missing_url'));
      return;
    }
    window.alert(t('coin_shop.support_contact_hint'));
  };

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
        <p className="mt-3 text-[13px] leading-relaxed text-artikl-text">
          {t('coin_shop.pack_line', { coins: COIN_PACK_1000_AMOUNT, price: COIN_PACK_1000_PRICE_AZN })}
        </p>
        <p className="mt-2 text-[11px] text-artikl-caption">{t('coin_shop.demo_note')}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={buy}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-stone-950 shadow-lg active:scale-[0.98]"
          >
            {t('coin_shop.buy')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-artikl-text"
          >
            {t('coin_shop.cancel')}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wide text-artikl-caption">
          {t('coin_shop.section_extra')}
        </p>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-500/40 bg-violet-950/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">✨ {t('coin_shop.pro_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.pro_sub')}</p>
            </div>
            <button
              type="button"
              onClick={onSupportClick}
              className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
            >
              {t('coin_shop.pro_price')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-950/25 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">☕ {t('coin_shop.coffee_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.coffee_sub')}</p>
            </div>
            <button
              type="button"
              onClick={onSupportClick}
              className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-stone-950 active:scale-[0.98]"
            >
              {t('coin_shop.coffee_cta')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 opacity-70">
            <div className="min-w-0">
              <p className="text-sm font-bold text-artikl-text">📺 {t('coin_shop.video_title')}</p>
              <p className="mt-0.5 text-[11px] text-artikl-caption">{t('coin_shop.video_sub')}</p>
            </div>
            <span className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-artikl-caption">
              {t('coin_shop.video_soon')}
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] leading-snug text-artikl-caption">{t('coin_shop.footer_note')}</p>
      </div>
    </div>
  );
}
