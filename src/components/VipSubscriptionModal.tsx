'use client';

import { useCallback, useEffect, useState } from 'react';
import posthog from 'posthog-js';

type Props = {
  open: boolean;
  onClose: () => void;
};

function safeCapture(event: string, props?: Record<string, unknown>) {
  try {
    posthog.capture(event, props);
  } catch {
    /* PostHog yüklənməyibsə və ya bloklanıbsa */
  }
}

/** m10 / kart — kopyalama üçün; .env: VITE_PAYMENT_PHONE_M10 */
function paymentPhoneDisplay(): string {
  return (import.meta.env.VITE_PAYMENT_PHONE_M10 ?? '').trim() || '+994000000000';
}

function instagramCheckoutUrl(): string {
  const direct = (import.meta.env.VITE_INSTAGRAM_CHECKOUT_URL ?? '').trim();
  if (direct) return direct;
  const u = (import.meta.env.VITE_SUPPORT_INSTAGRAM_URL ?? '').trim();
  if (u) return u;
  const h = (import.meta.env.VITE_SUPPORT_INSTAGRAM_HANDLE ?? 'artikelmatch').trim().replace(/^@/, '');
  return `https://www.instagram.com/${encodeURIComponent(h)}/`;
}

/**
 * VIP satış modalı + PostHog vörünüş hadisələri.
 * `.env`: `VITE_PAYMENT_PHONE_M10`, `VITE_INSTAGRAM_CHECKOUT_URL` (və ya köhnə `VITE_SUPPORT_*`).
 */
export function VipSubscriptionModal({ open, onClose }: Props) {
  const [copyDone, setCopyDone] = useState(false);
  const phone = paymentPhoneDisplay();

  useEffect(() => {
    if (!open) {
      setCopyDone(false);
      return;
    }
    safeCapture('payment_modal_opened');
  }, [open]);

  const onCopyNumber = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phone.replace(/\s/g, ''));
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2200);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = phone.replace(/\s/g, '');
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopyDone(true);
        window.setTimeout(() => setCopyDone(false), 2200);
      } catch {
        /* ignore */
      }
    }
    safeCapture('card_number_copied', { method: 'phone_m10' });
  }, [phone]);

  const onInstagramCheckout = useCallback(() => {
    safeCapture('instagram_checkout_clicked');
    window.open(instagramCheckoutUrl(), '_blank', 'noopener,noreferrer');
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[97] flex items-end justify-center bg-black/65 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14 backdrop-blur-md sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vip-sub-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(92dvh,640px)] w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-[28px] border border-amber-400/45 bg-gradient-to-br from-[#1f140a] via-[#16101f] to-[#0a0812] p-6 shadow-[0_0_72px_rgba(234,179,8,0.22)] will-change-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-6 right-0 h-36 w-36 rounded-full bg-yellow-500/10 blur-2xl" aria-hidden />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg text-amber-100/55 transition-colors hover:bg-white/10 hover:text-amber-50"
          aria-label="Bağla"
        >
          ✕
        </button>

        <h2
          id="vip-sub-title"
          className="pr-10 text-center font-display text-[1.35rem] font-black leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400"
        >
          Alman dilini sürətlə partlat! 🚀
        </h2>

        <ul className="mt-5 space-y-2.5 text-[14px] font-semibold leading-snug text-amber-50/95">
          <li className="flex gap-2">
            <span aria-hidden>✅</span>
            <span>Bütün səviyyələrə giriş (A2-C1)</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✅</span>
            <span>Reklamsız və limitsiz öyrənmə</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>✅</span>
            <span>Qızıl VIP statusu</span>
          </li>
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-200/70">1 Aylıq VIP</p>
            <p className="mt-1 text-xl font-black text-amber-100">3 AZN</p>
          </div>
          <div className="relative rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/20 to-yellow-600/10 p-3 text-center shadow-[0_0_24px_rgba(245,158,11,0.2)]">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-stone-900">
              Ən sərfəli
            </span>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-amber-100">3 Aylıq VIP</p>
            <p className="mt-1 text-xl font-black text-amber-50">7 AZN</p>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-amber-100/80">
          Ödənişi{' '}
          <span className="font-bold text-amber-200">m10</span> və ya{' '}
          <span className="font-bold text-amber-200">karta</span> et:
        </p>
        <button
          type="button"
          onClick={onCopyNumber}
          className="mt-2 w-full rounded-xl border border-amber-400/40 bg-amber-950/40 py-3 font-mono text-[15px] font-bold tracking-wide text-amber-100 transition-colors hover:bg-amber-900/50 active:scale-[0.99]"
        >
          {phone}
          {copyDone ? (
            <span className="mt-1 block text-[11px] font-semibold text-emerald-300">✓ Kopyalandı</span>
          ) : (
            <span className="mt-1 block text-[10px] font-medium text-amber-200/60">Kopyalamaq üçün toxun</span>
          )}
        </button>

        <button
          type="button"
          onClick={onInstagramCheckout}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_36px_rgba(139,92,246,0.35)] transition-transform active:scale-[0.99]"
        >
          Ödəniş etdim (Instagram-a yaz)
        </button>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-amber-200/35">
          Ödənişdən sonra Instagram-da yaz — VIP aktivləşdiriləcək.
        </p>
      </div>
    </div>
  );
}
