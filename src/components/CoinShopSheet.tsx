import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isArtikelVipFromLocalStorage, useGameStore } from '../store/useGameStore';
import {
  instagramCheckoutUrl,
  paypalCheckoutUrl,
  paypalRecipientEmail,
  paymentCardDisplay,
  paymentCardPlainForCopy,
} from '../lib/paymentLinks';

type CoinShopSheetProps = {
  open: boolean;
  onClose: () => void;
};

type PayCurrency = 'AZN' | 'EUR';

const PRICES_AZN = [3, 7, 19] as const;
const PRICES_EUR = [9, 19, 49] as const;

export function CoinShopSheet({ open, onClose }: CoinShopSheetProps) {
  const { t } = useTranslation();
  const coins = useGameStore((s) => s.coins);
  const [isVip, setIsVip] = useState(() => isArtikelVipFromLocalStorage());
  const [currency, setCurrency] = useState<PayCurrency>('AZN');

  const cardShown = paymentCardDisplay();
  const paypalUrl = paypalCheckoutUrl();
  const paypalEmail = paypalRecipientEmail();
  const instagramHref = instagramCheckoutUrl();

  useEffect(() => {
    if (!open) return;
    setIsVip(isArtikelVipFromLocalStorage());
  }, [open]);

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

  const prices = currency === 'AZN' ? PRICES_AZN : PRICES_EUR;

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
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-lg text-white/40 transition hover:bg-white/10 hover:text-white/75"
          aria-label={t('coin_shop.close_sheet')}
        >
          ✕
        </button>

        <div className="max-h-[min(88dvh,640px)] overflow-y-auto overscroll-contain px-5 pb-6 pt-5">
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

          <div
            className="relative z-10 mb-5 flex rounded-2xl border border-white/[0.06] bg-black/50 p-1"
            role="tablist"
            aria-label={t('coin_shop.currency_toggle_aria')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={currency === 'AZN'}
              onClick={() => setCurrency('AZN')}
              className={[
                'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all',
                currency === 'AZN'
                  ? 'bg-gradient-to-r from-sky-500/90 to-cyan-600/90 text-white shadow-md shadow-sky-500/15'
                  : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              <span className="tabular-nums text-inherit">AZN</span>
              <span className="text-base font-black leading-none text-inherit" aria-hidden>
                ₼
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currency === 'EUR'}
              onClick={() => setCurrency('EUR')}
              className={[
                'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all',
                currency === 'EUR'
                  ? 'bg-gradient-to-r from-indigo-500/90 to-violet-600/90 text-white shadow-md shadow-violet-500/15'
                  : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              <span className="tabular-nums text-inherit">EUR</span>
              <span className="text-base font-black leading-none text-inherit" aria-hidden>
                €
              </span>
            </button>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2">
            {prices.map((p) => (
              <div
                key={`${currency}-${p}`}
                className="relative isolate overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-4 text-center shadow-inner shadow-black/20"
              >
                <div className="relative z-10 flex min-h-[5.5rem] flex-col items-center justify-center gap-1">
                  <p className="text-3xl font-bold tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                    {p}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                    {currency === 'EUR' ? (
                      <>
                        EUR <span className="text-sm font-black normal-case">€</span>
                      </>
                    ) : (
                      <>
                        AZN <span className="text-sm font-black normal-case">₼</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
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
        </div>
      </div>
    </div>
  );
}
