import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'theme';

function systemPrefersLight(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

function readStoredTheme(): 'light' | 'dark' {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  /* İlk açılış (Vercel daxil): saxlanılan seçim yoxdursa OS üzrə */
  return systemPrefersLight() ? 'light' : 'dark';
}

function applyDomTheme(mode: 'light' | 'dark') {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.add('dark');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', mode === 'light' ? '#ffffff' : '#0a0a0f');
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => readStoredTheme());

  useEffect(() => {
    applyDomTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);

  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] z-[105] flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] text-[var(--artikl-text)] shadow-[inset_0_1px_0_var(--artikl-player-inset)] backdrop-blur-md transition-transform active:scale-95"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
