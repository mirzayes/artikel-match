import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayCurrency } from '../hooks/usePayCurrency';
import { getPayCurrency, payCurrencySymbol } from '../lib/payCurrencyPreference';
import { isArtikelVipFromLocalStorage, useGameStore } from '../store/useGameStore';
import {
  instagramCheckoutUrl,
  paypalCheckoutUrl,
  paypalRecipientEmail,
  paymentCardDisplay,
  paymentCardPlainForCopy,
} from '../lib/paymentLinks';
import { PayCurrencyCornerToggle } from './pricing/PayCurrencyCornerToggle';
import { PaymentModalInstagramSupportLink } from './social/SprachbasarInstagram';
import { PaymentReceiptConfirmBlock } from './payment/PaymentReceiptConfirmBlock';
import { formatPackPrice, packPriceForCurrency, SHOP_VIP_PACKS } from '../lib/shopVipPackages';

type CoinShopSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CoinShopSheet({ open, onClose }: CoinShopSheetProps) {
  const { t } = useTranslation();
  const coins = useGameStore((s) => s.coins);
  const [isVip, setIsVip] = useState(() => isArtikelVipFromLocalStorage());
  const { currency, setCurrency, toggleCurrency } = usePayCurrency();

  const cardShown = paymentCardDisplay();
  const paypalUrl = paypalCheckoutUrl();
  const paypalEmail = paypalRecipientEmail();
  const instagramHref = instagramCheckoutUrl();

  useEffect(() => {
    if (!open) return;
    setIsVip(isArtikelVipFromLocalStorage());
    setCurrency(getPayCurrency());
  }, [open, setCurrency]);

  const onCopyCard = useCallback(async () => {
    const plain = paymentCardPlainForCopy();
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = plain;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const onPayPal = useCallback(async () => {
    if (paypalUrl) {
      window.open(paypalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await navigator.clipboard.writeText(paypalEmail);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = paypalEmail;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /* ignore */
      }
    }
  }, [paypalUrl, paypalEmail]);

  if (!open) return null;

  const curSym = payCurrencySymbol(currency);

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14 backdrop-blur-md sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-shop-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(88dvh,640px)] w-full max-w-[400px] overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#0c0c10] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <PayCurrencyCornerToggle
          currency={currency}
          onToggle={toggleCurrency}
          className="absolute left-3 top-3 z-10 border-white/[0.08]"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-lg text-white/40 transition hover:bg-white/10 hover:text-white/75"
          aria-label={t('coin_shop.close_sheet')}
        >
          ✕
        </button>

        <div className="max-h-[min(88dvh,640px)] overflow-y-auto overscroll-contain px-5 pb-6 pt-14">
          <div className="mb-5 flex items-center gap-3 pr-10">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-lg shadow-lg shadow-amber-500/20"
              aria-hidden
            >
              ⚡
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                {t('coin_shop.balance_label')}
              </p>
              <p id="coin-shop-title" className="text-xl font-black tabular-nums text-white">
                {isVip ? '∞' : coins}
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2">
            {SHOP_VIP_PACKS.map((pack) => {
              const amount = packPriceForCurrency(pack, currency);
              const priceStr = formatPackPrice(amount);
              const isBest = pack.emphasis === 'best';
              const isValue = pack.emphasis === 'value';
              const shell = isBest
                ? 'relative isolate overflow-hidden rounded-2xl border-2 border-amber-300/85 bg-gradient-to-br from-amber-500/20 via-amber-950/25 to-yellow-950/35 px-1.5 pb-3.5 pt-5 text-center shadow-[0_0_22px_rgba(234,179,8,0.18)] ring-1 ring-amber-200/35'
                : isValue
                  ? 'relative isolate overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-950/30 via-[#0c1614] to-[#080c0b] px-1.5 pb-3.5 pt-5 text-center shadow-[0_0_18px_rgba(16,185,129,0.1)] ring-1 ring-emerald-400/22'
                  : 'relative isolate overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] px-1.5 py-3.5 text-center shadow-inner shadow-black/20';
              return (
                <div key={pack.id} className={shell}>
                  {pack.badge === 'value' ? (
                    <span className="absolute left-1/2 top-0 z-20 max-w-[min(100%,7rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 px-1 py-0.5 text-[5.5px] font-black uppercase leading-tight tracking-wide text-stone-950 sm:text-[6.5px]">
                      {t('coin_shop.pack_badge_value')}
                    </span>
                  ) : null}
                  {pack.badge === 'best' ? (
                    <span className="absolute left-1/2 top-0 z-20 max-w-[min(100%,9rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 px-1 py-0.5 text-[5.5px] font-black uppercase leading-tight tracking-wide text-stone-900 sm:text-[6.5px]">
                      {t('coin_shop.pack_badge_best')}
                    </span>
                  ) : null}
                  <div className="relative z-10 flex min-h-[5.5rem] flex-col items-center justify-center gap-1">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                      {t(pack.periodKey)}
                    </p>
                    <p className="text-[clamp(0.95rem,3.5vw,1.35rem)] font-bold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                      <span>{priceStr}</span>
                      <span className="ml-0.5 text-[0.95em] font-black text-white/95" aria-hidden>
                        {curSym}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            {currency === 'AZN' ? (
              <div className="rounded-[20px] border border-white/[0.1] bg-gradient-to-br from-[#141c1a] via-[#0e1412] to-[#080c0b] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400/90">
                  {t('coin_shop.azn_method_card')}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                  <p className="min-w-0 flex-1 text-center font-mono text-[clamp(1.1rem,5vw,1.5rem)] font-bold leading-snug tracking-[0.1em] text-white sm:text-left">
                    {cardShown}
                  </p>
                  <button
                    type="button"
                    onClick={onCopyCard}
                    className="shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/25 active:scale-[0.98] sm:py-2.5"
                  >
                    {t('coin_shop.copy')}
                  </button>
                </div>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-white/50">
                  {t('coin_shop.azn_pay_instruction')}
                </p>
                <PaymentReceiptConfirmBlock currency={currency} source="coin_shop" open={open} />
              </div>
            ) : (
              <div className="rounded-[20px] border border-white/[0.1] bg-gradient-to-br from-[#12182a] via-[#0e1220] to-[#080b14] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-sky-300/90">
                  {t('coin_shop.eur_method_paypal')}
                </p>
                <p className="mt-4 break-all text-center font-mono text-[clamp(0.95rem,3.8vw,1.15rem)] font-semibold leading-snug text-white">
                  {paypalEmail}
                </p>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-white/50">
                  {t('coin_shop.paypal_instruction')}
                </p>
                <button
                  type="button"
                  onClick={onPayPal}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0070ba] via-[#003087] to-[#001c64] py-3.5 text-[14px] font-bold text-white shadow-[0_10px_36px_rgba(0,112,186,0.35)] transition hover:brightness-110 active:scale-[0.99]"
                >
                  {t('coin_shop.paypal_cta')}
                </button>
                <PaymentReceiptConfirmBlock currency={currency} source="coin_shop" open={open} />
              </div>
            )}
          </div>

          <a
            href={instagramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full rounded-2xl py-4 text-center text-[14px] font-bold text-white no-underline shadow-[0_12px_40px_rgba(225,48,108,0.4)] transition hover:opacity-95 active:scale-[0.99]"
            style={{
              background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            }}
          >
            {t('coin_shop.instagram_receipt')}
          </a>
          <PaymentModalInstagramSupportLink />
        </div>
      </div>
    </div>
  );
}
