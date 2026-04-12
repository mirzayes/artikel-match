import { useTranslation } from 'react-i18next';

type AdsSoonModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Real bonus/reklam SDK qoşulana qədər — düymə yalnız məlumat modalı açır, balans dəyişmir.
 */
export function AdsSoonModal({ open, onClose }: AdsSoonModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ads-soon-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] rounded-2xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ads-soon-title" className="text-center text-base font-bold text-artikl-heading">
          {t('ads.soon_title')}
        </h2>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-artikl-text/90">
          {t('ads.soon_body')}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-bold text-white transition hover:opacity-95 active:scale-[0.99] dark:border-transparent dark:bg-[var(--artikl-accent)]"
        >
          {t('ads.close')}
        </button>
      </div>
    </div>
  );
}
