import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { COIN_PACK_1000_AMOUNT, COIN_PACK_1000_PRICE_AZN } from '../lib/levelGate';

type CoinShopSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CoinShopSheet({ open, onClose }: CoinShopSheetProps) {
  const { t } = useTranslation();
  const purchaseCoinPack1000Demo = useGameStore((s) => s.purchaseCoinPack1000Demo);

  if (!open) return null;

  const buy = () => {
    const ok = window.confirm(
      t('coin_shop.confirm_pack', { coins: COIN_PACK_1000_AMOUNT, price: COIN_PACK_1000_PRICE_AZN }),
    );
    if (!ok) return;
    purchaseCoinPack1000Demo();
    onClose();
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
        className="app-sheet-panel w-full max-w-[380px] rounded-2xl border border-amber-400/25 bg-[#14141f]/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}
