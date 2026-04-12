'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useTranslation } from 'react-i18next';
import {
  instagramCheckoutUrl,
  paypalCheckoutUrl,
  paypalRecipientEmail,
  paymentCardDisplay,
  paymentCardPlainForCopy,
} from '../lib/paymentLinks';

type Props = {
  open: boolean;
  onClose: () => void;
};

type PayCurrency = 'AZN' | 'EUR';

const VIP_AZN = [3, 7, 19] as const;
const VIP_EUR = [5, 12, 29] as const;

/**
 * VIP satış modalı + PostHog.
 * `.env`: `VITE_PAYMENT_CARD_PAN`, `VITE_PAYPAL_ME_URL` / `VITE_PAYPAL_ME_USERNAME`, `VITE_PAYPAL_RECIPIENT_EMAIL`, Instagram dəyişənləri.
 */
export function VipSubscriptionModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const [currency, setCurrency] = useState<PayCurrency>('AZN');
  const cardLine = paymentCardDisplay();
  const paypalUrl = paypalCheckoutUrl();
  const paypalEmail = paypalRecipientEmail();

  const safeCapture = useCallback(
    (event: string, props?: Record<string, unknown>) => {
      try {
        posthog?.capture(event, props);
      } catch {
        /* ignore */
      }
    },
    [posthog],
  );

  useEffect(() => {
    if (!open) return;
    safeCapture('payment_modal_opened');
  }, [open, safeCapture]);

  const onCopyNumber = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(paymentCardPlainForCopy());
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = paymentCardPlainForCopy();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /* ignore */
      }
    }
    safeCapture('card_number_copied', { method: 'azn_card' });
  }, [safeCapture]);

  const onPayPal = useCallback(async () => {
    if (paypalUrl) {
      window.open(paypalUrl, '_blank', 'noopener,noreferrer');
      safeCapture('paypal_cta_clicked', { mode: 'open_url' });
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
    safeCapture('paypal_cta_clicked', { mode: 'copy_email' });
  }, [paypalUrl, paypalEmail, safeCapture]);

  if (!open) return null;

  const instagramHref = instagramCheckoutUrl();
  const prices = currency === 'AZN' ? VIP_AZN : VIP_EUR;
  const unit = currency === 'AZN' ? 'AZN' : 'EUR';

  return (
    <div
      className="fixed inset-0 z-[97] flex items-end justify-center bg-black/65 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14 backdrop-blur-md sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vip-sub-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(92dvh,640px)] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-[26px] border border-amber-500/25 bg-gradient-to-br from-[#141008] via-[#100c16] to-[#08060e] p-6 shadow-[0_0_64px_rgba(234,179,8,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-amber-400/12 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-6 right-0 h-36 w-36 rounded-full bg-amber-500/8 blur-2xl" aria-hidden />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg text-amber-100/45 transition-colors hover:bg-white/10 hover:text-amber-50"
          aria-label={t('coin_shop.close_sheet')}
        >
          ✕
        </button>

        <h2
          id="vip-sub-title"
          className="pr-10 text-center font-display text-[1.3rem] font-black leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400"
        >
          VIP
        </h2>

        <ul className="mt-4 space-y-2 text-[13px] font-semibold leading-snug text-amber-50/90">
          <li className="flex gap-2">
            <span aria-hidden>✓</span>
            <span>Bütün səviyyələrə giriş</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✓</span>
            <span>Limitsiz öyrənmə</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✓</span>
            <span>Qızıl VIP statusu</span>
          </li>
        </ul>

        <div
          className="relative z-10 mt-4 flex rounded-2xl border border-white/[0.06] bg-black/40 p-1"
          role="tablist"
          aria-label={t('coin_shop.currency_toggle_aria')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={currency === 'AZN'}
            onClick={() => setCurrency('AZN')}
            className={[
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold transition-all',
              currency === 'AZN'
                ? 'bg-gradient-to-r from-sky-500/85 to-cyan-600/85 text-white shadow-md'
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
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold transition-all',
              currency === 'EUR'
                ? 'bg-gradient-to-r from-indigo-500/85 to-violet-600/85 text-white shadow-md'
                : 'text-white/70 hover:text-white',
            ].join(' ')}
          >
            <span className="tabular-nums text-inherit">EUR</span>
            <span className="text-base font-black leading-none text-inherit" aria-hidden>
              €
            </span>
          </button>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
          <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-4 text-center shadow-inner shadow-black/25">
            <div className="relative z-10 flex min-h-[6.25rem] flex-col items-center justify-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                1 ay
              </p>
              <p className="text-3xl font-bold tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {prices[0]}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                {unit === 'EUR' ? (
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
          <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-4 text-center shadow-inner shadow-black/25">
            <div className="relative z-10 flex min-h-[6.25rem] flex-col items-center justify-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                3 ay
              </p>
              <p className="text-3xl font-bold tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {prices[1]}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                {unit === 'EUR' ? (
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
          <div className="relative isolate overflow-hidden rounded-2xl border-2 border-amber-300/90 bg-gradient-to-br from-amber-500/25 via-amber-900/30 to-yellow-950/40 px-3 pb-4 pt-6 text-center shadow-[0_0_28px_rgba(234,179,8,0.22)] ring-1 ring-amber-200/40">
            <span className="absolute left-1/2 top-0 z-20 max-w-[calc(100%+4px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 px-2 py-0.5 text-[6px] font-black uppercase leading-tight tracking-wide text-stone-900 sm:text-[7px]">
              ƏN SƏRFƏLİ PLAN
            </span>
            <div className="relative z-10 flex min-h-[6.25rem] flex-col items-center justify-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                12 ay
              </p>
              <p className="text-3xl font-bold tabular-nums leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                {prices[2]}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {unit === 'EUR' ? (
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
        </div>

        {currency === 'AZN' ? (
          <div className="mt-5 rounded-[18px] border border-white/[0.1] bg-gradient-to-br from-[#141c1a] via-[#0e1412] to-[#080c0b] p-4">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/90">
              {t('coin_shop.azn_method_card')}
            </p>
            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <p className="min-w-0 flex-1 text-center font-mono text-[clamp(0.95rem,4vw,1.2rem)] font-bold tracking-[0.08em] text-white sm:text-left">
                {cardLine}
              </p>
              <button
                type="button"
                onClick={onCopyNumber}
                className="shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/25 active:scale-[0.98]"
              >
                {t('coin_shop.copy')}
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-white/48">{t('coin_shop.azn_pay_instruction')}</p>
          </div>
        ) : (
          <div className="mt-5 rounded-[18px] border border-white/[0.1] bg-gradient-to-br from-[#12182a] via-[#0e1220] to-[#080b14] p-4">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-sky-300/90">
              {t('coin_shop.eur_method_paypal')}
            </p>
            <p className="mt-3 break-all text-center font-mono text-[clamp(0.85rem,3.4vw,1rem)] font-semibold text-white">
              {paypalEmail}
            </p>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-white/48">{t('coin_shop.paypal_instruction')}</p>
            <button
              type="button"
              onClick={onPayPal}
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0070ba] via-[#003087] to-[#001c64] py-3 text-[13px] font-bold text-white shadow-[0_8px_28px_rgba(0,112,186,0.32)] transition hover:brightness-110 active:scale-[0.99]"
            >
              {t('coin_shop.paypal_cta')}
            </button>
          </div>
        )}

        <a
          href={instagramHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block w-full rounded-2xl py-4 text-center text-[14px] font-bold text-white no-underline shadow-[0_12px_40px_rgba(225,48,108,0.38)] transition hover:opacity-95 active:scale-[0.99]"
          style={{
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
          }}
          onClick={() => safeCapture('instagram_checkout_clicked')}
        >
          {t('coin_shop.instagram_receipt')}
        </a>
      </div>
    </div>
  );
}
