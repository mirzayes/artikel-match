import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { NounTranslationLang } from '../types';
import { GLOSS_LANG_STORAGE_KEY } from '../lib/nounTranslation';

const GLOSS_CHANGE_EVENT = 'artikel-gloss-lang-change';

type GlossLanguageContextValue = {
  glossLang: NounTranslationLang;
  setGlossLang: (lang: NounTranslationLang) => void;
  remoteGlossById: Readonly<Record<string, string>> | null;
  remoteGlossReady: boolean;
};

const GlossLanguageContext = createContext<GlossLanguageContextValue | null>(null);

function syncAzToStorage(): void {
  try {
    localStorage.setItem(GLOSS_LANG_STORAGE_KEY, 'az');
  } catch {
    /* ignore */
  }
}

export function GlossLanguageProvider({ children }: { children: ReactNode }) {
  const [glossLang] = useState<NounTranslationLang>('az');

  useEffect(() => {
    syncAzToStorage();
  }, []);

  const setGlossLang = useCallback((_next: NounTranslationLang) => {
    syncAzToStorage();
    window.dispatchEvent(new Event(GLOSS_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      glossLang,
      setGlossLang,
      remoteGlossById: null,
      remoteGlossReady: true,
    }),
    [glossLang, setGlossLang],
  );

  return <GlossLanguageContext.Provider value={value}>{children}</GlossLanguageContext.Provider>;
}

export function useGlossLanguage(): [NounTranslationLang, (lang: NounTranslationLang) => void] {
  const ctx = useContext(GlossLanguageContext);
  if (!ctx) throw new Error('useGlossLanguage: wrap app with GlossLanguageProvider');
  return [ctx.glossLang, ctx.setGlossLang];
}

export function useGlossRemote(): {
  remoteGlossById: Readonly<Record<string, string>> | null;
  remoteGlossReady: boolean;
} {
  const ctx = useContext(GlossLanguageContext);
  if (!ctx) throw new Error('useGlossRemote: wrap app with GlossLanguageProvider');
  return { remoteGlossById: ctx.remoteGlossById, remoteGlossReady: ctx.remoteGlossReady };
}
