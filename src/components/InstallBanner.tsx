import { useCallback, useEffect, useMemo, useState } from 'react';

const SHOW_DELAY_MS = 10_000;
const DISMISS_KEY = 'artikel-install-banner-dismissed';

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
}

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

/** DE bei deutscher Systemsprache, sonst AZ (optional: `artikel-install-banner-lang` in localStorage). */
function bannerLangCode(): 'de' | 'az' {
  try {
    const forced = localStorage.getItem('artikel-install-banner-lang');
    if (forced === 'de' || forced === 'az') return forced;
  } catch {
    /* ignore */
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'az';
  return lang.startsWith('de') ? 'de' : 'az';
}

const COPY = {
  az: {
    title: 'Artikel Match',
    iosBody:
      'Quraşdırmaq üçün: «Paylaş» (Share) düyməsinə toxunun, sonra «Ana ekrana əlavə et» seçin.',
    androidBtn: 'Quraşdır',
    androidFallback: 'Brauzer menyusundan tətbiqi quraşdırın (üç nöqtə / «Səhifəni quraşdır»).',
    dismiss: 'Bağla',
  },
  de: {
    title: 'Artikel Match',
    iosBody:
      'Zum Installieren auf „Teilen“ tippen und dann „Zum Home-Bildschirm“ wählen.',
    androidBtn: 'Installieren',
    androidFallback: 'Installation über das Browser-Menü (⋮ → „App installieren“).',
    dismiss: 'Schließen',
  },
} as const;

export function InstallBanner() {
  const [delayed, setDelayed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const lang = useMemo(() => bannerLangCode(), []);
  const copy = COPY[lang];

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setDelayed(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* ignore */
    } finally {
      setDeferredPrompt(null);
      dismiss();
    }
  }, [deferredPrompt, dismiss]);

  if (!delayed || dismissed || isStandaloneDisplay()) return null;

  const showIos = isIos();
  const showAndroid = isAndroid();
  /** `beforeinstallprompt` gibt es u. a. auf Android-Chrome und Desktop-Chrome, nicht auf iOS Safari. */
  const showInstallBtn = Boolean(deferredPrompt) && !showIos;

  if (!showIos && !showAndroid && !deferredPrompt) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label={copy.title}
    >
      <div
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-[22px] border border-white/14 bg-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/35"
        style={{ WebkitBackdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#1a1a2e] ring-1 ring-white/10">
            <img
              src="/pwa-192x192.png"
              alt=""
              className="h-full w-full object-cover"
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-[#0a0a0f] dark:text-white">
              {copy.title}
            </p>
            {showIos ? (
              <p className="mt-1 text-[13px] leading-snug text-[#3a3a45] dark:text-white/85">{copy.iosBody}</p>
            ) : showInstallBtn ? (
              <button
                type="button"
                onClick={() => void onInstall()}
                className="mt-2 inline-flex h-9 min-w-[7.5rem] items-center justify-center rounded-full bg-[#5b5cef] px-4 text-[14px] font-semibold text-white shadow-md transition hover:bg-[#4d4ee6] active:scale-[0.98]"
              >
                {copy.androidBtn}
              </button>
            ) : (
              <p className="mt-1 text-[13px] leading-snug text-[#3a3a45] dark:text-white/80">
                {copy.androidFallback}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full px-2 py-1 text-[13px] font-medium text-[#5b5cef] dark:text-[#a8a8ff]"
          >
            {copy.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
