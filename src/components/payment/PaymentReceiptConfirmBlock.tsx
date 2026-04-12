import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PayCurrency } from '../../lib/payCurrencyPreference';
import {
  isPaymentReceiptUploadConfigured,
  uploadPaymentReceipt,
  type PaymentReceiptSource,
} from '../../lib/uploadPaymentReceipt';

type Props = {
  currency: PayCurrency;
  source: PaymentReceiptSource;
  /** Modal açıq olanda true — bağlananda forma sıfırlanır */
  open: boolean;
  onUploaded?: () => void;
};

export function PaymentReceiptConfirmBlock({ currency, source, open, onUploaded }: Props) {
  const { t } = useTranslation();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploading(false);
    setErrorKey(null);
    setSent(false);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    return () => {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const onPickFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setErrorKey(null);
    if (!f) {
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!file || uploading || sent) return;
    setErrorKey(null);
    setUploading(true);
    try {
      const r = await uploadPaymentReceipt({ file, source, currency });
      if (!r.ok) {
        if (r.reason === 'not_configured') setErrorKey('coin_shop.receipt_not_configured_hint');
        else if (r.reason === 'too_large') setErrorKey('coin_shop.receipt_too_large');
        else if (r.reason === 'not_image') setErrorKey('coin_shop.receipt_not_image');
        else setErrorKey('coin_shop.receipt_error');
        return;
      }
      setSent(true);
      onUploaded?.();
    } finally {
      setUploading(false);
    }
  }, [file, uploading, sent, source, currency, onUploaded]);

  const configured = isPaymentReceiptUploadConfigured();

  if (sent) {
    return (
      <div
        className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-3 py-3 text-center shadow-inner shadow-black/20"
        role="status"
      >
        <p className="text-[12px] font-semibold leading-relaxed text-emerald-100/95">
          {t(source === 'vip_modal' ? 'coin_shop.receipt_success_vip' : 'coin_shop.receipt_success_shop')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/[0.08] pt-4">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
        {t('coin_shop.receipt_section_title')}
      </p>

      <div className="mt-3 flex flex-col items-center gap-3">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onPickFile}
        />
        <label
          htmlFor={inputId}
          className="flex w-full max-w-[280px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-400/35 bg-violet-600/15 px-4 py-3 text-[13px] font-bold text-violet-50 shadow-sm transition hover:border-violet-300/50 hover:bg-violet-600/25 active:scale-[0.99]"
        >
          <span className="inline-flex h-5 w-5 shrink-0 text-violet-200" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" stroke="currentColor" strokeWidth="1.75">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </span>
          {t('coin_shop.receipt_upload_label')}
        </label>

        {previewUrl ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 p-1.5 pr-2">
            <img
              src={previewUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-white/15"
            />
            <span className="max-w-[10rem] truncate text-[11px] font-medium text-white/70" title={file?.name}>
              {file?.name}
            </span>
          </div>
        ) : null}

        {errorKey ? (
          <p className="text-center text-[11px] font-medium leading-snug text-amber-200/90">{t(errorKey)}</p>
        ) : null}

        {!configured ? (
          <p className="text-center text-[10px] leading-relaxed text-white/45">{t('coin_shop.receipt_not_configured_hint')}</p>
        ) : null}

        <button
          type="button"
          disabled={!file || uploading || !configured}
          onClick={() => void onSubmit()}
          className="w-full max-w-[320px] rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-600/90 via-amber-500/90 to-yellow-600/90 py-3.5 text-[14px] font-bold text-stone-950 shadow-[0_8px_28px_rgba(245,158,11,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none active:scale-[0.99]"
        >
          {uploading ? t('coin_shop.receipt_uploading') : t('coin_shop.receipt_submit')}
        </button>
      </div>
    </div>
  );
}
