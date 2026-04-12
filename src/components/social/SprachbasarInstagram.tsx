import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { instagramSprachbasarUrl } from '../../lib/paymentLinks';

/** Instagram tərzi kvadrat + qradiyent (kiçik ölçüdə tanınan). */
export function InstagramBrandGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `igSprGrad-${rawId}`;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="0.35" stopColor="#e6683c" />
          <stop offset="0.55" stopColor="#dc2743" />
          <stop offset="0.75" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${gradId})`} />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="1.35" />
      <circle cx="16.85" cy="7.15" r="1.15" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}

/** Ayarlar: izləmə sətiri */
export function SettingsInstagramFollowLink() {
  const { t } = useTranslation();
  const href = instagramSprachbasarUrl();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)]/60 px-3 py-2.5 no-underline transition hover:border-fuchsia-500/25 hover:bg-[var(--artikl-surface2)] active:scale-[0.99]"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] dark:bg-white/[0.03]"
        aria-hidden
      >
        <InstagramBrandGlyph className="h-[1.15rem] w-[1.15rem] opacity-[0.92] group-hover:opacity-100" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-bold leading-snug text-artikl-heading">
          {t('settings.instagram_follow')}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-artikl-caption">
          {t('settings.instagram_follow_hint')}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-artikl-muted2 group-hover:text-artikl-text" aria-hidden>
        ↗
      </span>
    </a>
  );
}

/** Ödəniş modallarının altı: sual üçün əlaqə */
export function PaymentModalInstagramSupportLink() {
  const { t } = useTranslation();
  const href = instagramSprachbasarUrl();
  const base =
    'border-white/[0.1] bg-white/[0.04] text-white/75 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white/92';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-center text-[12px] font-medium leading-snug no-underline transition active:scale-[0.99] ${base}`}
    >
      <InstagramBrandGlyph className="h-4 w-4 shrink-0 opacity-90" />
      <span>{t('coin_shop.instagram_questions')}</span>
    </a>
  );
}
